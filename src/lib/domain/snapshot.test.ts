import { describe, expect, it } from 'vitest';
import { edge } from '$lib/testing/fixtures';
import { buildUiSnapshot, emptySnapshot } from './snapshot';
import type { QubitState } from '$lib/types';

describe('buildUiSnapshot', () => {
    it('converts wire qubits into a dense UI array', () => {
        const snap = buildUiSnapshot(
            {
                t: '2026-02-03',
                ts: '2026-02-03T04:05:06Z',
                qubits: [
                    { id: 0, T1: 0.0002, T2: 0.0001, readout_err: 0.03, p01: 0.1, p10: 0.2 },
                    { id: 99, T1: 0.1, T2: 0.1, readout_err: 0.5, p01: null, p10: null },
                    { T1: 0.00015, T2: 'bad', readout_err: 'bad', p01: null, p10: null } as unknown as QubitState
                ],
                gates: []
            },
            [edge(0, 1, null)],
            4
        );

        expect(snap.date).toBe('2026-02-03');
        expect(snap.timestamp).toBe('2026-02-03T04:05:06Z');
        expect(snap.qubits).toHaveLength(4);
        expect(snap.qubits[0]).toMatchObject({
            id: 0,
            T1: 200,
            T2: 100,
            readout_error: 0.03,
            p01: 0.1,
            p10: 0.2
        });
        expect(snap.qubits[1]).toMatchObject({ id: 1, T1: null, T2: null, readout_error: null });
        expect(snap.qubits[2]).toMatchObject({ id: 2, T1: 150, T2: null, readout_error: null });
        expect(snap.qubits[3]).toMatchObject({ id: 3, T1: null, T2: null, readout_error: null });
    });

    it('averages finite gate errors onto base edges', () => {
        const snap = buildUiSnapshot(
            {
                t: '2026-01-01',
                ts: '2026-01-01T00:00:00Z',
                qubits: [],
                gates: [
                    { gate: 'cx', qubits: [0, 1], error: 0.01, duration: null },
                    { gate: 'cx', qubits: [1, 0], error: 0.03, duration: null },
                    { gate: 'cx', qubits: [1, 2], error: null, duration: null },
                    { gate: 'cx', qubits: [1, 2], error: Number.NaN, duration: null }
                ]
            },
            [edge(0, 1, null), edge(1, 2, null)],
            3
        );

        expect(snap.edges).toEqual([
            { source: 0, target: 1, twoq_error: 0.02 },
            { source: 1, target: 2, twoq_error: null }
        ]);
    });
});

describe('emptySnapshot', () => {
    it('returns all-null qubits and preserves provided edges', () => {
        const edges = [edge(0, 1, 0.01)];
        expect(emptySnapshot(edges, 2)).toEqual({
            date: '',
            timestamp: '',
            qubits: [
                { id: 0, T1: null, T2: null, readout_error: null, p01: null, p10: null },
                { id: 1, T1: null, T2: null, readout_error: null, p01: null, p10: null }
            ],
            edges
        });
    });
});
