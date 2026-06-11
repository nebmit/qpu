import type { UiSnapshot } from '$lib/types';
import { computeRanges, metricScore } from '$lib/domain/metrics';
import { NODE_WEIGHTS } from '$lib/domain/cluster';
import { median } from '$lib/domain/statistics';

// Cross-snapshot analytics: everything here looks across a device's full
// time series rather than at a single snapshot. Pure and framework-free,
// like the rest of the domain layer.

// Per-qubit, per-metric coefficient of variation (std / mean) across snapshots.
// Needs at least two measurements to say anything; otherwise null.
function variationOf(values: number[]): number | null {
    if (values.length < 2) return null;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    if (mean === 0) return null;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance) / Math.abs(mean);
}

// Normalize values into [0,1]; a degenerate spread carries no ranking
// information, so everything scores a neutral 0.5 there (codebase convention).
function normalizeAll(byId: Map<number, number | null>): Map<number, number> {
    const ok = [...byId.values()].filter((v): v is number => v != null);
    const out = new Map<number, number>();
    if (!ok.length) return out;
    const lo = Math.min(...ok);
    const hi = Math.max(...ok);
    const spread = hi - lo;
    for (const [id, v] of byId) {
        if (v == null) continue;
        out.set(id, spread <= 0 ? 0.5 : (v - lo) / spread);
    }
    return out;
}

/**
 * Per-qubit calibration stability in [0,1] across a device's snapshots
 * (1 = rock stable, 0 = most volatile on the device). Blends the relative
 * variation of readout error, T₁ and T₂ with the finder's NODE_WEIGHTS;
 * metrics without enough history contribute a neutral 0.5.
 */
export function computeStability(snapshots: UiSnapshot[]): Map<number, number> {
    const scores = new Map<number, number>();
    if (snapshots.length < 2) return scores;

    const nQubits = Math.max(...snapshots.map((s) => s.qubits.length), 0);
    const cvs = {
        readout: new Map<number, number | null>(),
        T1: new Map<number, number | null>(),
        T2: new Map<number, number | null>()
    };
    for (let id = 0; id < nQubits; id++) {
        const series = snapshots.map((s) => s.qubits[id]).filter(Boolean);
        const pick = (sel: (q: (typeof series)[number]) => number | null) =>
            series.map(sel).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
        cvs.readout.set(id, variationOf(pick((q) => q.readout_error)));
        cvs.T1.set(id, variationOf(pick((q) => q.T1)));
        cvs.T2.set(id, variationOf(pick((q) => q.T2)));
    }

    const norm = {
        readout: normalizeAll(cvs.readout),
        T1: normalizeAll(cvs.T1),
        T2: normalizeAll(cvs.T2)
    };
    for (let id = 0; id < nQubits; id++) {
        // High variation = low stability; missing history scores neutral.
        const part = (m: 'readout' | 'T1' | 'T2') => {
            const n = norm[m].get(id);
            return n == null ? 0.5 : 1 - n;
        };
        scores.set(
            id,
            NODE_WEIGHTS.readout * part('readout') +
                NODE_WEIGHTS.T1 * part('T1') +
                NODE_WEIGHTS.T2 * part('T2')
        );
    }
    return scores;
}

export type ClusterTimePoint = {
    date: string;
    /** Mean blended node quality of the members on that snapshot; null if none measured. */
    cluster: number | null;
    /** Device-median blended node quality on that snapshot, for the "vs device" read. */
    device: number;
};

/**
 * How a fixed member set would have scored on every snapshot in the series:
 * per snapshot, the mean NODE_WEIGHTS-blended quality of the members next to
 * the device median, each normalized within that snapshot.
 */
export function clusterQualityOverTime(
    members: number[],
    snapshots: UiSnapshot[]
): ClusterTimePoint[] {
    return snapshots.map((snap) => {
        const R = computeRanges(snap.qubits, snap.edges);
        const quality = (id: number) => {
            const q = snap.qubits[id];
            if (!q) return null;
            return (
                NODE_WEIGHTS.readout * metricScore(q, 'readout', R) +
                NODE_WEIGHTS.T1 * metricScore(q, 'T1', R) +
                NODE_WEIGHTS.T2 * metricScore(q, 'T2', R)
            );
        };
        const memberQs = members
            .map(quality)
            .filter((v): v is number => v != null);
        const deviceQs = snap.qubits.filter(Boolean).map((q) => quality(q.id));
        return {
            date: snap.date,
            cluster: memberQs.length
                ? memberQs.reduce((s, v) => s + v, 0) / memberQs.length
                : null,
            device: median(deviceQs) ?? 0.5
        };
    });
}
