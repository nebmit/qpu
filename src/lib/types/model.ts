export type UiQubit = {
    id: number;
    T1: number | null;
    T2: number | null;
    readout_error: number | null;
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

export type MetricMode = 'readout' | 'T1' | 'T2' | 'stability';

export type ClusterDelta = {
    dir: 'up' | 'down' | 'flat';
    magnitude: number;
};
