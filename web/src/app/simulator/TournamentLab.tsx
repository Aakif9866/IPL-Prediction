"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, KindBadge } from "@/components/ui";
import type { Team } from "@/lib/data";
import { fix, pct, signed } from "@/lib/format";

type Row = { code: string; playoffs: number; final: number; champion: number; expPoints: number };
type Resp = { nSims: number; seed: number; baseline: Row[]; scenario: Row[]; ms: number };
const PRESETS = [1000, 5000, 10000];
const ORANGE = "#eb6834";
const winVsAverage = (elo: number) => 1 / (1 + 10 ** (-elo / 400));

export function TournamentLab({ teams, homeDefault }: { teams: Team[]; homeDefault: number }) {
  const zero = Object.fromEntries(teams.map((t) => [t.code, 0]));
  const [offsets, setOffsets] = useState<Record<string, number>>(zero);
  const [tauMode, setTauMode] = useState<"posterior" | "fixed">("posterior");
  const [tau, setTau] = useState(50);
  const [home, setHome] = useState(homeDefault);
  const [nSims, setNSims] = useState(5000);
  const [res, setRes] = useState<Resp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const changed = [
    ...teams.filter((t) => offsets[t.code] !== 0).map((t) => `${t.code} strength ${signed(offsets[t.code], 0)} Elo`),
    tauMode === "fixed" && `strength uncertainty fixed at τ = ${tau} (model: posterior)`,
    home !== homeDefault && `home advantage ${homeDefault} → ${home} Elo`,
  ].filter(Boolean) as string[];

  const run = useCallback(async (body: object) => {
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/simulate/tournament", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal });
      const j = await r.json();
      if (!r.ok) throw new Error((j.errors ?? ["Simulation failed"]).join("; "));
      setRes(j);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setErr((e as Error).message || "Simulation failed");
    } finally {
      if (abort.current === ctl) setBusy(false);
    }
  }, []);

  const submit = () => run({ nSims, offsets, tau: tauMode === "fixed" ? tau : null, homeAdv: home });
  const reset = () => {
    setOffsets(zero);
    setTauMode("posterior");
    setTau(50);
    setHome(homeDefault);
    run({ nSims, offsets: {}, tau: null, homeAdv: homeDefault });
  };
  useEffect(() => {
    run({ nSims: 5000, offsets: {}, tau: null, homeAdv: homeDefault });
    return () => abort.current?.abort();
  }, [run, homeDefault]);

  const byCode = (rows: Row[] | undefined) => Object.fromEntries((rows ?? []).map((r) => [r.code, r]));
  const b = byCode(res?.baseline), s = byCode(res?.scenario);
  const ordered = res ? [...teams].sort((x, y) => s[y.code].champion - s[x.code].champion) : [];
  const baseRank = res ? Object.fromEntries([...teams].sort((x, y) => b[y.code].champion - b[x.code].champion).map((t, i) => [t.code, i + 1])) : {};
  const max = res ? Math.max(...teams.flatMap((t) => [b[t.code].champion, s[t.code].champion])) * 1.1 : 1;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <Card className="space-y-5 self-start">
        <div>
          <h2 className="text-lg font-semibold text-ink">Scenario assumptions</h2>
          <p className="text-sm text-muted">Each run draws team strengths, a random group format and every match. The baseline uses the published model settings.</p>
        </div>
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
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-ink">Team strength adjustment (Elo points)</legend>
          <p className="text-xs text-muted">Applied on top of the model’s 2027 rating. +100 Elo ≈ {pct(winVsAverage(100), 0)} win chance against an average team, instead of 50%. Range ±150.</p>
          {teams.map((t) => (
            <label key={t.code} className="grid grid-cols-[3rem_1fr_3.5rem] items-center gap-2 text-sm">
              <span className="flex items-center gap-1.5 font-medium text-ink"><span aria-hidden className="team-dot size-2 rounded-full" style={{ background: t.color }} />{t.code}</span>
              <input type="range" min={-150} max={150} step={10} value={offsets[t.code]} aria-label={`${t.name} strength adjustment`}
                onChange={(e) => setOffsets((o) => ({ ...o, [t.code]: Number(e.target.value) }))} className="h-9 w-full" />
              <span className={`tabular text-right ${offsets[t.code] ? "font-semibold text-warn" : "text-muted"}`}>{signed(offsets[t.code], 0)}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">Strength uncertainty</legend>
          {(["posterior", "fixed"] as const).map((m) => (
            <label key={m} className="flex min-h-9 items-center gap-2 text-sm text-body">
              <input type="radio" name="tau" checked={tauMode === m} onChange={() => setTauMode(m)} className="accent-teal-600" />
              {m === "posterior" ? "Model posterior (fitted on 2010–2026)" : "Fixed τ (Elo standard deviation)"}
            </label>
          ))}
          {tauMode === "fixed" && (
            <label className="block text-sm">
              <span className="text-muted">τ = <span className="tabular text-ink">{tau}</span> (0–200; more = flatter odds)</span>
              <input type="range" min={0} max={200} step={10} value={tau} onChange={(e) => setTau(Number(e.target.value))} className="h-9 w-full" />
            </label>
          )}
        </fieldset>
        <label className="block text-sm">
          <span className="font-medium text-ink">Home advantage: <span className="tabular">{home}</span> Elo</span>
          <span className="block text-xs text-muted">Model: {homeDefault}. Range 0–60.</span>
          <input type="range" min={0} max={60} step={5} value={home} onChange={(e) => setHome(Number(e.target.value))} className="h-9 w-full" />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={submit} disabled={busy} className="brand-gradient min-h-11 flex-1 rounded-tl-xl rounded-br-xl px-5 text-sm font-semibold text-white transition duration-150 hover:brightness-110 active:scale-95 disabled:opacity-60">
            {busy ? "Simulating…" : `Run ${nSims.toLocaleString()} seasons`}
          </button>
          <button type="button" onClick={reset} className="min-h-11 rounded-tl-xl rounded-br-xl border border-accent-line px-4 text-sm font-semibold text-accent transition-colors duration-150 hover:bg-accent-line hover:text-white active:scale-95 dark:hover:text-black">
            Reset to baseline
          </button>
        </div>
      </Card>

      <Card className="min-w-0 space-y-4" as="section">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-ink">Baseline vs your scenario</h2>
          <KindBadge kind="scenario" />
        </div>
        <div aria-live="polite" className="text-sm text-muted">
          {changed.length ? <>Changed: <span className="text-ink">{changed.join(" · ")}</span></> : "No assumptions changed. Scenario equals baseline."}
          {res && <> · {res.nSims.toLocaleString()} seasons per side, same random seed, {res.ms} ms on the server</>}
        </div>
        {err && <p role="alert" className="rounded-tl-xl rounded-br-xl border border-warn p-3 text-sm text-warn">Simulation failed: {err}. Check the inputs and try again.</p>}
        {!res && !err && <p className="text-sm text-muted">Running the baseline…</p>}
        {res && (
          <div className={`space-y-4 transition-opacity duration-200 ${busy ? "opacity-50" : ""}`}>
            <div className="flex flex-wrap gap-4 text-xs text-body">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-series-soft" />Baseline title chance</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: ORANGE }} />Scenario title chance</span>
            </div>
            <div className="overflow-x-auto">
              <table className="tabular w-full text-sm">
                <caption className="sr-only">Simulated probabilities, baseline versus scenario</caption>
                <thead className="text-left text-xs uppercase tracking-wide text-muted">
                  <tr><th className="py-1.5 font-medium">Team</th><th className="hidden w-[40%] font-medium sm:table-cell">Title chance</th><th className="pl-2 text-right font-medium">Baseline</th><th className="pl-2 text-right font-medium">Scenario</th><th className="pl-2 text-right font-medium">Δ</th><th className="hidden pl-2 text-right font-medium sm:table-cell">Final</th><th className="hidden pl-2 text-right font-medium sm:table-cell">Top 4</th></tr>
                </thead>
                <tbody>
                  {ordered.map((t, i) => {
                    const d = s[t.code].champion - b[t.code].champion;
                    const move = baseRank[t.code] - (i + 1);
                    return (
                      <tr key={t.code} className="border-t border-line">
                        <th scope="row" className="py-2 pr-2 text-left font-medium text-ink">
                          <span className="flex items-center gap-1.5"><span aria-hidden className="team-dot size-2 rounded-full" style={{ background: t.color }} />{t.code}
                            {move !== 0 && <span className={`text-[11px] ${move > 0 ? "text-accent" : "text-warn"}`} title="Rank change vs baseline">{move > 0 ? `▲${move}` : `▼${-move}`}</span>}
                          </span>
                        </th>
                        <td className="hidden pr-3 sm:table-cell">
                          <span aria-hidden className="block space-y-0.5">
                            <span className="block h-1.5 rounded-r-[4px] bg-series-soft" style={{ width: `${(100 * b[t.code].champion) / max}%` }} />
                            <span className="block h-1.5 rounded-r-[4px]" style={{ width: `${(100 * s[t.code].champion) / max}%`, background: ORANGE }} />
                          </span>
                        </td>
                        <td className="pl-2 text-right">{pct(b[t.code].champion)}</td>
                        <td className="pl-2 text-right font-semibold text-ink">{pct(s[t.code].champion)}</td>
                        <td className={`pl-2 text-right ${Math.abs(d) < 0.005 ? "text-muted" : d > 0 ? "text-accent" : "text-warn"}`}>{signed(100 * d, 1)}</td>
                        <td className="hidden pl-2 text-right sm:table-cell">{pct(s[t.code].final)}</td>
                        <td className="hidden pl-2 text-right sm:table-cell">{pct(s[t.code].playoffs)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">
              Monte Carlo noise at this run count is about ±{fix(100 * 1.96 * Math.sqrt(0.1 * 0.9 / res.nSims), 1)} pp on a 10% probability
              (95%). Changes smaller than that may be noise. The published forecast on the Champion page uses 20,000 seasons from the Python pipeline.
              Both sides of this comparison use the same TypeScript engine, which reproduces it within Monte Carlo error.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
