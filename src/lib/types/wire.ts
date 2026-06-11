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
    t: string;
    ts: string;
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
    x: number;
    y: number;
}

export type Positions = Record<string, Record<string, Position>>;
