// UI / view-model types. Unlike the wire DTOs in `./wire`, these use the stable
// `readout_error` name, carry never-undefined fields, and hold only what the
// lattice and panels render. Built from raw snapshots by `$lib/domain/snapshot`.

export type UiQubit = {
    id: number;
    T1: number | null;
    T2: number | null;
    readout_error: number | null;
    sx_error: number | null;
    frequency: number | null;
    p01: number | null;
    p10: number | null;
};

export type UiEdge = {
    source: number;
    target: number;
    twoq_error: number | null;
};

export type UiSnapshot = {
    date: string;
    timestamp: string;
    qubits: UiQubit[];
    edges: UiEdge[];
};

export type MetricRanges = {
    T1: [number, number];
    T2: [number, number];
    readout: [number, number];
    twoq: [number, number];
};

// Node metric a user can colour the lattice by. A subset of the metrics the
// scorer understands — see `ScoreMetric` in `$lib/domain/metrics`.
export type MetricMode = 'readout' | 'T1' | 'T2';

// Direction + signed magnitude of a cluster metric relative to the device
// median. Rendered as ▲/▼ pills in the read panel; formatted via
// `deltaLabel` in `$lib/viz/format`.
export type ClusterDelta = {
    dir: 'up' | 'down' | 'flat';
    magnitude: number;
};
