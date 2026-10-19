"""Batting data: innings-level and season-level tables built from ball-by-ball data.

Self-contained (separate from the champion project in iplpred/).
"""
import logging
from pathlib import Path

import numpy as np
import pandas as pd

log = logging.getLogger(__name__)
DATA_DIR = Path(__file__).resolve().parent.parent / "IPL"

# Display name -> (dataset short name, player_id). Matched on players-data player_full_name, never on
# surname: "R Sharma" is Rahul Sharma (not Rohit = RG Sharma) and "VR Iyer" is Venkatesh Iyer
# (not Shreyas = SS Iyer). tests/test_batting.py re-checks every mapping against the players file.
PLAYERS = {
    "Virat Kohli": ("V Kohli", 332), "Rohit Sharma": ("RG Sharma", 25),
    "Suryakumar Yadav": ("SA Yadav", 61), "Shubman Gill": ("Shubman Gill", 1580),
    "Sai Sudharsan": ("B Sai Sudharsan", 6999), "Yashasvi Jaiswal": ("YBK Jaiswal", 4104),
    "Riyan Parag": ("R Parag", 3230), "Devdutt Padikkal": ("D Padikkal", 4071),
    "Tim David": ("TH David", 6550), "Rajat Patidar": ("RM Patidar", 5349),
    "Ruturaj Gaikwad": ("RD Gaikwad", 4119), "Sanju Samson": ("SV Samson", 180),
    "Abhishek Sharma": ("Abhishek Sharma", 2349), "Travis Head": ("TM Head", 3),
    "Heinrich Klaasen": ("H Klaasen", 1740), "Rishabh Pant": ("RR Pant", 181),
    "Nicholas Pooran": ("N Pooran", 2766), "Shreyas Iyer": ("SS Iyer", 389),
    "Tilak Varma": ("Tilak Varma", 6681), "Phil Salt": ("PD Salt", 8945),
}
TEAM_CODE = {1: "RCB", 2: "SRH", 3: "MI", 4: "RPS", 5: "GL", 6: "KKR", 129: "CSK", 134: "RR",
             252: "DC", 494: "PBKS", 614: "LSG", 615: "GT", 1414: "KTK", 1419: "PWI"}
SPIN = ("Offbreak", "Legbreak", "Orthodox", "Wrist spin")


def load_balls(data_dir: Path = DATA_DIR) -> pd.DataFrame:
    path = data_dir / "ball_by_ball_data.csv"
    if not path.exists():
        raise FileNotFoundError(path)
    b = pd.read_csv(path, low_memory=False)
    b = b[~b.is_super_over & b.innings.isin([1, 2])].copy()
    b = b.sort_values(["match_id", "innings", "over_number", "ball_number"], kind="stable")
    b["seq"] = b.groupby(["match_id", "innings"]).cumcount()
    b["spin"] = b.bowler_type.fillna("").str.contains("|".join(SPIN))
    b["phase"] = pd.cut(b.over_number, [-1, 5, 14, 19], labels=["powerplay", "middle", "death"])
    return b


def innings_table(b: pd.DataFrame) -> pd.DataFrame:
    """One row per player innings. A player has batted if he appears as striker or non-striker,
    so a 0-ball not-out innings counts, as in official records. Retired hurt is not a dismissal.
    'Innings' therefore means batting appearances: XI members who never came in are invisible."""
    keys = ["match_id", "innings"]
    app = pd.concat([b[keys + ["seq"]].assign(name=b.batter, role=0),
                     b[keys + ["seq"]].assign(name=b.non_striker, role=1)])
    first = app.sort_values(keys + ["seq", "role"]).drop_duplicates(keys + ["name"]).copy()
    first["position"] = first.groupby(keys).cumcount() + 1
    faced = b[~b.is_wide_ball].assign(f4=lambda d: d.batter_runs == 4, f6=lambda d: d.batter_runs == 6)
    agg = faced.groupby(keys + ["batter"]).agg(
        balls=("batter_runs", "size"), fours=("f4", "sum"), sixes=("f6", "sum")).rename_axis(keys + ["name"])
    runs = b.groupby(keys + ["batter"]).batter_runs.sum().rename_axis(keys + ["name"]).rename("runs")
    outs = b[b.player_out.notna() & (b.wicket_kind != "retired hurt")]
    outs = outs.groupby(keys + ["player_out"]).size().clip(upper=1).rename_axis(keys + ["name"]).rename("out")
    meta = b.groupby(keys).agg(season=("season_id", "first"), team=("team_batting", "first"))
    t = (first.set_index(keys + ["name"])[["position"]].join([runs, agg, outs]).fillna(0).reset_index()
         .merge(meta.reset_index(), on=keys))
    for c in ("runs", "balls", "fours", "sixes", "out"):
        t[c] = t[c].astype(int)
    dates = pd.read_csv(DATA_DIR / "ipl_matches_data.csv", usecols=["match_id", "match_date"])
    t = t.merge(dates, on="match_id")
    t["date"] = pd.to_datetime(t.pop("match_date"))
    return t.sort_values(["date", "match_id", "innings", "position"]).reset_index(drop=True)


def team_matches(data_dir: Path = DATA_DIR) -> pd.DataFrame:
    """Matches played per team per season (league + playoffs, as recorded)."""
    m = pd.read_csv(data_dir / "ipl_matches_data.csv")
    tm = pd.concat([m[["season_id", "team1"]].set_axis(["season", "team"], axis=1),
                    m[["season_id", "team2"]].set_axis(["season", "team"], axis=1)])
    return tm.groupby(["season", "team"]).size().rename("team_matches").reset_index()


def season_table(inn: pd.DataFrame, tm: pd.DataFrame) -> pd.DataFrame:
    s = inn.groupby(["season", "name"]).agg(
        inn=("runs", "size"), runs=("runs", "sum"), balls=("balls", "sum"), outs=("out", "sum"),
        fours=("fours", "sum"), sixes=("sixes", "sum"), fifties=("runs", lambda r: (r >= 50).sum()),
        pos_sum=("position", "sum"), team=("team", lambda x: x.mode().iat[0])).reset_index()
    s = s.merge(tm, on=["season", "team"], how="left")
    s["share"] = s.inn / s.team_matches
    return s


def splits(b: pd.DataFrame, name: str, seasons) -> dict:
    """Descriptive splits (pace/spin, phase) over the given seasons; balls exclude wides."""
    g = b[(b.batter == name) & b.season_id.isin(seasons) & ~b.is_wide_ball]
    outs = b[(b.player_out == name) & b.season_id.isin(seasons) & (b.wicket_kind != "retired hurt")]
    out = {}
    for label, mask, omask in (("pace", ~g.spin, ~outs.spin), ("spin", g.spin, outs.spin)):
        out[label] = (g[mask].batter_runs.sum(), int(mask.sum()), int(omask.sum()))
    for ph in ("powerplay", "middle", "death"):
        out[ph] = (g[g.phase == ph].batter_runs.sum(), int((g.phase == ph).sum()), int((outs.phase == ph).sum()))
    return out
