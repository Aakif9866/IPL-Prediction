"""Export the real model outputs and parameters for the web app (web/src/data, web/public/downloads).

Read-only with respect to both pipelines: run `python run.py` and `python run_batting.py` first.
Usage: python export_web_data.py
"""
import json
import logging
import re
import shutil
from pathlib import Path

import numpy as np
import pandas as pd

from batting.data import PLAYERS, TEAM_CODE as BAT_TEAM_CODE, innings_table, load_balls, season_table, team_matches
from batting.model import BIN_EDGES, OFFSET, build_rows, conformal_interval
from iplpred import data as cdata
from iplpred.features import BASE, elo

ROOT = Path(__file__).resolve().parent
OUT, CH, BR = ROOT / "outputs", ROOT / "REPORT.md", ROOT / "reports"
WEB = ROOT / "web"
DATA, DL = WEB / "src" / "data", WEB / "public" / "downloads"
log = logging.getLogger("export")

TEAM_COLOR = {"CSK": "#F9CD05", "DC": "#17479E", "GT": "#1C2C5B", "KKR": "#3A225D", "LSG": "#A72056",
              "MI": "#004BA0", "PBKS": "#DD1F2D", "RCB": "#EC1C24", "RR": "#EA1A85", "SRH": "#FF822A"}


def md_tables(text: str) -> dict:
    """{heading: [table rows as dicts]} for every pipe table, keyed by the nearest heading above it."""
    out, heading, lines = {}, None, text.splitlines()
    i = 0
    while i < len(lines):
        ln = lines[i]
        if ln.startswith("#"):
            heading = ln.lstrip("#").strip()
        if ln.startswith("|") and i + 1 < len(lines) and re.match(r"^\|[\s:|-]+\|?$", lines[i + 1]):
            cols = [c.strip() for c in ln.strip("|").split("|")]
            rows, i = [], i + 2
            while i < len(lines) and lines[i].startswith("|"):
                rows.append(dict(zip(cols, [c.strip() for c in lines[i].strip("|").split("|")])))
                i += 1
            key, n = heading, 2
            while key in out:
                key, n = f"{heading} #{n}", n + 1
            out[key] = rows
            continue
        i += 1
    return out


def num(v):
    try:
        f = float(str(v).replace("+", "").replace("%", "").replace("−", "-"))
    except ValueError:
        return v
    return None if np.isnan(f) else f


def clean(rows):
    return [{k: num(v) for k, v in r.items()} for r in rows]


