import type { UiQubit, UiEdge } from '$lib/types';
import { computeRanges, metricScore, edgeScore } from '$lib/domain/metrics';
import { edgeKey } from '$lib/domain/lattice';

// How many top-ranked seed nodes to try before picking the best grown cluster.
// 14 ≈ 9% of the 156-qubit device — enough variety to escape local quality peaks
// (different qubit degrees, component shapes) without making growth O(n²) costly.
const CLUSTER_SEED_CANDIDATES = 14;

// findCluster scoring weights. Node-metric weights blend three normalized
// per-qubit metrics into a single quality (sum = 1). The growth blend balances
// node quality against 2Q-edge quality when deciding which neighbour to add.
// Exported so cross-snapshot analytics (stability, cluster-over-time) rank
// qubits with the same value system as the finder.
export const NODE_WEIGHTS = { readout: 0.4, T1: 0.3, T2: 0.3 };
export const W_NODE = 0.6;
export const W_EDGE = 0.4;
// Topology nudges applied as additive bias to the gain score (range ≈ [0, 1]).
// The overdegree penalty (0.5) must dominate a single node+edge gain (max 1.0)
// to reliably block branching in linear mode — it is intentionally large.
// The endpoint/junction bonuses (0.05) are tie-breakers only; keeping them an
// order of magnitude smaller than the penalty means they never override quality.
const TOPO_LINEAR_OVERDEGREE_PENALTY = 0.5; // blocks pushing a member past degree 2
const TOPO_LINEAR_ENDPOINT_BONUS = 0.05;    // prefers extending a true chain endpoint
const TOPO_BRANCHED_JUNCTION_BONUS = 0.05;  // prefers forming a junction over a leaf

type ConnRules = { endpoint: number; chain: number; junction: number };

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
};

// Create an adjacency list for a set of allowed nodes. Optionally filters edges
// whose twoq_error exceeds a ceiling (used by largestComponent for error-aware routing).
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

// Flood-fill all components. Returns per-node component size and the largest
// component's node list, so callers can pick whichever they need.
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

// Quality context used by the finder: per-node and per-edge quality in [0,1],
// normalized over the allowed candidate pool.
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
    // Unmeasured links are neutral (0.5) rather than worst, so missing data
    // doesn't unfairly reject an edge.
    const edgeQuality = (e: UiEdge) =>
        typeof e.twoq_error === 'number' && Number.isFinite(e.twoq_error) ? edgeScore(e, R) : 0.5;
    return { allowedEdges, nodeQuality, edgeQuality };
}

export const TOPO_HINT: Record<Topology, string> = {
    compact: 'Dense, well-connected block — maximises 2-qubit gate options.',
    linear: 'A single chain — ideal for 1-D / nearest-neighbour circuits.',
    branched: 'Tree-like — junctions with reaching endpoints.'
};

