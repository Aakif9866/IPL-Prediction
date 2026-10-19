"use client";
import { useEffect, useState } from "react";

/** Copies the address to the clipboard. Never opens a mail client. */
export function CopyEmail({ email }: { email: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  useEffect(() => {
    if (state === "idle") return;
    const t = setTimeout(() => setState("idle"), 2000);
    return () => clearTimeout(t);
  }, [state]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setState("copied");
    } catch {
      // Clipboard API unavailable (insecure context / permissions): fall back to a selection copy.
      const ta = document.createElement("textarea");
      ta.value = email;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      setState(ok ? "copied" : "failed");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="tabular select-all break-all rounded-tl-xl rounded-br-xl border border-line bg-page px-3 py-2 font-medium text-ink">{email}</span>
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-11 items-center gap-2 rounded-tl-xl rounded-br-xl border border-accent-line px-4 text-sm font-semibold text-accent transition-colors duration-150 hover:bg-accent-line hover:text-white active:scale-95 dark:hover:text-black"
        aria-label={`Copy email address ${email}`}
      >
        <svg aria-hidden viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          {state === "copied" ? <path d="m4.5 10.5 3.5 3.5 7.5-8" /> : <><rect x="7" y="7" width="9" height="9" rx="1.5" /><path d="M13 7V5.5A1.5 1.5 0 0 0 11.5 4h-6A1.5 1.5 0 0 0 4 5.5v6A1.5 1.5 0 0 0 5.5 13H7" /></>}
        </svg>
        {state === "copied" ? "Copied" : "Copy email"}
      </button>
      <span role="status" aria-live="polite" className="text-xs text-muted">
        {state === "copied" ? "Email copied to clipboard" : state === "failed" ? "Copy failed. Select the address and copy it manually." : ""}
      </span>
    </div>
  );
}
