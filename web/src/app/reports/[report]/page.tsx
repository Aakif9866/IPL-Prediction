import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Download, KindBadge } from "@/components/ui";

const REPORTS = {
  champion: { title: "IPL 2027 champion forecast — report", file: "ipl2027_champion_report.md", csv: "ipl2027_champion_forecast.csv" },
  batting: { title: "IPL 2027 batting predictions — report", file: "ipl_2027_batting_predictions.md", csv: "ipl_2027_batting_predictions.csv" },
} as const;
type Key = keyof typeof REPORTS;

export const dynamicParams = false;
export function generateStaticParams() {
  return Object.keys(REPORTS).map((report) => ({ report }));
}
export async function generateMetadata({ params }: { params: Promise<{ report: string }> }): Promise<Metadata> {
  const r = REPORTS[(await params).report as Key];
  return r ? { title: r.title } : {};
}

export default async function ReportPage({ params }: { params: Promise<{ report: string }> }) {
  const key = (await params).report as Key;
  const r = REPORTS[key];
  if (!r) notFound();
  const md = await readFile(path.join(process.cwd(), "public", "downloads", r.file), "utf8");
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm text-muted"><Link href="/methodology" className="hover:text-accent hover:underline">Methodology</Link> / <span className="text-ink">{key === "champion" ? "Champion report" : "Batting report"}</span></nav>
      <div className="flex flex-wrap items-center gap-4">
        <KindBadge kind="estimate" />
        <span className="text-sm text-muted">Rendered unchanged from the pipeline output.</span>
        <Download href={`/downloads/${r.file}`} label="Markdown" kind="Markdown" />
        <Download href={`/downloads/${r.csv}`} label="Predictions" kind="CSV" />
      </div>
      <article className="report text-[15px] leading-relaxed text-body">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: (p) => <h1 className="mb-4 text-3xl font-bold text-ink" {...p} />,
            h2: (p) => <h2 className="mb-3 mt-10 border-b border-line pb-2 text-2xl font-semibold text-ink" {...p} />,
            h3: (p) => <h3 className="mb-2 mt-6 text-lg font-semibold text-ink" {...p} />,
            p: (p) => <p className="my-3" {...p} />,
            ul: (p) => <ul className="my-3 list-disc space-y-1 pl-6" {...p} />,
            ol: (p) => <ol className="my-3 list-decimal space-y-1 pl-6" {...p} />,
            strong: (p) => <strong className="text-ink" {...p} />,
            a: ({ href = "", ...p }) => <a className="text-accent [overflow-wrap:anywhere] hover:underline" href={href.startsWith("http") ? href : `/reports/${href}`} {...p} />,
            code: (p) => <code className="rounded bg-card px-1 py-0.5 text-[13px] text-ink" {...p} />,
            table: (p) => <div className="my-4 overflow-x-auto rounded-tl-xl rounded-br-xl border border-line"><table className="tabular w-full text-sm" {...p} /></div>,
            th: (p) => <th className="border-b border-line bg-card px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted" {...p} />,
            td: (p) => <td className="border-b border-line px-3 py-2" {...p} />,
            // eslint-disable-next-line @next/next/no-img-element
            img: ({ src = "", alt = "" }) => <img loading="lazy" className="my-4 w-full rounded-tl-xl rounded-br-xl border border-line bg-white" src={`/reports/${src}`} alt={alt || "Report figure"} />,
          }}
        >
          {md}
        </ReactMarkdown>
      </article>
    </div>
  );
}
