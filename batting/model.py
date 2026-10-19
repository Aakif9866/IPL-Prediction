"""Leak-free player-season features, models, rolling-origin backtest and prediction intervals.

A row is (player, target season S). Every feature uses seasons < S only, and only rates
(per innings, per ball, innings per team match), never raw season totals, so a partial
season (2026 in this data) does not bias the inputs. Targets: runs, innings and runs per innings in S.
"""
import logging

import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingRegressor, RandomForestRegressor
from sklearn.linear_model import RidgeCV
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

log = logging.getLogger(__name__)
W = (5, 4, 3)  # Marcel-style weights for seasons S-1, S-2, S-3
K_INN, K_BALLS = 10, 60  # shrinkage strength (pseudo-innings / pseudo-balls) toward the population
FEATURES = ["share_1", "share_2", "share_3", "share_w", "rpi_w", "sr_w", "outs_w", "bpi_w", "pos_w",
            "bnd_w", "fifty_w", "form10", "form_sr10", "career_inn", "years", "played_1", "n_inn_w", "tm"]
SEED = 0


def build_rows(season: pd.DataFrame, inn: pd.DataFrame, tm: pd.DataFrame, target: int, names=None) -> pd.DataFrame:
    """Feature rows for target season `target`. Population: batted in S-1 or S-2 (or `names`)."""
    past = season[season.season < target]
    pi = inn[inn.season < target]
    pop = {"rpi": past.runs.sum() / past.inn.sum(), "sr": 100 * past.runs.sum() / past.balls.sum(),
           "outs": past.outs.sum() / past.inn.sum(), "bpi": past.balls.sum() / past.inn.sum(),
           "bnd": (past.fours + past.sixes).sum() / past.balls.sum(), "fifty": past.fifties.sum() / past.inn.sum()}
    recent = past[past.season >= target - 2].name.unique()
    who = sorted(set(recent) | set(names or []))
    lag = {L: past[past.season == target - L].set_index("name") for L in (1, 2, 3)}
    last10 = pi[pi.name.isin(who)].groupby("name").tail(10).groupby("name").agg(r=("runs", "sum"), n=("runs", "size"), b=("balls", "sum"))
    career = past.groupby("name").agg(career_inn=("inn", "sum"), debut=("season", "min"))
    rows = []
    for p in who:
        d = {"name": p, "season": target}
        acc = dict.fromkeys(["w", "inn", "runs", "balls", "outs", "bnd", "fifty", "pos", "share"], 0.0)
        for (L, w) in zip((1, 2, 3), W):
            r = lag[L].loc[p] if p in lag[L].index else None
            d[f"share_{L}"] = 0.0 if r is None else float(r.share)
            acc["share"] += w * d[f"share_{L}"]
            acc["w"] += w
            if r is not None:
                acc["inn"] += w * r.inn; acc["runs"] += w * r.runs; acc["balls"] += w * r.balls
                acc["outs"] += w * r.outs; acc["bnd"] += w * (r.fours + r.sixes)
                acc["fifty"] += w * r.fifties; acc["pos"] += w * r.pos_sum
        n, bl = acc["inn"], acc["balls"]
        d["share_w"] = acc["share"] / acc["w"]
        d["n_inn_w"] = n
        d["rpi_w"] = (acc["runs"] + K_INN * pop["rpi"]) / (n + K_INN)
        d["sr_w"] = (100 * acc["runs"] + K_BALLS * pop["sr"]) / (bl + K_BALLS)
        d["outs_w"] = (acc["outs"] + K_INN * pop["outs"]) / (n + K_INN)
        d["bpi_w"] = (bl + K_INN * pop["bpi"]) / (n + K_INN)
        d["pos_w"] = (acc["pos"] + 3 * 6.0) / (n + 3)
        d["bnd_w"] = (acc["bnd"] + K_BALLS * pop["bnd"]) / (bl + K_BALLS)
        d["fifty_w"] = (acc["fifty"] + K_INN * pop["fifty"]) / (n + K_INN)
        f = last10.loc[p] if p in last10.index else None
        d["form10"] = pop["rpi"] if f is None else (f.r + 3 * pop["rpi"]) / (f.n + 3)
        d["form_sr10"] = pop["sr"] if f is None or f.b == 0 else (100 * f.r + 20 * pop["sr"]) / (f.b + 20)
        c = career.loc[p] if p in career.index else None
        d["career_inn"] = 0 if c is None else c.career_inn
        d["years"] = 0 if c is None else target - c.debut
        d["played_1"] = float(d["share_1"] > 0)
        rows.append(d)
    df = pd.DataFrame(rows)
    tms = tm[tm.season == target].team_matches
    df["tm"] = tms.mean() if len(tms) else np.nan
    y = season[season.season == target].set_index("name")
    df["y_runs"] = df.name.map(y.runs).fillna(0)
    df["y_inn"] = df.name.map(y.inn).fillna(0)
    df["y_balls"] = df.name.map(y.balls).fillna(0)
    df["y_outs"] = df.name.map(y.outs).fillna(0)
    return df


def make_models():
    return {
        "ridge": make_pipeline(StandardScaler(), RidgeCV(alphas=np.logspace(-2, 3, 21))),
        "rf": RandomForestRegressor(n_estimators=300, min_samples_leaf=20, max_features=0.5, random_state=SEED, n_jobs=-1),
        "gbm": HistGradientBoostingRegressor(max_depth=3, learning_rate=0.05, max_iter=200, min_samples_leaf=30, random_state=SEED),
    }


