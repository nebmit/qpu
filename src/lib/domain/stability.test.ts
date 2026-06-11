import { describe, expect, it } from 'vitest';
import { makeUiSnapshot, q } from '$lib/testing/fixtures';
import { clusterQualityOverTime, computeStability } from './stability';

describe('computeStability', () => {
    it('returns an empty map for fewer than two snapshots', () => {
        expect(computeStability([]).size).toBe(0);
        expect(computeStability([makeUiSnapshot([q(0)])]).size).toBe(0);
    });

    it('scores constant series above volatile series and stays bounded', () => {
        const scores = computeStability([
            makeUiSnapshot([
                q(0, { readout_error: 0.01, T1: 200, T2: 100 }),
                q(1, { readout_error: 0.01, T1: 200, T2: 100 }),
                q(2, { readout_error: null, T1: null, T2: null })
            ]),
            makeUiSnapshot([
                q(0, { readout_error: 0.01, T1: 200, T2: 100 }),
                q(1, { readout_error: 0.05, T1: 80, T2: 30 }),
                q(2, { readout_error: null, T1: null, T2: null })
            ]),
            makeUiSnapshot([
                q(0, { readout_error: 0.01, T1: 200, T2: 100 }),
                q(1, { readout_error: 0.02, T1: 300, T2: 180 }),
                q(2, { readout_error: null, T1: null, T2: null })
            ])
        ]);

        expect(scores.get(0)).toBeGreaterThan(scores.get(1) ?? 0);
        expect(scores.get(2)).toBe(0.5);
        for (const score of scores.values()) {
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(1);
        }
    });
});

describe('clusterQualityOverTime', () => {
    it('returns one quality point per snapshot', () => {
        const points = clusterQualityOverTime(
            [0, 1],
            [
                makeUiSnapshot([q(0), q(1)], [], '2026-01-01'),
                makeUiSnapshot([q(0, { T1: 300 }), q(1, { readout_error: 0.02 })], [], '2026-01-02')
            ]
        );

        expect(points).toHaveLength(2);
        expect(points[0].date).toBe('2026-01-01');
        expect(points[0].cluster).not.toBeNull();
    });

    it('uses null cluster and neutral device fallbacks when data is unavailable', () => {
        expect(clusterQualityOverTime([99], [makeUiSnapshot([], [], '2026-01-01')])).toEqual([
            { date: '2026-01-01', cluster: null, device: 0.5 }
        ]);
    });
});
