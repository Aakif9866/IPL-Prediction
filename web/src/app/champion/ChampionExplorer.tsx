"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { LineChart, ProbabilityBars } from "@/components/charts";
import { Card, KindBadge, Stat } from "@/components/ui";
import type { Team } from "@/lib/data";
import { fix, pct, signed } from "@/lib/format";

const METRICS = [
  { key: "p_champion", label: "Champion", ref: 0.1, refLabel: "uniform 10%" },
  { key: "p_final", label: "Reach final", ref: 0.2, refLabel: "uniform 20%" },
  { key: "p_playoffs", label: "Top four", ref: 0.4, refLabel: "uniform 40%" },
] as const;

function outcome2025(t: Team) {
  if (t.titles.includes(2025)) return "won the 2025 title";
  if (t.finals.includes(2025)) return "reached the 2025 final";
  if (t.playoffs.includes(2025)) return "made the 2025 playoffs";
  return "missed the 2025 playoffs";
}

export function ChampionExplorer({ teams, base, cutoff }: { teams: Team[]; base: number; cutoff: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [metric, setMetric] = useState<(typeof METRICS)[number]["key"]>("p_champion");
  const initial = teams.find((t) => t.code === params.get("team"))?.code ?? teams[0].code;
  const [sel, setSel] = useState(initial);
  const team = teams.find((t) => t.code === sel)!;
  const m = METRICS.find((x) => x.key === metric)!;
  const rows = useMemo(
    () =>
      [...teams].sort((a, b) => b[metric] - a[metric]).map((t) => ({
        code: t.code, name: t.name, color: t.color, value: t[metric],
        detail: [`Champion ${pct(t.p_champion)}`, `Final ${pct(t.p_final)}`, `Top four ${pct(t.p_playoffs)}`, `Elo ${fix(t.elo_end, 0)}`],
      })),
    [teams, metric],
  );
  const select = (code: string) => {
    setSel(code);
    router.replace(`/champion?team=${code}`, { scroll: false });
  };
  const rank = [...teams].sort((a, b) => b.p_champion - a.p_champion).findIndex((t) => t.code === sel) + 1;
  const tauKeys = Object.keys(team.tau_sensitivity);
  const factors = [
    `End-of-data Elo ${fix(team.elo_end, 0)}, ${signed(team.elo_end - base, 0)} vs the league average of ${base}. After the between-season pull toward the mean, its 2027 starting strength is ${fix(team.start_2027, 0)}.`,
    `2026 to ${cutoff}: won ${team.record_2026.won} of ${team.record_2026.played}${team.record_2026.no_result ? ` (${team.record_2026.no_result} no result)` : ""}. In 2025 it won ${team.record_2025.won} of ${team.record_2025.played} and ${outcome2025(team)}.`,
    `${team.titles.length ? `${team.titles.length} title${team.titles.length > 1 ? "s" : ""} (${team.titles.join(", ")})` : "No titles"}, ${team.finals.length} finals and ${team.playoffs.length} playoff appearances in ${team.seasons.length} seasons in the data. History only enters the forecast through the Elo rating.`,
    `Sensitivity: with no strength uncertainty (τ = 0) its title chance would be ${pct(team.tau_sensitivity[tauKeys[0]])}; with high uncertainty (τ = ${tauKeys.at(-1)?.replace("tau=", "")} Elo), ${pct(team.tau_sensitivity[tauKeys.at(-1)!])}. The forecast averages over the fitted range. More uncertainty pulls every team toward 10%.`,
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
      <Card>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Probability by team</h2>
            <p className="text-sm text-muted">Select a team to inspect it.</p>
          </div>
          <div role="tablist" aria-label="Probability shown" className="flex rounded-tl-xl rounded-br-xl border border-line p-1">
            {METRICS.map((x) => (
              <button key={x.key} role="tab" aria-selected={metric === x.key} onClick={() => setMetric(x.key)}
                className={`min-h-9 rounded-tl-lg rounded-br-lg px-3 text-sm font-medium transition-colors duration-150 ${metric === x.key ? "bg-accent-line text-white dark:text-black" : "text-muted hover:text-ink"}`}>
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <div className="pt-4">
          <ProbabilityBars rows={rows} reference={m.ref} referenceLabel={m.refLabel} selected={sel} onSelect={select} label={`${m.label} probability by team`} />
        </div>
        <p className="mt-4 text-xs text-muted">
          The gradient bar is the highest estimate. It is not a predicted winner: the leader is shown as more likely than the
          others, not as likely to win outright.
        </p>
      </Card>

      <Card as="section" className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted">Rank {rank} of {teams.length} by title chance</p>
            <h2 className="mt-1 flex items-center gap-2 text-2xl font-semibold text-ink">
              <span aria-hidden className="team-dot size-3 rounded-full" style={{ background: team.color }} />
              {team.name}
            </h2>
          </div>
          <KindBadge kind="estimate" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Champion" value={pct(team.p_champion)} />
          <Stat label="Final" value={pct(team.p_final)} />
          <Stat label="Top four" value={pct(team.p_playoffs)} />
          <Stat label="Exp. points" value={fix(team.exp_points, 1)} hint="of 28 max" />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium text-ink">Season-end Elo rating, {team.elo_history[0].season}–{team.elo_history.at(-1)!.season}</p>
          <LineChart points={team.elo_history.map((h) => ({ x: h.season, y: h.elo }))} refValue={base} refLabel="league average" label={`${team.name} season-end Elo rating by season`} />
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-ink">What drives this estimate</p>
          <ul className="space-y-2 text-sm leading-relaxed text-body">
            {factors.map((f) => (
              <li key={f} className="flex gap-2"><span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent-line" />{f}</li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
}
