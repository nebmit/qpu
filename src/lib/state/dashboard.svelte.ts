import { SvelteSet } from 'svelte/reactivity';
import { TOTAL_QUBITS, buildBaseEdges } from '$lib/domain/lattice';
import { computeRanges } from '$lib/domain/metrics';
import { avg, deltaVsReference, median } from '$lib/domain/statistics';
import { buildUiSnapshot, emptySnapshot } from '$lib/domain/snapshot';
import {
    findCluster,
    largestComponent,
    predictRelaxations,
    qualifyQubits,
    ruleTotal,
    topoToRules,
    type ClusterFilters,
    type RelaxSuggestions,
    type Topology
} from '$lib/domain/cluster';
import { computeStability, clusterQualityOverTime } from '$lib/domain/stability';
import { METRIC_OPTIONS } from '$lib/domain/metrics';
import { QPU_DEVICES } from '$lib/data/calibration';
import type { Dataset, UiEdge, UiSnapshot, MetricMode } from '$lib/types';

type SnapshotIndexOptions = {
    clearCluster?: boolean;
    pause?: boolean;
};

const DEFAULT_DEVICE = QPU_DEVICES[0];
const DEFAULT_METRIC_MODE: MetricMode = 'readout';
const DEFAULT_CLUSTER_SIZE = 12;
const DEFAULT_TOPOLOGY: Topology = 'compact';
const DEFAULT_ERROR_CUTOFFS = { readoutPct: 12, twoqPct: 4 };
const DEFAULT_COHERENCE_CUTOFFS = { minT1: 100, minT2: 50 };

export const INPUT_LIMITS = {
    readoutPct: { min: 0, max: 100 },
    twoqPct: { min: 0, max: 100 },
    minT1: { min: 0, max: 500 },
    minT2: { min: 0, max: 500 },
    clusterSize: { min: 2, max: TOTAL_QUBITS }
} as const;

const clusterSizeLimitFor = (totalQubits: number) => ({
    min: INPUT_LIMITS.clusterSize.min,
    max: Math.max(INPUT_LIMITS.clusterSize.min, totalQubits)
});

export class DashboardState {
    devices = $state<string[]>(QPU_DEVICES);
    device = $state(DEFAULT_DEVICE);
    timeIdx = $state(0);
    metricMode = $state<MetricMode>(DEFAULT_METRIC_MODE);
    clusterSize = $state(DEFAULT_CLUSTER_SIZE);
    topology = $state<Topology>(DEFAULT_TOPOLOGY);
    errorCutoffs = $state({ ...DEFAULT_ERROR_CUTOFFS });
    coherenceCutoffs = $state({ ...DEFAULT_COHERENCE_CUTOFFS });

    cluster = $state<number[]>([]);
    clusterRequested = $state(0);
    clusterError = $state<string | null>(null);
    findFailed = $state(false);
    findFailReason = $state<'region-too-small' | 'topology-unplaceable' | null>(null);
    nearestCluster = $state<number[]>([]);
    relaxSuggestions = $state<RelaxSuggestions | null>(null);
    hoveredId = $state<number | null>(null);
    hoveredEdge = $state<{ source: number; target: number } | null>(null);
    selectedId = $state<number | null>(null);

    isPlaying = $state(false);

    totalQubits = $state(TOTAL_QUBITS);
    baseEdgesByDevice = $state<Record<string, UiEdge[]>>({});
    snapshotsByDevice = $state<Record<string, UiSnapshot[]>>({});

    connRules = $derived(topoToRules(this.clusterSize, this.topology));

    deviceSnapshots = $derived(this.snapshotsByDevice[this.device] || []);

