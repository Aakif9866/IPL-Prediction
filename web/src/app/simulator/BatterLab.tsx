"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Histogram } from "@/components/charts";
import { Card, KindBadge, Stat } from "@/components/ui";
import type { BatterSimResult } from "@/lib/batter";
import type { Batter } from "@/lib/data";
import { fix, int, pct } from "@/lib/format";

type Resp = {
  defaults: { matches: number; availability: number; form: number };
  published: { expected: number; lower: number; upper: number };
  baseline: BatterSimResult;
  scenario: BatterSimResult;
  scenarioConformal: [number, number];
  changed: string[];
};
const PRESETS = [1000, 5000, 10000];

export function BatterLab({ players, initial, formRange, teamMatches }: { players: Batter[]; initial: string; formRange: [number, number]; teamMatches: number }) {
  const [slug, setSlug] = useState(initial);
  const p = players.find((x) => x.slug === slug)!;
  const defaults = (pl: Batter) => ({ matches: 15, availability: Math.min(1, pl.expected_innings / 15), form: 1 });
  const [cfg, setCfg] = useState(defaults(p));
  const [nSims, setNSims] = useState(5000);
  const [res, setRes] = useState<Resp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const run = useCallback(async (body: object) => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/simulate/batter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal });
      const j = await r.json();
      if (!r.ok) throw new Error((j.errors ?? ["Simulation failed"]).join("; "));
      setRes(j);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setErr((e as Error).message || "Simulation failed");
    } finally {
      if (abort.current === ctl) setBusy(false);
    }
  }, []);

  useEffect(() => {
    const d = defaults(players.find((x) => x.slug === slug)!);
    setCfg(d);
    run({ slug, ...d, nSims: 5000 });
    return () => abort.current?.abort();
  }, [slug, players, run]);

  const submit = () => run({ slug, ...cfg, nSims });
  const reset = () => {
    const d = defaults(p);
    setCfg(d);
    run({ slug, ...d, nSims });
  };
  const expInn = cfg.matches * cfg.availability;
  const field = "min-h-11 w-full rounded-tl-xl rounded-br-xl border border-line bg-card px-3 text-sm text-ink";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <Card className="space-y-5 self-start">
        <label className="block space-y-1 text-sm font-medium text-ink">Batter
          <select value={slug} onChange={(e) => setSlug(e.target.value)} className={field}>
            {players.map((x) => <option key={x.slug} value={x.slug}>{x.rank}. {x.name}</option>)}
          </select>
        </label>
        <p className="text-xs text-muted">
          Model: {fix(p.expected_innings)} expected innings × {fix(p.expected_rpi)} runs per innings = {int(p.expected_runs)} runs. Innings are bootstrapped from {p.recent_innings.length} real
          IPL innings, 2023–26.
        </p>
        <label className="block text-sm">
          <span className="font-medium text-ink">Team matches: <span className="tabular">{cfg.matches}</span></span>
          <span className="block text-xs text-muted">Model: 15 (2022–26 teams averaged {teamMatches.toFixed(2)} incl. playoffs). Range 1–17.</span>
          <input type="range" min={1} max={17} step={1} value={cfg.matches} onChange={(e) => setCfg((c) => ({ ...c, matches: Number(e.target.value) }))} className="h-9 w-full" />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink">Availability: <span className="tabular">{pct(cfg.availability, 0)}</span> of matches</span>
          <span className="block text-xs text-muted">Model: {pct(defaults(p).availability, 0)}, from this batter&apos;s playing-time history. Covers injury, rest and selection.</span>
          <input type="range" min={0} max={1} step={0.01} value={cfg.availability} onChange={(e) => setCfg((c) => ({ ...c, availability: Number(e.target.value) }))} className="h-9 w-full" />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-ink">Form multiplier: ×<span className="tabular">{cfg.form.toFixed(2)}</span></span>
          <span className="block text-xs text-muted">
            Scales runs per innings. Range ×0.50–×1.50. Backtest: 80% of established batters landed between ×{formRange[0].toFixed(2)} and ×{formRange[1].toFixed(2)} of their prediction.
          </span>
          <input type="range" min={0.5} max={1.5} step={0.01} value={cfg.form} onChange={(e) => setCfg((c) => ({ ...c, form: Number(e.target.value) }))} className="h-9 w-full" />
        </label>
        <p className="tabular text-sm text-body">Scenario expected innings: <strong className="text-ink">{fix(expInn)}</strong></p>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-ink">Simulated seasons</legend>
          <div className="flex gap-2">
            {PRESETS.map((n) => (
              <button key={n} type="button" aria-pressed={nSims === n} onClick={() => setNSims(n)}
                className={`min-h-11 flex-1 rounded-tl-lg rounded-br-lg border text-sm font-medium transition-colors duration-150 active:scale-95 ${nSims === n ? "border-accent-line bg-accent-line text-white dark:text-black" : "border-line text-body hover:border-accent-line"}`}>
                {n.toLocaleString()}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={submit} disabled={busy} className="brand-gradient min-h-11 flex-1 rounded-tl-xl rounded-br-xl px-5 text-sm font-semibold text-white transition duration-150 hover:brightness-110 active:scale-95 disabled:opacity-60">
            {busy ? "Simulating…" : "Run scenario"}
          </button>
          <button type="button" onClick={reset} className="min-h-11 rounded-tl-xl rounded-br-xl border border-accent-line px-4 text-sm font-semibold text-accent transition-colors duration-150 hover:bg-accent-line hover:text-white active:scale-95 dark:hover:text-black">
            Reset to baseline
          </button>
        </div>
      </Card>

      <Card as="section" className="min-w-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-ink">{p.name}: baseline vs scenario</h2>
          <KindBadge kind="scenario" />
        </div>
        {err && <p role="alert" className="rounded-tl-xl rounded-br-xl border border-warn p-3 text-sm text-warn">Simulation failed: {err}.</p>}
        {!res && !err && <p className="text-sm text-muted">Running the baseline…</p>}
        {res && (
          <div className={`space-y-5 transition-opacity duration-200 ${busy ? "opacity-50" : ""}`} aria-live="polite">
            <p className="text-sm text-muted">{res.changed.length ? <>Changed: <span className="text-ink">{res.changed.join(" · ")}</span></> : "No assumptions changed. Scenario equals baseline."}</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="Published model" value={int(res.published.expected)} hint={`80% interval ${int(res.published.lower)}–${int(res.published.upper)}`} />
              <Stat label="Baseline simulation" value={int(res.baseline.mean)} hint={`10th–90th pct ${int(res.baseline.p10)}–${int(res.baseline.p90)}`} />
              <Stat label="Your scenario" value={<span className="text-warn">{int(res.scenario.mean)}</span>} hint={`10th–90th pct ${int(res.scenario.p10)}–${int(res.scenario.p90)}`} />
            </div>
            <Histogram a={res.baseline.histogram} b={res.scenario.histogram} labelA="Baseline" labelB="Scenario" label={`Distribution of simulated season runs for ${p.name}`} />
            <div className="overflow-x-auto">
              <table className="tabular w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-muted"><tr><th className="py-1.5 font-medium">Simulated</th><th className="pl-3 text-right font-medium">Baseline</th><th className="pl-3 text-right font-medium">Scenario</th></tr></thead>
                <tbody>
                  {[
                    ["Expected runs (exact)", int(res.baseline.analyticMean), int(res.scenario.analyticMean)],
                    ["Median runs", int(res.baseline.p50), int(res.scenario.p50)],
                    ["Mean innings", fix(res.baseline.meanInnings), fix(res.scenario.meanInnings)],
                    ...[300, 500, 700].map((t) => [`P(≥ ${t} runs)`, pct(res.baseline.pAtLeast[t]), pct(res.scenario.pAtLeast[t])]),
                    ["Model-calibrated 80% interval", `${int(res.published.lower)}–${int(res.published.upper)}`, `${int(res.scenarioConformal[0])}–${int(res.scenarioConformal[1])}`],
                  ].map(([k, a, b]) => (
                    <tr key={k} className="border-t border-line"><th scope="row" className="py-2 text-left font-normal text-muted">{k}</th><td className="whitespace-nowrap pl-3 text-right">{a}</td><td className="whitespace-nowrap pl-3 text-right font-semibold text-ink">{b}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs leading-relaxed text-muted">
              How it works: innings ~ Binomial(matches, availability); one season form factor ~ LogNormal (mean 1, spread fitted to the
              backtest&apos;s 10th–90th percentile form ratio) × your multiplier; each innings&apos; runs are resampled from this batter&apos;s real
              2023–26 innings, rescaled to the model&apos;s runs per innings. The model-calibrated interval applies the published conformal
              bands to the scenario&apos;s expected runs. The published forecast is never changed.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
