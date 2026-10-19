/** Server-side input validation for the simulation API. Rejects (never silently clamps) bad input. */
export const LIMITS = {
  sims: { min: 100, max: Math.min(50_000, Number(process.env.SIM_MAX_RUNS) || 20_000) },
  offset: { min: -150, max: 150 },
  tau: { min: 0, max: 200 },
  homeAdv: { min: 0, max: 60 },
  matches: { min: 1, max: 17 },
  availability: { min: 0, max: 1 },
  form: { min: 0.5, max: 1.5 },
  seed: { min: 0, max: 2 ** 31 - 1 },
} as const;

type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

function numberIn(v: unknown, name: string, r: { min: number; max: number }, errors: string[], integer = false) {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    errors.push(`${name} must be a number`);
    return NaN;
  }
  if (integer && !Number.isInteger(v)) errors.push(`${name} must be an integer`);
  if (v < r.min || v > r.max) errors.push(`${name} must be between ${r.min} and ${r.max}`);
  return v;
}

export type TournamentRequest = { nSims: number; seed: number; offsets: Record<string, number>; tau: number | null; homeAdv: number | null };

export function parseTournament(body: unknown, teamCodes: string[]): Result<TournamentRequest> {
  const errors: string[] = [];
  if (typeof body !== "object" || body === null) return { ok: false, errors: ["body must be a JSON object"] };
  const b = body as Record<string, unknown>;
  const nSims = numberIn(b.nSims, "nSims", LIMITS.sims, errors, true);
  const seed = b.seed === undefined ? 2027 : numberIn(b.seed, "seed", LIMITS.seed, errors, true);
  const offsets: Record<string, number> = {};
  if (b.offsets !== undefined) {
    if (typeof b.offsets !== "object" || b.offsets === null) errors.push("offsets must be an object");
    else
      for (const [k, v] of Object.entries(b.offsets)) {
        if (!teamCodes.includes(k)) errors.push(`unknown team ${k}`);
        else offsets[k] = numberIn(v, `offsets.${k}`, LIMITS.offset, errors);
      }
  }
  const tau = b.tau === undefined || b.tau === null ? null : numberIn(b.tau, "tau", LIMITS.tau, errors);
  const homeAdv = b.homeAdv === undefined || b.homeAdv === null ? null : numberIn(b.homeAdv, "homeAdv", LIMITS.homeAdv, errors);
  return errors.length ? { ok: false, errors } : { ok: true, value: { nSims, seed, offsets, tau, homeAdv } };
}

export type BatterRequest = { slug: string; matches: number; availability: number; form: number; nSims: number; seed: number };

export function parseBatter(body: unknown, slugs: string[]): Result<BatterRequest> {
  const errors: string[] = [];
  if (typeof body !== "object" || body === null) return { ok: false, errors: ["body must be a JSON object"] };
  const b = body as Record<string, unknown>;
  if (typeof b.slug !== "string" || !slugs.includes(b.slug)) errors.push("slug must be one of the 20 shortlisted batters");
  const matches = numberIn(b.matches, "matches", LIMITS.matches, errors, true);
  const availability = numberIn(b.availability, "availability", LIMITS.availability, errors);
  const form = numberIn(b.form, "form", LIMITS.form, errors);
  const nSims = numberIn(b.nSims, "nSims", LIMITS.sims, errors, true);
  const seed = b.seed === undefined ? 2027 : numberIn(b.seed, "seed", LIMITS.seed, errors, true);
  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: { slug: b.slug as string, matches, availability, form, nSims, seed } };
}
