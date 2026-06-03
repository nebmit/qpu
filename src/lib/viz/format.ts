// Display formatters: turn raw numeric view-model values into the exact strings
// the panels render. `null` renders as an em dash. Keeping these here, rather
// than in the store, keeps number formatting a pure view concern.

export const DASH = '—';

/** e.g. 123 → "123 μs" (digits 0); 123.4 → "123.4 μs" (digits 1). */
export const microseconds = (v: number | null, digits = 0): string =>
    v == null ? DASH : `${v.toFixed(digits)} μs`;

/** Fraction → percent, e.g. 0.0123 → "1.23%". */
export const percent = (v: number | null, digits = 2): string =>
    v == null ? DASH : `${(v * 100).toFixed(digits)}%`;

/** e.g. 0.00123 → "1.23e-3". */
export const exponential = (v: number | null, digits = 2): string =>
    v == null ? DASH : v.toExponential(digits);

/** Cluster delta magnitude (signed fraction) → unsigned percent, e.g. -0.12 → "12%". */
export const deltaLabel = (magnitude: number): string =>
    `${Math.abs(magnitude * 100).toFixed(0)}%`;
