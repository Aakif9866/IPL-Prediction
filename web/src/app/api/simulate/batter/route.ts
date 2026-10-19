import { NextResponse } from "next/server";
import { batters } from "@/lib/data";
import { runBatterScenario } from "@/lib/scenario";
import { parseBatter } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { slug, matches, availability, form, nSims, seed? } */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: ["body must be valid JSON"] }, { status: 400 });
  }
  const parsed = parseBatter(body, batters.players.map((p) => p.slug));
  if (!parsed.ok) return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  return NextResponse.json(runBatterScenario(parsed.value), { headers: { "Cache-Control": "no-store" } });
}
