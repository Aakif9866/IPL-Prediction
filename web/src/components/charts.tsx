"use client";
/**
 * Hand-built, dependency-free charts (dataviz rules: thin marks with 4px rounded data ends, a
 * recessive grid, text in ink tokens and never in series colour, and a tooltip on hover and keyboard focus).
 */
import { useId, useState } from "react";
import { fix, int, pct, sr } from "@/lib/format";

const ORANGE = "#eb6834";

/* ---------- Ranked probability bars (champion) ---------- */
export type ProbRow = { code: string; name: string; color: string; value: number; detail: string[] };

export function ProbabilityBars({ rows, reference, referenceLabel, selected, onSelect, label }: {
  rows: ProbRow[]; reference?: number; referenceLabel?: string; selected?: string; onSelect?: (code: string) => void; label: string;
}) {
  const max = Math.max(...rows.map((r) => r.value), reference ?? 0) * 1.08;
  const leader = rows.reduce((a, b) => (b.value > a.value ? b : a)).code;
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div role="list" aria-label={label} className="relative space-y-1.5">
      {reference !== undefined && (
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[7.5rem] right-14 sm:left-[11rem]">
          <div className="absolute inset-y-0 border-l border-dashed border-muted/60" style={{ left: `${(100 * reference) / max}%` }}>
            <span className="absolute -top-5 -translate-x-1/2 whitespace-nowrap text-[11px] text-muted">{referenceLabel}</span>
          </div>
        </div>
      )}
      {rows.map((r, i) => {
        const isLead = r.code === leader;
        const active = hover === r.code || selected === r.code;
        return (
          <div role="listitem" key={r.code} className="relative">
            <button
              type="button"
              onClick={() => onSelect?.(r.code)}
              onMouseEnter={() => setHover(r.code)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(r.code)}
              onBlur={() => setHover(null)}
              aria-pressed={onSelect ? selected === r.code : undefined}
              aria-label={`${r.name}: ${pct(r.value)}. ${r.detail.join(". ")}`}
              className={`grid w-full grid-cols-[7rem_1fr_3.5rem] items-center gap-2 rounded-tl-lg rounded-br-lg py-1.5 pr-1 text-left transition-colors duration-150 sm:grid-cols-[10.5rem_1fr_3.5rem] ${active ? "bg-page" : ""} ${selected === r.code ? "ring-1 ring-accent-line" : ""}`}
            >
              <span className="flex min-w-0 items-center gap-2 pl-2 text-sm text-ink">
                <span aria-hidden className="team-dot size-2.5 shrink-0 rounded-full" style={{ background: r.color }} />
                <span className="truncate"><span className="sm:hidden">{r.code}</span><span className="hidden sm:inline">{r.name}</span></span>
              </span>
              <span className="relative h-3.5">
                <span
                  className={`absolute inset-y-0 left-0 rounded-r-[4px] transition-[width] duration-500 ease-out ${isLead ? "brand-gradient" : "bg-series"}`}
                  style={{ width: `${(100 * r.value) / max}%`, transitionDelay: `${i * 40}ms` }}
                />
              </span>
              <span className={`tabular text-right text-sm ${isLead ? "font-semibold text-ink" : "text-body"}`}>{pct(r.value)}</span>
            </button>
            {hover === r.code && (
              <div role="tooltip" className="pointer-events-none absolute right-0 top-full z-20 mt-1 w-56 rounded-tl-xl rounded-br-xl border border-line bg-pop p-3 text-xs shadow-lg">
                <p className="mb-1 font-semibold text-ink">{r.name}</p>
                {r.detail.map((d) => <p key={d} className="text-muted">{d}</p>)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Line chart with crosshair (Elo history) ---------- */
export function LineChart({ points, refValue, refLabel, label, unit = "" }: {
  points: { x: number; y: number }[]; refValue?: number; refLabel?: string; label: string; unit?: string;
}) {
  const W = 640, H = 220, P = { l: 44, r: 12, t: 12, b: 26 };
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y).concat(refValue ?? []);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const pad = Math.max(10, (Math.max(...ys) - Math.min(...ys)) * 0.15);
  const y0 = Math.floor((Math.min(...ys) - pad) / 10) * 10, y1 = Math.ceil((Math.max(...ys) + pad) / 10) * 10;
  const sx = (x: number) => P.l + ((x - x0) / Math.max(1, x1 - x0)) * (W - P.l - P.r);
  const sy = (y: number) => H - P.b - ((y - y0) / (y1 - y0)) * (H - P.t - P.b);
  const [hi, setHi] = useState<number | null>(null);
  const ticks = Array.from({ length: 4 }, (_, i) => y0 + ((y1 - y0) * i) / 3);
  const path = points.map((p, i) => `${i ? "L" : "M"}${sx(p.x)},${sy(p.y)}`).join("");
  const id = useId();
  return (
    <figure aria-labelledby={id} className="w-full">
      <figcaption id={id} className="sr-only">{label}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-pan-y" role="img" aria-label={label}
        onMouseLeave={() => setHi(null)}
        onMouseMove={(e) => {
          const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const x = ((e.clientX - r.left) / r.width) * W;
          let best = 0;
          points.forEach((p, i) => Math.abs(sx(p.x) - x) < Math.abs(sx(points[best].x) - x) && (best = i));
          setHi(best);
        }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={sy(t)} y2={sy(t)} className="stroke-line" strokeWidth="1" />
            <text x={P.l - 6} y={sy(t) + 4} textAnchor="end" className="fill-muted text-[11px]">{Math.round(t)}</text>
          </g>
        ))}
        {[x0, Math.round((x0 + x1) / 2), x1].map((t) => (
          <text key={t} x={sx(t)} y={H - 6} textAnchor="middle" className="fill-muted text-[11px]">{t}</text>
        ))}
        {refValue !== undefined && (
          <g>
            <line x1={P.l} x2={W - P.r} y1={sy(refValue)} y2={sy(refValue)} className="stroke-muted" strokeDasharray="4 4" strokeWidth="1" />
            <text x={W - P.r} y={sy(refValue) - 5} textAnchor="end" className="fill-muted text-[11px]">{refLabel}</text>
          </g>
        )}
        <path d={path} fill="none" className="stroke-series" strokeWidth="2" strokeLinejoin="round" />
        {hi !== null && (
          <g>
            <line x1={sx(points[hi].x)} x2={sx(points[hi].x)} y1={P.t} y2={H - P.b} className="stroke-muted" strokeWidth="1" />
            <circle cx={sx(points[hi].x)} cy={sy(points[hi].y)} r="5" className="fill-series stroke-card" strokeWidth="2" />
          </g>
        )}
      </svg>
      <p className="tabular h-5 text-xs text-muted" aria-live="polite">
        {hi !== null ? `${points[hi].x}: ${fix(points[hi].y, 0)}${unit}` : "Hover the chart for season values"}
      </p>
    </figure>
  );
}

/* ---------- Season run bars with optional forecast (batters) ---------- */
export type SeasonBar = { season: number; runs: number; innings: number; balls: number; partial?: boolean };

export function SeasonBars({ seasons, forecast, label, compact = false, maxY }: {
  seasons: SeasonBar[]; forecast?: { season: number; mid: number; lo: number; hi: number }; label: string; compact?: boolean; maxY?: number;
}) {
  const W = compact ? 320 : 640, H = compact ? 150 : 230, P = { l: compact ? 30 : 40, r: 8, t: 10, b: 22 };
  const years = seasons.map((s) => s.season).concat(forecast ? [forecast.season] : []);
  const yMax = maxY ?? Math.max(100, ...seasons.map((s) => s.runs), forecast?.hi ?? 0) * 1.05;
  const n = years.length;
  const band = (W - P.l - P.r) / n;
  const bw = Math.min(28, band * 0.62);
  const sx = (i: number) => P.l + band * i + band / 2;
  const sy = (v: number) => H - P.b - (v / yMax) * (H - P.t - P.b);
  const [hi, setHi] = useState<number | null>(null);
  const ticks = [0, yMax / 2, yMax].map((t) => Math.round(t / 50) * 50);
  const tip = hi === null ? null : hi < seasons.length ? seasons[hi] : null;
  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={sy(t)} y2={sy(t)} className="stroke-line" strokeWidth="1" />
            <text x={P.l - 5} y={sy(t) + 4} textAnchor="end" className="fill-muted text-[10px]">{t}</text>
          </g>
        ))}
        {seasons.map((s, i) => {
          const h = Math.max(0, H - P.b - sy(s.runs));
          return (
            <g key={s.season} tabIndex={0} role="img" aria-label={`${s.season}${s.partial ? " (partial)" : ""}: ${s.runs} runs in ${s.innings} innings`}
              onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(null)} onFocus={() => setHi(i)} onBlur={() => setHi(null)} className="outline-none">
              <rect x={sx(i) - band / 2} y={P.t} width={band} height={H - P.t - P.b} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${sx(i) - bw / 2},${H - P.b} V${sy(s.runs) + Math.min(4, h)} q0,-${Math.min(4, h)} ${Math.min(4, h)},-${Math.min(4, h)} H${sx(i) + bw / 2 - Math.min(4, h)} q${Math.min(4, h)},0 ${Math.min(4, h)},${Math.min(4, h)} V${H - P.b} Z`}
                  className={s.partial ? "fill-series-soft" : "fill-series"}
                  opacity={hi === null || hi === i ? 1 : 0.55}
                />
              )}
              {(!compact || i % 2 === 0 || i === seasons.length - 1) && (
                <text x={sx(i)} y={H - 6} textAnchor="middle" className="fill-muted text-[10px]">{compact ? `’${String(s.season).slice(2)}` : s.season}</text>
              )}
            </g>
          );
        })}
        {forecast && (
          <g aria-label={`${forecast.season} forecast ${int(forecast.mid)} runs, 80% interval ${int(forecast.lo)} to ${int(forecast.hi)}`} role="img">
            <line x1={sx(n - 1)} x2={sx(n - 1)} y1={sy(forecast.lo)} y2={sy(forecast.hi)} stroke={ORANGE} strokeWidth="2" />
            {[forecast.lo, forecast.hi].map((v) => <line key={v} x1={sx(n - 1) - 5} x2={sx(n - 1) + 5} y1={sy(v)} y2={sy(v)} stroke={ORANGE} strokeWidth="2" />)}
            <circle cx={sx(n - 1)} cy={sy(forecast.mid)} r="5" fill={ORANGE} className="stroke-card" strokeWidth="2" />
            <text x={sx(n - 1)} y={H - 6} textAnchor="middle" className="fill-ink text-[10px] font-semibold">{compact ? "’27" : forecast.season}</text>
          </g>
        )}
      </svg>
      {!compact && (
        <p className="tabular h-5 text-xs text-muted" aria-live="polite">
          {tip
            ? `${tip.season}${tip.partial ? " (partial, data cutoff)" : ""}: ${tip.runs} runs · ${tip.innings} inn · SR ${fix(sr(tip.runs, tip.balls), 1)}`
            : "Hover or focus a bar for season details"}
        </p>
      )}
    </figure>
  );
}

/* ---------- Inline interval (tables) ---------- */
export function IntervalBar({ lo, mid, hi, max }: { lo: number; mid: number; hi: number; max: number }) {
  return (
    <span aria-hidden className="relative block h-2 w-full min-w-24 rounded-full bg-line">
      <span className="absolute inset-y-0 rounded-full bg-series-soft" style={{ left: `${(100 * lo) / max}%`, width: `${(100 * (hi - lo)) / max}%` }} />
      <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-series ring-2 ring-card" style={{ left: `${(100 * mid) / max}%` }} />
    </span>
  );
}

/* ---------- Two-series histogram (batter scenario) ---------- */
export function Histogram({ a, b, labelA, labelB, label }: {
  a: { from: number; to: number; share: number }[]; b: { from: number; to: number; share: number }[]; labelA: string; labelB: string; label: string;
}) {
  const bins = Math.max(a.length, b.length);
  const get = (h: typeof a, i: number) => h[i]?.share ?? 0;
  const W = 640, H = 200, P = { l: 36, r: 8, t: 10, b: 24 };
  const ymax = Math.max(...Array.from({ length: bins }, (_, i) => Math.max(get(a, i), get(b, i)))) * 1.1 || 1;
  const band = (W - P.l - P.r) / bins;
  const sy = (v: number) => H - P.b - (v / ymax) * (H - P.t - P.b);
  const [hi, setHi] = useState<number | null>(null);
  return (
    <figure>
      <div className="mb-2 flex flex-wrap gap-4 text-xs text-body">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-series-soft" />{labelA}</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: ORANGE }} />{labelB}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={label} onMouseLeave={() => setHi(null)}>
        <line x1={P.l} x2={W - P.r} y1={H - P.b} y2={H - P.b} className="stroke-line" />
        {Array.from({ length: bins }, (_, i) => {
          const x = P.l + i * band;
          const w = Math.max(1, band / 2 - 1);
          return (
            <g key={i} onMouseEnter={() => setHi(i)}>
              <rect x={x} y={P.t} width={band} height={H - P.t - P.b} fill="transparent" />
              <rect x={x + 1} y={sy(get(a, i))} width={w} height={H - P.b - sy(get(a, i))} className="fill-series-soft" />
              <rect x={x + 1 + w + 1} y={sy(get(b, i))} width={w} height={H - P.b - sy(get(b, i))} fill={ORANGE} opacity={0.9} />
              {i % Math.ceil(bins / 8) === 0 && <text x={x} y={H - 7} className="fill-muted text-[10px]">{i * 50}</text>}
            </g>
          );
        })}
      </svg>
      <p className="tabular h-5 text-xs text-muted" aria-live="polite">
        {hi !== null ? `${hi * 50}–${hi * 50 + 50} runs: ${labelA} ${pct(get(a, hi))}, ${labelB} ${pct(get(b, hi))}` : "Hover the histogram for bin shares"}
      </p>
    </figure>
  );
}
