"""Match models, rolling-origin backtests and the pre-tournament strength model.

Rolling origin: for test season S every hyper-parameter and every model weight is chosen
using seasons FIT_FROM..S-1 only (2008 is burn-in for Elo/rolling features).
"""
import logging
from functools import lru_cache

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from .features import BASE, build_features, elo, elo_prob

log = logging.getLogger(__name__)
FIT_FROM = 2009
TEST_SEASONS = list(range(2013, 2027))
FEATURES = ["elo_diff", "rrd_diff", "form_diff", "home"]
ELO_GRID = [dict(k=k, carry=c, home=h) for k in (2, 4, 6, 8, 10, 15, 20, 30)
            for c in (0.5, 0.6, 0.7, 0.8, 0.9, 1.0) for h in (0, 20, 40)]
SHRINK_GRID = (0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0)
TAU_GRID = (0, 25, 50, 75, 100, 125, 150)
EPS = 1e-6


def logloss(y, p):
    p = np.clip(p, EPS, 1 - EPS)
    return -(y * np.log(p) + (1 - y) * np.log(1 - p))


def metrics(y, p) -> dict:
    y, p = np.asarray(y, float), np.asarray(p, float)
    auc = roc_auc_score(y, p) if len(set(y)) == 2 and np.ptp(p) > 0 else np.nan
    return {"n": len(y), "log_loss": logloss(y, p).mean(), "brier": ((p - y) ** 2).mean(),
            "auc": auc, "accuracy": ((p > 0.5) == (y == 1))[p != 0.5].mean() if (p != 0.5).any() else np.nan}


