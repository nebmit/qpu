import { describe, expect, it } from 'vitest';
import { makeDataset } from '$lib/testing/fixtures';
import { DashboardState, INPUT_LIMITS } from './dashboard.svelte';
import { applyUrlState, serializeUrlQuery } from './url';

function seededState() {
    const state = new DashboardState();
    state.applyDataset(makeDataset());
    return state;
}

describe('URL state', () => {
    it('round-trips dashboard inputs', () => {
        const state = seededState();
        state.setDevice('dev-b');
        state.setSnapshotIndex(0);
        state.errorCutoffs.readoutPct = 9;
        state.errorCutoffs.twoqPct = 3;
        state.coherenceCutoffs.minT1 = 120;
        state.coherenceCutoffs.minT2 = 70;
        state.clusterSize = 4;
        state.topology = 'linear';
        state.metricMode = 'T1';
        state.cluster = [0, 1, 2];
        state.clusterRequested = 3;

        const restored = seededState();
        applyUrlState(restored, new URLSearchParams(serializeUrlQuery(state)));

        expect(restored.device).toBe('dev-b');
        expect(restored.timeIdx).toBe(0);
        expect(restored.errorCutoffs).toEqual({ readoutPct: 9, twoqPct: 3 });
        expect(restored.coherenceCutoffs).toEqual({ minT1: 120, minT2: 70 });
        expect(restored.clusterSize).toBe(4);
        expect(restored.topology).toBe('linear');
        expect(restored.metricMode).toBe('T1');
        expect(restored.cluster).toEqual([0, 1, 2]);
    });

    it('clamps numeric inputs to shared limits', () => {
        const state = seededState();
        applyUrlState(state, new URLSearchParams('ro=999&t1=-5&n=200'));

        expect(state.errorCutoffs.readoutPct).toBe(INPUT_LIMITS.readoutPct.max);
        expect(state.coherenceCutoffs.minT1).toBe(INPUT_LIMITS.minT1.min);
        expect(state.clusterSize).toBe(state.clusterSizeLimit.max);
    });

    it('ignores hostile or unknown values', () => {
        const state = seededState();
        applyUrlState(state, new URLSearchParams('dev=unknown&topo=nope&m=nope&ro=abc&cl=99'));

        expect(state.device).toBe('dev-a');
        expect(state.topology).toBe('compact');
        expect(state.metricMode).toBe('readout');
        expect(state.errorCutoffs.readoutPct).toBe(12);
        expect(state.cluster).toEqual([]);
    });

    it('dedupes cluster ids and filters them through allowed qubits', () => {
        const state = seededState();
        applyUrlState(state, new URLSearchParams('cl=0,1,1,2,99'));

        expect(state.cluster).toEqual([0, 1, 2]);
        expect(state.clusterRequested).toBe(3);
    });

    it('leaves state untouched for empty params', () => {
        const state = seededState();
        const before = serializeUrlQuery(state);
        applyUrlState(state, new URLSearchParams());

        expect(serializeUrlQuery(state)).toBe(before);
    });
});
