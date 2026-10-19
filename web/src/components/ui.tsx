import Link from "next/link";
import type { ReactNode } from "react";

/** Opposite-corner rounding + border elevation (design skill), with an optional hover lift. */
export function Card({ children, className = "", lift = false, as: Tag = "div" }: { children: ReactNode; className?: string; lift?: boolean; as?: "div" | "section" | "article" | "li" }) {
  return (
    <Tag
      className={`rounded-tl-3xl rounded-br-3xl border border-line bg-card p-5 sm:p-6 ${
        lift ? "transition-all duration-200 motion-safe:hover:-translate-y-1 hover:shadow-lg hover:border-accent-line" : ""
      } ${className}`}
    >
      {children}
    </Tag>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{children}</p>;
}

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <header className="max-w-3xl space-y-3">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="text-3xl font-bold tracking-tight text-ink lg:text-5xl">{title}</h1>
      {children && <div className="text-base leading-relaxed text-muted sm:text-lg">{children}</div>}
    </header>
  );
}

export function SectionTitle({ title, children, id }: { title: string; children?: ReactNode; id?: string }) {
  return (
    <div className="mb-4 space-y-1" id={id}>
      <h2 className="text-xl font-semibold text-ink sm:text-2xl">{title}</h2>
      {children && <p className="max-w-3xl text-sm text-muted sm:text-base">{children}</p>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="tabular text-2xl font-semibold text-ink">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Kind of statement, so estimates, history and user scenarios are never confused. */
const KIND = {
  estimate: "Model estimate",
  history: "Historical result",
  scenario: "Your scenario",
  fact: "Data fact",
} as const;
export function KindBadge({ kind }: { kind: keyof typeof KIND }) {
  const style = {
    estimate: "border-accent-line text-accent",
    history: "border-line text-muted",
    scenario: "border-warn text-warn",
    fact: "border-line text-body",
  }[kind];
  return <span className={`inline-flex items-center rounded-tl-lg rounded-br-lg border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${style}`}>{KIND[kind]}</span>;
}

export function ConfidenceBadge({ level }: { level: "High" | "Medium" | "Low" }) {
  const bars = { High: 3, Medium: 2, Low: 1 }[level];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-body" title="Based on how regularly the player batted in the last three seasons">
      <span aria-hidden className="flex items-end gap-0.5">
        {[1, 2, 3].map((i) => (
          <span key={i} className={`w-1 rounded-sm ${i <= bars ? "bg-accent-line" : "bg-line"}`} style={{ height: 4 + i * 3 }} />
        ))}
      </span>
      {level}
    </span>
  );
}

export function TeamDot({ color, label }: { color: string; label?: string }) {
  return <span aria-hidden={!label} aria-label={label} className="team-dot inline-block size-2.5 shrink-0 rounded-full ring-2 ring-card" style={{ background: color }} />;
}

export function ButtonLink({ href, children, variant = "outline", className = "" }: { href: string; children: ReactNode; variant?: "outline" | "primary"; className?: string }) {
  const base = "inline-flex min-h-11 items-center justify-center gap-2 rounded-tl-xl rounded-br-xl px-5 text-sm font-semibold transition-colors duration-150 active:scale-95";
  const style =
    variant === "primary"
      ? "brand-gradient text-white hover:brightness-110"
      : "border border-accent-line text-accent hover:bg-accent-line hover:text-white dark:hover:text-black";
  const external = href.startsWith("http") || href.startsWith("/downloads/");
  return external ? (
    <a href={href} className={`${base} ${style} ${className}`}>{children}</a>
  ) : (
    <Link href={href} className={`${base} ${style} ${className}`}>{children}</Link>
  );
}

export function Callout({ title, children, tone = "info" }: { title: string; children: ReactNode; tone?: "info" | "warn" }) {
  return (
    <aside className={`rounded-tl-2xl rounded-br-2xl border-l-4 bg-card p-4 text-sm ${tone === "warn" ? "border-warn" : "border-accent-line"} border-y border-r border-y-line border-r-line`}>
      <p className="font-semibold text-ink">{title}</p>
      <div className="mt-1 leading-relaxed text-muted">{children}</div>
    </aside>
  );
}

export function Download({ href, label, kind }: { href: string; label: string; kind: "CSV" | "Markdown" }) {
  return (
    <a href={href} download className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent hover:underline">
      <svg aria-hidden viewBox="0 0 20 20" className="size-4" fill="currentColor"><path d="M10 3a1 1 0 0 1 1 1v7.6l2.3-2.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4L9 11.6V4a1 1 0 0 1 1-1Zm-6 13a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Z" /></svg>
      {label} <span className="text-xs text-muted">({kind})</span>
    </a>
  );
}