class Backtester:
    def __init__(self, matches: pd.DataFrame, tms: pd.DataFrame):
        self.m, self.tms = matches, tms
        self.y = matches.a_won.to_numpy()
        self.ok = ~np.isnan(self.y)
        self._elo = {}
        ll = []
        for i, prm in enumerate(ELO_GRID):
            pa, pb, starts, final = elo(matches, **prm)
            p = elo_prob(pa - pb + prm["home"] * matches.home.to_numpy())
            self._elo[i] = (p, starts, final)
            ll.append(np.where(self.ok, logloss(np.nan_to_num(self.y), p), np.nan))
        self.elo_ll = pd.DataFrame(np.array(ll).T).groupby(matches.season.to_numpy()).agg(["sum", "count"])
        self._z = np.random.default_rng(0).standard_normal((2000, 16))  # common random numbers

    # ---------- in-season (pre-match, pre-toss) ----------
    def pick_elo(self, seasons) -> int:
        t = self.elo_ll.loc[list(seasons)]
        return int((t.xs("sum", axis=1, level=1).sum() / t.xs("count", axis=1, level=1).sum()).idxmin())

    @lru_cache(maxsize=None)
    def features(self, ci: int) -> pd.DataFrame:
        f = build_features(self.m, self.tms, ELO_GRID[ci])
        t = self.tms.sort_values(["date", "match_id"]).copy()
        g = t.groupby("team")
        t["w"] = g.won.transform(lambda s: s.shift(1).fillna(0).cumsum())
        t["n"] = g.won.transform(lambda s: s.shift(1).notna().cumsum())
        wp = ((t.w + 5) / (t.n + 10)).set_axis(pd.MultiIndex.from_arrays([t.match_id, t.team]))
        pa = wp.reindex(list(zip(f.match_id, f.team_a))).to_numpy()
        pb = wp.reindex(list(zip(f.match_id, f.team_b))).to_numpy()
        f["winpct_p"] = (pa - pa * pb) / (pa + pb - 2 * pa * pb)  # log5 of shrunk career win%
        return f

    def match_backtest(self) -> pd.DataFrame:
        out = []
        for s in TEST_SEASONS:
            ci = self.pick_elo(range(FIT_FROM, s))
            f = self.features(ci)
            ok = f.a_won.notna()
            tr, te = f[ok & (f.season >= FIT_FROM) & (f.season < s)], f[ok & (f.season == s)].copy()
            lr = make_pipeline(StandardScaler(), LogisticRegression(C=1.0)).fit(tr[FEATURES], tr.a_won)
            lrt = make_pipeline(StandardScaler(), LogisticRegression(C=1.0)).fit(tr[FEATURES + ["a_toss"]], tr.a_won)
            # Fixed, deliberately shallow settings: ~1,000 training rows cannot support tuning.
            gb = HistGradientBoostingClassifier(max_depth=2, learning_rate=0.05, max_iter=150,
                                                min_samples_leaf=40, random_state=0).fit(tr[FEATURES], tr.a_won)
            te["coin"] = 0.5
            te["logreg"] = lr.predict_proba(te[FEATURES])[:, 1]
            te["logreg_toss"] = lrt.predict_proba(te[FEATURES + ["a_toss"]])[:, 1]
            te["gbm"] = gb.predict_proba(te[FEATURES])[:, 1]
            te["elo"] = te.elo_p
            te["winpct"] = te.winpct_p
            te["ens_elo_lr"] = (te.elo + te.logreg) / 2
            te["elo_params"] = str(ELO_GRID[ci])
            out.append(te)
            log.info("season %d: elo %s, train n=%d, test n=%d", s, ELO_GRID[ci], len(tr), len(te))
        return pd.concat(out, ignore_index=True)

    # ---------- pre-tournament (frozen at season start) ----------
    def season_league(self, s):
        g = self.m[(self.m.season == s) & ~self.m.playoff]
        return g

    @lru_cache(maxsize=None)
    def pre_season(self, ci: int, s: int, shrink: float, tau: float):
        """Marginal log-likelihood of season s's league results given only season-start info,
        integrating team strength theta ~ N(BASE + shrink*(start-BASE), tau^2) by Monte Carlo.
        Also returns marginal per-match probabilities (league matches with a result)."""
        starts = self._elo[ci][1][s]
        teams = sorted(starts)
        idx = {t: i for i, t in enumerate(teams)}
        g = self.season_league(s)
        g = g[g.a_won.notna()]
        ia, ib = g.team_a.map(idx).to_numpy(), g.team_b.map(idx).to_numpy()
        mu = BASE + shrink * (np.array([starts[t] for t in teams]) - BASE)
        theta = mu + tau * self._z[:, : len(teams)]
        p = elo_prob(theta[:, ia] - theta[:, ib] + ELO_GRID[ci]["home"] * g.home.to_numpy())
        ll = -logloss(g.a_won.to_numpy(), p).sum(1)
        season_ll = np.logaddexp.reduce(ll) - np.log(len(ll))
        return season_ll, p.mean(0), g.index.to_numpy()

    def pick_pre(self, ci, seasons):
        best = max(((sh, ta) for sh in SHRINK_GRID for ta in TAU_GRID),
                   key=lambda st: sum(self.pre_season(ci, s, *st)[0] for s in seasons))
        return best

    def posterior(self, ci, seasons):
        """Posterior weights over the (shrink, tau) grid under a uniform prior. Averaging over
        it carries parameter uncertainty into the simulation instead of trusting one point."""
        grid = [(sh, ta) for sh in SHRINK_GRID for ta in TAU_GRID]
        ll = np.array([sum(self.pre_season(ci, s, *g)[0] for s in seasons) for g in grid])
        w = np.exp(ll - ll.max())
        return list(zip(grid, w / w.sum()))

    def pre_backtest(self):
        """Per test season: chosen params, frozen match predictions, and season log-lik vs coin."""
        rows, preds = [], []
        for s in TEST_SEASONS:
            ci = self.pick_elo(range(FIT_FROM, s))
            sh, ta = self.pick_pre(ci, range(FIT_FROM + 1, s))
            sll, p, ix = self.pre_season(ci, s, sh, ta)
            y = self.y[ix]
            preds.append(pd.DataFrame({"season": s, "y": y, "pre_tournament": p, "coin": 0.5}))
            rows.append({"season": s, "elo": ci, "shrink": sh, "tau": ta, "season_loglik": sll,
                         "coin_loglik": len(y) * np.log(0.5)})
        return pd.DataFrame(rows), pd.concat(preds, ignore_index=True)

    def season_start_mu(self, ci, s, shrink):
        starts = self._elo[ci][1][s]
        teams = sorted(starts)
        return teams, BASE + shrink * (np.array([starts[t] for t in teams]) - BASE)

    def final_ratings(self, ci):
        return self._elo[ci][2]


def bootstrap_diff(y, p1, p2, n=2000, seed=0):
    """Paired bootstrap of mean log-loss(p1) - log-loss(p2): mean and 95% interval."""
    d = logloss(y, p1) - logloss(y, p2)
    rng = np.random.default_rng(seed)
    bs = d[rng.integers(0, len(d), (n, len(d)))].mean(1)
    return d.mean(), *np.percentile(bs, [2.5, 97.5])


def calibration_table(y, p, bins=10):
    q = pd.qcut(p, bins, duplicates="drop")
    return pd.DataFrame({"p": p, "y": y}).groupby(q, observed=True).agg(
        mean_pred=("p", "mean"), observed=("y", "mean"), n=("y", "size")).reset_index(drop=True)
