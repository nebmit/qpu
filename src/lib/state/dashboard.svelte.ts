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
import { computeStability, clusterQualityOverTime } from '$lib/domain/stability';
import { METRIC_OPTIONS } from '$lib/domain/metrics';
import { QPU_DEVICES } from '$lib/data/calibration';
import type { Dataset, UiEdge, UiSnapshot, MetricMode, ClusterDelta } from '$lib/types';

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
    // Picker options; replaced by the loaded dataset's `meta.backends`.
    devices = $state<string[]>(QPU_DEVICES);
    device = $state(QPU_DEVICES[0]);
    timeIdx = $state(0);
    metricMode = $state<MetricMode>('readout');
    clusterSize = $state(12);
    topology = $state<Topology>('compact');
    errorCutoffs = $state({ readoutPct: 12, twoqPct: 4 });
    coherenceCutoffs = $state({ minT1: 100, minT2: 50 });

    // ── Selection + cluster result ──────────────────────────────────────
    cluster = $state<number[]>([]);
    clusterRequested = $state(0);
    clusterError = $state<string | null>(null);
    findFailed = $state(false);
    nearestCluster = $state<number[]>([]);
    relaxSuggestions = $state<RelaxSuggestions | null>(null);
    hoveredId = $state<number | null>(null);
    hoveredEdge = $state<{ source: number; target: number } | null>(null);
    selectedId = $state<number | null>(null);

    // ── Timeline playback ──────────────────────────────────────────────
    isPlaying = $state(false);

    // ── Loaded data, keyed by device ────────────────────────────────────
    totalQubits = $state(TOTAL_QUBITS);
    baseEdgesByDevice = $state<Record<string, UiEdge[]>>({});
    snapshotsByDevice = $state<Record<string, UiSnapshot[]>>({});

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

    allowedQubitIds = $derived(new SvelteSet(qualifyQubits(this.clusterFilters(), this.snap.qubits)));

    filteredQubits = $derived.by(() => this.snap.qubits.filter((q) => this.allowedQubitIds.has(q.id)));

    filteredEdges = $derived.by(() => {
        const maxTwoq = this.errorCutoffs.twoqPct / 100;
        return this.snap.edges.filter((e) => {
            if (!this.allowedQubitIds.has(e.source) || !this.allowedQubitIds.has(e.target)) return false;
            return typeof e.twoq_error !== 'number' || e.twoq_error <= maxTwoq;
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
            twoq: avg(edges.map((e) => e.twoq_error)),
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
            twoq: median(edges.map((e) => e.twoq_error))
        };
    });

    // Aggregate metrics + Δ-vs-median for the active cluster.
    statsFor(members: number[]) {
        if (!members.length) return null;
        const cq = members.map((id) => this.snap.qubits[id]).filter(Boolean);
        if (!cq.length) return null;
        const clSet = new SvelteSet(members);
        const ce = this.filteredEdges.filter(
            (e) => clSet.has(e.source) && clSet.has(e.target)
        );
        const T1 = avg(cq.map((q) => q.T1));
        const T2 = avg(cq.map((q) => q.T2));
        const ro = avg(cq.map((q) => q.readout_error));
        const twoq = ce.length ? avg(ce.map((e) => e.twoq_error)) : null;

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
            twoq,
            deltaT1: delta(T1, med.T1, false),
            deltaT2: delta(T2, med.T2, false),
            deltaRo: delta(ro, med.ro, true),
            deltaTwoq: delta(twoq, med.twoq, true)
        };
    }

    clusterStats = $derived.by(() => this.statsFor(this.cluster));

    // ── Cross-snapshot view-models ───────────────────────────────────────
    stabilityScores = $derived.by(() => computeStability(this.snapshotsByDevice[this.device] || []));
    clusterTimeline = $derived.by(() =>
        this.cluster.length
            ? clusterQualityOverTime(this.cluster, this.snapshotsByDevice[this.device] || [])
            : []
    );

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

    /** Move the timeline while keeping the cluster — for "view this cluster on that date". */
    jumpToSnapshot(idx: number) {
        const list = this.snapshotsByDevice[this.device] || [];
        if (!list.length) return;
        this.isPlaying = false;
        this.timeIdx = Math.min(Math.max(idx, 0), list.length - 1);
    }

    cycleMetric() {
        const order = METRIC_OPTIONS.map((o) => o.value);
        const i = order.indexOf(this.metricMode);
        this.metricMode = order[(i + 1) % order.length];
    }

    clusterFilters(): ClusterFilters {
        return {
            readoutPct: this.errorCutoffs.readoutPct,
            twoqPct: this.errorCutoffs.twoqPct,
            minT1: this.coherenceCutoffs.minT1,
            minT2: this.coherenceCutoffs.minT2
        };
    }

    applyClusterFilters(filters: ClusterFilters) {
        this.errorCutoffs.readoutPct = filters.readoutPct;
        this.errorCutoffs.twoqPct = filters.twoqPct;
        this.coherenceCutoffs.minT1 = filters.minT1;
        this.coherenceCutoffs.minT2 = filters.minT2;
    }

    runFindCluster() {
        this.isPlaying = false;
        const result = findCluster(
            this.connRules,
            this.snap.qubits,
            this.filteredEdges,
            this.allowedQubitIds
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
                filters.twoqPct / 100
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
        this.isPlaying = false;
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
        this.devices = dataset.meta?.backends?.length ? dataset.meta.backends : devices;
        if (!this.devices.includes(this.device)) {
            this.device = this.devices[0] ?? this.device;
        }
        const currentList = snapshotsByDevice[this.device] || [];
        this.timeIdx = currentList.length ? currentList.length - 1 : 0;
        this.ensureTimeIdx();
        this.clearCluster();
    }
}

export const dashboardState = new DashboardState();
