"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/champion", label: "Champion" },
  { href: "/batters", label: "Batters" },
  { href: "/simulator", label: "Simulation Lab" },
  { href: "/methodology", label: "Methodology" },
];

function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    setDark(next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {}
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="grid size-11 place-items-center rounded-tl-xl rounded-br-xl border border-line text-muted transition-colors duration-150 hover:border-accent-line hover:text-accent active:scale-95"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        {dark ? (
          <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>
        ) : (
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        )}
      </svg>
    </button>
  );
}

export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const active = (href: string) => path === href || path.startsWith(`${href}/`);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-page/90 backdrop-blur supports-[backdrop-filter]:bg-page/75">
      <div className="h-2 bg-accent-line" aria-hidden />
      <nav aria-label="Main" className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
        <Link href="/" className="flex min-h-11 items-center gap-2 font-bold text-ink">
          <span aria-hidden className="brand-gradient grid size-8 place-items-center rounded-tl-xl rounded-br-xl text-sm text-white">27</span>
          <span><span className="brand-gradient-text">IPL 2027</span> Forecast Lab</span>
        </Link>
        <ul className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={active(l.href) ? "page" : undefined}
                className={`relative inline-flex min-h-11 items-center px-3 text-sm font-medium transition-colors duration-150 hover:text-accent ${active(l.href) ? "text-ink" : "text-muted"}`}
              >
                {l.label}
                {active(l.href) && <span aria-hidden className="brand-gradient absolute inset-x-3 bottom-1 h-0.5 rounded-full" />}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            className="grid size-11 place-items-center rounded-tl-xl rounded-br-xl border border-line text-ink lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </nav>
      {open && (
        <ul id="mobile-nav" className="mx-auto max-w-7xl space-y-1 border-t border-line px-4 py-3 lg:hidden">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} aria-current={active(l.href) ? "page" : undefined} className={`flex min-h-11 items-center rounded-tl-xl rounded-br-xl px-3 text-base font-medium ${active(l.href) ? "bg-card text-accent" : "text-body"}`}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </header>
  );
}
