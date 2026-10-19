import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { batters, champion, playersByRuns, simTeams } from "@/lib/data";
import { BatterLab } from "./BatterLab";
import { TournamentLab } from "./TournamentLab";

export const metadata: Metadata = { title: "Simulation Lab", description: "Run IPL 2027 Monte Carlo tournament and batter scenarios." };

export default async function SimulatorPage({ searchParams }: { searchParams: Promise<{ mode?: string; batter?: string }> }) {
  const sp = await searchParams;
  const mode = sp.mode === "batter" ? "batter" : "tournament";
  const initial = batters.players.some((p) => p.slug === sp.batter) ? sp.batter! : playersByRuns[0].slug;
  const tab = (m: string, label: string) => (
    <Link href={`/simulator?mode=${m}`} role="tab" aria-selected={mode === m} scroll={false}
      className={`inline-flex min-h-11 items-center rounded-tl-lg rounded-br-lg px-4 text-sm font-semibold transition-colors duration-150 ${mode === m ? "bg-accent-line text-white dark:text-black" : "text-muted hover:text-ink"}`}>
      {label}
    </Link>
  );
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Path 3 · Simulation Lab" title="Change the assumptions. Re-run the model.">
        <p>
          Real calculations run server-side for each request: the same Monte Carlo season simulator as the forecast (ported from
          the Python pipeline and tested against it) and a documented batter simulation. Your scenarios never change the published forecasts.
        </p>
      </PageHeader>
      <div role="tablist" aria-label="Simulation mode" className="inline-flex rounded-tl-xl rounded-br-xl border border-line p-1">
        {tab("tournament", "Tournament simulator")}
        {tab("batter", "Batter scenarios")}
      </div>
      {mode === "tournament" ? (
        <TournamentLab teams={simTeams} homeDefault={champion.meta.elo.home} />
      ) : (
        <BatterLab key={initial} players={playersByRuns} initial={initial} formRange={batters.meta.form_ratio_p10_p90} teamMatches={batters.meta.team_matches_2027} />
      )}
    </div>
  );
}
