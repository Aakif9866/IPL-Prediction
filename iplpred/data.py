"""Load, clean and profile the IPL data files in ./IPL."""
import logging
from pathlib import Path

import numpy as np
import pandas as pd

log = logging.getLogger(__name__)
DATA_DIR = Path(__file__).resolve().parent.parent / "IPL"

TEAM_CODE = {1: "RCB", 2: "SRH", 3: "MI", 4: "RPS", 5: "GL", 6: "KKR", 129: "CSK", 134: "RR",
             252: "DC", 494: "PBKS", 614: "LSG", 615: "GT", 1414: "KTK", 1419: "PWI"}
TEAM_NAME = {"RCB": "Royal Challengers Bengaluru", "SRH": "Sunrisers Hyderabad", "MI": "Mumbai Indians",
             "RPS": "Rising Pune Supergiant", "GL": "Gujarat Lions", "KKR": "Kolkata Knight Riders",
             "CSK": "Chennai Super Kings", "RR": "Rajasthan Royals", "DC": "Delhi Capitals",
             "PBKS": "Punjab Kings", "LSG": "Lucknow Super Giants", "GT": "Gujarat Titans",
             "KTK": "Kochi Tuskers Kerala", "PWI": "Pune Warriors", "DCH": "Deccan Chargers"}
# ponytail: static team -> home-city map (public knowledge, not in the data); ignores one-off
# relocations such as the 2022 Mumbai/Pune-only season, where it marks MI "home" in Mumbai.
HOME_CITIES = {"RCB": {"Bangalore", "Bengaluru"}, "SRH": {"Hyderabad"}, "MI": {"Mumbai"},
               "RPS": {"Pune"}, "GL": {"Rajkot", "Kanpur"}, "KKR": {"Kolkata"}, "CSK": {"Chennai"},
               "RR": {"Jaipur", "Guwahati"}, "DC": {"Delhi", "Visakhapatnam"},
               "PBKS": {"Chandigarh", "Mohali", "New Chandigarh", "Dharamsala", "Indore"},
               "LSG": {"Lucknow"}, "GT": {"Ahmedabad"}, "KTK": {"Kochi", "Indore"}, "PWI": {"Pune"},
               "DCH": {"Hyderabad", "Cuttack", "Visakhapatnam"}}


def team_key(team_id: int, season: int) -> str:
    # The alias table maps "Deccan Chargers" onto team_id 2 (Sunrisers), but SRH is a separate
    # franchise created in 2013 after Deccan Chargers was terminated, so split them.
    if team_id == 2 and season <= 2012:
        return "DCH"
    return TEAM_CODE[team_id]


def load_matches(data_dir: Path = DATA_DIR) -> pd.DataFrame:
    """One row per match with teams ordered alphabetically (team_a < team_b).

    The raw team1 column is mostly the side batting first (a post-toss fact), so we never use
    it for orientation. a_won is NaN for no-results (the raw match_winner there is just the
    toss winner and must not be used). For ties, a_won follows the official super-over winner.
    """
    path = data_dir / "ipl_matches_data.csv"
    if not path.exists():
        raise FileNotFoundError(f"missing {path}")
    m = pd.read_csv(path)
    unknown = (set(m.team1) | set(m.team2)) - set(TEAM_CODE)
    if unknown:
        raise ValueError(f"unknown team ids {unknown}")
    s = m.season_id
    t1 = [team_key(t, y) for t, y in zip(m.team1, s)]
    t2 = [team_key(t, y) for t, y in zip(m.team2, s)]
    win = [team_key(t, y) for t, y in zip(m.match_winner, s)]
    toss = [team_key(t, y) for t, y in zip(m.toss_winner, s)]
    df = pd.DataFrame({"match_id": m.match_id, "season": s, "date": pd.to_datetime(m.match_date),
                       "city": m.city, "venue": m.venue, "result": m.result,
                       "team_a": [min(x, y) for x, y in zip(t1, t2)], "team_b": [max(x, y) for x, y in zip(t1, t2)],
                       "winner": win, "toss_winner": toss, "toss_decision": m.toss_decision,
                       "match_number": m.match_number})
    df["a_won"] = np.where(df.result == "no result", np.nan, (df.winner == df.team_a).astype(float))
    df["a_toss"] = (df.toss_winner == df.team_a).astype(int)
    ha = [c in HOME_CITIES[a] for a, c in zip(df.team_a, df.city)]
    hb = [c in HOME_CITIES[b] for b, c in zip(df.team_b, df.city)]
    df["home"] = np.array(ha, int) - np.array(hb, int)  # +1 team_a at home, -1 team_b, 0 neutral
    # Playoff matches carry no match_number in this dataset (checked: 3/season 2008-09, 4 after).
    df["playoff"] = df.match_number.isna() & (df.season < 2026)
    df = df.sort_values(["date", "match_id"]).reset_index(drop=True)
    log.info("loaded %d matches, seasons %d-%d", len(df), df.season.min(), df.season.max())
    return df


