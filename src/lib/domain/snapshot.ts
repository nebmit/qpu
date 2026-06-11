import type { Snapshot, UiQubit, UiEdge, UiSnapshot } from '$lib/types';
import { edgeKey } from '$lib/domain/lattice';

function emptyQubit(id: number): UiQubit {
    return {
        id,
        T1: null,
        T2: null,
        readout_error: null,
        p01: null,
        p10: null
    };
}

export function buildUiSnapshot(snap: Snapshot, baseEdges: UiEdge[], totalQubits: number): UiSnapshot {
    const qubits: UiQubit[] = Array.from({ length: totalQubits }, (_, id) => emptyQubit(id));

    (snap.qubits || []).forEach((q, idx) => {
        const id = typeof q.id === 'number' ? q.id : idx;
        if (id < 0 || id >= totalQubits) return;
        const target = qubits[id];
        target.T1 = typeof q.T1 === 'number' ? q.T1 * 1e6 : null;
        target.T2 = typeof q.T2 === 'number' ? q.T2 * 1e6 : null;
        target.readout_error = typeof q.readout_err === 'number' ? q.readout_err : null;
        target.p01 = typeof q.p01 === 'number' ? q.p01 : null;
        target.p10 = typeof q.p10 === 'number' ? q.p10 : null;
    });

    const edgeStats = new Map<string, { sum: number; count: number }>();
    for (const g of snap.gates || []) {
        if (!g || !Array.isArray(g.qubits) || g.qubits.length !== 2) continue;
        const err = typeof g.error === 'number' ? g.error : null;
        if (err == null || !Number.isFinite(err)) continue;
        const key = edgeKey(g.qubits[0], g.qubits[1]);
        const entry = edgeStats.get(key) || { sum: 0, count: 0 };
        entry.sum += err;
        entry.count += 1;
        edgeStats.set(key, entry);
    }

    const edges = baseEdges.map((e) => {
        const stats = edgeStats.get(edgeKey(e.source, e.target));
        const twoq_error = stats && stats.count > 0 ? stats.sum / stats.count : null;
        return { ...e, twoq_error };
    });

    return { date: snap.t, timestamp: snap.ts, qubits, edges };
}

export function emptySnapshot(edges: UiEdge[], totalQubits: number): UiSnapshot {
    return {
        date: '',
        timestamp: '',
        qubits: Array.from({ length: totalQubits }, (_, id) => emptyQubit(id)),
        edges
    };
}