class TwoPart:
    """runs = tm * share(innings per team match) * runs-per-innings, each part a ridge model.
    The rpi part is fit only on rows that batted, weighted by innings."""

    def fit(self, X, y_inn, y_runs, tm):
        self.share = make_pipeline(StandardScaler(), RidgeCV(alphas=np.logspace(-2, 3, 21))).fit(X, y_inn / tm)
        m = y_inn > 0
        self.rpi = make_pipeline(StandardScaler(), RidgeCV(alphas=np.logspace(-2, 3, 21)))
        self.rpi.fit(X[m], y_runs[m] / y_inn[m], ridgecv__sample_weight=y_inn[m])
        return self

    def predict_parts(self, X, tm):
        inn = np.clip(self.share.predict(X), 0, 1) * tm
        rpi = np.clip(self.rpi.predict(X), 0, None)
        return inn, rpi

    def predict(self, X, tm):
        inn, rpi = self.predict_parts(X, tm)
        return inn * rpi


def baselines(df):
    """Simple reference predictions (no fitting)."""
    return {"last_season": df.last_runs, "career_avg": df.career_avg_runs, "marcel": df.share_w * df.tm * df.rpi_w}


def add_history(df, season):
    """Raw-total columns used only by the naive baselines (never as model features)."""
    s = season.set_index(["name", "season"])
    df["last_runs"] = [s.runs.get((n, t - 1), 0) for n, t in zip(df.name, df.season)]
    past = season.groupby("name")
    per = {n: g for n, g in past}
    df["career_avg_runs"] = [per[n][per[n].season < t].runs.mean() if n in per else 0 for n, t in zip(df.name, df.season)]
    return df


def quantile_models():
    q = lambda a: HistGradientBoostingRegressor(loss="quantile", quantile=a, max_depth=3, learning_rate=0.05,
                                                max_iter=200, min_samples_leaf=30, random_state=SEED)
    return q(0.1), q(0.9)


def backtest(data: pd.DataFrame, first_test=2014, last_test=2025):
    """Rolling origin: for test season S, fit on targets 2010..S-1 (interval models: fit on
    ..S-2, conformal calibration on S-1). Returns per-row predictions."""
    out = []
    for s in range(first_test, last_test + 1):
        tr, te = data[(data.season < s) & (data.season >= 2010)], data[data.season == s].copy()
        X, Xt = tr[FEATURES].to_numpy(), te[FEATURES].to_numpy()
        for name, mdl in make_models().items():
            te[name] = np.clip(mdl.fit(X, tr.y_runs).predict(Xt), 0, None)
        tp = TwoPart().fit(X, tr.y_inn.to_numpy(), tr.y_runs.to_numpy(), tr.tm.to_numpy())
        te["two_part"] = tp.predict(Xt, te.tm.to_numpy())
        te["pred_inn"], te["pred_rpi"] = tp.predict_parts(Xt, te.tm.to_numpy())
        for k, v in baselines(te).items():
            te[k] = v
        te["lo"], te["hi"], te["lo_raw"], te["hi_raw"] = cqr(tr, s, Xt)
        out.append(te)
        log.info("batting backtest %d: train n=%d test n=%d", s, len(tr), len(te))
    return pd.concat(out, ignore_index=True)


OFFSET, BIN_EDGES = 50.0, (150.0, 350.0)


def conformal_interval(cal_y, cal_p, p, coverage=0.8):
    """Split-conformal interval around a point prediction p, from out-of-sample residuals.
    Score = (y - p) / (p + OFFSET) so width scales with the prediction; calibrated separately
    within prediction bands split at BIN_EDGES (Mondrian conformal)."""
    cal_y, cal_p, p = (np.asarray(v, float) for v in (cal_y, cal_p, p))
    lo, hi = np.empty(len(p)), np.empty(len(p))
    a = (1 - coverage) / 2
    cb, pb = np.digitize(cal_p, BIN_EDGES), np.digitize(p, BIN_EDGES)
    for k in np.unique(pb):
        r = (cal_y[cb == k] - cal_p[cb == k]) / (cal_p[cb == k] + OFFSET)
        ql, qh = np.quantile(r, [a, 1 - a])
        m = pb == k
        lo[m], hi[m] = p[m] + ql * (p[m] + OFFSET), p[m] + qh * (p[m] + OFFSET)
    return np.clip(lo, 0, None), hi


def cqr(tr, s, Xt):
    """Conformalized quantile regression (80% nominal): quantile GBMs fit on seasons < s-1,
    widened by the conformity score quantile on season s-1."""
    fit, cal = tr[tr.season < s - 1], tr[tr.season == s - 1]
    qlo, qhi = quantile_models()
    Xf, Xc = fit[FEATURES].to_numpy(), cal[FEATURES].to_numpy()
    qlo.fit(Xf, fit.y_runs); qhi.fit(Xf, fit.y_runs)
    lo_c, hi_c = qlo.predict(Xc), qhi.predict(Xc)
    score = np.maximum(lo_c - cal.y_runs, cal.y_runs - hi_c)
    n = len(score)
    qhat = np.quantile(score, min(1, np.ceil((n + 1) * 0.8) / n))
    lo, hi = qlo.predict(Xt), qhi.predict(Xt)
    return np.clip(lo - qhat, 0, None), hi + qhat, np.clip(lo, 0, None), hi
