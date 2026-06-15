import { describe, expect, it } from 'vitest';
import { edge, q } from '$lib/testing/fixtures';
import { computeRanges, edgeScore, metricScore } from './metrics';
import type { MetricRanges } from '$lib/types';

describe('computeRanges', () => {
    it('computes finite min and max values', () => {
        expect(
            computeRanges(
                [
                    q(0, { T1: 10, T2: 20, readout_error: 0.02 }),
                    q(1, { T1: 30, T2: Number.NaN, readout_error: 0.01 })
                ],
                [edge(0, 1, 0.003), edge(1, 2, Number.NaN)]
            )
        ).toEqual({
            T1: [10, 30],
            T2: [20, 20],
            readout: [0.01, 0.02],
            twoq: [0.003, 0.003]
        });
    });

    it('uses documented fallbacks when every value is missing', () => {
        expect(computeRanges([q(0, { T1: null, T2: null, readout_error: null })], [edge(0, 1, null)])).toEqual({
            T1: [0, 1],
            T2: [0, 1],
            readout: [0, 0.1],
            twoq: [0, 0.01]
        });
    });
});

describe('metricScore', () => {
    const ranges: MetricRanges = {
        T1: [100, 300],
        T2: [50, 150],
        readout: [0.01, 0.05],
        twoq: [0.001, 0.01]
    };

    it('scores missing metrics neutrally', () => {
        expect(metricScore(q(0, { T1: null }), 'T1', ranges)).toBe(0.5);
        expect(metricScore(q(0, { readout_error: null }), 'readout', ranges)).toBe(0.5);
    });

    it('inverts readout error and clamps outside the range', () => {
        expect(metricScore(q(0, { readout_error: 0.01 }), 'readout', ranges)).toBe(1);
        expect(metricScore(q(0, { readout_error: 0.05 }), 'readout', ranges)).toBe(0);
        expect(metricScore(q(0, { readout_error: 0 }), 'readout', ranges)).toBe(1);
        expect(metricScore(q(0, { readout_error: 0.1 }), 'readout', ranges)).toBe(0);
    });

    it('returns neutral for zero-spread ranges and unranked stability mode', () => {
        const zeroSpread = { ...ranges, T1: [100, 100] as [number, number] };
        expect(metricScore(q(0, { T1: 100 }), 'T1', zeroSpread)).toBe(0.5);
        expect(metricScore(q(0), 'stability', ranges)).toBe(0.5);
    });
});

describe('edgeScore', () => {
    const ranges: MetricRanges = {
        T1: [0, 1],
        T2: [0, 1],
        readout: [0, 0.1],
        twoq: [0.001, 0.01]
    };

    it('scores missing or non-finite edge errors neutrally', () => {
        expect(edgeScore(edge(0, 1, null), ranges)).toBe(0.5);
        expect(edgeScore(edge(0, 1, Number.NaN), ranges)).toBe(0.5);
    });

    it('scores lower two-qubit error higher', () => {
        expect(edgeScore(edge(0, 1, 0.001), ranges)).toBe(1);
        expect(edgeScore(edge(0, 1, 0.01), ranges)).toBe(0);
    });
});
