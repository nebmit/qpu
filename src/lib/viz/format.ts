export const DASH = '—';

export const microseconds = (v: number | null, digits = 0): string =>
    v == null ? DASH : `${v.toFixed(digits)} μs`;

export const percent = (v: number | null, digits = 2): string =>
    v == null ? DASH : `${(v * 100).toFixed(digits)}%`;

export const exponential = (v: number | null, digits = 2): string =>
    v == null ? DASH : v.toExponential(digits);

export const deltaLabel = (magnitude: number): string =>
    `${Math.abs(magnitude * 100).toFixed(0)}%`;
