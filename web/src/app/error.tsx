"use client";
import { useEffect } from "react";
import { Card } from "@/components/ui";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <Card className="mx-auto max-w-xl space-y-4 text-center">
      <h1 className="text-2xl font-bold text-ink">Something went wrong</h1>
      <p className="text-muted">This page failed to render. The forecasts themselves are unaffected. Try again, or go back to the home page.</p>
      <button type="button" onClick={reset} className="brand-gradient min-h-11 rounded-tl-xl rounded-br-xl px-5 text-sm font-semibold text-white active:scale-95">Try again</button>
    </Card>
  );
}
