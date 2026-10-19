import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SeasonBars } from "@/components/charts";
import { ButtonLink, Card, ConfidenceBadge, Eyebrow, KindBadge, Stat } from "@/components/ui";
import { batters, playerBySlug, playersByRuns } from "@/lib/data";
import { fix, int, sr } from "@/lib/format";

export const dynamicParams = false;
export function generateStaticParams() {
  return batters.players.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = playerBySlug((await params).slug);
  return p ? { title: `${p.name} — 2027 forecast`, description: `${p.name}: ${int(p.expected_runs)} expected IPL 2027 runs (80% interval ${int(p.lower_80)}–${int(p.upper_80)}).` } : {};
}

const SPLITS = [["pace", "vs pace"], ["spin", "vs spin"], ["powerplay", "Powerplay (overs 1–6)"], ["middle", "Middle (7–15)"], ["death", "Death (16–20)"]] as const;

export default async function BatterPage({ params }: { params: Promise<{ slug: string }> }) {
  const p = playerBySlug((await params).slug);
  if (!p) notFound();
  const i = playersByRuns.findIndex((x) => x.slug === p.slug);
  const prev = playersByRuns[i - 1], next = playersByRuns[i + 1];
  const partial = batters.meta.partial_season;
  const seasons = p.history.map((h) => ({ season: h.season, runs: h.runs, innings: h.innings, balls: h.balls, partial: h.season === partial }));
  const a = p.analysis;
  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted"><Link href="/batters" className="hover:text-accent hover:underline">Batters</Link> / <span className="text-ink">{p.name}</span></nav>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <Eyebrow>Rank {p.rank} of {batters.players.length} by expected runs</Eyebrow>
          <h1 className="flex items-center gap-3 text-3xl font-bold text-ink lg:text-5xl">
            <span aria-hidden className="team-dot size-3.5 rounded-full" style={{ background: p.team_color }} />{p.name}
          </h1>
          <p className="text-sm text-muted">Dataset name <code className="text-body">{p.dataset_name}</code> · batted for {p.team_2026} in the 2026 data (2027 team unconfirmed) · {p.role} (weighted batting position {fix(p.batting_position_w, 1)})</p>
        </div>
        <ButtonLink href={`/simulator?mode=batter&batter=${p.slug}`} variant="primary">Simulate scenarios</ButtonLink>
      </header>

      <Card className="grid gap-6 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1fr]">
        <div className="space-y-1">
          <div className="flex items-center gap-2"><p className="text-xs font-medium uppercase tracking-wide text-muted">Expected 2027 runs</p><KindBadge kind="estimate" /></div>
          <p className="tabular text-4xl font-bold text-ink">{int(p.expected_runs)}</p>
          <p className="tabular text-sm text-muted">80% interval {int(p.lower_80)}–{int(p.upper_80)}</p>
        </div>
        <Stat label="Expected innings" value={fix(p.expected_innings)} hint={`of ~${fix(batters.meta.team_matches_2027)} team matches`} />
        <Stat label="Runs / innings" value={fix(p.expected_rpi)} />
        <Stat label="Average" value={fix(p.expected_average)} hint="runs ÷ expected dismissals" />
        <div className="space-y-1">
          <Stat label="Strike rate" value={fix(p.expected_sr)} />
          <ConfidenceBadge level={p.confidence} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-semibold text-ink">Season runs and 2027 forecast</h2><KindBadge kind="history" /></div>
          <SeasonBars seasons={seasons} forecast={{ season: 2027, mid: p.expected_runs, lo: p.lower_80, hi: p.upper_80 }} label={`${p.name} IPL runs by season with 2027 forecast`} />
          <p className="text-xs text-muted">Light bar = {partial}, partial in the data ({batters.meta.partial_season_matches} matches). Orange = 2027 estimate with its 80% interval. Seasons with no innings are not shown.</p>
        </Card>
        <Card>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold text-ink">Splits, 2024–2026</h2><KindBadge kind="history" /></div>
          <table className="tabular w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted"><tr><th className="py-1.5 font-medium">Split</th><th className="text-right font-medium">Runs</th><th className="text-right font-medium">Balls</th><th className="text-right font-medium">SR</th><th className="text-right font-medium">Outs</th></tr></thead>
            <tbody>
              {SPLITS.map(([k, label]) => {
                const s = p.splits[k];
                return (
                  <tr key={k} className="border-t border-line">
                    <th scope="row" className="py-2 text-left font-normal text-ink">{label}</th>
                    <td className="text-right">{s.runs}</td><td className="text-right">{s.balls}</td>
                    <td className="text-right">{s.balls ? fix(sr(s.runs, s.balls)) : "—"}</td><td className="text-right">{s.outs}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">Balls exclude wides. Pace and spin come from the bowler-type field; the few deliveries with no bowler type are counted as pace.</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">Analysis from the batting report</h2>
          {["Historical trend", "Recent performance", "Strengths (data-derived)", "Risk factors"].map((k) => a[k] && (
            <div key={k}><p className="text-sm font-medium text-ink">{k}</p><p className="text-sm leading-relaxed text-body">{a[k]}</p></div>
          ))}
        </Card>
        <Card className="space-y-4">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-ink">Report scenarios</h2><KindBadge kind="estimate" /></div>
          <dl className="tabular grid grid-cols-2 gap-4">
            <Stat label="Full season (14 inn)" value={int(p.scenarios.full)} />
            <Stat label="Strong form" value={int(p.scenarios.strong)} hint="90th pct form, 14 inn" />
            <Stat label="Weak form" value={int(p.scenarios.weak)} hint="10th pct form, 14 inn" />
            <Stat label="Reduced (8 inn)" value={int(p.scenarios.reduced)} />
          </dl>
          {a["Assumptions"] && <p className="text-sm text-muted"><strong className="text-ink">Assumptions:</strong> {a["Assumptions"]}</p>}
        </Card>
      </div>

      <nav aria-label="Other batters" className="flex flex-wrap justify-between gap-3 text-sm">
        {prev ? <Link className="min-h-11 text-accent hover:underline" href={`/batters/${prev.slug}`}>← {prev.rank}. {prev.name}</Link> : <span />}
        {next && <Link className="min-h-11 text-accent hover:underline" href={`/batters/${next.slug}`}>{next.rank}. {next.name} →</Link>}
      </nav>
    </div>
  );
}
