"""Markdown/CSV report and figures for the IPL 2027 batting forecast. Every number is computed."""
from itertools import groupby

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

INK, MUTED, GRID, BLUE, ORANGE, LIGHT = "#0b0b0b", "#898781", "#e1e0d9", "#2a78d6", "#eb6834", "#9ec5f4"


def _style(ax, grid_axis="y"):
    ax.spines[["top", "right"]].set_visible(False)
    ax.spines[["left", "bottom"]].set_color("#c3c2b7")
    ax.tick_params(colors=MUTED, labelsize=8)
    ax.grid(axis=grid_axis, color=GRID, lw=0.6)
    ax.set_axisbelow(True)


def md_table(df, fmt=None):
    fmt = fmt or {}
    cell = lambda c, v: (fmt[c].format(v) if c in fmt else (f"{v:.1f}" if isinstance(v, (float, np.floating)) else str(v)))
    lines = ["| " + " | ".join(df.columns) + " |", "|" + "|".join("---:" if pd.api.types.is_numeric_dtype(df[c]) else "---" for c in df.columns) + "|"]
    lines += ["| " + " | ".join(cell(c, v) for c, v in zip(df.columns, r)) + " |" for r in df.itertuples(index=False)]
    return "\n".join(lines)


def plot_intervals(fc, path):
    f = fc.sort_values("expected_runs")
    fig, ax = plt.subplots(figsize=(8, 6.5))
    y = np.arange(len(f))
    ax.hlines(y, f.lower_80, f.upper_80, color=LIGHT, lw=6, label="80% prediction interval")
    ax.plot(f.expected_runs, y, "o", color=BLUE, ms=7, label="expected runs")
    for yi, v in zip(y, f.expected_runs):
        ax.text(v, yi + 0.32, f"{v:.0f}", ha="center", fontsize=7, color=INK)
    ax.set_yticks(y, f.batter)
    ax.set_xlabel("runs in IPL 2027", color=MUTED)
    ax.set_title("IPL 2027 runs: model expectation and 80% interval", loc="left", color=INK)
    _style(ax, "x"); ax.legend(frameon=False, fontsize=8, loc="lower right")
    fig.tight_layout(); fig.savefig(path, dpi=150); plt.close(fig)


def plot_history(fc, season, path, partial_season):
    fig, axes = plt.subplots(4, 5, figsize=(15, 10), sharey=True)
    yrs = list(range(2018, partial_season + 1))
    for ax, r in zip(axes.flat, fc.sort_values("rank").itertuples()):
        h = season[season.name == r.dataset_name].set_index("season").runs.reindex(yrs).fillna(0)
        ax.bar(yrs, h.values, color=[LIGHT if y == partial_season else BLUE for y in yrs], width=0.7)
        ax.errorbar([partial_season + 1], [r.expected_runs], yerr=[[r.expected_runs - r.lower_80], [r.upper_80 - r.expected_runs]],
                    fmt="o", color=ORANGE, ms=5, capsize=3, lw=1.5)
        ax.set_title(f"{r.rank}. {r.batter}", fontsize=9, loc="left", color=INK)
        ax.set_xticks([2018, 2022, partial_season + 1], ["18", "22", "27"])
        _style(ax)
    fig.suptitle(f"Season runs 2018-{partial_season} (blue; {partial_season} light = partial season in data) and 2027 forecast with 80% interval (orange)",
                 x=0.01, ha="left", color=INK)
    fig.tight_layout(); fig.savefig(path, dpi=130); plt.close(fig)


def plot_backtest(summary, path):
    fig, axes = plt.subplots(1, 2, figsize=(10, 3.8))
    for ax, (sub, g) in zip(axes, summary.groupby("subset", sort=False)):
        g = g.sort_values("MAE", ascending=False)
        ax.barh(g.model, g.MAE, color=[ORANGE if m == "two_part" else BLUE for m in g.model], height=0.6)
        for i, v in enumerate(g.MAE):
            ax.text(v + 1, i, f"{v:.1f}", va="center", fontsize=7, color=INK)
        ax.set_title(f"Season-runs MAE, {sub}", loc="left", fontsize=10, color=INK)
        _style(ax, "x")
    fig.tight_layout(); fig.savefig(path, dpi=150); plt.close(fig)


