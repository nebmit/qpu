import type { UiQubit, UiEdge } from '$lib/types';
import { computeRanges, metricScore, edgeScore } from '$lib/domain/metrics';

const CLUSTER_SEED_CANDIDATES = 14;

// findCluster scoring weights. Node-metric weights blend the four normalized
// per-qubit metrics into a single quality (sum = 1). The growth blend balances
// node quality against CX-edge quality when deciding which neighbour to add and
// when ranking finished clusters — so 2-qubit gate error meaningfully steers the
// selection alongside the per-qubit sx gate error.
const NODE_WEIGHTS = { readout: 0.3, sx: 0.2, T1: 0.25, T2: 0.25 };
const W_NODE = 0.6;
const W_EDGE = 0.4;
// Soft topology nudges, small relative to the [0,1] quality terms.
const TOPO_LINEAR_OVERDEGREE_PENALTY = 0.5; // adding past a degree-2 chain
const TOPO_LINEAR_ENDPOINT_BONUS = 0.05;    // extend a true endpoint
const TOPO_BRANCHED_JUNCTION_BONUS = 0.05;  // reward forming junctions

type ConnRules = { endpoint: number; chain: number; junction: number };

export type Topology = 'compact' | 'linear' | 'branched';

export const TOPOLOGIES: { value: Topology; label: string }[] = [
    { value: 'compact', label: 'Compact' },
    { value: 'linear', label: 'Linear' },
    { value: 'branched', label: 'Branched' }
];

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

    const total = (connRules.endpoint || 0) + (connRules.chain || 0) + (connRules.junction || 0);
    if (total === 0) return [];
    const ids = [...allowed];
    // Cluster size is a hard requirement: return exactly `needed` connected
    // qubits or throw. Do NOT cap to the pool size.
    const needed = total;

    // Connected components of the filtered graph. A cluster of `needed` qubits
    // can only live inside a component with at least that many nodes.
    const componentSize = new Map<number, number>();
    const seenComp = new Set<number>();
    let maxComponent = 0;
    for (const start of ids) {
        if (seenComp.has(start)) continue;
        const comp: number[] = [];
        const stack = [start];
        seenComp.add(start);
        while (stack.length) {
            const cur = stack.pop()!;
            comp.push(cur);
            for (const nb of adj.get(cur) || []) {
                if (!seenComp.has(nb)) {
                    seenComp.add(nb);
                    stack.push(nb);
                }
            }
        }
        for (const id of comp) componentSize.set(id, comp.length);
        if (comp.length > maxComponent) maxComponent = comp.length;
    }

    const tooSmall = () =>
        new Error(
            `Can't build a connected ${needed}-qubit cluster with the current filters — ` +
            `the largest connected region is ${maxComponent} qubit${maxComponent === 1 ? '' : 's'}. ` +
            `Relax the quality filters or reduce the cluster size.`
        );
    if (maxComponent < needed) throw tooSmall();

    // topoToRules() encodes the requested topology in connRules: a chain budget
    // means linear, an endpoint budget means branched, otherwise compact.
    const mode: Topology =
        connRules.chain > 0 ? 'linear' : connRules.endpoint > 0 ? 'branched' : 'compact';

    // Normalize all metrics over the allowed candidate pool so scoring adapts to
    // each snapshot, reusing the same machinery the lattice/read panels use.
    const allowedQubits = qubits.filter((q) => allowed.has(q.id));
    const allowedEdges = edges.filter((e) => allowed.has(e.source) && allowed.has(e.target));
    const R = computeRanges(allowedQubits, allowedEdges);

    // Per-qubit quality in [0,1], higher = better. Missing metrics score a
    // neutral 0.5 via metricScore.
    const nodeQuality = (id: number) => {
        const q = byId.get(id);
        if (!q) return 0;
        return (
            NODE_WEIGHTS.readout * metricScore(q, 'readout', R) +
            NODE_WEIGHTS.sx * metricScore(q, 'sx', R) +
            NODE_WEIGHTS.T1 * metricScore(q, 'T1', R) +
            NODE_WEIGHTS.T2 * metricScore(q, 'T2', R)
        );
    };

    // CX-edge quality in [0,1], higher = better. Unmeasured links are neutral
    // (0.5) rather than worst, so missing data doesn't unfairly reject an edge.
    const edgeQuality = (e: UiEdge) =>
        typeof e.cx_error === 'number' && Number.isFinite(e.cx_error) ? edgeScore(e, R) : 0.5;

    // Precompute edge quality by qubit-pair key for O(1) lookup during growth.
    const edgeKey = (a: number, b: number) => `${Math.min(a, b)}-${Math.max(a, b)}`;
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

    // Grow a connected cluster from a seed, repeatedly adding the frontier node
    // with the highest marginal gain (node quality + connecting-edge quality +
    // a soft topology nudge).
    const grow = (seed: number): number[] => {
        const members = new Set([seed]);
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
        addFrontier(seed);

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
        const cluster = grow(seed);
        if (cluster.length !== needed) continue; // never return a short cluster
        const score = clusterScore(cluster);
        if (score > bestScore) {
            bestScore = score;
            best = cluster;
        }
    }
    // Defensive: eligibility guarantees a full-size cluster, but if growth somehow
    // failed to reach the target we error rather than return a short result.
    if (!best || best.length !== needed) throw tooSmall();
    return best;
}
