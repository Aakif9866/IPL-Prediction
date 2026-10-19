"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { IntervalBar } from "@/components/charts";
import { ButtonLink, Card, ConfidenceBadge } from "@/components/ui";
import type { Batter } from "@/lib/data";
import { fix, int } from "@/lib/format";

type SortKey = "expected_runs" | "lower_80" | "upper_80" | "expected_innings" | "expected_average" | "expected_sr" | "name";
const COLS: { key: SortKey; label: string }[] = [
  { key: "expected_runs", label: "Expected runs" },
  { key: "lower_80", label: "Low" },
  { key: "upper_80", label: "High" },
  { key: "expected_innings", label: "Innings" },
  { key: "expected_average", label: "Average" },
  { key: "expected_sr", label: "Strike rate" },
];
const MAX_COMPARE = 4;

export function BattersExplorer({ players }: { players: Batter[] }) {
  const [q, setQ] = useState("");
  const [team, setTeam] = useState("all");
  const [role, setRole] = useState("all");
  const [conf, setConf] = useState("all");
  const [minRuns, setMinRuns] = useState(0);
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "expected_runs", desc: true });
  const [picked, setPicked] = useState<string[]>([]);
  const teams = useMemo(() => [...new Set(players.map((p) => p.team_2026))].sort(), [players]);
  const roles = useMemo(() => [...new Set(players.map((p) => p.role))], [players]);
  const maxUpper = Math.max(...players.map((p) => p.upper_80));
  const runsCeil = Math.ceil(Math.max(...players.map((p) => p.expected_runs)) / 50) * 50;

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const r = players.filter(
      (p) =>
        (!needle || p.name.toLowerCase().includes(needle) || p.dataset_name.toLowerCase().includes(needle)) &&
        (team === "all" || p.team_2026 === team) &&
        (role === "all" || p.role === role) &&
        (conf === "all" || p.confidence === conf) &&
        p.expected_runs >= minRuns,
    );
    const k = sort.key;
    return r.sort((a, b) => (k === "name" ? a.name.localeCompare(b.name) : (a[k] as number) - (b[k] as number)) * (sort.desc ? -1 : 1));
  }, [players, q, team, role, conf, minRuns, sort]);

  const toggleSort = (key: SortKey) => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== "name" }));
  const togglePick = (slug: string) =>
    setPicked((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : p.length < MAX_COMPARE ? [...p, slug] : p));
  const reset = () => (setQ(""), setTeam("all"), setRole("all"), setConf("all"), setMinRuns(0));
  const select = "min-h-11 w-full rounded-tl-xl rounded-br-xl border border-line bg-card px-3 text-sm text-ink";

  return (
    <div className="space-y-5">
      <Card className="!p-4">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.3fr]" onSubmit={(e) => e.preventDefault()} aria-label="Filter batters">
          <label className="space-y-1 text-xs font-medium text-muted">Search
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. Kohli" className={select} />
          </label>
          <label className="space-y-1 text-xs font-medium text-muted">2026 team (data)
            <select value={team} onChange={(e) => setTeam(e.target.value)} className={select}>
              <option value="all">All teams</option>
              {teams.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted">Batting role
            <select value={role} onChange={(e) => setRole(e.target.value)} className={select}>
              <option value="all">All roles</option>
              {roles.map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted">Confidence
            <select value={conf} onChange={(e) => setConf(e.target.value)} className={select}>
              <option value="all">Any</option>
              {["High", "Medium", "Low"].map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted">
            Min expected runs: <span className="tabular text-ink">{minRuns}</span>
            <input type="range" min={0} max={runsCeil} step={25} value={minRuns} onChange={(e) => setMinRuns(Number(e.target.value))} className="h-11 w-full" />
          </label>
        </form>
        <p className="mt-2 text-xs text-muted" aria-live="polite">
          {shown.length} of {players.length} batters shown. Team = the side batted for in the 2026 data; 2027 teams are not confirmed. Role comes from weighted batting position, 2024–26.
        </p>
      </Card>

      {shown.length === 0 ? (
        <Card className="text-center">
          <p className="font-medium text-ink">No batters match these filters.</p>
          <button type="button" onClick={reset} className="mt-3 min-h-11 text-sm font-semibold text-accent hover:underline">Clear filters</button>
        </Card>
      ) : (
        <>
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Batter forecasts, sortable</caption>
              <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="w-10 px-2 py-2 font-medium"><span className="sr-only">Compare</span></th>
                  <th scope="col" className="px-2 py-2 font-medium">#</th>
                  <th scope="col" aria-sort={sort.key === "name" ? (sort.desc ? "descending" : "ascending") : "none"} className="px-2 py-2 font-medium">
                    <button type="button" onClick={() => toggleSort("name")} className="min-h-9 uppercase hover:text-ink">Batter{sort.key === "name" ? (sort.desc ? " ↓" : " ↑") : ""}</button>
                  </th>
                  {COLS.map((c) => (
                    <th key={c.key} scope="col" aria-sort={sort.key === c.key ? (sort.desc ? "descending" : "ascending") : "none"} className="px-2 py-2 text-right font-medium">
                      <button type="button" onClick={() => toggleSort(c.key)} className="min-h-9 uppercase hover:text-ink">{c.label}{sort.key === c.key ? (sort.desc ? " ↓" : " ↑") : ""}</button>
                    </th>
                  ))}
                  <th scope="col" className="w-44 px-2 py-2 font-medium">80% interval</th>
                  <th scope="col" className="px-2 py-2 font-medium">Confidence</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {shown.map((p) => (
                  <tr key={p.slug} className="border-b border-line transition-colors duration-150 hover:bg-card">
                    <td className="px-2 py-2">
                      <input type="checkbox" aria-label={`Compare ${p.name}`} checked={picked.includes(p.slug)} disabled={!picked.includes(p.slug) && picked.length >= MAX_COMPARE} onChange={() => togglePick(p.slug)} className="size-4 accent-teal-600" />
                    </td>
                    <td className="px-2 py-2 text-muted">{p.rank}</td>
                    <th scope="row" className="px-2 py-2 font-medium">
                      <Link href={`/batters/${p.slug}`} className="flex items-center gap-2 text-ink hover:text-accent hover:underline">
                        <span aria-hidden className="team-dot size-2.5 rounded-full" style={{ background: p.team_color }} />{p.name}
                        <span className="text-xs font-normal text-muted">{p.team_2026} · {p.role}</span>
                      </Link>
                    </th>
                    <td className="px-2 py-2 text-right font-semibold text-ink">{int(p.expected_runs)}</td>
                    <td className="px-2 py-2 text-right">{int(p.lower_80)}</td>
                    <td className="px-2 py-2 text-right">{int(p.upper_80)}</td>
                    <td className="px-2 py-2 text-right">{fix(p.expected_innings)}</td>
                    <td className="px-2 py-2 text-right">{fix(p.expected_average)}</td>
                    <td className="px-2 py-2 text-right">{fix(p.expected_sr)}</td>
                    <td className="px-2 py-2"><IntervalBar lo={p.lower_80} mid={p.expected_runs} hi={p.upper_80} max={maxUpper} /></td>
                    <td className="px-2 py-2"><ConfidenceBadge level={p.confidence} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <label className="text-xs font-medium text-muted" htmlFor="sort-m">Sort by</label>
            <select id="sort-m" value={sort.key} onChange={(e) => setSort({ key: e.target.value as SortKey, desc: e.target.value !== "name" })} className="min-h-11 rounded-tl-xl rounded-br-xl border border-line bg-card px-3 text-sm text-ink">
              {[...COLS, { key: "name" as SortKey, label: "Name" }].map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:hidden">
            {shown.map((p) => (
              <li key={p.slug}>
                <Card className="!p-4">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/batters/${p.slug}`} className="min-w-0 font-semibold text-ink hover:text-accent">
                      <span className="text-muted">{p.rank}. </span>{p.name}
                      <span className="block text-xs font-normal text-muted">{p.team_2026} · {p.role}</span>
                    </Link>
                    <label className="flex min-h-11 items-center gap-1.5 text-xs text-muted">
                      <input type="checkbox" checked={picked.includes(p.slug)} disabled={!picked.includes(p.slug) && picked.length >= MAX_COMPARE} onChange={() => togglePick(p.slug)} className="size-4 accent-teal-600" />
                      Compare
                    </label>
                  </div>
                  <p className="tabular mt-2 text-2xl font-semibold text-ink">{int(p.expected_runs)} <span className="text-sm font-normal text-muted">runs · {int(p.lower_80)}–{int(p.upper_80)}</span></p>
                  <div className="mt-2"><IntervalBar lo={p.lower_80} mid={p.expected_runs} hi={p.upper_80} max={maxUpper} /></div>
                  <dl className="tabular mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div><dt className="text-xs text-muted">Innings</dt><dd>{fix(p.expected_innings)}</dd></div>
                    <div><dt className="text-xs text-muted">Average</dt><dd>{fix(p.expected_average)}</dd></div>
                    <div><dt className="text-xs text-muted">SR</dt><dd>{fix(p.expected_sr)}</dd></div>
                  </dl>
                  <div className="mt-2"><ConfidenceBadge level={p.confidence} /></div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      {picked.length > 0 && (
        <div role="region" aria-label="Comparison tray" className="sticky bottom-4 z-30 mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-tl-2xl rounded-br-2xl border border-line bg-pop p-3 shadow-lg">
          <p className="text-sm text-body">
            {picked.length} selected{picked.length < 2 ? ". Pick at least one more" : ""} (max {MAX_COMPARE}):{" "}
            <span className="text-ink">{picked.map((s) => players.find((p) => p.slug === s)?.name).join(", ")}</span>
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPicked([])} className="min-h-11 px-3 text-sm text-muted hover:text-ink">Clear</button>
            {picked.length >= 2 && <ButtonLink href={`/batters/compare?p=${picked.join(",")}`} variant="primary">Compare</ButtonLink>}
          </div>
        </div>
      )}
    </div>
  );
}