def player_section(r, season, inn, split_df, bench, partial_season):
    """Data-derived narrative for one batter. Strengths/risks come from fixed rules on the numbers."""
    h = season[season.name == r.dataset_name].sort_values("season")
    hist = ", ".join(f"{s.season}: {s.runs} ({s.inn} inn)" for s in h[h.season >= partial_season - 6].itertuples())
    played = set(h.season)
    missed = [y for y in range(max(h.season.min(), partial_season - 6), partial_season) if y not in played]
    full = h[(h.season < partial_season) & (h.inn >= 8)]
    rpi = full.runs / full.inn
    p = h[h.season == partial_season]
    last10 = inn[inn.name == r.dataset_name].tail(10)
    sp = split_df.loc[r.dataset_name]
    strengths, risks = [], []
    for k in ("pace", "spin", "powerplay", "middle", "death"):
        if sp[f"{k}_balls"] >= 60:
            d = sp[f"{k}_sr"] - bench[f"{k}_sr"]
            if d >= 15:
                strengths.append(f"strike rate {sp[f'{k}_sr']:.0f} vs {k} (top-order benchmark {bench[f'{k}_sr']:.0f}, {int(sp[f'{k}_balls'])} balls)")
            elif d <= -15:
                risks.append(f"strike rate {sp[f'{k}_sr']:.0f} vs {k} (benchmark {bench[f'{k}_sr']:.0f}, {int(sp[f'{k}_balls'])} balls)")
    if r.hist_rpi_w >= 35:
        strengths.append(f"high recent runs per innings (weighted, shrunk: {r.hist_rpi_w:.1f})")
    if r.hist_fifty_w >= 0.25:
        strengths.append(f"frequent 50+ scores ({100 * r.hist_fifty_w:.0f}% of innings, weighted)")
    if missed:
        risks.append(f"no IPL innings in {', '.join(map(str, missed))} (availability/selection history)")
    if len(rpi) >= 3 and rpi.std() / rpi.mean() > 0.3:
        risks.append(f"volatile season-to-season output (runs-per-innings CV {rpi.std() / rpi.mean():.2f} over {len(rpi)} seasons)")
    if r.share_1 < 0.7:
        risks.append(f"batted in only {100 * r.share_1:.0f}% of the team's {partial_season} matches in the data")
    if r.hist_pos_w >= 4.5:
        risks.append(f"middle/lower-order role (weighted batting position {r.hist_pos_w:.1f}) caps balls per innings")
    teams = [t for t, _ in groupby(h.team_code)]  # consecutive dedupe keeps returns (MI → KKR → MI)
    recent = (f"{partial_season} (partial, to data cutoff): {int(p.runs.iat[0])} runs in {int(p.inn.iat[0])} innings, "
              f"SR {100 * p.runs.iat[0] / max(p.balls.iat[0], 1):.0f}" if len(p) else f"no innings in {partial_season} up to the data cutoff")
    return "\n".join([
        f"### {r.rank}. {r.batter} (`{r.dataset_name}`)",
        f"- **Historical trend:** {hist}. Teams in data: {' → '.join(teams)}.",
        f"- **Recent performance:** {recent}; last 10 innings: {int(last10.runs.sum())} runs, "
        f"SR {100 * last10.runs.sum() / max(last10.balls.sum(), 1):.0f}.",
        f"- **Strengths (data-derived):** {'; '.join(strengths) if strengths else 'no split stands out by ≥15 SR points from the benchmark'}.",
        f"- **Risk factors:** {'; '.join(risks) if risks else 'none flagged by the rules beyond general IPL variance'}.",
        f"- **2027 estimate:** {r.expected_runs:.0f} runs (80% interval {r.lower_80:.0f}–{r.upper_80:.0f}) from "
        f"{r.expected_innings:.1f} expected innings × {r.expected_runs_per_innings:.1f} runs/innings; confidence **{r.confidence}**.",
        f"- **Scenarios:** full season ({r.scen_inn_full} inn) {r.scen_full:.0f}; strong form {r.scen_strong:.0f}; "
        f"weak form {r.scen_weak:.0f}; reduced time ({r.scen_inn_reduced} inn) {r.scen_reduced:.0f}.",
        f"- **Assumptions:** plays IPL 2027 with availability in line with the player's own recent history; role similar to "
        f"2024–{partial_season}; 2027 team, squad and batting position not known from the data.",
    ])
