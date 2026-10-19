"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SeasonBars } from "@/components/charts";
import { Card, ConfidenceBadge } from "@/components/ui";
import type { Batter } from "@/lib/data";
import { fix, int } from "@/lib/format";

const ROWS: { label: string; get: (p: Batter) => string }[] = [
  { label: "Expected runs", get: (p) => int(p.expected_runs) },
  { label: "80% interval", get: (p) => `${int(p.lower_80)}–${int(p.upper_80)}` },
  { label: "Expected innings", get: (p) => fix(p.expected_innings) },
  { label: "Runs per innings", get: (p) => fix(p.expected_rpi) },
  { label: "Average", get: (p) => fix(p.expected_average) },
  { label: "Strike rate", get: (p) => fix(p.expected_sr) },
  { label: "Role (data)", get: (p) => p.role },
  { label: "2026 team (data)", get: (p) => p.team_2026 },
  { label: "Career IPL runs (data)", get: (p) => int(p.history.reduce((s, h) => s + h.runs, 0)) },
];

export function Compare({ players, partial }: { players: Batter[]; partial: number }) {
  const slugs = (useSearchParams().get("p") ?? "").split(",").filter(Boolean);
  const sel = slugs.map((s) => players.find((p) => p.slug === s)).filter((p): p is Batter => !!p).slice(0, 4);
  if (sel.length < 2)
    return (
      <Card className="text-center">
        <p className="font-medium text-ink">Pick at least two batters to compare.</p>
        <p className="mt-1 text-sm text-muted">Tick the compare boxes in the batter table, then press Compare.</p>
        <Link href="/batters" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">Go to batter table</Link>
      </Card>
    );
  const from = Math.min(...sel.map((p) => p.history[0].season), 2018);
  const yMax = Math.max(...sel.flatMap((p) => [p.upper_80, ...p.history.map((h) => h.runs)])) * 1.05;
  return (
    <div className="space-y-6">
      <Card className="overflow-x-auto !p-0">
        <table className="tabular w-full min-w-[36rem] text-sm">
          <caption className="sr-only">Side-by-side forecast comparison</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="p-3 text-left text-xs font-medium uppercase tracking-wide text-muted">Metric</th>
              {sel.map((p) => (
                <th key={p.slug} scope="col" className="p-3 text-left">
                  <Link href={`/batters/${p.slug}`} className="flex items-center gap-2 font-semibold text-ink hover:text-accent">
                    <span aria-hidden className="team-dot size-2.5 rounded-full" style={{ background: p.team_color }} />{p.name}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.label} className="border-b border-line last:border-0">
                <th scope="row" className="p-3 text-left font-normal text-muted">{r.label}</th>
                {sel.map((p) => <td key={p.slug} className="p-3 text-ink">{r.get(p)}</td>)}
              </tr>
            ))}
            <tr>
              <th scope="row" className="p-3 text-left font-normal text-muted">Confidence</th>
              {sel.map((p) => <td key={p.slug} className="p-3"><ConfidenceBadge level={p.confidence} /></td>)}
            </tr>
          </tbody>
        </table>
      </Card>
      <div>
        <h2 className="mb-1 text-lg font-semibold text-ink">Season runs, {from}–2027</h2>
        <p className="mb-3 text-sm text-muted">Small multiples on a shared scale. Light bar = {partial} (partial season); orange = 2027 estimate with 80% interval.</p>
        <ul className="grid gap-4 sm:grid-cols-2">
          {sel.map((p) => (
            <li key={p.slug}>
              <Card className="!p-4">
                <p className="mb-1 text-sm font-semibold text-ink">{p.name}</p>
                <SeasonBars compact maxY={yMax}
                  seasons={p.history.filter((h) => h.season >= from).map((h) => ({ season: h.season, runs: h.runs, innings: h.innings, balls: h.balls, partial: h.season === partial }))}
                  forecast={{ season: 2027, mid: p.expected_runs, lo: p.lower_80, hi: p.upper_80 }}
                  label={`${p.name} runs by season and 2027 forecast`} />
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
