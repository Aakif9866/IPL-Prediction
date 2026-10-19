"""Vectorised Monte Carlo simulation of an IPL season (league + playoffs).

Team strength in each simulated season is uncertain: theta = mu + N(0, tau^2), drawn once per
team per simulation, so a team that is strong is strong for the whole simulated season.
League match: latent margin = logit(p) + Logistic(0, 1), team_a wins iff margin > 0, so
P(a wins) = p exactly. The summed margins act as the net-run-rate tie-breaker on equal points.
"""
from itertools import combinations

import numpy as np

from .features import LN10_400


def ipl_group_fixtures(n_teams: int, rng: np.random.Generator) -> np.ndarray:
    """League fixtures in the 2022-2026 IPL format, with groups drawn at random.

    Two groups of n/2. Each team plays its own group home and away, its 'counterpart' in the
    other group home and away, and the rest of the other group once (home side random).
    For 10 teams: 14 matches per team, 70 in total. Rows are (team_a, team_b, home), where
    home = +1 means team_a is at home.
    """
    if n_teams % 2:
        raise ValueError("group format needs an even number of teams")
    p = rng.permutation(n_teams)
    ga, gb = p[: n_teams // 2], p[n_teams // 2:]
    double = list(combinations(ga, 2)) + list(combinations(gb, 2)) + list(zip(ga, gb))
    dset = {frozenset(d) for d in double}
    single = [(x, y) for x in ga for y in gb if frozenset((x, y)) not in dset]
    rows = [(x, y, 1) for x, y in double] + [(x, y, -1) for x, y in double]
    rows += [(x, y, s) for (x, y), s in zip(single, rng.choice([-1, 1], len(single)))]
    return np.array(rows, dtype=int)


def simulate(mu, fixtures, playoff="qualifier", home_adv=0.0, tau=0.0, n_sims=10_000, seed=0):
    """Return per-team probabilities of reaching playoffs, final, and winning the title.

    mu: (n_teams,) Elo-scale strengths. fixtures: (m, 3) int rows (a, b, home).
    playoff: "qualifier" (2011+: Q1 1v2, Eliminator 3v4, Q2, Final) or "semis" (2008-10: 1v4, 2v3).
    """
    rng = np.random.default_rng(seed)
    mu = np.asarray(mu, float)
    n_t = len(mu)
    theta = mu + rng.normal(0, tau, (n_sims, n_t))
    a, b, h = fixtures[:, 0], fixtures[:, 1], fixtures[:, 2]
    margin = (theta[:, a] - theta[:, b] + h * home_adv) * LN10_400 + rng.logistic(size=(n_sims, len(a)))
    win = margin > 0
    A, B = np.eye(n_t)[a], np.eye(n_t)[b]
    points = 2 * (win @ A + (~win) @ B)
    nrr = margin @ A - margin @ B
    # ponytail: margins are bounded far below 1000 in practice, so points dominate the sort key.
    order = np.argsort(-(points * 1000 + nrr), axis=1)
    rows = np.arange(n_sims)

    def play(x, y):  # neutral-venue knockout
        p = 1 / (1 + np.exp(-(theta[rows, x] - theta[rows, y]) * LN10_400))
        xw = rng.random(n_sims) < p
        return np.where(xw, x, y), np.where(xw, y, x)

    s = [order[:, i] for i in range(4)]
    if playoff == "qualifier":
        w1, l1 = play(s[0], s[1])
        we, _ = play(s[2], s[3])
        w2, _ = play(l1, we)
        f1, f2 = w1, w2
    elif playoff == "semis":
        f1, _ = play(s[0], s[3])
        f2, _ = play(s[1], s[2])
    else:
        raise ValueError(f"unknown playoff format {playoff!r}")
    champ, _ = play(f1, f2)
    count = lambda *xs: sum(np.bincount(x, minlength=n_t) for x in xs) / n_sims
    return {"playoffs": count(*s), "final": count(f1, f2), "champion": count(champ),
            "exp_points": points.mean(0)}
