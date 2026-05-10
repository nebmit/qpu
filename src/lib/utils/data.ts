import type { Dataset, Positions, Snapshot, UiQubit, UiEdge, UiSnapshot, MetricRanges } from '$lib/types';

export const QPU_DEVICES = ['ibm_fez', 'ibm_kingston', 'ibm_marrakesh'];
export const TOTAL_QUBITS = 156;

const CLUSTER_SEED_CANDIDATES = 14;

function buildLayout() {
    const pos = [];
    let id = 0;
    for (let row = 0; id < TOTAL_QUBITS; row++) {
        const even = row % 2 === 0,
            cols = even ? 13 : 12;
        for (let c = 0; c < cols && id < TOTAL_QUBITS; c++) {
            pos.push({ id, row, col: even ? c * 2 : c * 2 + 1 });
            id++;
        }
    }
    return pos;
}

function buildEdges(positions: { id: number; row: number; col: number }[]) {
    const map = new Map(positions.map((p) => [`${p.row},${p.col}`, p.id]));
    const seen = new Set();
    const edges: { source: number; target: number }[] = [];
    const add = (a?: number, b?: number) => {
        if (a == null || b == null) return;
        const k = `${Math.min(a, b)}-${Math.max(a, b)}`;
        if (!seen.has(k)) {
            seen.add(k);
            edges.push({ source: a, target: b });
        }
    };
    for (const p of positions) {
        add(p.id, map.get(`${p.row},${p.col + 2}`));
        if (p.row % 2 === 1) {
            add(map.get(`${p.row - 1},${p.col - 1}`), p.id);
            add(p.id, map.get(`${p.row - 1},${p.col + 1}`));
            add(map.get(`${p.row + 1},${p.col - 1}`), p.id);
            add(p.id, map.get(`${p.row + 1},${p.col + 1}`));
        }
    }
    return edges;
}

export function buildEdgesFromCoupling(coupling: [number, number][]) {
    const seen = new Set<string>();
    const edges: { source: number; target: number }[] = [];
    for (const [a, b] of coupling) {
        const k = `${Math.min(a, b)}-${Math.max(a, b)}`;
        if (!seen.has(k)) {
            seen.add(k);
            edges.push({ source: a, target: b });
        }
    }
    return edges;
}

export const BASE_POS = buildLayout();
export const BASE_EDGES = buildEdges(BASE_POS);

type ProgressCallback = (pct: number, received: number, total: number | null) => void;

async function fetchJson<T>(url: string, onProgress?: ProgressCallback): Promise<T> {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    if (!onProgress || !response.body) return response.json() as Promise<T>;

    const total = parseInt(response.headers.get('Content-Length') ?? '') || null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total) onProgress(received / total, received, total);
    }

    const all = new Uint8Array(received);
    let off = 0;
    for (const c of chunks) { all.set(c, off); off += c.length; }
    return JSON.parse(new TextDecoder().decode(all)) as T;
}

export async function loadData(onProgress?: ProgressCallback) {
    const [dataset, positions] = await Promise.all([
        fetchJson<Dataset>('/dataset.json', onProgress ? (p, recv, total) => onProgress(p * 0.95, recv, total) : undefined),
        fetchJson<Positions>('/positions.json'),
    ]);
    onProgress?.(1, 0, null);
    return { dataset, positions };
}

export function avg(vals: Array<number | null | undefined>): number | null {
    const ok = vals.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (!ok.length) return null;
    return ok.reduce((s, v) => s + v, 0) / ok.length;
}

export function buildBaseEdges(coupling?: [number, number][]): UiEdge[] {
    const edges = coupling ? buildEdgesFromCoupling(coupling) : BASE_EDGES;
    return edges.map((e) => ({ ...e, cx_error: null }));
}

export function buildUiSnapshot(snap: Snapshot, baseEdges: UiEdge[], totalQubits: number): UiSnapshot {
    const qubits: UiQubit[] = Array.from({ length: totalQubits }, (_, id) => ({
        id,
        T1: null,
        T2: null,
        readout_error: null,
        sx_error: null,
        frequency: null,
        p01: null,
        p10: null,
    }));

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
        qubits: Array.from({ length: totalQubits }, (_, id) => ({
            id,
            T1: null,
            T2: null,
            readout_error: null,
            sx_error: null,
            frequency: null,
            p01: null,
            p10: null,
        })),
        edges,
    };
}

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
        sx: range(qubits.map((q) => q.sx_error), [0, 0.01]),
        cx: range(edges.map((e) => e.cx_error), [0, 0.01])
    };
}

