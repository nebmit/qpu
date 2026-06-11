import type { Dataset, Snapshot, UiEdge, UiQubit, UiSnapshot } from '$lib/types';

export function q(id: number, overrides: Partial<UiQubit> = {}): UiQubit {
    return {
        id,
        T1: 200,
        T2: 100,
        readout_error: 0.01,
        p01: null,
        p10: null,
        ...overrides
    };
}

export function edge(source: number, target: number, twoq_error: number | null = 0.005): UiEdge {
    return { source, target, twoq_error };
}

export function pathGraph(n: number): { qubits: UiQubit[]; edges: UiEdge[] } {
    return {
        qubits: Array.from({ length: n }, (_, id) => q(id)),
        edges: Array.from({ length: Math.max(0, n - 1) }, (_, id) => edge(id, id + 1))
    };
}

export function starGraph(n: number): { qubits: UiQubit[]; edges: UiEdge[] } {
    return {
        qubits: Array.from({ length: n }, (_, id) => q(id)),
        edges: Array.from({ length: Math.max(0, n - 1) }, (_, id) => edge(0, id + 1))
    };
}

export function gridGraph(rows: number, cols: number): { qubits: UiQubit[]; edges: UiEdge[] } {
    const id = (row: number, col: number) => row * cols + col;
    const edges: UiEdge[] = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            if (col + 1 < cols) edges.push(edge(id(row, col), id(row, col + 1)));
            if (row + 1 < rows) edges.push(edge(id(row, col), id(row + 1, col)));
        }
    }
    return {
        qubits: Array.from({ length: rows * cols }, (_, idx) => q(idx)),
        edges
    };
}

export function makeUiSnapshot(
    qubits: UiQubit[],
    edges: UiEdge[] = [],
    date = '2026-01-01'
): UiSnapshot {
    return { date, timestamp: `${date}T00:00:00Z`, qubits, edges };
}

export function makeWireSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
    return {
        t: '2026-01-01',
        ts: '2026-01-01T00:00:00Z',
        qubits: [
            { id: 0, T1: 0.0002, T2: 0.0001, readout_err: 0.01, p01: null, p10: null },
            { id: 1, T1: 0.00018, T2: 0.00009, readout_err: 0.02, p01: null, p10: null }
        ],
        gates: [{ gate: 'cx', qubits: [0, 1], error: 0.005, duration: null }],
        ...overrides
    };
}

export function makeDataset(overrides: Partial<Dataset> = {}): Dataset {
    const backends = overrides.meta?.backends ?? ['dev-a', 'dev-b'];
    const n_qubits = overrides.meta?.n_qubits ?? 4;
    const coupling_map: Record<string, [number, number][]> =
        overrides.coupling_map ??
        Object.fromEntries(backends.map((dev) => [dev, [[0, 1], [1, 2], [2, 3]] as [number, number][]]));
    const timeseries: Record<string, Snapshot[]> =
        overrides.timeseries ??
        Object.fromEntries(
            backends.map((dev) => [
                dev,
                [
                    makeWireSnapshot({ t: '2026-01-01', ts: '2026-01-01T00:00:00Z' }),
                    makeWireSnapshot({ t: '2026-01-02', ts: '2026-01-02T00:00:00Z' })
                ]
            ])
        );

    return {
        ...overrides,
        meta: {
            backends,
            n_qubits,
            cadence_days: overrides.meta?.cadence_days ?? 1
        },
        coupling_map,
        timeseries
    };
}
