/**
 * Monte Carlo IPL season simulator — a TypeScript port of iplpred/simulate.py.
 *
 * Per simulated season: draw (shrink, tau) from the fitted posterior, draw team strengths
 * theta = base + shrink * (start - base) + offset + N(0, tau^2), draw the 2022-26 group format at
 * random, play 70 league matches (latent margin = logit(p) + Logistic noise; summed margins are the
 * NRR tie-breaker), then Qualifier 1 / Eliminator / Qualifier 2 / Final at neutral venues.
 */
import { makeRng, type Rng } from "./rng";

export const LN10_400 = Math.log(10) / 400;

export type PosteriorPoint = { shrink: number; tau: number; weight: number };
export type Fixture = [a: number, b: number, home: 1 | -1];

export type TournamentInput = {
  start: number[]; // season-start Elo per team (already regressed across the season boundary)
  base: number;
  posterior: PosteriorPoint[];
  homeAdv: number;
  offsets?: number[]; // user scenario: Elo points added to each team's strength
  tauOverride?: number | null; // user scenario: fixed strength uncertainty instead of the posterior's tau
  nSims: number;
  seed: number;
};

export type TournamentResult = {
  nSims: number;
  playoffs: number[];
  final: number[];
  champion: number[];
  expPoints: number[];
};

/** Same construction as ipl_group_fixtures(): two random groups; own group + counterpart home and away, rest once. */
export function groupFixtures(nTeams: number, rng: Rng): Fixture[] {
  if (nTeams % 2 !== 0) throw new Error("group format needs an even number of teams");
  const p = Array.from({ length: nTeams }, (_, i) => i);
  for (let i = nTeams - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  const half = nTeams / 2;
  const ga = p.slice(0, half);
  const gb = p.slice(half);
  const double: [number, number][] = [];
  for (const g of [ga, gb]) for (let i = 0; i < half; i++) for (let j = i + 1; j < half; j++) double.push([g[i], g[j]]);
  for (let i = 0; i < half; i++) double.push([ga[i], gb[i]]);
  const out: Fixture[] = [];
  for (const [x, y] of double) out.push([x, y, 1], [x, y, -1]);
  for (let i = 0; i < half; i++)
    for (let j = 0; j < half; j++) if (i !== j) out.push([ga[i], gb[j], rng.next() < 0.5 ? 1 : -1]);
  return out;
}

function samplePosterior(post: PosteriorPoint[], cum: number[], rng: Rng): PosteriorPoint {
  const u = rng.next() * cum[cum.length - 1];
  let lo = 0;
  while (cum[lo] < u) lo++;
  return post[lo];
}

export function simulateTournament(input: TournamentInput): TournamentResult {
  const { start, base, posterior, homeAdv, nSims } = input;
  const n = start.length;
  const offsets = input.offsets ?? new Array(n).fill(0);
  const rng = makeRng(input.seed);
  const cum: number[] = [];
  posterior.reduce((s, p, i) => (cum[i] = s + p.weight), 0);
  const playoffs = new Array(n).fill(0);
  const final = new Array(n).fill(0);
  const champion = new Array(n).fill(0);
  const points = new Array(n).fill(0);
  const theta = new Array<number>(n);
  const pts = new Array<number>(n);
  const nrr = new Array<number>(n);
  const idx = Array.from({ length: n }, (_, i) => i);

  const play = (x: number, y: number) => {
    const p = 1 / (1 + Math.exp(-(theta[x] - theta[y]) * LN10_400));
    return rng.next() < p ? [x, y] : [y, x];
  };

  for (let s = 0; s < nSims; s++) {
    const pp = samplePosterior(posterior, cum, rng);
    const tau = input.tauOverride ?? pp.tau;
    for (let i = 0; i < n; i++) {
      theta[i] = base + pp.shrink * (start[i] - base) + offsets[i] + tau * rng.normal();
      pts[i] = 0;
      nrr[i] = 0;
    }
    for (const [a, b, h] of groupFixtures(n, rng)) {
      const margin = (theta[a] - theta[b] + h * homeAdv) * LN10_400 + rng.logistic();
      if (margin > 0) pts[a] += 2;
      else pts[b] += 2;
      nrr[a] += margin;
      nrr[b] -= margin;
    }
    idx.sort((i, j) => pts[j] * 1000 + nrr[j] - (pts[i] * 1000 + nrr[i]));
    const [s1, s2, s3, s4] = idx;
    const [w1, l1] = play(s1, s2);
    const [we] = play(s3, s4);
    const [w2] = play(l1, we);
    const [champ] = play(w1, w2);
    for (const t of [s1, s2, s3, s4]) playoffs[t]++;
    final[w1]++;
    final[w2]++;
    champion[champ]++;
    for (let i = 0; i < n; i++) points[i] += pts[i];
  }
  const f = (a: number[]) => a.map((v) => v / nSims);
  return { nSims, playoffs: f(playoffs), final: f(final), champion: f(champion), expPoints: f(points) };
}
