import type { Metadata } from "next";
import { Callout, Download, PageHeader } from "@/components/ui";
import { batters, playersByRuns } from "@/lib/data";
import { int, pct } from "@/lib/format";
import { BattersExplorer } from "./BattersExplorer";

export const metadata: Metadata = { title: "Batter Predictions", description: "Expected IPL 2027 runs with 80% intervals for 20 batters." };

export default function BattersPage() {
  const est = batters.intervals.find((r) => String(r.method).includes("used") && r.subset === "established");
  const top = playersByRuns[0];
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Path 2 · Batter predictions" title="Expected IPL 2027 runs for 20 batters">
        <p>
          Ranked by the model&apos;s expected total runs, not reputation. {top.name} leads at {int(top.expected_runs)}, but every
          interval is several hundred runs wide: playing time, form and role are uncertain. Expected innings already include each
          batter&apos;s own history of missed matches and seasons.
        </p>
      </PageHeader>
      <BattersExplorer players={playersByRuns} />
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Callout title="How to read the interval">
          The model expects about 1 batter in 10 to finish below their low estimate and 1 in 10 above their high estimate. In backtesting
          on established batters, the interval held the actual total {est ? pct(Number(est.coverage_80)) : "—"} of the time. Intervals
          are calibrated separately below 150, from 150 to 350, and above 350 expected runs, so widths jump at those boundaries.
        </Callout>
        <div className="flex flex-col justify-center">
          <Download href="/downloads/ipl_2027_batting_predictions.csv" label="Batting predictions" kind="CSV" />
          <Download href="/downloads/ipl_2027_batting_predictions.md" label="Full batting report" kind="Markdown" />
        </div>
      </div>
    </div>
  );
}
