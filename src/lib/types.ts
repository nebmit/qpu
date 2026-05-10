export interface QubitState {
    id?: number
    T1: number | null
    T2: number | null
    readout_err: number | null
    sx_error?: number | null
    frequency?: number | null
    p01: number | null
    p10: number | null
}

export interface GateState {
    qubits: [number, number]
    gate: string
    error: number | null
    duration: number | null
}

export interface Snapshot {
    t: string           // date string e.g. "2024-11-12"
    ts: string          // full ISO timestamp
    qubits: QubitState[]
    gates: GateState[]
}

export interface Dataset {
    meta: {
        backends: string[]
        n_qubits: number
        cadence_days: number
    }
    coupling_map: Record<string, [number, number][]>
    timeseries: Record<string, Snapshot[]>
}

export interface Position {
    x: number   // [0, 1]
    y: number   // [0, 1]
}

export type Positions = Record<string, Record<string, Position>>

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
    cx_error: number | null;
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
    sx: [number, number];
    cx: [number, number];
};
