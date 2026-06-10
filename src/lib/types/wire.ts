// Raw JSON shapes returned by the calibration endpoints (`/dataset.json`,
// `/positions.json`). These mirror the wire format exactly — including its
// snake_case field names (e.g. `readout_err`) — and are adapted into the UI
// view-model types (see `$lib/types/model`) by `$lib/domain/snapshot`.

export interface QubitState {
    id?: number;
    T1: number | null;
    T2: number | null;
    readout_err: number | null;
    p01: number | null;
    p10: number | null;
}

export interface GateState {
    qubits: [number, number];
    gate: string;
    error: number | null;
    duration: number | null;
}

export interface Snapshot {
    t: string; // date string e.g. "2024-11-12"
    ts: string; // full ISO timestamp
    qubits: QubitState[];
    gates: GateState[];
}

export interface Dataset {
    meta: {
        backends: string[];
        n_qubits: number;
        cadence_days: number;
    };
    coupling_map: Record<string, [number, number][]>;
    timeseries: Record<string, Snapshot[]>;
}

export interface Position {
    x: number; // [0, 1]
    y: number; // [0, 1]
}

export type Positions = Record<string, Record<string, Position>>;