def champion():
    m = cdata.load_matches()
    params = json.loads((OUT / "ipl2027_params.json").read_text())
    prm = params["elo"]
    fc = pd.read_csv(OUT / "ipl2027_forecast.csv")
    post = pd.read_csv(OUT / "ipl2027_posterior_shrink_tau.csv")
    sens = pd.read_csv(OUT / "ipl2027_tau_sensitivity.csv", index_col=0)
    outcomes = pd.read_csv(OUT / "season_outcomes.csv")
    for c in ("teams", "playoff_teams", "finalists"):
        outcomes[c] = outcomes[c].map(eval)  # written by run.py from Python lists
    tb = pd.read_csv(OUT / "tournament_backtest.csv")
    final = json.loads((OUT / "elo_ratings_final.json").read_text())
    # Season-end Elo per team with the final parameters (re-running the same function on truncated data).
    hist = {}
    for s in sorted(m.season.unique()):
        _, _, _, r = elo(m[m.season <= s], **prm)
        teams_s = set(m[m.season == s].team_a) | set(m[m.season == s].team_b)
        for t in teams_s:
            hist.setdefault(t, []).append({"season": int(s), "elo": round(r[t], 1)})
    if any(abs(final[t] - hist[t][-1]["elo"]) > 0.05 for t in params["teams"]):
        raise RuntimeError("season-end Elo does not reproduce the saved final ratings")

    def record(t, s):
        g = m[(m.season == s) & ((m.team_a == t) | (m.team_b == t))]
        won = ((g.team_a == t) & (g.a_won == 1)) | ((g.team_b == t) & (g.a_won == 0))
        return {"played": int(len(g)), "won": int(won.sum()), "no_result": int(g.a_won.isna().sum())}

    teams = []
    for r in fc.itertuples():
        t = r.team
        o = outcomes
        teams.append({
            "code": t, "name": r.name, "color": TEAM_COLOR[t],
            "p_playoffs": r.p_playoffs, "p_final": r.p_final, "p_champion": r.p_champion, "exp_points": r.exp_points,
            "elo_end": r.elo_end_of_data, "start_2027": BASE + prm["carry"] * (final[t] - BASE),
            "tau_sensitivity": {c: float(sens.loc[t, c]) for c in sens.columns},
            "elo_history": hist[t],
            "titles": [int(s) for s, c in zip(o.season, o.champion) if c == t],
            "finals": [int(s) for s, f in zip(o.season, o.finalists) if t in f],
            "playoffs": [int(s) for s, p in zip(o.season, o.playoff_teams) if t in p],
            "seasons": sorted({int(s) for s in m[(m.team_a == t) | (m.team_b == t)].season}),
            "record_2025": record(t, 2025), "record_2026": record(t, 2026),
        })
    res = md_tables((OUT / "results.md").read_text())
    bma = tb[tb.variant == "bma"]
    eras = []
    for label, g in (("2013–2021", bma[bma.season <= 2021]), ("2022–2025", bma[bma.season >= 2022]), ("All", bma)):
        eras.append({"period": label, "seasons": len(g), "model_log_p": g.log_p_champion.mean(), "uniform_log_p": g.log_uniform.mean(),
                     "beats_uniform": int((g.log_p_champion > g.log_uniform).sum()),
                     "playoff_brier": g.playoff_brier.mean(), "playoff_brier_uniform": g.playoff_brier_uniform.mean()})
    profile = json.loads((OUT / "data_profile.json").read_text())
    return {
        "meta": {"data_cutoff": params["data_cutoff"], "n_sims": params["n_sims"], "elo": prm, "base": BASE,
                 "format": "2022–2026 IPL format: 10 teams, 14 league matches each (two groups drawn at random per simulation), top-4 Qualifier/Eliminator playoffs"},
        "teams": teams,
        "posterior": post.to_dict("records"),
        "match_backtest": clean(res["Match-level backtest (pooled, test seasons 2013-2026, pre-match & pre-toss except logreg_toss)"]),
        "bootstrap": clean(res["Paired bootstrap: mean log-loss difference (negative = first model better)"]),
        "pre_tournament": clean(res["Pre-tournament (frozen at season start) match predictions, pooled test seasons"]),
        "tournament_backtest": bma[["season", "n_teams", "champion", "p_champion", "rank_of_champion", "favourite", "p_favourite",
                                    "playoff_brier", "playoff_brier_uniform"]].to_dict("records"),
        "eras": eras,
        "profile": {k: profile[k] for k in ("date_range", "result_counts", "team1_bats_first", "toss_winner_wins",
                                            "home_team_win_rate", "home_matches", "season_2026_matches", "win_by_runs_consistent_with_balls")}
                   | {"matches": sum(profile["matches_per_season"].values()), "deliveries": profile["files"]["ball_by_ball_data.csv"]},
    }


