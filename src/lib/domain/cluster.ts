import type { UiQubit, UiEdge } from '$lib/types';
import { computeRanges, metricScore, edgeScore } from '$lib/domain/metrics';
import { edgeKey } from '$lib/domain/lattice';

// 14 ≈ 9% of the 156-qubit device — enough variety to escape local quality peaks
// (different qubit degrees, component shapes) without making growth O(n²) costly.
const CLUSTER_SEED_CANDIDATES = 14;

export const NODE_WEIGHTS = { readout: 0.4, T1: 0.3, T2: 0.3 };
export const W_NODE = 0.6;
export const W_EDGE = 0.4;

// The overdegree penalty (0.5) must dominate a single node+edge gain (max 1.0)
// to reliably block branching in linear mode — it is intentionally large.
// The endpoint/junction bonuses (0.05) are tie-breakers only; keeping them an
// order of magnitude smaller than the penalty means they never override quality.
const TOPO_LINEAR_OVERDEGREE_PENALTY = 0.5;
const TOPO_LINEAR_ENDPOINT_BONUS = 0.05;
const TOPO_BRANCHED_JUNCTION_BONUS = 0.05;

const RELAX_STEPS: ClusterFilters = {
    readoutPct: 6,
    twoqPct: 2,
    minT1: 50,
    minT2: 30
};

export type ConnRules = { endpoint: number; chain: number; junction: number };

export const ruleTotal = (rules: ConnRules): number =>
    rules.endpoint + rules.chain + rules.junction;

export type Topology = 'compact' | 'linear' | 'branched';

export type ClusterFilters = {
    readoutPct: number;
    twoqPct: number;
    minT1: number;
    minT2: number;
};

export type RelaxCandidate = {
    key: string;
    label: string;
    addQ: number;
    comp: number;
    filters: ClusterFilters;
};

export type RelaxSuggestions = {
    baseQ: number;
    baseComp: number;
    candidates: RelaxCandidate[];
};

export type ClusterResult = {
    cluster: number[];
    requested: number;
    maxComponent: number;
    allowedCount: number;
    reason: 'ok' | 'region-too-small' | 'topology-unplaceable';
};

function buildAdj(
    allowed: Set<number>,
    edges: UiEdge[],
    maxTwoqError?: number
): Map<number, number[]> {
    const adj = new Map<number, number[]>();
    for (const id of allowed) adj.set(id, []);
    for (const e of edges) {
        if (!allowed.has(e.source) || !allowed.has(e.target)) continue;
        if (maxTwoqError !== undefined && typeof e.twoq_error === 'number' && e.twoq_error > maxTwoqError) continue;
        adj.get(e.source)!.push(e.target);
        adj.get(e.target)!.push(e.source);
    }
    return adj;
}

function analyzeComponents(adj: Map<number, number[]>): {
    sizeByNode: Map<number, number>;
    largest: number[];
} {
    const sizeByNode = new Map<number, number>();
    const seen = new Set<number>();
    let largest: number[] = [];
    for (const start of adj.keys()) {
        if (seen.has(start)) continue;
        const comp: number[] = [];
        const stack = [start];
        seen.add(start);
        while (stack.length) {
            const cur = stack.pop()!;
            comp.push(cur);
            for (const nb of adj.get(cur)!) {
                if (!seen.has(nb)) { seen.add(nb); stack.push(nb); }
            }
        }
        for (const id of comp) sizeByNode.set(id, comp.length);
        if (comp.length > largest.length) largest = comp;
    }
    return { sizeByNode, largest };
}

export const TOPOLOGIES: { value: Topology; label: string }[] = [
    { value: 'compact', label: 'Compact' },
    { value: 'linear', label: 'Linear' },
    { value: 'branched', label: 'Branched' }
];

function buildQualityContext(qubits: UiQubit[], edges: UiEdge[], allowed: Set<number>) {
    const byId = new Map(qubits.map((q) => [q.id, q]));
    const allowedQubits = qubits.filter((q) => allowed.has(q.id));
    const allowedEdges = edges.filter((e) => allowed.has(e.source) && allowed.has(e.target));
    const R = computeRanges(allowedQubits, allowedEdges);
    const nodeQuality = (id: number) => {
        const q = byId.get(id);
        if (!q) return 0;
        return (
            NODE_WEIGHTS.readout * metricScore(q, 'readout', R) +
            NODE_WEIGHTS.T1 * metricScore(q, 'T1', R) +
            NODE_WEIGHTS.T2 * metricScore(q, 'T2', R)
        );
    };
    // Unmeasured links are neutral rather than worst, so missing data doesn't unfairly reject an edge.
    const edgeQuality = (e: UiEdge) =>
        typeof e.twoq_error === 'number' && Number.isFinite(e.twoq_error) ? edgeScore(e, R) : 0.5;
    return { allowedEdges, nodeQuality, edgeQuality };
}