export function metricScore(q: UiQubit, mode: string, R: MetricRanges): number {
    switch (mode) {
        case 'T1':
            if (q.T1 == null) return 0.5;
            return (q.T1 - R.T1[0]) / (R.T1[1] - R.T1[0] + 1e-9);
        case 'T2':
            if (q.T2 == null) return 0.5;
            return (q.T2 - R.T2[0]) / (R.T2[1] - R.T2[0] + 1e-9);
        case 'readout':
            if (q.readout_error == null) return 0.5;
            return 1 - (q.readout_error - R.readout[0]) / (R.readout[1] - R.readout[0] + 1e-9);
        default:
            return 0.5;
    }
}

export function edgeScore(e: UiEdge, R: MetricRanges): number {
    if (typeof e.cx_error !== 'number' || !Number.isFinite(e.cx_error)) return 0;
    return 1 - (e.cx_error - R.cx[0]) / (R.cx[1] - R.cx[0] + 1e-9);
}

type ConnRules = { endpoint: number; chain: number; junction: number };

export function findCluster(
    connRules: ConnRules,
    qubits: UiQubit[],
    edges: UiEdge[],
    allowedIds?: Set<number>
): number[] {
    const allowed = allowedIds || new Set(qubits.map((q) => q.id));
    const byId = new Map(qubits.map((q) => [q.id, q]));
    const adj = new Map<number, number[]>();
    for (const id of allowed) adj.set(id, []);
    edges.forEach((e) => {
        if (!allowed.has(e.source) || !allowed.has(e.target)) return;
        adj.get(e.source)?.push(e.target);
        adj.get(e.target)?.push(e.source);
    });
    const deg = new Map<number, number>();
    for (const id of allowed) deg.set(id, (adj.get(id) || []).length);

    const qubitScore = (id: number) => {
        const q = byId.get(id);
        if (!q) return Infinity;
        const ro = q.readout_error ?? 1;
        const sx = q.sx_error ?? 1;
        const T1 = q.T1 ?? 1;
        const T2 = q.T2 ?? 1;
        return ro * 40 + sx * 4000 + 80 / (T1 + 1) + 60 / (T2 + 1);
    };

    const total = (connRules.endpoint || 0) + (connRules.chain || 0) + (connRules.junction || 0);
    if (total === 0) return [];
    const ids = [...allowed];
    const needed = Math.min(total, ids.length);
    if (needed === 0) return [];

    const needDeg = new Set<number>();
    if (connRules.endpoint > 0) needDeg.add(1);
    if (connRules.chain > 0) needDeg.add(2);
    if (connRules.junction > 0) needDeg.add(3);

    const sortedIds = ids.sort((a, b) => {
        const da = needDeg.has(deg.get(a)!) ? 0 : 1;
        const db = needDeg.has(deg.get(b)!) ? 0 : 1;
        return da - db || qubitScore(a) - qubitScore(b);
    });

    let best: number[] | null = null;
    let bestScore = Infinity;
    for (const seed of sortedIds.slice(0, CLUSTER_SEED_CANDIDATES)) {
        const vis = new Set([seed]);
        const queue = [seed];
        while (queue.length && vis.size < needed) {
            const cur = queue.shift()!;
            const neighbors = [...(adj.get(cur) || [])].sort((a, b) => qubitScore(a) - qubitScore(b));
            for (const nb of neighbors) {
                if (!vis.has(nb) && vis.size < needed) {
                    vis.add(nb);
                    queue.push(nb);
                }
            }
        }
        const cluster = [...vis];
        const score = cluster.reduce((a, id) => a + qubitScore(id), 0) / cluster.length;
        if (score < bestScore) {
            bestScore = score;
            best = cluster;
        }
    }
    return best || sortedIds.slice(0, needed);
}

export function metricNodeColor(t: number) {
    t = Math.max(0, Math.min(1, t));
    // Diverging: amber (t=0, bad) → bright white (t=0.5) → muted steel blue (t=1, good).
    // Good end shares the edge hue family so they read as one coherent "quality" layer.
    let L: number, C: number, H: number;
    if (t <= 0.5) {
        const s = t * 2;
        L = 58 + s * 37;      // 58 → 95
        C = 0.19 - s * 0.18;  // 0.19 → 0.01
        H = 35;
    } else {
        const s = (t - 0.5) * 2;
        L = 95 - s * 40;      // 95 → 55
        C = 0.01 + s * 0.07;  // 0.01 → 0.08
        H = 220;
    }
    return `oklch(${L.toFixed(1)}% ${C.toFixed(3)} ${H})`;
}

export function edgeColor(t: number) {
    t = Math.max(0, Math.min(1, t));
    // Single cool ramp: light slate (t=0, high error) → deep slate (t=1, low error).
    const L = 80 - t * 28;    // 80 → 52
    const C = 0.03 + t * 0.07; // 0.03 → 0.10
    return `oklch(${L.toFixed(1)}% ${C.toFixed(3)} 220)`;
}
