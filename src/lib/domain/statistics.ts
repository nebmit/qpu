import type { ClusterDelta } from '$lib/types';

const DELTA_DEAD_ZONE = 0.02;

export function deltaVsReference(
    val: number | null,
    ref: number | null,
    lowerBetter = false
): ClusterDelta | null {
    if (val == null || ref == null || ref === 0) return null;
    const magnitude = (val - ref) / ref;
    const good = lowerBetter ? magnitude < -DELTA_DEAD_ZONE : magnitude > DELTA_DEAD_ZONE;
    const bad = lowerBetter ? magnitude > DELTA_DEAD_ZONE : magnitude < -DELTA_DEAD_ZONE;
    return { dir: good ? 'up' : bad ? 'down' : 'flat', magnitude };
}

export function avg(vals: Array<number | null | undefined>): number | null {
    const ok = vals.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (!ok.length) return null;
    return ok.reduce((s, v) => s + v, 0) / ok.length;
}

export function median(vals: Array<number | null | undefined>): number | null {
    const ok = vals.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    if (!ok.length) return null;
    ok.sort((a, b) => a - b);
    const mid = Math.floor(ok.length / 2);
    return ok.length % 2 === 0 ? (ok[mid - 1] + ok[mid]) / 2 : ok[mid];
}
