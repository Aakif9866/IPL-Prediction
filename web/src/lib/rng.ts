/** Small seeded PRNG (mulberry32) plus the distributions the simulators need. */
export type Rng = {
  next: () => number; // uniform [0, 1)
  normal: () => number;
  logistic: () => number;
  int: (n: number) => number; // uniform integer in [0, n)
};

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare: number | null = null;
  const normal = () => {
    if (spare !== null) {
      const s = spare;
      spare = null;
      return s;
    }
    let u = 0;
    while (u === 0) u = next();
    const v = next();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
  const logistic = () => {
    let u = 0;
    while (u === 0) u = next();
    return Math.log(u / (1 - u));
  };
  const int = (n: number) => Math.floor(next() * n);
  return { next, normal, logistic, int };
}
