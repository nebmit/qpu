import type { UiQubit, UiEdge, MetricRanges, MetricMode } from '$lib/types';

export const METRIC_OPTIONS: { value: MetricMode; label: string }[] = [
    { value: 'readout', label: 'Readout' },
    { value: 'T1', label: 'T₁' },
    { value: 'T2', label: 'T₂' },
    { value: 'stability', label: 'Stability' }
];

export function computeRanges(qubits: UiQubit[], edges: UiEdge[]): MetricRanges {
    const range = (vals: Array<number | null | undefined>, fallback: [number, number]) => {
        const ok = vals.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
        if (!ok.length) return fallback;
        return [Math.min(...ok), Math.max(...ok)] as [number, number];
    };
    return {
        T1: range(qubits.map((q) => q.T1), [0, 1]),
        T2: range(qubits.map((q) => q.T2), [0, 1]),
        readout: range(qubits.map((q) => q.readout_error), [0, 0.1]),
        twoq: range(edges.map((e) => e.twoq_error), [0, 0.01])
    };
}

// A zero-spread range carries no ranking information, so score it neutrally.
function normalize(v: number, [lo, hi]: [number, number]): number {
    const spread = hi - lo;
    if (spread <= 0) return 0.5;
    return Math.max(0, Math.min(1, (v - lo) / spread));
}

export function metricScore(q: UiQubit, mode: MetricMode, R: MetricRanges): number {
    switch (mode) {
        case 'T1':
            if (q.T1 == null) return 0.5;
            return normalize(q.T1, R.T1);
        case 'T2':
            if (q.T2 == null) return 0.5;
            return normalize(q.T2, R.T2);
        case 'readout':
            if (q.readout_error == null) return 0.5;
            return 1 - normalize(q.readout_error, R.readout);
        default:
            return 0.5;
    }
}

export function edgeScore(e: UiEdge, R: MetricRanges): number {
    if (typeof e.twoq_error !== 'number' || !Number.isFinite(e.twoq_error)) return 0.5;
    return 1 - normalize(e.twoq_error, R.twoq);
}
