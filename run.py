"""End-to-end pipeline: inspect -> features -> backtests -> 2027 simulation -> report artifacts.

Usage: python run.py [--sims 20000]
"""
import argparse
import json
import logging
from pathlib import Path

import joblib
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
from sklearn.linear_model import LogisticRegression  # noqa: E402
from sklearn.pipeline import make_pipeline  # noqa: E402
from sklearn.preprocessing import StandardScaler  # noqa: E402

from iplpred import data  # noqa: E402
from iplpred.features import BASE  # noqa: E402
from iplpred.models import (ELO_GRID, FEATURES, FIT_FROM, TEST_SEASONS, Backtester,  # noqa: E402
                        bootstrap_diff, calibration_table, metrics)
from iplpred.simulate import ipl_group_fixtures, simulate  # noqa: E402

OUT = Path(__file__).resolve().parent / "outputs"
MODELS = ["coin", "winpct", "elo", "logreg", "gbm", "ens_elo_lr", "logreg_toss"]
INK, MUTED, GRID, BLUE, ORANGE, AQUA, YELLOW = "#0b0b0b", "#898781", "#e1e0d9", "#2a78d6", "#eb6834", "#1baf7a", "#eda100"
log = logging.getLogger("run")


def style(ax):
    ax.spines[["top", "right"]].set_visible(False)
    ax.spines[["left", "bottom"]].set_color("#c3c2b7")
    ax.tick_params(colors=MUTED)
    ax.grid(axis="y", color=GRID, lw=0.6)
    ax.set_axisbelow(True)


def mixture(post, fn, n_sims, min_w=1e-3):
    """Posterior-weighted average of fn(shrink, tau, n_sims) simulation results."""
    post = [(g, w) for g, w in post if w >= min_w]
    tot = sum(w for _, w in post)
    rs = [(w / tot, fn(sh, ta, max(500, int(n_sims * w / tot)))) for (sh, ta), w in post]
    return {k: sum(w * r[k] for w, r in rs) for k in rs[0][1]}


def tournament_backtest(bt: Backtester, outcomes: pd.DataFrame, n_sims: int) -> pd.DataFrame:
    """Pre-season title/playoff forecasts for each completed test season vs the uniform baseline."""
    rows = []
    for s in [s for s in TEST_SEASONS if s in set(outcomes.season)]:
        ci = bt.pick_elo(range(FIT_FROM, s))
        post = bt.posterior(ci, range(FIT_FROM + 1, s))
        teams = bt.season_start_mu(ci, s, 1.0)[0]
        idx = {t: i for i, t in enumerate(teams)}
        g = bt.season_league(s)  # the schedule (not results) is public before the season
        fx = np.c_[g.team_a.map(idx), g.team_b.map(idx), g.home]
        o = outcomes.set_index("season").loc[s]
        fmt = "semis" if s <= 2010 else "qualifier"
        fn = lambda sh, ta, n: simulate(bt.season_start_mu(ci, s, sh)[1], fx, fmt, ELO_GRID[ci]["home"], ta, n, seed=s)
        mle = max(post, key=lambda gw: gw[1])[0]
        for label, r in (("bma", mixture(post, fn, n_sims)), ("mle", fn(*mle, n_sims))):
            inpo = np.isin(teams, o.playoff_teams).astype(float)
            pc = r["champion"][idx[o.champion]]
            rows.append({"season": s, "variant": label, "n_teams": len(teams), "champion": o.champion,
                         "p_champion": pc, "log_p_champion": np.log(max(pc, 1e-4)),
                         "rank_of_champion": int((r["champion"] > pc).sum() + 1),
                         "playoff_brier": ((r["playoffs"] - inpo) ** 2).mean(),
                         "playoff_brier_uniform": ((4 / len(teams) - inpo) ** 2).mean(),
                         "log_uniform": np.log(1 / len(teams)),
                         "favourite": teams[int(r["champion"].argmax())], "p_favourite": r["champion"].max()})
    return pd.DataFrame(rows)