def season_outcomes(matches: pd.DataFrame) -> pd.DataFrame:
    """Per completed season: teams, playoff teams, finalists, champion (from the data itself)."""
    rows = []
    for season, g in matches.groupby("season"):
        po = g[g.playoff]
        if po.empty:
            continue
        final = po.iloc[-1]
        top = sorted(set(po.team_a) | set(po.team_b))
        rows.append({"season": season, "teams": sorted(set(g.team_a) | set(g.team_b)),
                     "playoff_teams": top, "finalists": [final.team_a, final.team_b],
                     "champion": final.winner, "n_playoff_matches": len(po)})
    return pd.DataFrame(rows)


def load_balls(data_dir: Path = DATA_DIR) -> pd.DataFrame:
    cols = ["season_id", "match_id", "team_batting", "team_bowling", "innings", "total_runs",
            "is_wide_ball", "is_no_ball", "is_wicket", "is_super_over"]
    return pd.read_csv(data_dir / "ball_by_ball_data.csv", usecols=cols)


def team_match_stats(matches: pd.DataFrame, balls: pd.DataFrame) -> pd.DataFrame:
    """Per team per match: run-rate differential (runs per 6 legal balls, for minus against),
    excluding super overs. Post-match quantities: only ever used after shifting (see features)."""
    b = balls[(~balls.is_super_over) & (balls.innings <= 2)].copy()
    b["legal"] = ~(b.is_wide_ball | b.is_no_ball)
    b["bat"] = [team_key(t, y) for t, y in zip(b.team_batting, b.season_id)]
    inn = b.groupby(["match_id", "bat"]).agg(runs=("total_runs", "sum"), legal=("legal", "sum")).reset_index()
    inn["rr"] = 6 * inn.runs / inn.legal.clip(lower=1)
    rr = inn.set_index(["match_id", "bat"]).rr
    out = []
    for r in matches.itertuples():
        for t, o in ((r.team_a, r.team_b), (r.team_b, r.team_a)):
            f, a = rr.get((r.match_id, t), np.nan), rr.get((r.match_id, o), np.nan)
            won = np.nan if np.isnan(r.a_won) else float(r.a_won == (t == r.team_a))
            out.append((r.match_id, r.date, t, f - a, won))
    return pd.DataFrame(out, columns=["match_id", "date", "team", "rrd", "won"])


def inspect(data_dir: Path = DATA_DIR) -> dict:
    """Dataset profile used in the report. Every number here is computed, none typed in."""
    raw = pd.read_csv(data_dir / "ipl_matches_data.csv")
    balls = pd.read_csv(data_dir / "ball_by_ball_data.csv", low_memory=False)
    players = pd.read_csv(data_dir / "players-data-updated.csv")
    m = load_matches(data_dir)
    inn = balls[~balls.is_super_over].groupby(["match_id", "innings"]).total_runs.sum().unstack()
    j = raw.set_index("match_id").join(inn)
    j = j[j.win_by_runs.notna()]
    hm = m[(m.home != 0) & m.a_won.notna()]
    return {
        "files": {f.name: sum(1 for _ in open(f)) - 1 for f in sorted(data_dir.glob("*.csv"))},
        "date_range": (str(m.date.min().date()), str(m.date.max().date())),
        "matches_per_season": m.groupby("season").size().to_dict(),
        "result_counts": raw.result.value_counts().to_dict(),
        "duplicate_match_ids": int(raw.match_id.duplicated().sum()),
        "duplicate_deliveries": int(balls.duplicated(["match_id", "innings", "over_number", "ball_number"]).sum()),
        "missing_raw": {k: int(v) for k, v in raw.isna().sum().items() if v},
        "missing_balls": {k: int(v) for k, v in balls.isna().sum().items() if v and k not in
                          ("player_out", "fielders_involved", "wicket_kind")},
        "matches_without_balls": len(set(raw.match_id) - set(balls.match_id)),
        "win_by_runs_consistent_with_balls": float(((j[1] - j[2]) == j.win_by_runs).mean()),
        "super_over_balls": int(balls.is_super_over.sum()),
        "players": len(players),
        "venue_spellings": int(raw.venue.nunique()),
        "team1_bats_first": float((raw.team1 == raw.match_id.map(
            balls[balls.innings == 1].groupby("match_id").team_batting.first())).mean()),
        "toss_winner_wins": float((raw.toss_winner == raw.match_winner)[raw.result == "win"].mean()),
        "no_result_winner_equals_toss_winner": float((raw.toss_winner == raw.match_winner)[raw.result == "no result"].mean()),
        "home_team_win_rate": float((hm.a_won == (hm.home == 1)).mean()),
        "home_matches": len(hm),
        "season_2026_last_date": str(m[m.season == 2026].date.max().date()),
        "season_2026_matches": int((m.season == 2026).sum()),
        "teams_2026": sorted(set(m[m.season == 2026].team_a) | set(m[m.season == 2026].team_b)),
    }
