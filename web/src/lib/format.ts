export const pct = (p: number, dp = 1) => `${(100 * p).toFixed(dp)}%`;
export const int = (v: number) => Math.round(v).toLocaleString("en-IN");
export const fix = (v: number, dp = 1) => v.toFixed(dp);
export const signed = (v: number, dp = 1) => `${v > 0 ? "+" : v < 0 ? "−" : "±"}${Math.abs(v).toFixed(dp)}`;
export const sr = (runs: number, balls: number) => (balls ? (100 * runs) / balls : NaN);
