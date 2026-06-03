import { SvelteSet } from 'svelte/reactivity';
import { TOTAL_QUBITS, buildBaseEdges } from '$lib/domain/lattice';
import { computeRanges } from '$lib/domain/metrics';
import { avg, median } from '$lib/domain/statistics';
import { buildUiSnapshot, emptySnapshot } from '$lib/domain/snapshot';
import {
    findCluster,
    largestComponent,
    predictRelaxations,
    qualifyQubits,
    topoToRules,
    type ClusterFilters,
    type RelaxSuggestions,
    type Topology
} from '$lib/domain/cluster';
import { QPU_DEVICES } from '$lib/data/calibration';
import type { Dataset, Positions, UiEdge, UiSnapshot, MetricMode, ClusterDelta } from '$lib/types';

/**
 * Single reactive store backing the dashboard. Holds user-controlled inputs and
 * loaded data, and exposes derived snapshots, filtering, and numeric view-models.
 *
 * View-models (`stats`, `medians`, `clusterStats`) intentionally expose raw
 * numbers; string formatting lives in `$lib/viz/format` and is applied by the
 * components that render them.
 */
export class DashboardState {
    // ── User-controlled inputs ──────────────────────────────────────────
    device = $state(QPU_DEVICES[0]);
    timeIdx = $state(0);
    metricMode = $state<MetricMode>('readout');
    clusterSize = $state(12);
    topology = $state<Topology>('compact');
    errorCutoffs = $state({ readoutPct: 12, cxPct: 4 });
    coherenceCutoffs = $state({ minT1: 100, minT2: 50 });

    // ── Selection + cluster result ──────────────────────────────────────
    cluster = $state<number[]>([]);
    clusterRequested = $state(0);
    clusterError = $state<string | null>(null);
    findFailed = $state(false);
    nearestCluster = $state<number[]>([]);
    relaxSuggestions = $state<RelaxSuggestions | null>(null);
    hoveredId = $state<number | null>(null);
    selectedId = $state<number | null>(null);

    // ── Loaded data, keyed by device ────────────────────────────────────
    totalQubits = $state(TOTAL_QUBITS);
    baseEdgesByDevice = $state<Record<string, UiEdge[]>>({});
    snapshotsByDevice = $state<Record<string, UiSnapshot[]>>({});
    positionsByDevice = $state<Positions | null>(null);

    // ── Derived: active snapshot + filtering ────────────────────────────
    connRules = $derived(topoToRules(this.clusterSize, this.topology));

    snap = $derived.by(() => {
        const list = this.snapshotsByDevice[this.device] || [];
        if (!list.length) {
            const baseEdges = this.baseEdgesByDevice[this.device] || buildBaseEdges();
            return emptySnapshot(baseEdges, this.totalQubits);
        }
        const idx = Math.min(Math.max(this.timeIdx, 0), list.length - 1);
        return list[idx];
    });

    allowedQubitIds = $derived.by(() => {
        const maxReadout = this.errorCutoffs.readoutPct / 100;
        const { minT1, minT2 } = this.coherenceCutoffs;
        const ids = new SvelteSet<number>();
        for (const q of this.snap.qubits) {
            if (!q) continue;
            const roOk = typeof q.readout_error !== 'number' || q.readout_error <= maxReadout;
            const t1Ok = typeof q.T1 !== 'number' || q.T1 >= minT1;
            const t2Ok = typeof q.T2 !== 'number' || q.T2 >= minT2;
            if (roOk && t1Ok && t2Ok) ids.add(q.id);
        }
        return ids;
    });

    filteredQubits = $derived.by(() => this.snap.qubits.filter((q) => this.allowedQubitIds.has(q.id)));

    filteredEdges = $derived.by(() => {
        const maxCx = this.errorCutoffs.cxPct / 100;
        return this.snap.edges.filter((e) => {
            if (!this.allowedQubitIds.has(e.source) || !this.allowedQubitIds.has(e.target)) return false;
            return typeof e.cx_error !== 'number' || e.cx_error <= maxCx;
        });
    });

    ranges = $derived(computeRanges(this.filteredQubits, this.filteredEdges));
    totalConnections = $derived((this.connRules.endpoint || 0) + (this.connRules.chain || 0) + (this.connRules.junction || 0));
    timeCount = $derived((this.snapshotsByDevice[this.device] || []).length);

    // ── Derived view-models (raw numbers; formatted at the view layer) ──
    stats = $derived.by(() => {
        const q = this.snap.qubits;
        const edges = this.snap.edges;
        return {
            T1: avg(q.map((x) => x.T1)),
            T2: avg(q.map((x) => x.T2)),
            ro: avg(q.map((x) => x.readout_error)),
            cx: avg(edges.map((e) => e.cx_error)),
            qubitsCount: q.length,
            edgesCount: edges.length
        };
    });

    medians = $derived.by(() => {
        const q = this.snap.qubits;
        const edges = this.snap.edges;
        return {
            T1: median(q.map((x) => x.T1)),
            T2: median(q.map((x) => x.T2)),
            ro: median(q.map((x) => x.readout_error)),
            cx: median(edges.map((e) => e.cx_error))
        };
    });

