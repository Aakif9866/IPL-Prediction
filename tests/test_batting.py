import numpy as np
import pandas as pd
import pytest

from batting.data import DATA_DIR, PLAYERS, innings_table, season_table, team_matches
from batting.model import FEATURES, build_rows, conformal_interval

REAL_MATCH = 335982  # any real match id, so the date lookup inside innings_table resolves


def balls(rows):
    cols = ["batter", "non_striker", "batter_runs", "is_wide_ball", "player_out", "wicket_kind"]
    b = pd.DataFrame(rows, columns=cols)
    b["match_id"], b["innings"], b["season_id"], b["team_batting"] = REAL_MATCH, 1, 2008, 6
    b["seq"] = range(len(b))
    return b


def test_innings_counting_rules():
    b = balls([
        ("A", "B", 4, False, None, None),
        ("A", "B", 0, True, None, None),             # wide: not a ball faced
        ("A", "B", 0, False, "A", "retired hurt"),   # not a dismissal
        ("C", "B", 6, False, None, None),
        ("C", "B", 0, False, "B", "run out"),        # non-striker run out, faced 0 balls
    ])
    t = innings_table(b).set_index("name")
    assert t.loc["A", ["runs", "balls", "out", "fours", "position"]].tolist() == [4, 2, 0, 1, 1]
    assert t.loc["B", ["runs", "balls", "out", "position"]].tolist() == [0, 0, 1, 2]  # 0-ball innings still counts
    assert t.loc["C", ["runs", "sixes", "position"]].tolist() == [6, 1, 3]


def test_name_mapping_matches_players_file():
    p = pd.read_csv(DATA_DIR / "players-data-updated.csv").set_index("player_id")
    names = [v[0] for v in PLAYERS.values()]
    assert len(set(names)) == 20
    for disp, (nm, pid) in PLAYERS.items():
        assert p.loc[pid, "player_name"] == nm
        assert set(disp.split()) <= set(p.loc[pid, "player_full_name"].split()) | {"Phil", "Tim", "Sai"}


@pytest.fixture(scope="module")
def real():
    from batting.data import load_balls
    inn = innings_table(load_balls())
    tm = team_matches()
    return inn, tm, season_table(inn, tm)


def test_features_do_not_see_target_season(real):
    inn, tm, s = real
    base = build_rows(s, inn, tm, 2024).set_index("name")
    s2, inn2 = s.copy(), inn.copy()
    s2.loc[s2.season == 2024, ["runs", "inn", "balls"]] = [0, 1, 1]
    inn2.loc[inn2.season == 2024, "runs"] = 0
    alt = build_rows(s2, inn2, tm, 2024).set_index("name")
    pd.testing.assert_frame_equal(base[FEATURES], alt[FEATURES])
    assert base.loc["V Kohli", "y_runs"] == 741 and alt.loc["V Kohli", "y_runs"] == 0


def test_conformal_interval_contains_point_and_covers():
    rng = np.random.default_rng(0)
    p = rng.uniform(0, 600, 4000)
    y = np.clip(p + rng.normal(0, 0.4 * (p + 50)), 0, None)
    lo, hi = conformal_interval(y[:2000], p[:2000], p[2000:])
    assert ((lo <= p[2000:]) & (p[2000:] <= hi)).all()
    cov = ((y[2000:] >= lo) & (y[2000:] <= hi)).mean()
    assert 0.76 < cov < 0.84
