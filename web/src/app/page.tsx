import Link from "next/link";
import { Photo, PhotoCredit } from "@/components/Photo";
import { Reveal } from "@/components/Reveal";
import { ButtonLink, Card, Eyebrow, KindBadge, SectionTitle } from "@/components/ui";
import { batters, champion, playersByRuns, teamsByChance } from "@/lib/data";
import { photos, type Photo as PhotoT } from "@/lib/images";
import { int, pct } from "@/lib/format";

const EXPERIENCES: { href: string; title: string; text: string; cta: string; photo: PhotoT }[] = [
  { href: "/champion", title: "Champion Predictor", text: "Title, final and top-four probabilities for all ten franchises, with team strength history and the factors behind each number.", cta: "See the forecast", photo: photos.dyPatilCrowd },
  { href: "/batters", title: "Batter Predictions", text: "Expected 2027 runs, innings, average and strike rate for 20 batters, with calibrated 80% intervals and season history.", cta: "Explore batters", photo: photos.delhiSpectators },
  { href: "/simulator", title: "Simulation Lab", text: "Re-run the tournament Monte Carlo with your own team-strength assumptions, or stress-test a batter's availability and form.", cta: "Open the lab", photo: photos.galle },
];

export default function Home() {
  const lead = teamsByChance[0];
  const last = teamsByChance[teamsByChance.length - 1];
  const topBat = playersByRuns[0];
  const era = champion.eras.find((e) => e.period === "2022–2025")!;
  return (
    <div className="space-y-16 sm:space-y-24">
      <section className="relative -mx-4 overflow-hidden rounded-br-[3rem] sm:-mx-6 lg:mx-0 lg:rounded-tl-[3rem]">
        <div className="absolute inset-0">
          <Photo photo={photos.delhiPanorama} sizes="(min-width: 1280px) 1280px, 100vw" priority />
          <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/25" />
        </div>
        <div className="relative flex min-h-[420px] flex-col justify-end gap-6 px-6 py-10 sm:px-10 lg:min-h-[480px] lg:py-14">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-teal-300">IPL 2027 · Data to {champion.meta.data_cutoff}</p>
          <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-tight text-white lg:text-6xl">
            Who wins IPL 2027? A forecast that shows how open it really is.
          </h1>
          <p className="max-w-2xl text-base text-gray-200 sm:text-lg">
            {champion.meta.n_sims.toLocaleString()} simulated seasons give {lead.name} the best estimated chance, at {pct(lead.p_champion)}. That
            is only slightly ahead of the 10% you’d get by picking a team at random. Every number here comes from a model
            trained and tested season by season on {champion.profile.matches.toLocaleString()} IPL matches.
          </p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href="/champion" variant="primary">Explore the champion forecast</ButtonLink>
            <Link href="/simulator" className="inline-flex min-h-11 items-center rounded-tl-xl rounded-br-xl border border-white/70 px-5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-white hover:text-black active:scale-95">
              Run your own simulation
            </Link>
          </div>
          <PhotoCredit photo={photos.delhiPanorama} />
        </div>
      </section>

      <section aria-label="Forecast highlights" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { k: "Highest title chance", v: `${lead.code} ${pct(lead.p_champion)}`, h: `${lead.name} · lowest: ${last.code} ${pct(last.p_champion)}` },
          { k: "Most expected runs", v: `${int(topBat.expected_runs)}`, h: `${topBat.name} · 80% interval ${int(topBat.lower_80)}–${int(topBat.upper_80)}` },
          { k: "Simulated seasons", v: champion.meta.n_sims.toLocaleString(), h: "Group format drawn at random each time; team strength sampled from its posterior" },
          { k: "Data cutoff", v: champion.meta.data_cutoff, h: `IPL ${batters.meta.partial_season} partial: ${champion.profile.season_2026_matches} matches in the dataset` },
        ].map((s, i) => (
          <Reveal key={s.k} delay={i * 60}>
            <Card className="h-full">
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{s.k}</p>
              <p className="tabular mt-2 text-2xl font-semibold text-ink">{s.v}</p>
              <p className="mt-1 text-sm text-muted">{s.h}</p>
            </Card>
          </Reveal>
        ))}
      </section>

      <section aria-labelledby="experiences">
        <SectionTitle title="Three ways in" id="experiences">Read the forecasts, inspect the evidence behind them, then change the assumptions yourself.</SectionTitle>
        <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {EXPERIENCES.map((e, i) => (
            <li key={e.href}>
              <Reveal delay={i * 80} className="h-full">
                <Link href={e.href} className="group relative flex h-full flex-col overflow-hidden rounded-tl-3xl rounded-br-3xl border border-line bg-card transition-all duration-300 hover:border-accent-line motion-safe:hover:-translate-y-1 hover:shadow-lg">
                  <div className="relative h-44 overflow-hidden transition-all duration-300 motion-safe:group-hover:h-36">
                    <Photo photo={e.photo} sizes="(min-width: 1024px) 400px, (min-width: 768px) 50vw, 100vw" className="transition-transform duration-500 motion-safe:group-hover:scale-105" />
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-5 pb-16">
                    <h3 className="line-clamp-2 text-lg font-semibold text-ink">{e.title}</h3>
                    <p className="text-sm leading-relaxed text-muted">{e.text}</p>
                  </div>
                  <span className="absolute inset-x-5 bottom-4 flex min-h-11 items-center justify-center rounded-tl-xl rounded-br-xl border border-accent-line text-sm font-semibold text-accent transition-colors duration-300 group-hover:bg-accent-line group-hover:text-white dark:group-hover:text-black">
                    {e.cta} →
                  </span>
                </Link>
              </Reveal>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1.2fr]" aria-labelledby="honest">
        <div className="space-y-3">
          <Eyebrow>Read this before the numbers</Eyebrow>
          <h2 id="honest" className="text-2xl font-semibold text-ink sm:text-3xl">IPL outcomes are close to coin flips. The forecasts say so.</h2>
          <p className="text-muted">
            The models were tested season by season, each one trained only on earlier data. Here is what that testing found,
            and it is why no team is shown as a near-certain champion.
          </p>
          <ButtonLink href="/methodology">How the models were validated</ButtonLink>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <KindBadge kind="history" />
            <p className="mt-3 text-sm text-body">
              Match level, 2013–2026 ({champion.match_backtest.find((r) => r.model === "elo")?.n} matches): the best model’s log loss was{" "}
              <strong className="tabular text-ink">{champion.match_backtest.find((r) => r.model === "elo")?.log_loss}</strong>, against{" "}
              <strong className="tabular text-ink">{champion.match_backtest.find((r) => r.model === "coin")?.log_loss}</strong> for a coin flip,
              a difference within noise.
            </p>
          </Card>
          <Card>
            <KindBadge kind="history" />
            <p className="mt-3 text-sm text-body">
              Pre-season title forecasts beat a uniform guess in {champion.eras[2].beats_uniform} of {champion.eras[2].seasons} seasons, but only{" "}
              {era.beats_uniform} of {era.seasons} since the 2022 expansion and mega-auctions.
            </p>
          </Card>
          <Card>
            <KindBadge kind="history" />
            <p className="mt-3 text-sm text-body">
              Batter totals: the two-part model’s typical error for established batters was{" "}
              <strong className="tabular text-ink">{batters.backtest.find((r) => String(r.subset).startsWith("established") && r.model === "two_part")?.MAE} runs</strong>, and its 80% intervals contained the actual total{" "}
              <strong className="tabular text-ink">{pct(Number(batters.intervals.find((r) => String(r.method).includes("used") && r.subset === "established")?.coverage_80), 1)}</strong> of the time.
            </p>
          </Card>
          <Card>
            <KindBadge kind="fact" />
            <p className="mt-3 text-sm text-body">
              Not in the data: 2027 squads, auction, injuries, schedule and groups. Forecasts are conditional on 2026 teams and
              the 2022–26 format, and are labelled as estimates throughout.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}
