import numpy as np
import pandas as pd
import pytest

from iplpred import data
from iplpred.features import BASE, elo, rolling_team_features


def toy(rows):
    """rows: (season, team_a, team_b, a_won) -> matches frame in the shape load_matches returns."""
    df = pd.DataFrame(rows, columns=["season", "team_a", "team_b", "a_won"])
    df["date"] = pd.date_range("2020-01-01", periods=len(df))
    df["match_id"] = range(len(df))
    df["home"] = 0
    df["result"] = np.where(df.a_won.isna(), "no result", "win")
    return df


def test_elo_zero_sum_winner_gains_and_no_result_ignored():
    m = toy([(1, "A", "B", 1.0), (1, "A", "B", np.nan), (1, "A", "B", 0.0)])
    pa, pb, starts, final = elo(m, k=20, carry=1.0)
    assert pa[0] == pb[0] == BASE
    assert pa[1] == pytest.approx(BASE + 10) and pb[1] == pytest.approx(BASE - 10)
    assert pa[2] == pa[1]  # no-result did not move ratings
    assert sum(final.values()) == pytest.approx(2 * BASE)


def test_elo_season_regression_and_new_team():
    m = toy([(1, "A", "B", 1.0), (2, "A", "C", 1.0)])
    pa, pb, starts, _ = elo(m, k=20, carry=0.5)
    assert starts[2]["A"] == pytest.approx(BASE + 0.5 * 10)
    assert starts[2]["C"] == BASE  # first appearance starts at the mean
    assert pa[1] == starts[2]["A"]


def test_rolling_features_use_only_past_matches():
    tms = pd.DataFrame({"match_id": [0, 1, 2], "date": pd.date_range("2020-01-01", periods=3),
                        "team": "A", "rrd": [1.0, 2.0, 3.0], "won": [1.0, 0.0, 1.0]})
    base = rolling_team_features(tms).set_index("match_id")
    assert np.isnan(base.loc[0, "rrd_ewm"])
    assert base.loc[1, "rrd_ewm"] == 1.0
    changed = tms.copy()
    changed.loc[1, ["rrd", "won"]] = [-50.0, 1.0]  # alter match 1's own outcome
    alt = rolling_team_features(changed).set_index("match_id")
    assert alt.loc[1].equals(base.loc[1])  # its own features are unaffected
    assert alt.loc[2, "rrd_ewm"] != base.loc[2, "rrd_ewm"]  # later matches do see it


def test_deccan_chargers_split_from_sunrisers():
    assert data.team_key(2, 2012) == "DCH" and data.team_key(2, 2013) == "SRH"


def test_real_data_cleaning():
    m = data.load_matches()
    assert m.loc[m.result == "no result", "a_won"].isna().all()
    assert (m.team_a < m.team_b).all()
    o = data.season_outcomes(m).set_index("season")
    assert o.loc[2025, "champion"] == "RCB" and o.loc[2009, "champion"] == "DCH"
    assert (o.n_playoff_matches >= 3).all() and 2026 not in o.index
