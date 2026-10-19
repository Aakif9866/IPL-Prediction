/**
 * Batter season-runs scenario simulation and the published conformal interval.
 *
 * Statistical simulation (documented on /methodology):
 *   innings  ~ Binomial(team matches, availability)
 *   form     ~ LogNormal, mean 1, spread fitted so its 10th/90th percentiles equal the backtest's
 *              10th/90th percentile ratio of actual to predicted runs per innings (one draw per season)
 *   each innings' runs = bootstrap draw from the player's real 2023-26 IPL innings, rescaled so the
 *              draws average the model's runs-per-innings, times form and the user's form multiplier
 * Baseline settings reproduce the model's expected runs exactly in expectation.
 */
import { makeRng } from "./rng";

const Z90 = 1.2815515655446004;

export type ConformalBand = { from: number; to: number | null; q_lo: number; q_hi: number };

/** Same calculation as batting.model.conformal_interval, from the exported calibration bands. */
export function conformalInterval(p: number, bands: ConformalBand[], offset: number): [number, number] {
  const band = bands.find((b) => p >= b.from && (b.to === null || p < b.to)) ?? bands[bands.length - 1];
  return [Math.max(0, p + band.q_lo * (p + offset)), p + band.q_hi * (p + offset)];
}

export type BatterSimInput = {
  rpi: number; // model runs per innings
  recentInnings: number[];
  matches: number; // team matches available
  availability: number; // P(bats in a given match)
  formMultiplier: number; // user scenario (1 = model)
  formP10: number;
  formP90: number;
  nSims: number;
  seed: number;
};

export type BatterSimResult = {
  analyticMean: number;
  mean: number;
  p10: number;
  p50: number;
  p90: number;
  meanInnings: number;
  pAtLeast: Record<number, number>;
  histogram: { from: number; to: number; share: number }[];
};

export function formSigma(p10: number, p90: number) {
  return (Math.log(p90) - Math.log(p10)) / (2 * Z90);
}

function quantile(sorted: Float64Array, q: number) {
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function simulateBatter(input: BatterSimInput): BatterSimResult {
  const { rpi, recentInnings, matches, availability, formMultiplier, nSims } = input;
  if (recentInnings.length === 0) throw new Error("no innings history to bootstrap");
  const rng = makeRng(input.seed);
  const empMean = recentInnings.reduce((a, b) => a + b, 0) / recentInnings.length;
  const scale = empMean > 0 ? rpi / empMean : 0;
  const s = formSigma(input.formP10, input.formP90);
  const totals = new Float64Array(nSims);
  let innSum = 0;
  for (let i = 0; i < nSims; i++) {
    const form = Math.exp(s * rng.normal() - (s * s) / 2) * formMultiplier;
    let runs = 0;
    for (let m = 0; m < matches; m++) {
      if (rng.next() >= availability) continue;
      innSum++;
      runs += recentInnings[rng.int(recentInnings.length)] * scale * form;
    }
    totals[i] = runs;
  }
  const sorted = totals.slice().sort();
  const mean = totals.reduce((a, b) => a + b, 0) / nSims;
  const top = Math.max(100, Math.ceil(quantile(sorted, 0.995) / 100) * 100);
  const histogram = Array.from({ length: top / 50 }, (_, k) => ({ from: k * 50, to: (k + 1) * 50, share: 0 }));
  for (const t of totals) histogram[Math.min(histogram.length - 1, Math.floor(t / 50))].share += 1 / nSims;
  const pAtLeast: Record<number, number> = {};
  for (const thr of [300, 500, 700]) pAtLeast[thr] = totals.filter((t) => t >= thr).length / nSims;
  return {
    analyticMean: matches * availability * rpi * formMultiplier,
    mean,
    p10: quantile(sorted, 0.1),
    p50: quantile(sorted, 0.5),
    p90: quantile(sorted, 0.9),
    meanInnings: innSum / nSims,
    pAtLeast,
    histogram,
  };
}
