/** Scenario services shared by the API routes (and tests). Baselines are never mutated. */
import { batters, champion, playerBySlug, simTeams } from "./data";
import { conformalInterval, simulateBatter } from "./batter";
import { simulateTournament } from "./tournament";
import type { BatterRequest, TournamentRequest } from "./validate";

export function runTournamentScenario(req: TournamentRequest) {
  const common = {
    start: simTeams.map((t) => t.start_2027),
    base: champion.meta.base,
    posterior: champion.posterior,
    nSims: req.nSims,
    seed: req.seed,
  };
  // Same seed and run count for both, so differences reflect the scenario rather than Monte Carlo noise.
  const baseline = simulateTournament({ ...common, homeAdv: champion.meta.elo.home });
  const scenario = simulateTournament({
    ...common,
    homeAdv: req.homeAdv ?? champion.meta.elo.home,
    offsets: simTeams.map((t) => req.offsets[t.code] ?? 0),
    tauOverride: req.tau,
  });
  const rows = (r: typeof baseline) =>
    simTeams.map((t, i) => ({ code: t.code, playoffs: r.playoffs[i], final: r.final[i], champion: r.champion[i], expPoints: r.expPoints[i] }));
  return { nSims: req.nSims, seed: req.seed, baseline: rows(baseline), scenario: rows(scenario) };
}

export function batterDefaults(slug: string) {
  const p = playerBySlug(slug);
  if (!p) throw new Error(`unknown batter ${slug}`);
  const matches = 15; // 2022-26 average is 14.65 team matches incl. playoffs; 15 Bernoulli trials keep the mean exact
  return { matches, availability: Math.min(1, p.expected_innings / matches), form: 1 };
}

export function runBatterScenario(req: BatterRequest) {
  const p = playerBySlug(req.slug);
  if (!p) throw new Error(`unknown batter ${req.slug}`);
  const [p10, p90] = batters.meta.form_ratio_p10_p90;
  const common = { rpi: p.expected_rpi, recentInnings: p.recent_innings, formP10: p10, formP90: p90, nSims: req.nSims, seed: req.seed };
  const d = batterDefaults(req.slug);
  const baseline = simulateBatter({ ...common, matches: d.matches, availability: d.availability, formMultiplier: 1 });
  const scenario = simulateBatter({ ...common, matches: req.matches, availability: req.availability, formMultiplier: req.form });
  const { bands, offset } = batters.meta.conformal;
  return {
    slug: p.slug,
    defaults: d,
    published: { expected: p.expected_runs, lower: p.lower_80, upper: p.upper_80 },
    baseline,
    scenario,
    scenarioConformal: conformalInterval(scenario.analyticMean, bands, offset),
    changed: [
      req.matches !== d.matches && `team matches ${d.matches} → ${req.matches}`,
      Math.abs(req.availability - d.availability) > 1e-9 &&
        `availability ${(100 * d.availability).toFixed(0)}% → ${(100 * req.availability).toFixed(0)}%`,
      req.form !== 1 && `form multiplier ×1.00 → ×${req.form.toFixed(2)}`,
    ].filter(Boolean) as string[],
  };
}
