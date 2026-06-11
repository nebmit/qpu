import { describe, expect, it } from 'vitest';
import { avg, deltaVsReference, median } from './statistics';

describe('avg', () => {
    it('returns null for empty or non-finite-only input', () => {
        expect(avg([])).toBeNull();
        expect(avg([null, undefined, Number.NaN, Infinity])).toBeNull();
    });

    it('ignores nullish and non-finite values', () => {
        expect(avg([1, null, 3, undefined, Number.NaN, Infinity])).toBe(2);
    });
});

describe('median', () => {
    it('returns null for empty or non-finite-only input', () => {
        expect(median([])).toBeNull();
        expect(median([null, undefined, Number.NaN, -Infinity])).toBeNull();
    });

    it('handles odd, even, and single-value inputs', () => {
        expect(median([3, 1, 2])).toBe(2);
        expect(median([4, 1, 2, 3])).toBe(2.5);
        expect(median([7])).toBe(7);
    });
});

describe('deltaVsReference', () => {
    it('guards null values and zero references', () => {
        expect(deltaVsReference(null, 1)).toBeNull();
        expect(deltaVsReference(1, null)).toBeNull();
        expect(deltaVsReference(1, 0)).toBeNull();
    });

    it('uses a two percent dead zone and reports magnitude', () => {
        expect(deltaVsReference(101, 100)).toEqual({ dir: 'flat', magnitude: 0.01 });
        expect(deltaVsReference(103, 100)).toEqual({ dir: 'up', magnitude: 0.03 });
        expect(deltaVsReference(97, 100)).toEqual({ dir: 'down', magnitude: -0.03 });
    });

    it('flips direction when lower is better', () => {
        expect(deltaVsReference(97, 100, true)).toEqual({ dir: 'up', magnitude: -0.03 });
        expect(deltaVsReference(103, 100, true)).toEqual({ dir: 'down', magnitude: 0.03 });
    });
});
