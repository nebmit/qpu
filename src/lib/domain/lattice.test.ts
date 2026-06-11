import { describe, expect, it } from 'vitest';
import { BASE_EDGES, BASE_POS, TOTAL_QUBITS, buildBaseEdges, buildEdgesFromCoupling, edgeKey } from './lattice';

describe('edgeKey', () => {
    it('is symmetric', () => {
        expect(edgeKey(3, 7)).toBe(edgeKey(7, 3));
    });
});

describe('BASE_POS', () => {
    it('contains a dense 156-qubit alternating-row layout', () => {
        expect(BASE_POS).toHaveLength(TOTAL_QUBITS);
        expect(new Set(BASE_POS.map((p) => p.id)).size).toBe(TOTAL_QUBITS);
        expect(Math.min(...BASE_POS.map((p) => p.id))).toBe(0);
        expect(Math.max(...BASE_POS.map((p) => p.id))).toBe(TOTAL_QUBITS - 1);

        const rowCounts = new Map<number, typeof BASE_POS>();
        for (const pos of BASE_POS) {
            rowCounts.set(pos.row, [...(rowCounts.get(pos.row) ?? []), pos]);
        }
        const lastRow = Math.max(...rowCounts.keys());
        for (const [row, positions] of rowCounts) {
            const expected = row % 2 === 0 ? 13 : 12;
            if (row !== lastRow) expect(positions).toHaveLength(expected);
            expect(positions.length).toBeLessThanOrEqual(expected);
        }
    });
});

describe('BASE_EDGES', () => {
    it('has unique in-range undirected edges and is connected', () => {
        const keys = new Set(BASE_EDGES.map((e) => edgeKey(e.source, e.target)));
        expect(keys.size).toBe(BASE_EDGES.length);
        for (const edge of BASE_EDGES) {
            expect(edge.source).toBeGreaterThanOrEqual(0);
            expect(edge.source).toBeLessThan(TOTAL_QUBITS);
            expect(edge.target).toBeGreaterThanOrEqual(0);
            expect(edge.target).toBeLessThan(TOTAL_QUBITS);
        }

        const adj = new Map<number, number[]>();
        for (const { id } of BASE_POS) adj.set(id, []);
        for (const edge of BASE_EDGES) {
            adj.get(edge.source)?.push(edge.target);
            adj.get(edge.target)?.push(edge.source);
        }
        const seen = new Set<number>([0]);
        const stack = [0];
        while (stack.length) {
            const current = stack.pop()!;
            for (const next of adj.get(current) ?? []) {
                if (!seen.has(next)) {
                    seen.add(next);
                    stack.push(next);
                }
            }
        }
        expect(seen.size).toBe(TOTAL_QUBITS);
    });
});

describe('buildEdgesFromCoupling', () => {
    it('dedupes reversed pairs', () => {
        expect(buildEdgesFromCoupling([[0, 1], [1, 0], [1, 2]])).toEqual([
            { source: 0, target: 1 },
            { source: 1, target: 2 }
        ]);
    });
});

describe('buildBaseEdges', () => {
    it('attaches null errors to generated base edges', () => {
        expect(buildBaseEdges().every((e) => e.twoq_error === null)).toBe(true);
        expect(buildBaseEdges()).toHaveLength(BASE_EDGES.length);
    });

    it('uses a provided coupling map', () => {
        expect(buildBaseEdges([[0, 1], [1, 0]])).toEqual([{ source: 0, target: 1, twoq_error: null }]);
    });
});
