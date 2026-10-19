import type { Metadata } from "next";
import Link from "next/link";
import { Photo, PhotoCredit } from "@/components/Photo";
import { Card, Download, KindBadge, PageHeader, SectionTitle } from "@/components/ui";
import { batters, champion } from "@/lib/data";
import { photos, LICENSE_URL } from "@/lib/images";
import { fix, pct } from "@/lib/format";

export const metadata: Metadata = { title: "Methodology", description: "Data, models, validation and limitations behind the IPL 2027 forecasts." };

type Row = Record<string, string | number | null>;
function DataTable({ rows, cols, caption }: { rows: Row[]; cols: { key: string; label: string; fmt?: (v: number) => string }[]; caption: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="tabular w-full min-w-[30rem] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="text-left text-xs uppercase tracking-wide text-muted"><tr>{cols.map((c) => <th key={c.key} scope="col" className="py-1.5 pr-3 font-medium">{c.label}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {cols.map((c) => {
                const v = r[c.key];
                return <td key={c.key} className="py-2 pr-3">{v === null || v === undefined ? "—" : typeof v === "number" && c.fmt ? c.fmt(v) : String(v)}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const f3 = (v: number) => v.toFixed(3), f4 = (v: number) => v.toFixed(4), f1 = (v: number) => v.toFixed(1), sg = (v: number) => (v > 0 ? "+" : "") + v.toFixed(4);

export default function Methodology() {
  const P = champion.profile;
  return (
    <div className="space-y-14">
      <PageHeader eyebrow="Methodology" title="How the forecasts are made, and how far to trust them">
        <p>Two separate analyses share one dataset. Each was backtested season by season, with every prediction using only data from before the season it predicts.</p>
      </PageHeader>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Card className="space-y-3">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-ink">Dataset coverage</h2><KindBadge kind="fact" /></div>
          <ul className="space-y-2 text-sm text-body">
            <li>{P.matches.toLocaleString()} IPL matches from {P.date_range[0]} to <strong className="text-ink">{P.date_range[1]} (data cutoff)</strong>, plus {P.deliveries.toLocaleString()} ball-by-ball deliveries.</li>
            <li>IPL {batters.meta.partial_season} is partial: {P.season_2026_matches} matches. Its later results and champion are not in the data and were not invented.</li>
            <li>Results: {P.result_counts.win} wins, {P.result_counts.tie} ties (decided by super over), {P.result_counts["no result"]} no-results (excluded; their winner field is a placeholder).</li>
            <li>Cleaning: Deccan Chargers separated from Sunrisers Hyderabad (they share an ID in the source). The <code>team1</code> column, which is the side batting first {pct(P.team1_bats_first)} of the time, is never used to orient matches.</li>
            <li>Batters were matched by full name, never by surname (e.g. <code>R Sharma</code> is Rahul, not Rohit).</li>
            <li>Not available: squads, auction, injuries, ages, the 2027 schedule and groups.</li>
          </ul>
        </Card>
        <div className="relative min-h-64 overflow-hidden rounded-tl-3xl rounded-br-3xl border border-line">
          <Photo photo={photos.galle} sizes="(min-width: 1024px) 40vw, 100vw" />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4"><PhotoCredit photo={photos.galle} /></div>
        </div>
      </section>

      <section>
        <SectionTitle title="Champion forecast: models">
          Baselines (coin flip, career win %), Elo, logistic regression and gradient boosting were compared on pre-match, pre-toss predictions for 2013–2026.
          Elo was kept: no model beat a coin flip with confidence, and the more complex models were worse.
        </SectionTitle>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold text-ink">Match-level backtest (pooled)</h3><KindBadge kind="history" /></div>
            <DataTable caption="Match-level backtest" rows={champion.match_backtest} cols={[{ key: "model", label: "Model" }, { key: "n", label: "n", fmt: (v) => String(v) }, { key: "log_loss", label: "Log loss", fmt: f4 }, { key: "brier", label: "Brier", fmt: f4 }, { key: "auc", label: "AUC", fmt: f3 }, { key: "accuracy", label: "Accuracy", fmt: (v) => pct(v) }]} />
          </Card>
          <Card>
            <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold text-ink">Paired bootstrap, log-loss difference</h3><KindBadge kind="history" /></div>
            <DataTable caption="Bootstrap comparison" rows={champion.bootstrap} cols={[{ key: "comparison", label: "Comparison" }, { key: "mean", label: "Mean", fmt: sg }, { key: "lo95", label: "Low 95%", fmt: sg }, { key: "hi95", label: "High 95%", fmt: sg }]} />
            <p className="mt-2 text-xs text-muted">Negative means the first model is better. An interval that includes 0 means no detectable difference.</p>
          </Card>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">How the title probabilities are calculated</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-body">
            <li>Elo ratings (K = {champion.meta.elo.k}, home advantage {champion.meta.elo.home}) are updated through every match to the cutoff. At each season boundary they are pulled toward 1500 (carry-over {champion.meta.elo.carry}).</li>
            <li>2027 team strength = 1500 + shrink × (start − 1500) + Normal(0, τ²). The shrink and uncertainty τ are not fixed: each of {champion.posterior.length} grid points is weighted by the Monte Carlo marginal likelihood of all past seasons&apos; league results.</li>
            <li>Each simulated season draws (shrink, τ) from that posterior, draws team strengths, draws the two groups at random and plays 70 league matches. Summed latent margins act as the net-run-rate tie-break. Then Qualifier 1, Eliminator, Qualifier 2 and the Final.</li>
            <li>The probabilities are frequencies over {champion.meta.n_sims.toLocaleString()} seasons. The Simulation Lab runs the same engine in TypeScript, tested to reproduce the Python results within Monte Carlo error.</li>
          </ol>
        </Card>
        <Card>
          <div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-semibold text-ink">Pre-season title forecasts, by season</h2><KindBadge kind="history" /></div>
          <DataTable caption="Tournament backtest" rows={champion.tournament_backtest as unknown as Row[]} cols={[{ key: "season", label: "Season", fmt: String }, { key: "champion", label: "Champion" }, { key: "p_champion", label: "P(champ)", fmt: (v) => pct(v) }, { key: "rank_of_champion", label: "Its rank", fmt: String }, { key: "favourite", label: "Favourite" }, { key: "p_favourite", label: "P(fav)", fmt: (v) => pct(v) }]} />
        </Card>
      </section>

      <section>
        <SectionTitle title="Batter forecast: models">
          Rows are player-seasons (batted in either of the two previous seasons). A player scores 0 when absent, so availability is part of the target. The
          chosen model is two ridge regressions, innings per team match × runs per innings, on recency-weighted, shrunk rate features from earlier seasons only.
        </SectionTitle>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold text-ink">Season-runs backtest, 2014–2025</h3><KindBadge kind="history" /></div>
            <DataTable caption="Batting backtest" rows={batters.backtest} cols={[{ key: "subset", label: "Subset" }, { key: "model", label: "Model" }, { key: "MAE", label: "MAE", fmt: f1 }, { key: "RMSE", label: "RMSE", fmt: f1 }, { key: "bias", label: "Bias", fmt: f1 }]} />
          </Card>
          <div className="space-y-6">
            <Card>
              <div className="mb-2 flex items-center justify-between"><h3 className="font-semibold text-ink">Paired bootstrap, MAE difference</h3><KindBadge kind="history" /></div>
              <DataTable caption="Batting bootstrap" rows={batters.bootstrap} cols={[{ key: "comparison", label: "Comparison" }, { key: "subset", label: "Subset" }, { key: "MAE diff", label: "Diff", fmt: f1 }, { key: "lo95", label: "Low", fmt: f1 }, { key: "hi95", label: "High", fmt: f1 }]} />
            </Card>
            <Card>
              <h3 className="mb-2 font-semibold text-ink">Components vs naive baselines</h3>
              <DataTable caption="Component errors" rows={batters.components} cols={[{ key: "target", label: "Target" }, { key: "model", label: "Model" }, { key: "MAE", label: "MAE", fmt: (v) => v.toFixed(2) }]} />
            </Card>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="text-lg font-semibold text-ink">How prediction intervals are calculated</h2>
          <p className="text-sm text-body">
            Split-conformal intervals around the point forecast. Out-of-sample errors from 2014–2025 are normalised as (actual − predicted) ÷ (predicted + {batters.meta.conformal.offset}).
            Their 10th and 90th percentiles are taken separately for predictions below 150, from 150 to 350, and above 350 runs. The interval therefore always contains the forecast,
            and its width scales with it.
          </p>
          <DataTable caption="Calibration bands" rows={batters.meta.conformal.bands.map((b) => ({ band: `${b.from}–${b.to ?? "∞"}`, q_lo: b.q_lo, q_hi: b.q_hi }))} cols={[{ key: "band", label: "Prediction band" }, { key: "q_lo", label: "10th pct", fmt: f3 }, { key: "q_hi", label: "90th pct", fmt: f3 }]} />
        </Card>
        <Card>
          <div className="mb-2 flex items-center justify-between"><h2 className="text-lg font-semibold text-ink">Interval reliability (nominal 80%)</h2><KindBadge kind="history" /></div>
          <DataTable caption="Interval coverage" rows={batters.intervals} cols={[{ key: "method", label: "Method" }, { key: "subset", label: "Subset" }, { key: "coverage_80", label: "Coverage", fmt: (v) => pct(v) }, { key: "below_lower", label: "Below", fmt: (v) => pct(v) }, { key: "above_upper", label: "Above", fmt: (v) => pct(v) }, { key: "mean_width", label: "Width", fmt: (v) => fix(v, 0) }]} />
        </Card>
      </section>

      <section>
        <SectionTitle title="Known limitations and sources of uncertainty" />
        <ul className="grid gap-4 md:grid-cols-2">
          {[
            ["Squads are unknown", "Team-level Elo cannot see retentions, the auction or injuries. That is the likely reason title forecasts did worse than uniform in 2022–25."],
            ["Partial 2026 season", `Only ${P.season_2026_matches} matches of 2026 are in the data, so the freshest evidence is a part-season.`],
            ["Assumed format", "The 2027 format is assumed to match 2022–26. Groups are random in each simulation, NRR is approximated, and rain no-results are not simulated."],
            ["Batter availability", "Expected innings come from each batter's own playing-time history. Real 2027 selection, injuries and batting order are not known."],
            ["Small samples", "13 tournament backtests and about 400 established-batter seasons. Calibration estimates are themselves uncertain."],
            ["Non-stationarity", "Eras differ (expansion, Impact Player rule, mega-auctions), so historical calibration is only an approximate guide to 2027."],
          ].map(([t, d]) => (
            <li key={t}><Card className="h-full"><p className="font-semibold text-ink">{t}</p><p className="mt-1 text-sm text-muted">{d}</p></Card></li>
          ))}
        </ul>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-2">
          <h2 className="text-lg font-semibold text-ink">Reports and downloads</h2>
          <p className="text-sm text-muted">The two reports are separate analyses and are shown separately.</p>
          <div className="flex flex-col">
            <Link href="/reports/champion" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">Read the champion report →</Link>
            <Link href="/reports/batting" className="inline-flex min-h-11 items-center text-sm font-semibold text-accent hover:underline">Read the batting report →</Link>
            <Download href="/downloads/ipl2027_champion_report.md" label="Champion report" kind="Markdown" />
            <Download href="/downloads/ipl2027_champion_results.md" label="Champion results tables" kind="Markdown" />
            <Download href="/downloads/ipl2027_champion_forecast.csv" label="Champion forecast" kind="CSV" />
            <Download href="/downloads/ipl_2027_batting_predictions.md" label="Batting report" kind="Markdown" />
            <Download href="/downloads/ipl_2027_batting_predictions.csv" label="Batting predictions" kind="CSV" />
          </div>
        </Card>
        <Card className="space-y-3" as="section">
          <h2 id="credits" className="scroll-mt-24 text-lg font-semibold text-ink">Photo credits</h2>
          <p className="text-sm text-muted">
            Each photo was checked on its own Unsplash page: &quot;Free to use under the <a className="text-accent hover:underline" href={LICENSE_URL} rel="noopener noreferrer" target="_blank">Unsplash License</a>&quot; (not Unsplash+).
            Attribution is not required, but credited here. No IPL, BCCI or franchise logos and no player photographs are used.
          </p>
          <ul className="space-y-2 text-sm">
            {Object.values(photos).map((p) => (
              <li key={p.src} className="text-body">
                <a href={p.page} className="text-accent hover:underline" rel="noopener noreferrer" target="_blank">{p.location}</a> by{" "}
                <a href={p.profile} className="hover:underline" rel="noopener noreferrer" target="_blank">{p.photographer}</a> <span className="text-muted">· original {p.original}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