// Map a target size + topology choice onto the connectivity-degree rules the
// finder seeds from: endpoint = deg-1, chain = deg-2, junction = deg-3.
export function topoToRules(n: number, topo: Topology): ConnRules {
    if (topo === 'linear') return { endpoint: 0, chain: n, junction: 0 };
    if (topo === 'branched') return { endpoint: Math.floor(n / 2), chain: 0, junction: Math.ceil(n / 2) };
    return { endpoint: 0, chain: 0, junction: n }; // compact
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

    const total = (connRules.endpoint || 0) + (connRules.chain || 0) + (connRules.junction || 0);
    if (total === 0) {
        return { cluster: [], requested: 0, maxComponent: 0, allowedCount: allowed.size };
    }
    const ids = [...allowed];
    const needed = Math.min(total, ids.length);

    const { sizeByNode: componentSize, largest: largestComp } = analyzeComponents(adj);
    const maxComponent = largestComp.length;

    if (maxComponent < needed) {
        return { cluster: [], requested: total, maxComponent, allowedCount: ids.length };
    }

    // topoToRules() encodes the requested topology in connRules: a chain budget
    // means linear, an endpoint budget means branched, otherwise compact.
    const mode: Topology =
        connRules.chain > 0 ? 'linear' : connRules.endpoint > 0 ? 'branched' : 'compact';

    // Normalize all metrics over the allowed candidate pool so scoring adapts to
    // each snapshot, reusing the same machinery the lattice/read panels use.
    const { allowedEdges, nodeQuality, edgeQuality } = buildQualityContext(qubits, edges, allowed);

    // Precompute edge quality by qubit-pair key for O(1) lookup during growth.
    const linkQ = new Map<string, number>();
    for (const e of allowedEdges) linkQ.set(edgeKey(e.source, e.target), edgeQuality(e));

    // Quality of the edge between two adjacent qubits (0.5 if no edge record).
    const linkQuality = (a: number, b: number) => linkQ.get(edgeKey(a, b)) ?? 0.5;

    // Internal degree of a cluster node = how many of its neighbours are members.
    const internalDegree = (id: number, members: Set<number>) =>
        (adj.get(id) || []).reduce((n, nb) => n + (members.has(nb) ? 1 : 0), 0);

    // Seed from the best qubits, preferring degrees that suit the topology.
    const needDeg = new Set<number>();
    if (connRules.endpoint > 0) needDeg.add(1);
    if (connRules.chain > 0) needDeg.add(2);
    if (connRules.junction > 0) needDeg.add(3);
    // Only seed from nodes whose component is big enough to hold the cluster, so
    // growth always reaches exactly `needed`.
    const sortedIds = ids
        .filter((id) => (componentSize.get(id) || 0) >= needed)
        .sort((a, b) => {
            const da = needDeg.has(deg.get(a)!) ? 0 : 1;
            const db = needDeg.has(deg.get(b)!) ? 0 : 1;
            return da - db || nodeQuality(b) - nodeQuality(a);
        });

    // Grow a connected cluster from one or more seed members, repeatedly adding
    // the frontier node with the highest marginal gain (node quality +
    // connecting-edge quality + a soft topology nudge).
    const grow = (seedMembers: number[]): number[] => {
        const members = new Set(seedMembers);
        // links from each frontier node into the current cluster
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
                        ? edgeQs.reduce((s, q) => s + q, 0) // reward density
                        : Math.max(...edgeQs);              // single best link

                let topoBias = 0;
                if (mode === 'linear') {
                    // Discourage branching: penalize pushing a member past degree 2.
                    const wouldOverDegree = links.some((m) => internalDegree(m, members) >= 2);
                    if (wouldOverDegree) topoBias -= TOPO_LINEAR_OVERDEGREE_PENALTY;
                    if (links.length === 1) topoBias += TOPO_LINEAR_ENDPOINT_BONUS;
                } else if (mode === 'branched') {
                    // Reward attaching where it forms a junction (member gains degree).
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

    // Objective for ranking finished clusters: mean node quality blended with
    // mean internal-edge quality.
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
        if (cluster.length !== needed) continue; // never return a short cluster
        const score = clusterScore(cluster);
        if (score > bestScore) {
            bestScore = score;
            best = cluster;
        }
    }
    if (!best || best.length !== needed) {
        return { cluster: [], requested: total, maxComponent, allowedCount: ids.length };
    }
    return { cluster: best, requested: total, maxComponent, allowedCount: ids.length };
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
    mk('readoutPct', `Readout ≤ ${Math.min(100, filters.readoutPct + 6).toFixed(0)}%`, {
        ...filters,
        readoutPct: Math.min(100, filters.readoutPct + 6)
    });
    mk('minT1', `T₁ ≥ ${Math.max(0, filters.minT1 - 50)} μs`, {
        ...filters,
        minT1: Math.max(0, filters.minT1 - 50)
    });
    mk('minT2', `T₂ ≥ ${Math.max(0, filters.minT2 - 30)} μs`, {
        ...filters,
        minT2: Math.max(0, filters.minT2 - 30)
    });
    mk('twoqPct', `2Q ≤ ${Math.min(100, filters.twoqPct + 2).toFixed(0)}%`, {
        ...filters,
        twoqPct: Math.min(100, filters.twoqPct + 2)
    });
    candidates.sort((a, b) => b.comp - a.comp || b.addQ - a.addQ);
    return {
        baseQ: baseAllowed.size,
        baseComp,
        candidates: candidates.slice(0, 3)
    };
}