def batters():
    fc = pd.read_csv(BR / "ipl_2027_batting_predictions.csv")
    bt = pd.read_csv(BR / "batting" / "backtest_predictions.csv")
    bparams = json.loads((BR / "batting" / "params.json").read_text())
    splits = pd.read_csv(BR / "batting" / "splits_2024_2026.csv", index_col=0)
    balls = load_balls()
    inn = innings_table(balls)
    tm = team_matches()
    season = season_table(inn, tm)
    season["team_code"] = season.team.map(BAT_TEAM_CODE)
    names = [v[0] for v in PLAYERS.values()]
    feats = build_rows(season, inn, tm, 2027, names).set_index("name")
    # Conformal quantiles per prediction band (same calibration set as run_batting.py), verified to reproduce the CSV.
    bands, a = [], 0.1
    edges = (0.0, *BIN_EDGES, float("inf"))
    for lo, hi in zip(edges[:-1], edges[1:]):
        g = bt[(bt.two_part >= lo) & (bt.two_part < hi)]
        r = (g.y_runs - g.two_part) / (g.two_part + OFFSET)
        bands.append({"from": lo, "to": None if np.isinf(hi) else hi, "q_lo": float(r.quantile(a)), "q_hi": float(r.quantile(1 - a)), "n": len(g)})
    lo_chk, hi_chk = conformal_interval(bt.y_runs, bt.two_part, fc.expected_runs)
    if not (np.allclose(lo_chk, fc.lower_80, atol=0.01) and np.allclose(hi_chk, fc.upper_80, atol=0.01)):
        raise RuntimeError("exported conformal bands do not reproduce the published intervals")
    md = (BR / "ipl_2027_batting_predictions.md").read_text()
    sections = dict(re.findall(r"### \d+\. (.+?) \(`[^`]+`\)\n(.*?)(?=\n### |\n## )", md, flags=re.S))
    players = []
    for r in fc.itertuples():
        nm = r.dataset_name
        h = season[season.name == nm].sort_values("season")
        f = feats.loc[nm]
        pos = float(f.pos_w)
        sp = splits.loc[nm]
        bullets = {}
        for line in sections[r.batter].splitlines():
            mt = re.match(r"- \*\*(.+?):\*\* (.*)", line)
            if mt:
                bullets[mt.group(1)] = mt.group(2)
        players.append({
            "slug": re.sub(r"[^a-z]+", "-", r.batter.lower()).strip("-"), "name": r.batter, "dataset_name": nm, "player_id": int(r.player_id),
            "rank": int(r.rank), "team_2026": r.last_team_in_data, "team_color": TEAM_COLOR.get(r.last_team_in_data, "#64748b"),
            "role": "Opener" if pos <= 2.5 else "Top order" if pos <= 4.5 else "Middle order / finisher",
            "batting_position_w": round(pos, 2),
            "expected_runs": r.expected_runs, "lower_80": r.lower_80, "upper_80": r.upper_80,
            "expected_innings": r.expected_innings, "expected_rpi": r.expected_runs_per_innings,
            "expected_average": r.expected_average, "expected_sr": r.expected_strike_rate, "confidence": r.confidence,
            "scenarios": {"full": r.scen_full, "strong": r.scen_strong, "weak": r.scen_weak, "reduced": r.scen_reduced},
            "share": [r.share_1, r.share_2, r.share_3],
            "history": [{"season": int(s.season), "runs": int(s.runs), "innings": int(s.inn), "balls": int(s.balls), "outs": int(s.outs),
                         "fifties": int(s.fifties), "team": s.team_code} for s in h.itertuples()],
            "splits": {k: {"runs": int(sp[f"{k}_runs"]), "balls": int(sp[f"{k}_balls"]), "outs": int(sp[f"{k}_outs"])}
                       for k in ("pace", "spin", "powerplay", "middle", "death")},
            "recent_innings": inn[(inn.name == nm) & (inn.season >= 2023)].runs.astype(int).tolist(),
            "analysis": bullets,
        })
    tabs = md_tables(md)
    return {
        "meta": {"target": 2027, "team_matches_2027": bparams["tm_2022_2025"], "form_ratio_p10_p90": bparams["form_ratio_p10_p90"],
                 "conformal": {"offset": OFFSET, "coverage": 0.8, "bands": bands}, "partial_season": 2026,
                 "partial_season_matches": bparams["partial_season_matches"]},
        "players": players,
        "backtest": clean(tabs["Backtest: season runs"]),
        "bootstrap": clean(tabs["Backtest: season runs #2"]),
        "components": clean(tabs["Backtest: components vs naive baselines"]),
        "intervals": clean(tabs["Prediction-interval reliability (nominal 80%)"]),
        "intervals_by_season": clean(tabs["Prediction-interval reliability (nominal 80%) #2"]),
    }


def main():
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
    DATA.mkdir(parents=True, exist_ok=True)
    DL.mkdir(parents=True, exist_ok=True)
    for name, obj in (("champion.json", champion()), ("batters.json", batters())):
        (DATA / name).write_text(json.dumps(obj, indent=1, allow_nan=False, default=lambda o: o.item() if hasattr(o, "item") else str(o)))
        log.info("wrote %s", DATA / name)
    for src, dst in ((CH, "ipl2027_champion_report.md"), (OUT / "results.md", "ipl2027_champion_results.md"),
                     (OUT / "ipl2027_forecast.csv", "ipl2027_champion_forecast.csv"),
                     (OUT / "tournament_backtest.csv", "ipl2027_champion_tournament_backtest.csv"),
                     (BR / "ipl_2027_batting_predictions.md", "ipl_2027_batting_predictions.md"),
                     (BR / "ipl_2027_batting_predictions.csv", "ipl_2027_batting_predictions.csv")):
        shutil.copyfile(src, DL / dst)
    # Figures/tables the two reports link to, at the same relative paths the markdown uses.
    figs = WEB / "public" / "reports"
    for src_dir, dst, pattern in ((OUT, figs / "outputs", "*.png"), (OUT, figs / "outputs", "results.md"), (BR / "batting", figs / "batting", "*.png")):
        dst.mkdir(parents=True, exist_ok=True)
        for f in src_dir.glob(pattern):
            shutil.copyfile(f, dst / f.name)
    log.info("copied downloads to %s and report figures to %s", DL, figs)


if __name__ == "__main__":
    main()
