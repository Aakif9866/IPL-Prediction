# IPL 2027 Forecast Lab — web app

Source: https://github.com/Aakif9866/IPL-Prediction

A Next.js 15 (App Router, TypeScript, Tailwind CSS 4) app that presents the two model-backed analyses in this repository
and lets users run their own simulations.

| Route | What it shows |
|---|---|
| `/` | Project overview, forecast highlights, links to the three experiences |
| `/champion` | Title, final and top-four probabilities per team; team explorer (Elo history, record, factors, τ sensitivity); backtest; assumptions; downloads |
| `/batters` | Searchable, sortable, filterable table of 20 batters (cards on mobile); compare tray |
| `/batters/[slug]` | Profile page for each batter: forecast, 80% interval, season history chart, 2024–26 splits, report analysis and scenarios |
| `/batters/compare?p=a,b` | Side-by-side comparison of 2–4 batters, with small-multiple history charts |
| `/simulator` | Simulation Lab: tournament Monte Carlo (presets 1k/5k/10k, per-team Elo offsets, τ, home advantage, reset) and batter scenarios (matches, availability, form) |
| `/methodology` | Data coverage, models, validation tables, how probabilities and intervals are computed, limitations, photo credits |
| `/reports/champion`, `/reports/batting` | The two pipeline reports, rendered unchanged, with Markdown/CSV downloads |

## Where things run

| Component | Runs on | Notes |
|---|---|---|
| Python pipelines (`run.py`, `run_batting.py`) | Your machine (offline) | pandas and scikit-learn; trains, backtests and writes reports. Not deployed. |
| `export_web_data.py` | Your machine | Turns the pipeline outputs into `src/data/*.json` and copies reports and figures to `public/`. Checks itself: season-end Elo must reproduce the saved ratings, and the conformal bands must reproduce the published intervals. |
| Pages | Vercel (static and SSR) | All pages except `/simulator` are prerendered at build time. |
| `POST /api/simulate/tournament`, `POST /api/simulate/batter` | Vercel serverless functions (Node.js) | TypeScript port of the season simulator plus the batter Monte Carlo. Input is validated server-side, and runs are capped (`SIM_MAX_RUNS`, default 20,000). 5,000 seasons take about 70–90 ms. |

No separate Python backend is needed. The scikit-learn models are only used offline, and live inference is cheap
arithmetic (Elo strengths, the fitted posterior, conformal bands), so it was ported to TypeScript (`src/lib/`). A unit test checks that the TypeScript simulator reproduces
the published Python probabilities for all 10 teams within Monte Carlo error. There is no database, no authentication and no paid service.

## Run locally

```bash
cd web
npm install          # Node 20+
npm run dev          # http://localhost:3000
npm test             # vitest: simulator, batter simulation, conformal intervals, validation
npm run lint && npm run typecheck
npm run build && npm start
```

To refresh the data after re-running the models (Python 3.10+ with `../requirements.txt`):

```bash
cd ..
python run.py && python run_batting.py   # champion + batting pipelines
python export_web_data.py                 # writes web/src/data and web/public/{downloads,reports}
```

## Deploy to Vercel

1. The repository is on GitHub at `Aakif9866/IPL-Prediction`.
2. In Vercel, choose **Add New → Project**, import the repository, and set **Root Directory = `web`**. The framework preset is detected as Next.js; keep the default build command (`next build`) and output.
3. Optional environment variables (see `.env.example`):
   - `NEXT_PUBLIC_SITE_URL`: the deployed URL, used for metadata.
   - `SIM_MAX_RUNS`: a server-side cap on simulations per request (default 20000, hard max 50000).
4. Deploy. No secrets are required, so nothing sensitive is exposed to the client.

The CLI equivalent is `npx vercel` from inside `web/`, then `npx vercel --prod`.

## Design

This follows the local *frontend-design-aesthetic* skill:
- one workhorse accent (teal) and a single gradient, used for the brand mark, the primary CTA and the leading team's bar;
- opposite-corner rounding, and borders instead of shadows for elevation;
- a top accent strip;
- a near-black dark-mode ladder (`#0a0a0a`, `#141414`, `#1c1c1c`);
- motion limited to `motion-safe` reveals, hover lifts and `active:scale-95`.

Colour pairs were checked for WCAG AA (see the comments in `src/app/globals.css`). Charts are dependency-free SVG/HTML and follow
the dataviz rules: thin marks, a recessive grid, hover and focus tooltips, and text in ink colours.

## Images

Four photos from Unsplash. Each photo page was checked individually and says "Free to use under the Unsplash License" (none are Unsplash+), and each
original is at least 4000 px wide. They are served by Unsplash's CDN at the exact width requested (`src/lib/unsplash-loader.ts`), are lazy-loaded
(except the hero), and fall back to a neutral panel if loading fails. Credits are on `/methodology#credits`. No IPL, BCCI or
franchise logos and no player photographs are used.

## Limitations

- The forecasts are conditional: the data ends on 2026-05-01, partway through the 2026 season, and 2027 squads, schedule and format are unknown. See `/methodology`.
- Team membership shown for batters is the 2026 team in the data; 2027 teams are not confirmed.
