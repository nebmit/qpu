import type { Snapshot, UiQubit, UiEdge, UiSnapshot } from '$lib/types';

// Adapts a raw wire `Snapshot` into the `UiSnapshot` view-model: indexes qubits
// by id, converts coherence times to microseconds, and averages per-edge gate
// error onto the static base topology.

// Zero-value qubit record — every metric unknown until a snapshot fills it in.
function emptyQubit(id: number): UiQubit {
    return {
        id,
        T1: null,
        T2: null,
        readout_error: null,
        sx_error: null,
        frequency: null,
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
        target.sx_error = typeof q.sx_error === 'number' ? q.sx_error : null;
        target.frequency = typeof q.frequency === 'number' ? q.frequency : null;
        target.p01 = typeof q.p01 === 'number' ? q.p01 : null;
        target.p10 = typeof q.p10 === 'number' ? q.p10 : null;
    });

    const edgeStats = new Map<
        string,
        { cxSum: number; cxCount: number; anySum: number; anyCount: number }
    >();
    for (const g of snap.gates || []) {
        if (!g || !Array.isArray(g.qubits) || g.qubits.length !== 2) continue;
        const err = typeof g.error === 'number' ? g.error : null;
        if (err == null || !Number.isFinite(err)) continue;
        const a = Math.min(g.qubits[0], g.qubits[1]);
        const b = Math.max(g.qubits[0], g.qubits[1]);
        const key = `${a}-${b}`;
        const entry = edgeStats.get(key) || { cxSum: 0, cxCount: 0, anySum: 0, anyCount: 0 };
        const name = typeof g.gate === 'string' ? g.gate.toLowerCase() : '';
        if (name === 'cx') {
            entry.cxSum += err;
            entry.cxCount += 1;
        } else {
            entry.anySum += err;
            entry.anyCount += 1;
        }
        edgeStats.set(key, entry);
    }

    const edges = baseEdges.map((e) => {
        const key = `${Math.min(e.source, e.target)}-${Math.max(e.source, e.target)}`;
        const stats = edgeStats.get(key);
        let cx_error: number | null = null;
        if (stats) {
            cx_error = stats.cxCount > 0
                ? stats.cxSum / stats.cxCount
                : stats.anyCount > 0 ? stats.anySum / stats.anyCount : null;
        }
        return { ...e, cx_error };
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
