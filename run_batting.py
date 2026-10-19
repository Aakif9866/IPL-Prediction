"""IPL 2027 batting-runs forecast for 20 batters. Separate from the champion project (run.py).

Usage: python run_batting.py      -> writes reports/ipl_2027_batting_predictions.{md,csv} + reports/batting/
"""
import json
from itertools import groupby
import logging
from pathlib import Path

import numpy as np
import pandas as pd

from batting import report
from batting.data import PLAYERS, TEAM_CODE, innings_table, load_balls, season_table, splits, team_matches
from batting.model import FEATURES, TwoPart, add_history, backtest, build_rows, conformal_interval

ROOT = Path(__file__).resolve().parent
REP = ROOT / "reports"
ART = REP / "batting"
TARGET, PARTIAL = 2027, 2026
SPLIT_SEASONS = (2024, 2025, 2026)
log = logging.getLogger("run_batting")


def metrics_table(bt, models, subsets):
    rows = []
    for sub, g in subsets.items():
        for m in models:
            e = g[m] - g.y_runs
            rows.append({"subset": sub, "model": m, "n": len(g), "MAE": e.abs().mean(),
                         "RMSE": np.sqrt((e ** 2).mean()), "bias": e.mean()})
    return pd.DataFrame(rows)


def boot_mae_diff(y, a, b, n=2000, seed=0):
    d = np.abs(a - y) - np.abs(b - y)
    bs = d[np.random.default_rng(seed).integers(0, len(d), (n, len(d)))].mean(1)
    return d.mean(), *np.percentile(bs, [2.5, 97.5])


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    ART.mkdir(parents=True, exist_ok=True)
    balls = load_balls()
    inn = innings_table(balls)
    tm = team_matches()
    season = season_table(inn, tm)
    season["team_code"] = season.team.map(TEAM_CODE)
    if season.season.max() != PARTIAL:
        raise RuntimeError(f"expected data to end in partial season {PARTIAL}")

    # ---- inspection numbers for the report ----
    players = pd.read_csv(ROOT / "IPL" / "players-data-updated.csv")
    mapping = []
    for disp, (nm, pid) in PLAYERS.items():
        row = players[players.player_id == pid]
        if row.empty or row.player_name.iat[0] != nm:
            raise ValueError(f"name mapping broken for {disp}")
        h = season[season.name == nm]
        mapping.append({"batter": disp, "dataset_name": nm, "player_id": pid, "full_name": row.player_full_name.iat[0],
                        "seasons": f"{h.season.min()}–{h.season.max()} ({h.season.nunique()})",
                        "career_runs": int(h.runs.sum()), "teams": " → ".join(t for t, _ in groupby(h.sort_values("season").team_code))})
    mapping = pd.DataFrame(mapping)
    profile = {"deliveries_used": len(balls), "player_innings": len(inn), "batters": inn.name.nunique(),
               "seasons": f"{season.season.min()}–{season.season.max()}", "partial_season_matches": int(tm[tm.season == PARTIAL].team_matches.sum() / 2),
               "missing_batsman_type": int(balls.batsman_type.isna().sum()), "missing_bowler_type": int(balls.bowler_type.isna().sum()),
               "tm_2022_2025": float(tm[tm.season.between(2022, 2025)].team_matches.mean())}

    # ---- rolling-origin backtest ----
    data = add_history(pd.concat([build_rows(season, inn, tm, t) for t in range(2010, PARTIAL)], ignore_index=True), season)
    bt = backtest(data)
    bt["ens_ridge_two_part"] = (bt.ridge + bt.two_part) / 2
    # Conformal interval around the two-part point, calibrated on earlier seasons' out-of-sample residuals.
    bt["lo_nc"], bt["hi_nc"] = np.nan, np.nan
    for s in range(2016, PARTIAL):
        cal, m = bt[bt.season < s], bt.season == s
        bt.loc[m, "lo_nc"], bt.loc[m, "hi_nc"] = conformal_interval(cal.y_runs, cal.two_part, bt.loc[m, "two_part"])
    models = ["last_season", "career_avg", "marcel", "ridge", "rf", "gbm", "two_part", "ens_ridge_two_part"]
    est = bt[bt.last_runs >= 250]
    summary = metrics_table(bt, models, {"all active batters": bt, "established (≥250 runs in S-1)": est})
    boots = pd.DataFrame([{"comparison": f"two_part − {b}", "subset": sub, **dict(zip(["MAE diff", "lo95", "hi95"], boot_mae_diff(g.y_runs.to_numpy(), g.two_part.to_numpy(), g[b].to_numpy())))}
                          for sub, g in (("all", bt), ("established", est)) for b in ("last_season", "marcel", "ridge", "rf", "gbm")])
    # component checks against naive baselines
    s_idx = season.set_index(["name", "season"])
    lag = lambda col: [s_idx[col].get((n, t - 1), np.nan) for n, t in zip(bt.name, bt.season)]
    bt["last_inn"], bt["last_rpi"] = lag("inn"), np.array(lag("runs")) / np.array(lag("inn"))
    with np.errstate(invalid="ignore", divide="ignore"):
        bt["last_sr"] = 100 * np.array(lag("runs")) / np.array(lag("balls"))
    r5 = bt[bt.y_inn >= 5]
    b100 = bt[(bt.y_balls >= 100) & bt.last_sr.notna()]
    comp = pd.DataFrame([
        {"target": "innings", "model": "two-part share model", "MAE": (bt.pred_inn - bt.y_inn).abs().mean()},
        {"target": "innings", "model": "last season innings", "MAE": (bt.last_inn.fillna(0) - bt.y_inn).abs().mean()},
        {"target": "innings", "model": "Marcel weighted share × matches", "MAE": (bt.share_w * bt.tm - bt.y_inn).abs().mean()},
        {"target": "runs/innings (≥5 inn)", "model": "two-part rpi model", "MAE": (r5.pred_rpi - r5.y_runs / r5.y_inn).abs().mean()},
        {"target": "runs/innings (≥5 inn)", "model": "last season rpi", "MAE": (r5.last_rpi.fillna(r5.rpi_w) - r5.y_runs / r5.y_inn).abs().mean()},
        {"target": "runs/innings (≥5 inn)", "model": "weighted shrunk rpi", "MAE": (r5.rpi_w - r5.y_runs / r5.y_inn).abs().mean()},
        {"target": "strike rate (≥100 balls)", "model": "weighted shrunk SR", "MAE": (b100.sr_w - 100 * b100.y_runs / b100.y_balls).abs().mean()},
        {"target": "strike rate (≥100 balls)", "model": "last season SR", "MAE": (b100.last_sr - 100 * b100.y_runs / b100.y_balls).abs().mean()},
    ])
    cov = lambda g, lo="lo", hi="hi": ((g.y_runs >= g[lo]) & (g.y_runs <= g[hi])).mean()
    ev = bt[bt.season >= 2016]
    est_ev = ev[ev.last_runs >= 250]
    pi = pd.DataFrame([{"method": meth, "subset": sub, "n": len(g), "coverage_80": cov(g, lo, hi),
                        "below_lower": (g.y_runs < g[lo]).mean(), "above_upper": (g.y_runs > g[hi]).mean(),
                        "mean_width": (g[hi] - g[lo]).mean(), "contains_point": ((g.two_part >= g[lo]) & (g.two_part <= g[hi])).mean()}
                       for meth, lo, hi in (("conformal around two-part (used)", "lo_nc", "hi_nc"), ("CQR quantile GBM", "lo", "hi"))
                       for sub, g in (("all", ev), ("established", est_ev))])
    pi_season = est_ev.groupby("season").apply(lambda g: pd.Series({"n": len(g), "coverage_80": cov(g, "lo_nc", "hi_nc")}), include_groups=False).reset_index()
    ok = est[(est.y_inn >= 8) & (est.pred_rpi > 0)]
    ratio = (ok.y_runs / ok.y_inn) / ok.pred_rpi
    r10, r90 = np.percentile(ratio, [10, 90])

    # ---- IPL 2027 forecast ----
    names = [v[0] for v in PLAYERS.values()]
    tr = data[data.season >= 2010]
    fut = build_rows(season, inn, tm, TARGET, names)
    fut["tm"] = profile["tm_2022_2025"]  # ponytail: assumes 2022-26 format (14 league games + playoff share)
    fut = fut[fut.name.isin(names)].copy()
    X = fut[FEATURES].to_numpy()
    tp = TwoPart().fit(tr[FEATURES].to_numpy(), tr.y_inn.to_numpy(), tr.y_runs.to_numpy(), tr.tm.to_numpy())
    fut["expected_innings"], fut["expected_runs_per_innings"] = tp.predict_parts(X, fut.tm.to_numpy())
    fut["expected_runs"] = fut.expected_innings * fut.expected_runs_per_innings
    fut["lower_80"], fut["upper_80"] = conformal_interval(bt.y_runs, bt.two_part, fut.expected_runs)
    fut["expected_average"] = fut.expected_runs / (fut.expected_innings * fut.outs_w)
    fut["expected_strike_rate"] = fut.sr_w
    # Confidence rule, fixed before looking at outputs: regular (≥70% of team matches) in how many of the last 3 seasons.
    reg = (fut[["share_1", "share_2", "share_3"]] >= 0.7).sum(1)
    fut["confidence"] = np.select([reg == 3, reg == 2], ["High", "Medium"], "Low")
    fut["scen_inn_full"], fut["scen_inn_reduced"] = 14, 8
    fut["scen_full"] = 14 * fut.expected_runs_per_innings
    fut["scen_strong"] = fut.scen_full * r90
    fut["scen_weak"] = fut.scen_full * r10
    fut["scen_reduced"] = 8 * fut.expected_runs_per_innings
    disp = {v[0]: k for k, v in PLAYERS.items()}
    fut["batter"] = fut.name.map(disp)
    fut["dataset_name"] = fut.name
    fut["player_id"] = fut.name.map({v[0]: v[1] for v in PLAYERS.values()})
    fut["last_team_in_data"] = fut.name.map(season[season.season == season.groupby("name").season.transform("max")].set_index("name").team_code)
    fut = fut.sort_values("expected_runs", ascending=False).reset_index(drop=True)
    fut["rank"] = np.arange(1, len(fut) + 1)
    for c in ("rpi_w", "fifty_w", "pos_w"):
        fut[f"hist_{c}"] = fut[c]
    if fut.batter.isna().any() or len(fut) != 20:
        raise RuntimeError("not all 20 batters were forecast")

    cols = ["rank", "batter", "dataset_name", "player_id", "last_team_in_data", "expected_runs", "lower_80", "upper_80",
            "expected_innings", "expected_runs_per_innings", "expected_average", "expected_strike_rate", "confidence",
            "scen_full", "scen_strong", "scen_weak", "scen_reduced", "share_1", "share_2", "share_3"]
    fut[cols].round(2).to_csv(REP / "ipl_2027_batting_predictions.csv", index=False)

    # ---- descriptive splits (2024-26) and top-order benchmark ----
    pos = inn.set_index(["match_id", "innings", "name"]).position
    bb = balls[balls.season_id.isin(SPLIT_SEASONS)].copy()
    bb["pos"] = pos.reindex(list(zip(bb.match_id, bb.innings, bb.batter))).to_numpy()
    top = bb[(bb.pos <= 4) & ~bb.is_wide_ball]
    bench = {f"{k}_sr": 100 * top[m].batter_runs.sum() / len(top[m]) for k, m in
             (("pace", ~top.spin), ("spin", top.spin), ("powerplay", top.phase == "powerplay"),
              ("middle", top.phase == "middle"), ("death", top.phase == "death"))}
    srows = {}
    for nm in names:
        sp = splits(balls, nm, SPLIT_SEASONS)
        srows[nm] = {f"{k}_{f}": v for k, (r, bl, o) in sp.items()
                     for f, v in (("runs", r), ("balls", bl), ("outs", o), ("sr", 100 * r / bl if bl else np.nan))}
    split_df = pd.DataFrame(srows).T
    split_df.to_csv(ART / "splits_2024_2026.csv")

    # ---- artifacts & figures ----
    bt.to_csv(ART / "backtest_predictions.csv", index=False)
    summary.to_csv(ART / "backtest_summary.csv", index=False)
    (ART / "params.json").write_text(json.dumps({"features": FEATURES, "form_ratio_p10_p90": [r10, r90], **profile}, indent=2, default=float))
    report.plot_intervals(fut, ART / "forecast_intervals.png")
    report.plot_history(fut, season, ART / "history_and_forecast.png", PARTIAL)
    report.plot_backtest(summary, ART / "backtest_mae.png")

    # ---- markdown ----
    a = fut[["rank", "batter", "expected_runs", "lower_80", "upper_80", "expected_innings", "expected_average",
             "expected_strike_rate", "confidence"]].set_axis(["Rank", "Batter", "Expected Runs", "Lower Estimate", "Upper Estimate",
                                                              "Expected Innings", "Expected Average", "Expected Strike Rate", "Confidence"], axis=1)
    f0 = {"Expected Runs": "{:.0f}", "Lower Estimate": "{:.0f}", "Upper Estimate": "{:.0f}", "Expected Innings": "{:.1f}",
          "Expected Average": "{:.1f}", "Expected Strike Rate": "{:.1f}"}
    scen = fut[["batter", "expected_runs", "scen_full", "scen_strong", "scen_weak", "scen_reduced"]].set_axis(
        ["Batter", "Model expectation", "Full season (14 inn)", "Full + strong form", "Full + weak form", "Reduced (8 inn)"], axis=1)
    s_fmt = {c: "{:.0f}" for c in scen.columns[1:]}
    sm = summary.copy()
    text = "\n\n".join([
        "# IPL 2027 batting predictions — 20 shortlisted batters",
        "*A separate analysis from the IPL 2027 champion forecast; it shares only the raw data files. "
        f"Generated by `python run_batting.py`. Data cutoff: last match in the data (IPL {PARTIAL} is partial: "
        f"{profile['partial_season_matches']} matches).*",
        "**These are model estimates, not facts.** No 2027 squads, teams, batting orders, fitness or schedule exist in the data. "
        "Expected innings come from each player's own history of playing time (including missed seasons), so the forecast does **not** "
        "assume every player plays the full tournament.",
        "## A. Main predictions",
        md(a, f0),
        "Lower/Upper = 80% prediction interval for total runs (split-conformal around the point estimate, calibrated on 2014–2025 out-of-sample errors; see C). "
        "Expected average = expected runs ÷ expected dismissals; expected strike rate = recency-weighted, shrunk SR. "
        "Confidence: **High** = regular (batted in ≥70% of team matches) in each of the last 3 seasons, **Medium** = 2 of 3, **Low** = otherwise. "
        "Confidence is relative: even High carries an interval of several hundred runs.",
        "Intervals are calibrated separately for predictions below 150, 150–350 and above 350 runs, so they jump at those boundaries "
        "(e.g. 361 → lower bound 120 vs 344 → 37): the 150–350 band historically contains many players who lost their place, so its downside is larger.",
        "### Scenarios (runs)",
        "Same runs-per-innings estimate under fixed playing time; strong/weak form = 90th/10th percentile of the historical "
        f"ratio of actual to predicted runs per innings for established batters (×{r90:.2f} / ×{r10:.2f}).",
        md(scen, s_fmt),
        "## B. Individual player analysis",
        f"Splits are for {SPLIT_SEASONS[0]}–{SPLIT_SEASONS[-1]}; benchmark = all batters at positions 1–4 in those seasons "
        "(SR: " + ", ".join(f"{k.replace('_sr', '')} {v:.0f}" for k, v in bench.items()) + "). "
        "Strengths/risks are produced by fixed rules (±15 SR points with ≥60 balls, missed seasons, CV > 0.3, low recent share, role).",
        *[report.player_section(r, season, inn, split_df, bench, PARTIAL) for r in fut.itertuples()],
        "## C. Model evaluation",
        "### Dataset and name matching",
        f"- Ball-by-ball data, {profile['seasons']}: {profile['deliveries_used']:,} deliveries (super overs excluded), "
        f"{profile['player_innings']:,} player innings, {profile['batters']} batters. Runs, balls, boundaries, dismissals, batting position and "
        "phase come from deliveries; bowler type is used to group deliveries into pace or spin.",
        f"- Missing: batsman type on {profile['missing_batsman_type']} deliveries, bowler type on {profile['missing_bowler_type']} (counted as pace). "
        "Matches abandoned without a ball are absent. 'Innings' means batted appearances: players in the XI who did not bat cannot be seen.",
        "- **Not in the data:** age/date of birth, squads, auction/retention, injuries, 2027 teams and batting orders, non-IPL cricket. "
        "Age and career stage are proxied only by years since IPL debut.",
        "- Names were matched on the players file's full names, never by surname (e.g. `R Sharma` = Rahul Sharma, `VR Iyer` = Venkatesh Iyer). "
        "No dataset name batted for two teams in one season, so no different players are merged under one name.",
        md(mapping),
        "### Models (rolling origin: train on target seasons 2010…S−1, test on S, S = 2014–2025)",
        "- Baselines: last-season runs; career average runs per season played; Marcel (5/4/3-weighted innings share × matches × shrunk runs/innings).\n"
        "- Ridge (regularisation chosen by internal CV), RandomForest, gradient boosting (sklearn): direct season runs.\n"
        "- **Two-part ridge** (chosen): innings-per-team-match model × runs-per-innings model (the second is innings-weighted and fit only on seasons where the player batted).\n"
        f"- Features (all from seasons < S, rates only): {', '.join(FEATURES)}.\n"
        "- A player-season is in the population if the player batted in S−1 or S−2, and counts as 0 runs when absent in S. That makes availability part of the target.",
        "### Backtest: season runs",
        md(sm, {"MAE": "{:.1f}", "RMSE": "{:.1f}", "bias": "{:+.1f}"}),
        "Paired bootstrap of the MAE difference (negative = two-part better; 95% interval):",
        md(boots, {"MAE diff": "{:+.1f}", "lo95": "{:+.1f}", "hi95": "{:+.1f}"}),
        "### Backtest: components vs naive baselines",
        md(comp, {"MAE": "{:.2f}"}),
        "### Prediction-interval reliability (nominal 80%)",
        md(pi, {"n": "{:.0f}", "coverage_80": "{:.3f}", "below_lower": "{:.3f}", "above_upper": "{:.3f}", "mean_width": "{:.0f}", "contains_point": "{:.3f}"}),
        "Evaluated on 2016–2025 (each season calibrated only on earlier seasons). The CQR adjustment came out near zero because many rows score exactly 0 runs, "
        "and its quantile trees can place the point estimate outside the interval, so the conformal interval around the two-part point is used.",
        "Coverage by season, established batters (conformal interval):",
        md(pi_season, {"n": "{:.0f}", "coverage_80": "{:.2f}"}),
        "### Known sources of uncertainty",
        f"- The {PARTIAL} season is partial in the data, so the most recent evidence is a part-season.\n"
        "- Playing time is the largest risk: injury, selection, workload, and international clashes are not observable here.\n"
        "- Team and role changes for 2027 are unknown; batting position is assumed to continue from recent seasons.\n"
        f"- Tournament length is assumed to follow the 2022–26 format ({profile['tm_2022_2025']:.1f} matches per team on average, including playoffs).\n"
        "- Seasons are not exchangeable (eras, formats, Impact Player rule), so the conformal coverage guarantee is only approximate.",
        "## D. Visualisations",
        "![forecast](batting/forecast_intervals.png)", "![history](batting/history_and_forecast.png)", "![backtest](batting/backtest_mae.png)",
    ])
    (REP / "ipl_2027_batting_predictions.md").write_text(text)
    log.info("wrote %s", REP / "ipl_2027_batting_predictions.md")
    print(fut[cols[:13]].round(1).to_string(index=False))
    print(summary.round(1).to_string(index=False)); print(boots.round(1).to_string(index=False)); print(comp.round(2).to_string(index=False)); print(pi.round(3).to_string(index=False))


md = report.md_table

if __name__ == "__main__":
    main()
