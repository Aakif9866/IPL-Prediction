import { NextResponse } from "next/server";
import { simTeams } from "@/lib/data";
import { runTournamentScenario } from "@/lib/scenario";
import { parseTournament } from "@/lib/validate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST { nSims, seed?, offsets?: {CODE: elo}, tau?: number|null, homeAdv?: number|null } */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ errors: ["body must be valid JSON"] }, { status: 400 });
  }
  const parsed = parseTournament(body, simTeams.map((t) => t.code));
  if (!parsed.ok) return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  const started = performance.now();
  const result = runTournamentScenario(parsed.value);
  return NextResponse.json({ ...result, ms: Math.round(performance.now() - started) }, { headers: { "Cache-Control": "no-store" } });
}
