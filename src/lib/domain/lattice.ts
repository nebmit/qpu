import type { UiEdge } from '$lib/types';

// Heavy-hex lattice geometry. `buildLayout`/`buildEdges` synthesise the default
// 156-qubit IBM heavy-hex arrangement; `buildEdgesFromCoupling` derives edges
// from a device-supplied coupling map instead. These produce the static base
// topology that snapshots are layered onto (see `$lib/domain/snapshot`).

export const TOTAL_QUBITS = 156;

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

export function buildBaseEdges(coupling?: [number, number][]): UiEdge[] {
    const edges = coupling ? buildEdgesFromCoupling(coupling) : BASE_EDGES;
    return edges.map((e) => ({ ...e, cx_error: null }));
}