    snap = $derived.by(() => {
        const list = this.deviceSnapshots;
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
    totalConnections = $derived(ruleTotal(this.connRules));
    timeCount = $derived(this.deviceSnapshots.length);
    clusterSizeLimit = $derived(clusterSizeLimitFor(this.totalQubits));

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

        const med = this.medians;
        return {
            T1,
            T2,
            ro,
            twoq,
            deltaT1: deltaVsReference(T1, med.T1, false),
            deltaT2: deltaVsReference(T2, med.T2, false),
            deltaRo: deltaVsReference(ro, med.ro, true),
            deltaTwoq: deltaVsReference(twoq, med.twoq, true)
        };
    }

    clusterStats = $derived.by(() => this.statsFor(this.cluster));

    stabilityScores = $derived.by(() => computeStability(this.deviceSnapshots));
    clusterTimeline = $derived.by(() =>
        this.cluster.length ? clusterQualityOverTime(this.cluster, this.deviceSnapshots) : []
    );

    clearCluster() {
        this.cluster = [];
        this.clusterError = null;
        this.clusterRequested = 0;
        this.findFailed = false;
        this.findFailReason = null;
        this.nearestCluster = [];
        this.relaxSuggestions = null;
        this.selectedId = null;
    }

    resetInputs() {
        this.pauseTimeline();
        this.device = this.devices.includes(DEFAULT_DEVICE)
            ? DEFAULT_DEVICE
            : (this.devices[0] ?? this.device);
        this.metricMode = DEFAULT_METRIC_MODE;
        this.clusterSize = Math.min(DEFAULT_CLUSTER_SIZE, this.clusterSizeLimit.max);
        this.topology = DEFAULT_TOPOLOGY;
        this.errorCutoffs = { ...DEFAULT_ERROR_CUTOFFS };
        this.coherenceCutoffs = { ...DEFAULT_COHERENCE_CUTOFFS };
        const list = this.deviceSnapshots;
        this.timeIdx = list.length ? list.length - 1 : 0;
        this.hoveredId = null;
        this.hoveredEdge = null;
        this.clearCluster();
        this.ensureTimeIdx();
    }

    setSnapshotIndex(idx: number, options: SnapshotIndexOptions = {}) {
        const list = this.deviceSnapshots;
        if (!list.length) {
            this.timeIdx = 0;
            this.pauseTimeline();
            return;
        }
        if (options.pause !== false) this.pauseTimeline();
        this.timeIdx = Math.min(Math.max(Math.round(idx), 0), list.length - 1);
        if (options.clearCluster) this.clearCluster();
    }

    restartTimelineIfAtEnd() {
        if (this.timeIdx >= this.timeCount - 1) {
            this.setSnapshotIndex(0, { pause: false });
        }
    }

    playTimeline() {
        if (this.timeCount <= 1) return;
        this.restartTimelineIfAtEnd();
        if (this.cluster.length || this.findFailed) this.clearCluster();
        this.isPlaying = true;
    }

    pauseTimeline() {
        this.isPlaying = false;
    }

    jumpToSnapshot(idx: number) {
        this.setSnapshotIndex(idx);
    }

    stepSnapshot(dir: number) {
        const next = this.timeIdx + dir;
        if (next < 0 || next > this.timeCount - 1) return;
        this.setSnapshotIndex(next, { clearCluster: true });
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
        this.pauseTimeline();
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

        if (result.reason !== 'ok' || result.cluster.length !== result.requested || result.cluster.length < 2 || internalLinks === 0) {
            this.cluster = [];
            this.findFailed = true;
            this.findFailReason = result.reason === 'ok' ? 'region-too-small' : result.reason;
            const filters = this.clusterFilters();
            this.nearestCluster = largestComponent(
                this.allowedQubitIds,
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
        this.findFailReason = null;
        this.nearestCluster = [];
        this.relaxSuggestions = null;
    }

    useLargestRegionAndRetry() {
        const target = this.nearestCluster.length >= INPUT_LIMITS.clusterSize.min
            ? this.nearestCluster.length
            : Math.min(this.allowedQubitIds.size, 8);
        this.clusterSize = Math.min(
            this.clusterSizeLimit.max,
            Math.max(INPUT_LIMITS.clusterSize.min, target)
        );
        if (this.findFailReason === 'topology-unplaceable') {
            this.topology = 'compact';
        }
        this.runFindCluster();
    }

    applyRelaxation(idx: number) {
        const cand = this.relaxSuggestions?.candidates[idx];
        if (!cand) return;
        this.applyClusterFilters(cand.filters);
        this.runFindCluster();
    }

    ensureTimeIdx() {
        const list = this.deviceSnapshots;
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
        this.pauseTimeline();
        this.clearCluster();
        this.ensureTimeIdx();
    }

    applyDataset(dataset: Dataset) {
        this.pauseTimeline();
        this.totalQubits = dataset.meta?.n_qubits ?? TOTAL_QUBITS;
        this.clusterSize = Math.min(this.clusterSize, clusterSizeLimitFor(this.totalQubits).max);
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
