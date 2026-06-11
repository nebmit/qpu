import { TOPOLOGIES, type Topology } from '$lib/domain/cluster';
import { METRIC_OPTIONS } from '$lib/domain/metrics';
import { INPUT_LIMITS, type DashboardState } from '$lib/state/dashboard.svelte';
import type { MetricMode } from '$lib/types';

const TOPOLOGY_VALUES = TOPOLOGIES.map((t) => t.value);
const METRIC_VALUES = METRIC_OPTIONS.map((o) => o.value);

type Limit = { min: number; max: number };

const clamp = (v: number, { min, max }: Limit) => Math.min(max, Math.max(min, v));

export function applyUrlState(state: DashboardState, params: URLSearchParams) {
    if ([...params.keys()].length === 0) return;
    const num = (key: string) => {
        const v = params.get(key);
        if (v == null) return null;
        const n = Number(v);
        return Number.isFinite(n) ? n : null;
    };

    const dev = params.get('dev');
    if (dev && state.devices.includes(dev)) state.setDevice(dev);
    const ro = num('ro');
    if (ro != null) state.errorCutoffs.readoutPct = clamp(ro, INPUT_LIMITS.readoutPct);
    const tq = num('2q');
    if (tq != null) state.errorCutoffs.twoqPct = clamp(tq, INPUT_LIMITS.twoqPct);
    const t1 = num('t1');
    if (t1 != null) state.coherenceCutoffs.minT1 = clamp(t1, INPUT_LIMITS.minT1);
    const t2 = num('t2');
    if (t2 != null) state.coherenceCutoffs.minT2 = clamp(t2, INPUT_LIMITS.minT2);
    const n = num('n');
    if (n != null) state.clusterSize = clamp(Math.round(n), INPUT_LIMITS.clusterSize);
    const topo = params.get('topo') as Topology | null;
    if (topo && TOPOLOGY_VALUES.includes(topo)) state.topology = topo;
    const m = params.get('m') as MetricMode | null;
    if (m && METRIC_VALUES.includes(m)) state.metricMode = m;
    const t = num('t');
    if (t != null) state.jumpToSnapshot(Math.round(t));
    const cl = params.get('cl');
    if (cl) {
        const ids = cl
            .split(',')
            .map(Number)
            .filter((x) => Number.isInteger(x) && x >= 0);
        const valid = [...new Set(ids)].filter((id) => state.allowedQubitIds.has(id));
        if (valid.length >= 2) {
            state.cluster = valid;
            state.clusterRequested = valid.length;
            state.findFailed = false;
        }
    }
}

export function serializeUrlQuery(state: DashboardState): string {
    const params = new URLSearchParams();
    params.set('dev', state.device);
    params.set('t', String(state.timeIdx));
    params.set('ro', String(state.errorCutoffs.readoutPct));
    params.set('2q', String(state.errorCutoffs.twoqPct));
    params.set('t1', String(state.coherenceCutoffs.minT1));
    params.set('t2', String(state.coherenceCutoffs.minT2));
    params.set('n', String(state.clusterSize));
    params.set('topo', state.topology);
    params.set('m', state.metricMode);
    if (state.cluster.length) params.set('cl', state.cluster.join(','));
    return `?${params.toString()}`;
}
