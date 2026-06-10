// Colour ramps mapping a normalized score in [0,1] to an oklch colour string.
// Kept as a presentation concern, separate from the domain scoring that
// produces the scores.

export function metricNodeColor(t: number) {
    t = Math.max(0, Math.min(1, t));
    // Viridis-leaning ramp: dark indigo/purple (t=0, bad) → teal (t=0.5) → yellow-green (t=1, good).
    // Perceived brightness increases monotonically — readable on both light and dark backgrounds.
    let L: number, C: number, H: number;
    if (t < 0.25) {
        const s = t / 0.25;
        L = 32 + s * 12;       // 32 → 44
        C = 0.10 + s * 0.06;   // 0.10 → 0.16
        H = 290 - s * 30;      // 290 → 260 (indigo → violet)
    } else if (t < 0.5) {
        const s = (t - 0.25) / 0.25;
        L = 44 + s * 14;       // 44 → 58
        C = 0.16 - s * 0.02;   // 0.16 → 0.14
        H = 260 - s * 60;      // 260 → 200 (violet → teal-blue)
    } else if (t < 0.75) {
        const s = (t - 0.5) / 0.25;
        L = 58 + s * 14;       // 58 → 72
        C = 0.14 + s * 0.02;   // 0.14 → 0.16
        H = 200 - s * 40;      // 200 → 160 (teal-blue → teal-green)
    } else {
        const s = (t - 0.75) / 0.25;
        L = 72 + s * 14;       // 72 → 86
        C = 0.16 - s * 0.04;   // 0.16 → 0.12
        H = 160 - s * 30;      // 160 → 130 (teal-green → yellow-green)
    }
    return `oklch(${L.toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(1)})`;
}

// Fixed neutral stroke for live edges — quality is encoded via stroke-width, not colour.
export const LIVE_EDGE_STROKE = "oklch(64% 0.09 258)";

// Indigo ramp for edge quality: muted lavender (t=0, high error) → deep indigo (t=1, low error).
export function edgeColor(t: number): string {
    t = Math.max(0, Math.min(1, t));
    const L = 72 - t * 34;   // 72 → 38
    const C = 0.07 + t * 0.11; // 0.07 → 0.18
    const H = 290 - t * 32;  // 290 → 258
    return `oklch(${L.toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(1)})`;
}
