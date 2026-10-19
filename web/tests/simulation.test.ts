import { describe, expect, it } from "vitest";
import { makeRng } from "@/lib/rng";
import { groupFixtures, simulateTournament } from "@/lib/tournament";
import { conformalInterval, simulateBatter } from "@/lib/batter";
import { batters, champion, simTeams } from "@/lib/data";
import { batterDefaults, runBatterScenario, runTournamentScenario } from "@/lib/scenario";
import { parseBatter, parseTournament } from "@/lib/validate";

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const baseInput = (nSims: number, seed = 1) => ({
  start: simTeams.map((t) => t.start_2027),
  base: champion.meta.base,
  posterior: champion.posterior,
  homeAdv: champion.meta.elo.home,
  nSims,
  seed,
});

describe("group fixtures", () => {
  it("matches the 2022-26 IPL format", () => {
    const fx = groupFixtures(10, makeRng(3));
    expect(fx).toHaveLength(70);
    const games = new Array(10).fill(0);
    fx.forEach(([a, b]) => (games[a]++, games[b]++));
    expect(new Set(games)).toEqual(new Set([14]));
    for (let t = 0; t < 10; t++) {
      const opp = new Map<number, number>();
      fx.forEach(([a, b]) => {
        if (a === t) opp.set(b, (opp.get(b) ?? 0) + 1);
        if (b === t) opp.set(a, (opp.get(a) ?? 0) + 1);
      });
      expect([...opp.values()].sort()).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 2]);
    }
  });
});

describe("tournament simulator", () => {
  it("produces coherent probabilities", () => {
    const r = simulateTournament(baseInput(3000));
    expect(sum(r.champion)).toBeCloseTo(1, 10);
    expect(sum(r.final)).toBeCloseTo(2, 10);
    expect(sum(r.playoffs)).toBeCloseTo(4, 10);
    expect(sum(r.expPoints)).toBeCloseTo(140, 8);
    r.champion.forEach((c, i) => expect(c).toBeLessThanOrEqual(r.final[i]));
  });

  it("is deterministic for a seed", () => {
    expect(simulateTournament(baseInput(500, 9))).toEqual(simulateTournament(baseInput(500, 9)));
  });

  it("reproduces the published Python forecast within Monte Carlo error", () => {
    const r = simulateTournament(baseInput(40_000, 11));
    simTeams.forEach((t, i) => {
      // Python: 20,000 sims; TS: 40,000. Combined s.e. for p≈0.1 is ~0.26pp, so 1.2pp is ~4.5 s.e.
      expect(Math.abs(r.champion[i] - t.p_champion)).toBeLessThan(0.012);
      expect(Math.abs(r.playoffs[i] - t.p_playoffs)).toBeLessThan(0.015);
      expect(Math.abs(r.final[i] - t.p_final)).toBeLessThan(0.015);
    });
  });

  it("responds to strength offsets in the right direction", () => {
    const i = simTeams.findIndex((t) => t.code === "MI");
    const offsets = simTeams.map((_, j) => (j === i ? 150 : 0));
    const boosted = simulateTournament({ ...baseInput(5000), offsets });
    const base = simulateTournament(baseInput(5000));
    expect(boosted.champion[i]).toBeGreaterThan(base.champion[i] + 0.05);
  });
});

describe("batter simulation", () => {
  const p = batters.players[0];
  const [f10, f90] = batters.meta.form_ratio_p10_p90;
  const input = { rpi: p.expected_rpi, recentInnings: p.recent_innings, formP10: f10, formP90: f90, nSims: 40_000, seed: 5 };

  it("baseline settings reproduce the model expectation", () => {
    const d = batterDefaults(p.slug);
    const r = simulateBatter({ ...input, matches: d.matches, availability: d.availability, formMultiplier: 1 });
    expect(Math.abs(r.analyticMean - p.expected_runs)).toBeLessThan(0.5); // CSV components are rounded to 2 dp
    expect(Math.abs(r.mean - p.expected_runs) / p.expected_runs).toBeLessThan(0.02);
    expect(r.meanInnings).toBeCloseTo(p.expected_innings, 0);
    expect(r.p10).toBeLessThan(r.p50);
    expect(r.p50).toBeLessThan(r.p90);
    expect(sum(r.histogram.map((h) => h.share))).toBeCloseTo(1, 8);
  });

  it("scales with innings and form", () => {
    const r = simulateBatter({ ...input, matches: 8, availability: 1, formMultiplier: 1.2 });
    expect(r.analyticMean).toBeCloseTo(8 * p.expected_rpi * 1.2, 6);
    expect(Math.abs(r.mean - r.analyticMean) / r.analyticMean).toBeLessThan(0.02);
    expect(simulateBatter({ ...input, matches: 10, availability: 0, formMultiplier: 1 }).mean).toBe(0);
  });

  it("conformal interval reproduces every published interval", () => {
    const { bands, offset } = batters.meta.conformal;
    for (const pl of batters.players) {
      const [lo, hi] = conformalInterval(pl.expected_runs, bands, offset);
      expect(lo).toBeCloseTo(pl.lower_80, 1);
      expect(hi).toBeCloseTo(pl.upper_80, 1);
    }
  });

  it("scenario service reports changed assumptions and keeps the baseline", () => {
    const r = runBatterScenario({ slug: p.slug, matches: 10, availability: 0.9, form: 1.1, nSims: 2000, seed: 1 });
    expect(r.changed).toHaveLength(3);
    expect(r.published.expected).toBe(p.expected_runs);
    expect(Math.abs(r.baseline.analyticMean - p.expected_runs)).toBeLessThan(0.5);
  });
});

describe("validation", () => {
  const codes = simTeams.map((t) => t.code);
  it("accepts a valid tournament request", () => {
    const r = parseTournament({ nSims: 5000, offsets: { RCB: -50 }, tau: 40 }, codes);
    expect(r.ok).toBe(true);
    if (r.ok) expect(runTournamentScenario(r.value).scenario).toHaveLength(10);
  });
  it.each([
    [{ nSims: 10 }, "nSims"],
    [{ nSims: 1e9 }, "nSims"],
    [{ nSims: 1000, offsets: { XYZ: 10 } }, "unknown team"],
    [{ nSims: 1000, offsets: { RCB: 999 } }, "offsets.RCB"],
    [{ nSims: 1000.5 }, "integer"],
    [{ nSims: "1000" }, "number"],
  ])("rejects %j", (body, msg) => {
    const r = parseTournament(body, codes);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toContain(msg);
  });
  it("validates batter requests", () => {
    const slugs = batters.players.map((p) => p.slug);
    expect(parseBatter({ slug: "virat-kohli", matches: 14, availability: 0.9, form: 1, nSims: 1000 }, slugs).ok).toBe(true);
    expect(parseBatter({ slug: "nobody", matches: 14, availability: 0.9, form: 1, nSims: 1000 }, slugs).ok).toBe(false);
    expect(parseBatter({ slug: "virat-kohli", matches: 40, availability: 2, form: 9, nSims: 1000 }, slugs).ok).toBe(false);
  });
});
