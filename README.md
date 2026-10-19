# IPL 2027 champion forecast

A reproducible pipeline: data cleaning, leak-free features, rolling-origin backtests, a Monte Carlo
tournament simulator, and a conditional IPL 2027 forecast. The findings are in [REPORT.md](REPORT.md).

## Setup and run

```bash
pip install -r requirements.txt   # Python 3.10+
python run.py                     # ~20 s; writes everything to outputs/ (use --sims N to change the number of simulations)
python -m pytest -q tests         # 10 tests
```

Input data: `IPL/*.csv` (the provided files, unchanged).

## Layout

| Path | Purpose |
|---|---|
| `iplpred/data.py` | loading, team canonicalisation (Deccan Chargers vs SRH), no-result and tie handling, home flag, playoff and champion derivation, dataset profile |
| `iplpred/features.py` | Elo (with season regression) and leak-free rolling run-rate and form features |
| `iplpred/models.py` | baselines, logistic regression, gradient boosting, rolling-origin backtest, pre-season strength model (Monte Carlo marginal likelihood and posterior), bootstrap and calibration |
| `iplpred/simulate.py` | vectorised season simulator (league, NRR proxy, Qualifier or semi-final playoffs) and the 2022–26 group-format fixture generator |
| `run.py` | runs the whole pipeline and writes artifacts, plots and `outputs/results.md` |
| `tests/` | Elo maths, leakage guard, data cleaning, fixture format, probability sums, symmetry, seeding |

Key outputs:
- `ipl2027_forecast.csv`
- `tournament_backtest.csv`
- `match_predictions_backtest.csv`
- `elo_ratings_final.json`
- `match_model_logreg.joblib`
- `ipl2027_params.json`
- plots (`*.png`)

The package is called `iplpred` rather than `ipl` because macOS's case-insensitive filesystem would merge an `ipl/` folder with the `IPL/` data folder.

To change the 2027 assumptions (teams, format, number of simulations, τ grid), edit `forecast_2027` in `run.py` and the grids at the top of `iplpred/models.py`.

## Project parts

| Part | Entry point | Output |
|---|---|---|
| Champion forecast | `python run.py` | `outputs/`, [REPORT.md](REPORT.md) |
| Batting forecast (separate analysis) | `python run_batting.py` | `reports/ipl_2027_batting_predictions.{md,csv}`, `reports/batting/` |
| Web app | `python export_web_data.py`, then `cd web && npm run dev` | Next.js site with the Simulation Lab; see [web/README.md](web/README.md) |
