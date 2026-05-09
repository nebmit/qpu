import { SvelteSet } from 'svelte/reactivity';
import { QPU_DEVICES, computeRanges, TOTAL_QUBITS, avg, buildBaseEdges, buildUiSnapshot, emptySnapshot } from '$lib/utils/data';
import type { Dataset, UiEdge, UiSnapshot } from '$lib/types';

export class DashboardState {
    device = $state(QPU_DEVICES[0]);
    timeIdx = $state(0);
    metricMode = $state<'readout' | 'T1' | 'T2'>('readout');
    connRules = $state({ endpoint: 0, chain: 20, junction: 10 });
    errorCutoffs = $state({ readoutPct: 12, cxPct: 4 });
    coherenceCutoffs = $state({ minT1: 100, minT2: 50 });
    cluster = $state<number[]>([]);
    hoveredId = $state<number | null>(null);
    selectedId = $state<number | null>(null);
    sidebarOpen = $state(true);

    totalQubits = $state(TOTAL_QUBITS);
    baseEdgesByDevice = $state<Record<string, UiEdge[]>>({});
    snapshotsByDevice = $state<Record<string, UiSnapshot[]>>({});

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

    stats = $derived.by(() => {
        const q = this.snap.qubits;
        const edges = this.snap.edges;
        const T1avg = avg(q.map(x => x.T1));
        const T2avg = avg(q.map(x => x.T2));
        const roAvg = avg(q.map(x => x.readout_error));
        const cxAvg = avg(edges.map(e => e.cx_error));
        return {
            T1: T1avg == null ? '—' : T1avg.toFixed(0),
            T2: T2avg == null ? '—' : T2avg.toFixed(0),
            ro: roAvg == null ? '—' : (roAvg * 100).toFixed(2),
            cx: cxAvg == null ? '—' : cxAvg.toExponential(2),
            qubitsCount: q.length,
            edgesCount: edges.length
        };
    });

    clusterStats = $derived.by(() => {
        if (!this.cluster.length) return null;
        const cq = this.cluster.map(id => this.snap.qubits[id]).filter(Boolean);
        if (!cq.length) return null;
        const T1avg = avg(cq.map(q => q.T1));
        const T2avg = avg(cq.map(q => q.T2));
        const roAvg = avg(cq.map(q => q.readout_error));
        return {
            T1: T1avg == null ? '—' : T1avg.toFixed(0),
            T2: T2avg == null ? '—' : T2avg.toFixed(0),
            ro: roAvg == null ? '—' : (roAvg * 100).toFixed(2)
        };
    });

    clearCluster() {
        this.cluster = [];
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
