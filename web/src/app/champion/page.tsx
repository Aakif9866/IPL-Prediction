import type { Metadata } from "next";
import { Suspense } from "react";
import { Card, Callout, Download, KindBadge, PageHeader, SectionTitle } from "@/components/ui";
import { champion, teamsByChance } from "@/lib/data";
import { fix, pct } from "@/lib/format";
import { ChampionExplorer } from "./ChampionExplorer";

export const metadata: Metadata = { title: "Champion Predictor", description: "IPL 2027 title, final and top-four probabilities for every franchise." };

export default function ChampionPage() {
  const lead = teamsByChance[0];
  const second = teamsByChance[1];
  const recent = champion.tournament_backtest.filter((r) => r.season >= 2022);
  const spread = [teamsByChance.at(-1)!.p_champion, lead.p_champion];
  return (
    <div className="space-y-12">
      <PageHeader eyebrow="Path 1 · Champion predictor" title={<>IPL 2027: <span className="brand-gradient-text">{lead.name}</span> lead a wide-open field</>}>
        <p>
          Pre-season forecast from {champion.meta.n_sims.toLocaleString()} simulated seasons. Title chances range from {pct(spread[0])} to {pct(spread[1])}, so even the leader is far
          more likely <em>not</em> to win. {lead.code} ({pct(lead.p_champion)}) and {second.code} ({pct(second.p_champion)}) are close enough that their order is uncertain.
        </p>
      </PageHeader>

      <Suspense fallback={<Card><p className="text-sm text-muted">Loading the explorer…</p></Card>}>
        <ChampionExplorer teams={champion.teams} base={champion.meta.base} cutoff={champion.meta.data_cutoff} />
      </Suspense>

      <section>
        <SectionTitle title="Full ranking">Ranked by estimated title probability. Expected points are average league points over the 14-match league stage.</SectionTitle>
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">IPL 2027 forecast by team</caption>
            <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
              <tr>{["#", "Team", "Champion", "Final", "Top four", "Exp. points", "Elo (end of data)", "Titles in data"].map((h) => <th key={h} scope="col" className="px-3 py-2 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody className="tabular">
              {teamsByChance.map((t, i) => (
                <tr key={t.code} className="border-b border-line">
                  <td className="px-3 py-2.5 text-muted">{i + 1}</td>
                  <th scope="row" className="px-3 py-2.5 font-medium text-ink"><span className="team-dot mr-2 inline-block size-2.5 rounded-full" style={{ background: t.color }} />{t.name}</th>
                  <td className="px-3 py-2.5 font-semibold text-ink">{pct(t.p_champion)}</td>
                  <td className="px-3 py-2.5">{pct(t.p_final)}</td>
                  <td className="px-3 py-2.5">{pct(t.p_playoffs)}</td>
                  <td className="px-3 py-2.5">{fix(t.exp_points)}</td>
                  <td className="px-3 py-2.5">{fix(t.elo_end, 0)}</td>
                  <td className="px-3 py-2.5">{t.titles.length || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 md:hidden">
          {teamsByChance.map((t, i) => (
            <li key={t.code}>
              <Card className="!p-4">
                <p className="flex items-center gap-2 font-medium text-ink"><span className="text-muted">{i + 1}.</span><span className="team-dot size-2.5 rounded-full" style={{ background: t.color }} />{t.name}</p>
                <dl className="tabular mt-2 grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="text-xs text-muted">Champion</dt><dd className="font-semibold text-ink">{pct(t.p_champion)}</dd></div>
                  <div><dt className="text-xs text-muted">Final</dt><dd>{pct(t.p_final)}</dd></div>
                  <div><dt className="text-xs text-muted">Top four</dt><dd>{pct(t.p_playoffs)}</dd></div>
                </dl>
              </Card>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">Champion probabilities sum to {pct(champion.teams.reduce((s, t) => s + t.p_champion, 0))}. Monte Carlo standard error of the largest probability ≈ {fix(100 * Math.sqrt((lead.p_champion * (1 - lead.p_champion)) / champion.meta.n_sims), 2)} percentage points.</p>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold text-ink">How reliable are pre-season title forecasts?</h2><KindBadge kind="history" /></div>
          <p className="mb-3 text-sm text-muted">Each season’s forecast was made using only earlier seasons and the real fixture list. Scored by the log probability given to the actual champion (higher is better).</p>
          <div className="overflow-x-auto">
            <table className="tabular w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted"><tr><th className="py-1.5 pr-3 font-medium">Period</th><th className="pr-3 font-medium">Model</th><th className="pr-3 font-medium">Uniform</th><th className="font-medium">Beat uniform</th></tr></thead>
              <tbody>
                {champion.eras.map((e) => (
                  <tr key={e.period} className="border-t border-line"><td className="py-2 pr-3 text-ink">{e.period}</td><td className="pr-3">{fix(e.model_log_p, 3)}</td><td className="pr-3">{fix(e.uniform_log_p, 3)}</td><td>{e.beats_uniform} of {e.seasons}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-sm text-body">
            Before 2022 the model beat a uniform guess, because CSK and MI stayed strong for years. Since the 2022 expansion and the
            mega-auctions it has done worse than uniform. Pre-season ranks of the actual champions:{" "}
            {recent.map((r) => `${r.champion} ${r.season} (#${r.rank_of_champion})`).join(", ")}.
          </p>
        </Card>
        <Card className="space-y-4">
          <h2 className="text-lg font-semibold text-ink">Assumptions and data cutoff</h2>
          <ul className="space-y-2 text-sm text-body">
            <li><strong className="text-ink">Data cutoff:</strong> {champion.meta.data_cutoff}. IPL 2026 is partial in the dataset ({champion.profile.season_2026_matches} matches); its remaining results and champion are not used.</li>
            <li><strong className="text-ink">Teams:</strong> the ten 2026 franchises, assumed unchanged. No 2027 squads, retentions, auction or injuries are known to the model.</li>
            <li><strong className="text-ink">Format:</strong> {champion.meta.format}.</li>
            <li><strong className="text-ink">Strength:</strong> Elo (K = {champion.meta.elo.k}, carry-over {champion.meta.elo.carry}, home advantage {champion.meta.elo.home}), averaged over the fitted posterior of pre-season shrinkage and strength uncertainty τ.</li>
          </ul>
          <Callout title="What this is not" tone="warn">A model estimate built for analysis, not a prediction of a guaranteed result, and not betting advice.</Callout>
          <div className="flex flex-wrap gap-x-5">
            <Download href="/downloads/ipl2027_champion_forecast.csv" label="Forecast table" kind="CSV" />
            <Download href="/downloads/ipl2027_champion_tournament_backtest.csv" label="Tournament backtest" kind="CSV" />
            <Download href="/downloads/ipl2027_champion_report.md" label="Full report" kind="Markdown" />
          </div>
        </Card>
      </section>
    </div>
  );
}