    clusterStats = $derived.by(() => {
        if (!this.cluster.length) return null;
        const cq = this.cluster.map((id) => this.snap.qubits[id]).filter(Boolean);
        if (!cq.length) return null;
        const T1 = avg(cq.map((q) => q.T1));
        const T2 = avg(cq.map((q) => q.T2));
        const ro = avg(cq.map((q) => q.readout_error));

        // Compare a cluster metric to the device median; a ±2% dead-zone is "flat".
        // `dir` is "up" when the cluster is better than median (accounting for
        // metrics where lower is better, e.g. readout error).
        const delta = (
            val: number | null,
            ref: number | null,
            lowerBetter = false
        ): ClusterDelta | null => {
            if (val == null || ref == null || ref === 0) return null;
            const magnitude = (val - ref) / ref;
            const good = lowerBetter ? magnitude < -0.02 : magnitude > 0.02;
            const bad = lowerBetter ? magnitude > 0.02 : magnitude < -0.02;
            return { dir: good ? 'up' : bad ? 'down' : 'flat', magnitude };
        };

        const med = this.medians;
        return {
            T1,
            T2,
            ro,
            deltaT1: delta(T1, med.T1, false),
            deltaT2: delta(T2, med.T2, false),
            deltaRo: delta(ro, med.ro, true)
        };
    });

    // ── Actions ─────────────────────────────────────────────────────────
    clearCluster() {
        this.cluster = [];
        this.clusterError = null;
        this.clusterRequested = 0;
        this.findFailed = false;
        this.nearestCluster = [];
        this.relaxSuggestions = null;
        this.selectedId = null;
    }

    clusterFilters(): ClusterFilters {
        return {
            readoutPct: this.errorCutoffs.readoutPct,
            cxPct: this.errorCutoffs.cxPct,
            minT1: this.coherenceCutoffs.minT1,
            minT2: this.coherenceCutoffs.minT2
        };
    }

    applyClusterFilters(filters: ClusterFilters) {
        this.errorCutoffs.readoutPct = filters.readoutPct;
        this.errorCutoffs.cxPct = filters.cxPct;
        this.coherenceCutoffs.minT1 = filters.minT1;
        this.coherenceCutoffs.minT2 = filters.minT2;
    }

    setPositions(positions: Positions) {
        this.positionsByDevice = positions;
    }

    runFindCluster() {
        const allowed = new SvelteSet(this.allowedQubitIds);
        const result = findCluster(
            this.connRules,
            this.snap.qubits,
            this.filteredEdges,
            allowed
        );
        this.clusterRequested = result.requested;
        this.clusterError = null;
        this.selectedId = null;

        const clSet = new SvelteSet(result.cluster);
        const internalLinks = this.filteredEdges.filter(
            (e) => clSet.has(e.source) && clSet.has(e.target)
        ).length;

        if (result.cluster.length < 2 || internalLinks === 0) {
            this.cluster = [];
            this.findFailed = true;
            const filters = this.clusterFilters();
            const qualified = qualifyQubits(filters, this.snap.qubits);
            this.nearestCluster = largestComponent(
                qualified,
                this.snap.edges,
                filters.cxPct / 100
            );
            this.relaxSuggestions = predictRelaxations(
                filters,
                this.snap.qubits,
                this.snap.edges
            );
            return;
        }

        this.cluster = result.cluster;
        this.findFailed = false;
        this.nearestCluster = [];
        this.relaxSuggestions = null;
    }

    shrinkToNearestAndRetry() {
        const allowed = new SvelteSet(this.allowedQubitIds);
        const target = this.nearestCluster.length >= 2
            ? this.nearestCluster.length
            : Math.min(allowed.size, 8);
        this.clusterSize = Math.max(2, target);
        this.runFindCluster();
    }

    applyRelaxation(idx: number) {
        const cand = this.relaxSuggestions?.candidates[idx];
        if (!cand) return;
        this.applyClusterFilters(cand.filters);
        this.runFindCluster();
    }

    ensureTimeIdx(dev = this.device) {
        const list = this.snapshotsByDevice[dev] || [];
        if (!list.length) {
            this.timeIdx = 0;
            return;
        }
        if (this.timeIdx > list.length - 1) {
            this.timeIdx = list.length - 1;
        }
    }

    setDevice(dev: string) {
        this.device = dev;
        this.clearCluster();
        this.ensureTimeIdx(dev);
    }

    applyDataset(dataset: Dataset) {
        this.totalQubits = dataset.meta?.n_qubits || TOTAL_QUBITS;
        const couplingMap = dataset.coupling_map || {};
        const snapshotsByDevice: Record<string, UiSnapshot[]> = {};
        const baseEdgesByDevice: Record<string, UiEdge[]> = {};

        const devices = Object.keys(dataset.timeseries || {});
        for (const dev of devices) {
            const baseEdges = buildBaseEdges(couplingMap[dev]);
            baseEdgesByDevice[dev] = baseEdges;
            const series = dataset.timeseries?.[dev] || [];
            snapshotsByDevice[dev] = series.map((snap) =>
                buildUiSnapshot(snap, baseEdges, this.totalQubits)
            );
        }

        this.snapshotsByDevice = snapshotsByDevice;
        this.baseEdgesByDevice = baseEdgesByDevice;
        const currentList = snapshotsByDevice[this.device] || [];
        this.timeIdx = currentList.length ? currentList.length - 1 : 0;
        this.ensureTimeIdx();
        this.clearCluster();
    }
}

export const dashboardState = new DashboardState();