export const TOPO_HINT: Record<Topology, string> = {
    compact: 'Dense, well-connected block — maximises 2-qubit gate options.',
    linear: 'A single chain — ideal for 1-D / nearest-neighbour circuits.',
    branched: 'Tree-like — junctions with reaching endpoints.'
};

export function topoToRules(n: number, topo: Topology): ConnRules {
    if (topo === 'linear') return { endpoint: 0, chain: n, junction: 0 };
    if (topo === 'branched') return { endpoint: Math.floor(n / 2), chain: 0, junction: Math.ceil(n / 2) };
    return { endpoint: 0, chain: 0, junction: n };
}

export function findCluster(
    connRules: ConnRules,
    qubits: UiQubit[],
    edges: UiEdge[],
    allowedIds?: Set<number>
): ClusterResult {
    const allowed = allowedIds || new Set(qubits.map((q) => q.id));
    const adj = buildAdj(allowed, edges);
    const deg = new Map<number, number>();
    for (const id of allowed) deg.set(id, adj.get(id)!.length);

    const total = ruleTotal(connRules);
    if (total === 0) {
        return { cluster: [], requested: 0, maxComponent: 0, allowedCount: allowed.size, reason: 'ok' };
    }
    const ids = [...allowed];
    const needed = Math.min(total, ids.length);

    const { sizeByNode: componentSize, largest: largestComp } = analyzeComponents(adj);
    const maxComponent = largestComp.length;

    if (maxComponent < needed) {
        return { cluster: [], requested: total, maxComponent, allowedCount: ids.length, reason: 'region-too-small' };
    }

    const mode: Topology =
        connRules.chain > 0 ? 'linear' : connRules.endpoint > 0 ? 'branched' : 'compact';

    const { allowedEdges, nodeQuality, edgeQuality } = buildQualityContext(qubits, edges, allowed);

    const linkQ = new Map<string, number>();
    for (const e of allowedEdges) linkQ.set(edgeKey(e.source, e.target), edgeQuality(e));

    const linkQuality = (a: number, b: number) => linkQ.get(edgeKey(a, b)) ?? 0.5;

    const internalDegree = (id: number, members: Set<number>) =>
        (adj.get(id) || []).reduce((n, nb) => n + (members.has(nb) ? 1 : 0), 0);

    const needDeg = new Set<number>();
    if (connRules.endpoint > 0) needDeg.add(1);
    if (connRules.chain > 0) needDeg.add(2);
    if (connRules.junction > 0) needDeg.add(3);

    const sortedIds = ids
        .filter((id) => (componentSize.get(id) || 0) >= needed)
        .sort((a, b) => {
            const da = needDeg.has(deg.get(a)!) ? 0 : 1;
            const db = needDeg.has(deg.get(b)!) ? 0 : 1;
            return da - db || nodeQuality(b) - nodeQuality(a);
        });

    const grow = (seedMembers: number[]): number[] => {
        const members = new Set(seedMembers);
        const frontier = new Map<number, number[]>();
        const addFrontier = (id: number) => {
            for (const nb of adj.get(id) || []) {
                if (members.has(nb)) continue;
                const links = frontier.get(nb) || [];
                links.push(id);
                frontier.set(nb, links);
            }
        };
        for (const m of members) addFrontier(m);

        while (members.size < needed && frontier.size) {
            let pick = -1;
            let pickGain = -Infinity;
            for (const [nb, links] of frontier) {
                const edgeQs = links.map((m) => linkQuality(nb, m));
                const connectivity =
                    mode === 'compact'
                        ? edgeQs.reduce((s, q) => s + q, 0)
                        : Math.max(...edgeQs);

                let topoBias = 0;
                if (mode === 'linear') {
                    const wouldOverDegree = links.some((m) => internalDegree(m, members) >= 2);
                    if (wouldOverDegree) topoBias -= TOPO_LINEAR_OVERDEGREE_PENALTY;
                    if (links.length === 1) topoBias += TOPO_LINEAR_ENDPOINT_BONUS;
                } else if (mode === 'branched') {
                    if (links.some((m) => internalDegree(m, members) >= 2)) {
                        topoBias += TOPO_BRANCHED_JUNCTION_BONUS;
                    }
                }

                const gain = W_NODE * nodeQuality(nb) + W_EDGE * connectivity + topoBias;
                if (gain > pickGain) {
                    pickGain = gain;
                    pick = nb;
                }
            }
            if (pick < 0) break;
            members.add(pick);
            frontier.delete(pick);
            addFrontier(pick);
        }
        return [...members];
    };

    const clusterScore = (members: number[]) => {
        const set = new Set(members);
        const nodeMean =
            members.reduce((s, id) => s + nodeQuality(id), 0) / (members.length || 1);
        const internal = allowedEdges.filter((e) => set.has(e.source) && set.has(e.target));
        const edgeMean = internal.length
            ? internal.reduce((s, e) => s + edgeQuality(e), 0) / internal.length
            : 0;
        return W_NODE * nodeMean + W_EDGE * edgeMean;
    };

    let best: number[] | null = null;
    let bestScore = -Infinity;
    for (const seed of sortedIds.slice(0, CLUSTER_SEED_CANDIDATES)) {
        const cluster = grow([seed]);
        if (cluster.length !== needed) continue;
        const score = clusterScore(cluster);
        if (score > bestScore) {
            bestScore = score;
            best = cluster;
        }
    }
    if (!best || best.length !== needed) {
        return { cluster: [], requested: total, maxComponent, allowedCount: ids.length, reason: 'topology-unplaceable' };
    }
    return { cluster: best, requested: total, maxComponent, allowedCount: ids.length, reason: 'ok' };
}