def forecast_2027(bt: Backtester, matches: pd.DataFrame, n_sims: int, n_schedules: int = 20):
    ci = bt.pick_elo(range(FIT_FROM, 2027))
    post = bt.posterior(ci, range(FIT_FROM + 1, 2027))
    prm = ELO_GRID[ci]
    teams = sorted(set(matches[matches.season == 2026].team_a) | set(matches[matches.season == 2026].team_b))
    final = bt.final_ratings(ci)
    start = np.array([BASE + prm["carry"] * (final[t] - BASE) for t in teams])  # season-boundary step

    def run(sh, tau, n):
        # The 2027 group draw is unknown: average over random draws of the 2022-26 format.
        per = max(25, n // n_schedules)
        rs = [simulate(BASE + sh * (start - BASE), ipl_group_fixtures(len(teams), np.random.default_rng(1000 + i)),
                       "qualifier", prm["home"], tau, per, seed=i) for i in range(n_schedules)]
        return {k: np.mean([r[k] for r in rs], 0) for k in rs[0]}

    res = mixture(post, run, n_sims)
    mle = max(post, key=lambda gw: gw[1])[0]
    df = pd.DataFrame({"team": teams, "name": [data.TEAM_NAME[t] for t in teams],
                       "elo_end_of_data": [final[t] for t in teams], "mu_2027_at_mle": BASE + mle[0] * (start - BASE),
                       "p_playoffs": res["playoffs"], "p_final": res["final"], "p_champion": res["champion"],
                       "exp_points": res["exp_points"]}).sort_values("p_champion", ascending=False)
    sens = pd.DataFrame({f"tau={ta}": dict(zip(teams, run(mle[0], ta, n_sims)["champion"]))
                         for ta in (0, 50, 100, 150)}).loc[df.team]
    post_tab = pd.DataFrame([{"shrink": sh, "tau": ta, "weight": w} for (sh, ta), w in post]).sort_values("weight", ascending=False)
    params = {"elo": prm, "mle_shrink_tau": mle, "n_sims": n_sims, "n_schedules": n_schedules,
              "data_cutoff": str(matches.date.max().date()), "teams": teams}
    return df, sens, params, post_tab


def plots(preds, cal, fc, tb):
    per = preds.groupby("season").apply(lambda g: pd.Series({m: metrics(g.a_won, g[m])["log_loss"] for m in ("coin", "elo", "logreg", "gbm")}), include_groups=False)
    fig, ax = plt.subplots(figsize=(8, 4))
    for m, c in zip(per.columns, (MUTED, BLUE, ORANGE, AQUA)):
        ax.plot(per.index, per[m], color=c, lw=2, marker="o", ms=4, label=m)
    ax.set_title("Out-of-sample match log loss by season (lower is better)", loc="left", color=INK)
    ax.set_ylabel("log loss", color=MUTED)
    style(ax); ax.legend(frameon=False, ncol=4)
    fig.tight_layout(); fig.savefig(OUT / "backtest_logloss_by_season.png", dpi=150); plt.close(fig)

    fig, ax = plt.subplots(figsize=(5, 5))
    ax.plot([0.2, 0.8], [0.2, 0.8], color=MUTED, lw=1, ls="--", label="perfect calibration")
    for m, c in (("elo", BLUE), ("logreg", ORANGE)):
        ax.plot(cal[m].mean_pred, cal[m].observed, color=c, lw=2, marker="o", ms=5, label=m)
    ax.set_xlabel("predicted P(team_a wins)", color=MUTED); ax.set_ylabel("observed frequency", color=MUTED)
    ax.set_title("Calibration, pooled 2013-2026 test matches", loc="left", color=INK)
    style(ax); ax.legend(frameon=False)
    fig.tight_layout(); fig.savefig(OUT / "calibration.png", dpi=150); plt.close(fig)

    f = fc.sort_values("p_champion")
    fig, ax = plt.subplots(figsize=(8, 4.5))
    ax.barh(f.name, 100 * f.p_champion, color=BLUE, height=0.6)
    ax.axvline(10, color=MUTED, lw=1, ls="--")
    ax.text(10.2, -0.6, "uniform 10%", color=MUTED, fontsize=8)
    for y, v in enumerate(100 * f.p_champion):
        ax.text(v + 0.2, y, f"{v:.1f}%", va="center", fontsize=8, color=INK)
    ax.set_title("IPL 2027 championship probability (conditional forecast)", loc="left", color=INK)
    ax.set_xlabel("% of simulated seasons won", color=MUTED)
    style(ax); ax.grid(axis="x", color=GRID, lw=0.6); ax.grid(axis="y", visible=False)
    fig.tight_layout(); fig.savefig(OUT / "ipl2027_champion_probabilities.png", dpi=150); plt.close(fig)


def md(df, floatfmt=".3f"):
    cell = lambda v: format(v, floatfmt) if isinstance(v, (float, np.floating)) else str(v)
    rows = [[cell(v) for v in r] for r in df.itertuples(index=False)]
    return "\n".join(["| " + " | ".join(map(str, df.columns)) + " |", "|" + "---|" * len(df.columns)]
                     + ["| " + " | ".join(r) + " |" for r in rows])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sims", type=int, default=20_000)
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    OUT.mkdir(exist_ok=True)

    profile = data.inspect()
    (OUT / "data_profile.json").write_text(json.dumps(profile, indent=2, default=str))
    matches = data.load_matches()
    outcomes = data.season_outcomes(matches)
    outcomes.to_csv(OUT / "season_outcomes.csv", index=False)
    tms = data.team_match_stats(matches, data.load_balls())
    bt = Backtester(matches, tms)

    log.info("match-level rolling-origin backtest")
    preds = bt.match_backtest()
    preds.to_csv(OUT / "match_predictions_backtest.csv", index=False)
    summary = pd.DataFrame([{"model": m, **metrics(preds.a_won, preds[m])} for m in MODELS])
    boot = pd.DataFrame([{"comparison": f"{a} - {b}", **dict(zip(["mean", "lo95", "hi95"], bootstrap_diff(preds.a_won.to_numpy(), preds[a].to_numpy(), preds[b].to_numpy())))}
                         for a, b in [("elo", "coin"), ("logreg", "coin"), ("gbm", "coin"), ("winpct", "coin"),
                                      ("logreg", "elo"), ("gbm", "elo"), ("ens_elo_lr", "elo"), ("logreg_toss", "logreg")]])
    cal = {m: calibration_table(preds.a_won.to_numpy(), preds[m].to_numpy(), 8) for m in ("elo", "logreg")}

    log.info("pre-tournament backtest")
    pre_rows, pre_preds = bt.pre_backtest()
    pre_summary = pd.DataFrame([{"model": m, **metrics(pre_preds.y, pre_preds[m])} for m in ("coin", "pre_tournament")])
    pre_rows["elo"] = pre_rows.elo.map(lambda i: str(ELO_GRID[i]))
    pre_rows.to_csv(OUT / "pretournament_params_by_season.csv", index=False)

    log.info("tournament backtest")
    tb = tournament_backtest(bt, outcomes, 10_000)
    tb.to_csv(OUT / "tournament_backtest.csv", index=False)
    tb_sum = tb.groupby("variant").agg(seasons=("season", "size"), mean_log_p_champion=("log_p_champion", "mean"),
                                       mean_log_uniform=("log_uniform", "mean"), mean_p_champion=("p_champion", "mean"),
                                       playoff_brier=("playoff_brier", "mean"), playoff_brier_uniform=("playoff_brier_uniform", "mean")).reset_index()

    log.info("IPL 2027 simulation")
    fc, sens, params, post_tab = forecast_2027(bt, matches, args.sims)
    fc.to_csv(OUT / "ipl2027_forecast.csv", index=False)
    sens.to_csv(OUT / "ipl2027_tau_sensitivity.csv")
    post_tab.to_csv(OUT / "ipl2027_posterior_shrink_tau.csv", index=False)
    (OUT / "ipl2027_params.json").write_text(json.dumps(params, indent=2))

    # Saved artifacts: final Elo ratings and the in-season match model refit on all data.
    ci = bt.pick_elo(range(FIT_FROM, 2027))
    feats = bt.features(ci)
    tr = feats[feats.a_won.notna() & (feats.season >= FIT_FROM)]
    lr = make_pipeline(StandardScaler(), LogisticRegression(C=1.0)).fit(tr[FEATURES], tr.a_won)
    joblib.dump({"model": lr, "features": FEATURES, "elo_params": ELO_GRID[ci]}, OUT / "match_model_logreg.joblib")
    (OUT / "elo_ratings_final.json").write_text(json.dumps(bt.final_ratings(ci), indent=2))
    coef = dict(zip(FEATURES, lr[-1].coef_[0].round(3)))

    plots(preds, cal, fc, tb)
    mc_se = float(np.sqrt(fc.p_champion.max() * (1 - fc.p_champion.max()) / args.sims))
    fc_tab = fc.assign(**{c: 100 * fc[c] for c in ("p_playoffs", "p_final", "p_champion")})
    text = "\n\n".join([
        "# Generated results (do not edit; produced by run.py)",
        f"Data cutoff: {params['data_cutoff']}. Final Elo params: {params['elo']}; MLE (shrink, tau) = {params['mle_shrink_tau']}.",
        "## Match-level backtest (pooled, test seasons 2013-2026, pre-match & pre-toss except logreg_toss)",
        md(summary, ".4f"), "## Paired bootstrap: mean log-loss difference (negative = first model better)",
        md(boot, ".4f"), "## Calibration (8 quantile bins)",
        "### elo\n" + md(cal["elo"]), "### logreg\n" + md(cal["logreg"]),
        f"## Logistic regression coefficients (standardised, refit on {FIT_FROM}-2026)\n{coef}",
        "## Pre-tournament (frozen at season start) match predictions, pooled test seasons",
        md(pre_summary, ".4f"), md(pre_rows, ".2f"),
        "## Tournament backtest (pre-season title forecasts)", md(tb_sum, ".3f"),
        md(tb[tb.variant == "bma"].drop(columns="variant"), ".3f"),
        f"## IPL 2027 forecast ({args.sims} sims; MC s.e. of largest title prob ≈ {100 * mc_se:.2f} pp)",
        md(fc_tab, ".1f"), f"Sum of champion probabilities: {fc.p_champion.sum():.4f}",
        "## Posterior over (shrink, tau) used for the 2027 mixture (top 10)", md(post_tab.head(10), ".3f"),
        "## Sensitivity of title probability to tau (shrink fixed at MLE)", md(sens.reset_index(names="team"), ".3f"),
    ])
    (OUT / "results.md").write_text(text)
    log.info("done -> %s", OUT)
    print(fc_tab.to_string(index=False, float_format="%.1f"))


if __name__ == "__main__":
    main()
