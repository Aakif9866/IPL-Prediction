"""Leak-free features: every value for a match uses only matches strictly before it."""
import numpy as np
import pandas as pd

BASE = 1500.0
LN10_400 = np.log(10) / 400


def elo_prob(diff):
    """P(team_a wins) for rating difference (a - b, home advantage included)."""
    return 1.0 / (1.0 + np.exp(-np.asarray(diff, float) * LN10_400))


def elo(matches: pd.DataFrame, k: float = 20, carry: float = 0.8, home: float = 0.0):
    """Sequential Elo over matches sorted by date.

    At each new season every rating is pulled toward BASE: r <- BASE + carry * (r - BASE);
    franchises appearing for the first time start at BASE. No-results do not update; ties
    (super-over decided) update as a draw, since the score was level.

    Returns (pre_a, pre_b, season_start, final): pre-match ratings aligned with `matches`,
    {season: {team: rating at season start}}, and ratings after the last match.
    """
    teams_by_season = {s: set(g.team_a) | set(g.team_b) for s, g in matches.groupby("season")}
    r, starts, season = {}, {}, None
    pre_a, pre_b = np.empty(len(matches)), np.empty(len(matches))
    for i, row in enumerate(matches[["season", "team_a", "team_b", "home", "a_won", "result"]].itertuples(index=False)):
        if row.season != season:
            season = row.season
            r = {t: BASE + carry * (v - BASE) for t, v in r.items()}
            for t in teams_by_season[season]:
                r.setdefault(t, BASE)
            starts[season] = {t: r[t] for t in teams_by_season[season]}
        ra, rb = r[row.team_a], r[row.team_b]
        pre_a[i], pre_b[i] = ra, rb
        if np.isnan(row.a_won):
            continue
        score = 0.5 if row.result == "tie" else row.a_won
        delta = k * (score - elo_prob(ra - rb + home * row.home))
        r[row.team_a], r[row.team_b] = ra + delta, rb - delta
    return pre_a, pre_b, starts, dict(r)


def rolling_team_features(tms: pd.DataFrame, halflife: float = 10) -> pd.DataFrame:
    """Exponentially weighted pre-match form per team (spans seasons).

    shift(1) is the leakage guard: the value at a match only sees that team's earlier matches.
    """
    t = tms.sort_values(["date", "match_id"]).copy()
    g = t.groupby("team")
    for col in ("rrd", "won"):
        t[f"{col}_ewm"] = g[col].transform(lambda s: s.shift(1).ewm(halflife=halflife, ignore_na=True).mean())
    return t[["match_id", "team", "rrd_ewm", "won_ewm"]]


def build_features(matches: pd.DataFrame, tms: pd.DataFrame, elo_params: dict) -> pd.DataFrame:
    """Model matrix for the pre-match (pre-toss) match model."""
    pre_a, pre_b, _, _ = elo(matches, **elo_params)
    roll = rolling_team_features(tms).set_index(["match_id", "team"])
    f = matches[["match_id", "season", "team_a", "team_b", "home", "a_toss", "a_won"]].copy()
    ra = roll.reindex(list(zip(f.match_id, f.team_a))).to_numpy()
    rb = roll.reindex(list(zip(f.match_id, f.team_b))).to_numpy()
    f["elo_diff"] = (pre_a - pre_b) / 100
    f["rrd_diff"] = np.nan_to_num(ra[:, 0]) - np.nan_to_num(rb[:, 0])
    f["form_diff"] = np.nan_to_num(ra[:, 1], nan=0.5) - np.nan_to_num(rb[:, 1], nan=0.5)
    f["elo_p"] = elo_prob(pre_a - pre_b + elo_params.get("home", 0) * f.home)
    return f