export function qualifyQubits(filters: ClusterFilters, qubits: UiQubit[]) {
    const maxReadout = filters.readoutPct / 100;
    const set = new Set<number>();
    for (const q of qubits) {
        if (!q) continue;
        const roOk = typeof q.readout_error !== 'number' || q.readout_error <= maxReadout;
        const t1Ok = typeof q.T1 !== 'number' || q.T1 >= filters.minT1;
        const t2Ok = typeof q.T2 !== 'number' || q.T2 >= filters.minT2;
        if (roOk && t1Ok && t2Ok) set.add(q.id);
    }
    return set;
}

export function largestComponent(
    allowed: Set<number>,
    edges: UiEdge[],
    maxTwoq: number
): number[] {
    const adj = buildAdj(allowed, edges, maxTwoq);
    const { largest } = analyzeComponents(adj);
    return largest;
}

export function predictRelaxations(
    filters: ClusterFilters,
    qubits: UiQubit[],
    edges: UiEdge[]
): RelaxSuggestions {
    const baseAllowed = qualifyQubits(filters, qubits);
    const baseComp = largestComponent(baseAllowed, edges, filters.twoqPct / 100).length;
    const candidates: RelaxCandidate[] = [];
    const mk = (key: string, label: string, nf: ClusterFilters) => {
        const allowed = qualifyQubits(nf, qubits);
        const comp = largestComponent(allowed, edges, nf.twoqPct / 100).length;
        const addQ = allowed.size - baseAllowed.size;
        const addC = comp - baseComp;
        if (addQ > 0 || addC > 0) candidates.push({ key, label, addQ, comp, filters: nf });
    };
    const relaxedReadout = Math.min(100, filters.readoutPct + RELAX_STEPS.readoutPct);
    mk('readoutPct', `Readout ≤ ${relaxedReadout.toFixed(0)}%`, {
        ...filters,
        readoutPct: relaxedReadout
    });
    const relaxedT1 = Math.max(0, filters.minT1 - RELAX_STEPS.minT1);
    mk('minT1', `T₁ ≥ ${relaxedT1} μs`, { ...filters, minT1: relaxedT1 });
    const relaxedT2 = Math.max(0, filters.minT2 - RELAX_STEPS.minT2);
    mk('minT2', `T₂ ≥ ${relaxedT2} μs`, { ...filters, minT2: relaxedT2 });
    const relaxedTwoq = Math.min(100, filters.twoqPct + RELAX_STEPS.twoqPct);
    mk('twoqPct', `2Q ≤ ${relaxedTwoq.toFixed(0)}%`, { ...filters, twoqPct: relaxedTwoq });
    candidates.sort((a, b) => b.comp - a.comp || b.addQ - a.addQ);
    return {
        baseQ: baseAllowed.size,
        baseComp,
        candidates: candidates.slice(0, 3)
    };
}
