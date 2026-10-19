import Link from "next/link";
import { champion } from "@/lib/data";

const REPO = "https://github.com/Aakif9866/IPL-Prediction";
const MAILTO = "mailto:aakif9866@gmail.com?subject=IPL%202027%20Prediction%20Platform%20-%20Technical%20Enquiry";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-line bg-card">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <p className="font-semibold text-ink">IPL 2027 Forecast Lab</p>
          <p className="max-w-md text-sm leading-relaxed text-muted">
            A portfolio machine-learning project: Elo team ratings, a Bayesian pre-season strength model and Monte Carlo
            tournament simulation for the champion forecast, plus a two-part batting model with calibrated intervals for 20
            batters. Built from IPL data up to {champion.meta.data_cutoff}. Model estimates only, not betting advice.
          </p>
          <a href={REPO} rel="noopener noreferrer" target="_blank" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent hover:underline">
            <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="currentColor"><path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.22 1.87.87 2.33.66.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.66 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" /></svg>
            Source code on GitHub
          </a>
        </div>
        <nav aria-label="Footer" className="text-sm">
          <p className="mb-2 font-semibold text-ink">Explore</p>
          <ul className="space-y-1">
            {[["/champion", "Champion predictor"], ["/batters", "Batter predictions"], ["/simulator", "Simulation Lab"], ["/methodology", "Methodology"], ["/reports/champion", "Champion report"], ["/reports/batting", "Batting report"], ["/methodology#credits", "Photo credits"]].map(([h, l]) => (
              <li key={h}><Link href={h} className="inline-flex min-h-9 items-center text-muted hover:text-accent hover:underline">{l}</Link></li>
            ))}
          </ul>
        </nav>
        <div className="space-y-3 text-sm">
          <p className="font-semibold text-ink">Technical enquiries</p>
          <p className="text-muted">
            For questions about the software, ML pipeline, deployment or collaboration. Not for match predictions, cricket opinions or betting.
          </p>
          <a href={MAILTO} className="brand-gradient inline-flex min-h-11 items-center rounded-tl-xl rounded-br-xl px-5 font-semibold text-white transition duration-150 hover:brightness-110 active:scale-95">
            Contact for Technical Enquiries
          </a>
        </div>
      </div>
      <p className="border-t border-line px-4 py-4 text-center text-xs text-muted">
        Not affiliated with the IPL, BCCI or any franchise. Team names are used descriptively; no logos or player photographs are used.
      </p>
    </footer>
  );
}
