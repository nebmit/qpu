import { describe, expect, it } from 'vitest';
import { edge, pathGraph, q, starGraph } from '$lib/testing/fixtures';
import {
    findCluster,
    largestComponent,
    predictRelaxations,
    qualifyQubits,
    ruleTotal,
    topoToRules
} from './cluster';

function inducedDegrees(members: number[], edges: ReturnType<typeof edge>[]) {
    const set = new Set(members);
    const deg = new Map(members.map((id) => [id, 0]));
    for (const e of edges) {
        if (set.has(e.source) && set.has(e.target)) {
            deg.set(e.source, (deg.get(e.source) ?? 0) + 1);
            deg.set(e.target, (deg.get(e.target) ?? 0) + 1);
        }
    }
    return deg;
}

describe('topoToRules', () => {
    it('maps topologies to connection rules', () => {
        expect(topoToRules(5, 'linear')).toEqual({ endpoint: 0, chain: 5, junction: 0 });
        expect(topoToRules(5, 'branched')).toEqual({ endpoint: 2, chain: 0, junction: 3 });
        expect(topoToRules(5, 'compact')).toEqual({ endpoint: 0, chain: 0, junction: 5 });
        expect(ruleTotal({ endpoint: 2, chain: 1, junction: 3 })).toBe(6);
    });
});

describe('qualifyQubits', () => {
    it('enforces readout and coherence boundaries', () => {
        const filters = { readoutPct: 2, twoqPct: 1, minT1: 100, minT2: 50 };
        const allowed = qualifyQubits(filters, [
            q(0, { readout_error: 0.02, T1: 100, T2: 50 }),
            q(1, { readout_error: 0.021 }),
            q(2, { T1: 99 }),
            q(3, { T2: 49 }),
            q(4, { readout_error: null, T1: null, T2: null })
        ]);

        expect([...allowed].sort((a, b) => a - b)).toEqual([0, 4]);
    });
});

describe('findCluster', () => {
    it('finds a connected linear cluster on a path', () => {
        const graph = pathGraph(6);
        const result = findCluster(topoToRules(4, 'linear'), graph.qubits, graph.edges);
        const degrees = inducedDegrees(result.cluster, graph.edges);

        expect(result.reason).toBe('ok');
        expect(result.cluster).toHaveLength(4);
        expect([...degrees.values()].filter((d) => d === 1)).toHaveLength(2);
        expect([...degrees.values()].filter((d) => d === 2)).toHaveLength(2);
    });

    it('returns an empty ok result for zero requested qubits', () => {
        const graph = pathGraph(3);
        expect(findCluster({ endpoint: 0, chain: 0, junction: 0 }, graph.qubits, graph.edges)).toEqual({
            cluster: [],
            requested: 0,
            maxComponent: 0,
            allowedCount: 3,
            reason: 'ok'
        });
    });

    it('reports region-too-small when every component is smaller than the request', () => {
        const qubits = Array.from({ length: 5 }, (_, id) => q(id));
        const edges = [edge(0, 1), edge(2, 3)];
        expect(findCluster(topoToRules(3, 'linear'), qubits, edges)).toMatchObject({
            cluster: [],
            requested: 3,
            maxComponent: 2,
            allowedCount: 5,
            reason: 'region-too-small'
        });
    });

    it('keeps linear clusters degree-bounded on a star', () => {
        const graph = starGraph(5);
        const result = findCluster(topoToRules(3, 'linear'), graph.qubits, graph.edges);
        const maxDegree = Math.max(...inducedDegrees(result.cluster, graph.edges).values());

        expect(result.reason).toBe('ok');
        expect(maxDegree).toBeLessThanOrEqual(2);
    });

    it('prefers the better-quality connected component', () => {
        const qubits = [
            q(0, { readout_error: 0.05, T1: 100, T2: 50 }),
            q(1, { readout_error: 0.05, T1: 100, T2: 50 }),
            q(2, { readout_error: 0.05, T1: 100, T2: 50 }),
            q(3, { readout_error: 0.001, T1: 300, T2: 200 }),
            q(4, { readout_error: 0.001, T1: 300, T2: 200 }),
            q(5, { readout_error: 0.001, T1: 300, T2: 200 })
        ];
        const edges = [edge(0, 1, 0.01), edge(1, 2, 0.01), edge(3, 4, 0.001), edge(4, 5, 0.001)];

        expect(findCluster(topoToRules(3, 'linear'), qubits, edges).cluster.sort((a, b) => a - b)).toEqual([3, 4, 5]);
    });

    it('returns a partial cluster when fewer connected qubits are allowed than requested', () => {
        const graph = pathGraph(3);
        const result = findCluster(topoToRules(5, 'linear'), graph.qubits, graph.edges);

        expect(result.reason).toBe('ok');
        expect(result.requested).toBe(5);
        expect(result.cluster).toHaveLength(3);
    });

    it('is deterministic for repeated inputs', () => {
        const graph = pathGraph(6);
        const first = findCluster(topoToRules(4, 'linear'), graph.qubits, graph.edges).cluster;
        const second = findCluster(topoToRules(4, 'linear'), graph.qubits, graph.edges).cluster;

        expect(second).toEqual(first);
    });
});

describe('largestComponent', () => {
    it('excludes links above the two-qubit cutoff', () => {
        expect(largestComponent(new Set([0, 1, 2, 3]), [edge(0, 1, 0.001), edge(1, 2, 0.05), edge(2, 3, 0.001)], 0.01)).toEqual([0, 1]);
    });
});

describe('predictRelaxations', () => {
    it('reports useful relaxations sorted by resulting component size', () => {
        const suggestions = predictRelaxations(
            { readoutPct: 1, twoqPct: 1, minT1: 100, minT2: 50 },
            [
                q(0, { readout_error: 0.005 }),
                q(1, { readout_error: 0.05 }),
                q(2, { readout_error: 0.06 }),
                q(3, { readout_error: 0.2, T1: 20 }),
                q(4, { readout_error: 0.2, T2: 20 })
            ],
            [edge(0, 1, 0.005), edge(1, 2, 0.005), edge(3, 4, 0.005)]
        );

        expect(suggestions.baseQ).toBe(1);
        expect(suggestions.baseComp).toBe(1);
        expect(suggestions.candidates).toHaveLength(1);
        expect(suggestions.candidates[0]).toMatchObject({
            key: 'readoutPct',
            addQ: 2,
            comp: 3
        });
    });
});
