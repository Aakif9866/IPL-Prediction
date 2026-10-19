import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Card, PageHeader } from "@/components/ui";
import { batters, playersByRuns } from "@/lib/data";
import { Compare } from "./Compare";

export const metadata: Metadata = { title: "Compare batters" };

export default function ComparePage() {
  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="text-sm text-muted"><Link href="/batters" className="hover:text-accent hover:underline">Batters</Link> / <span className="text-ink">Compare</span></nav>
      <PageHeader eyebrow="Comparison mode" title="Compare batters side by side">
        <p>Model estimates next to the historical record. 2027 teams and availability are not confirmed.</p>
      </PageHeader>
      <Suspense fallback={<Card><p className="text-sm text-muted">Loading comparison…</p></Card>}>
        <Compare players={playersByRuns} partial={batters.meta.partial_season} />
      </Suspense>
    </div>
  );
}
