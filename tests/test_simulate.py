from collections import Counter

import numpy as np
import pytest

from iplpred.simulate import ipl_group_fixtures, simulate


def test_group_fixtures_match_ipl_format():
    fx = ipl_group_fixtures(10, np.random.default_rng(0))
    assert len(fx) == 70
    games = Counter(fx[:, 0].tolist() + fx[:, 1].tolist())
    assert set(games.values()) == {14}
    for t in range(10):
        opp = Counter([b for a, b, _ in fx if a == t] + [a for a, b, _ in fx if b == t])
        assert sorted(opp.values()) == [1] * 4 + [2] * 5
    pairs = Counter(frozenset(r[:2]) for r in fx)
    for a, b, h in fx:  # double-header pairs are one home game each
        if pairs[frozenset((a, b))] == 2:
            assert h in (1, -1)


@pytest.mark.parametrize("fmt", ["qualifier", "semis"])
def test_probabilities_sum_correctly(fmt):
    fx = ipl_group_fixtures(10, np.random.default_rng(1))
    r = simulate(np.linspace(1450, 1550, 10), fx, fmt, home_adv=20, tau=50, n_sims=4000, seed=0)
    assert r["champion"].sum() == pytest.approx(1)
    assert r["final"].sum() == pytest.approx(2)
    assert r["playoffs"].sum() == pytest.approx(4)
    assert (r["champion"] <= r["final"]).all() and (r["final"] <= r["playoffs"]).all()
    assert r["exp_points"].sum() == pytest.approx(2 * 70)


def test_equal_teams_are_symmetric_and_dominant_team_wins():
    fx = ipl_group_fixtures(10, np.random.default_rng(2))
    r = simulate(np.full(10, 1500.0), fx, n_sims=20000, seed=0)
    assert np.allclose(r["champion"], 0.1, atol=0.012)
    mu = np.full(10, 1500.0)
    mu[3] = 2500
    r = simulate(mu, fx, n_sims=2000, seed=0)
    assert r["champion"][3] > 0.99


def test_seeded_runs_are_reproducible():
    fx = ipl_group_fixtures(10, np.random.default_rng(3))
    a = simulate(np.linspace(1400, 1600, 10), fx, tau=40, n_sims=500, seed=7)
    b = simulate(np.linspace(1400, 1600, 10), fx, tau=40, n_sims=500, seed=7)
    assert all(np.array_equal(a[k], b[k]) for k in a)
