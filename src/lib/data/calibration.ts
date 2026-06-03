import type { Dataset, Positions } from '$lib/types';

// Network layer: fetches the calibration dataset and lattice positions from the
// static endpoints, with optional streamed download progress.

// Backends exposed in the device picker.
export const QPU_DEVICES = ['ibm_fez', 'ibm_kingston', 'ibm_marrakesh'];

export type ProgressCallback = (pct: number, received: number, total: number | null) => void;

async function fetchJson<T>(url: string, onProgress?: ProgressCallback): Promise<T> {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    if (!onProgress || !response.body) return response.json() as Promise<T>;

    const total = parseInt(response.headers.get('Content-Length') ?? '') || null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total) onProgress(received / total, received, total);
    }

    const all = new Uint8Array(received);
    let off = 0;
    for (const c of chunks) { all.set(c, off); off += c.length; }
    return JSON.parse(new TextDecoder().decode(all)) as T;
}

export async function loadData(onProgress?: ProgressCallback) {
    const [dataset, positions] = await Promise.all([
        fetchJson<Dataset>('/dataset.json', onProgress ? (p, recv, total) => onProgress(p * 0.95, recv, total) : undefined),
        fetchJson<Positions>('/positions.json'),
    ]);
    onProgress?.(1, 0, null);
    return { dataset, positions };
}
