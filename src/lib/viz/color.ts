export function metricNodeColor(t: number) {
    t = Math.max(0, Math.min(1, t));
    // OKLCH control points are tuned for monotonic lightness across themes.
    let L: number, C: number, H: number;
    if (t < 0.25) {
        const s = t / 0.25;
        L = 32 + s * 12;
        C = 0.10 + s * 0.06;
        H = 290 - s * 30;
    } else if (t < 0.5) {
        const s = (t - 0.25) / 0.25;
        L = 44 + s * 14;
        C = 0.16 - s * 0.02;
        H = 260 - s * 60;
    } else if (t < 0.75) {
        const s = (t - 0.5) / 0.25;
        L = 58 + s * 14;
        C = 0.14 + s * 0.02;
        H = 200 - s * 40;
    } else {
        const s = (t - 0.75) / 0.25;
        L = 72 + s * 14;
        C = 0.16 - s * 0.04;
        H = 160 - s * 30;
    }
    return `oklch(${L.toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(1)})`;
}

export const LIVE_EDGE_STROKE = "oklch(64% 0.09 258)";

export function edgeColor(t: number): string {
    t = Math.max(0, Math.min(1, t));
    const L = 72 - t * 34;
    const C = 0.07 + t * 0.11;
    const H = 290 - t * 32;
    return `oklch(${L.toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(1)})`;
}
