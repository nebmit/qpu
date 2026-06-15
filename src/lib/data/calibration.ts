import type { Dataset, Positions } from '$lib/types';
import { ASSET_SIZES } from 'virtual:asset-sizes';

export const QPU_DEVICES = ['ibm_fez', 'ibm_kingston', 'ibm_marrakesh'];

export type ProgressCallback = (pct: number, received: number, total: number | null) => void;

const ASSET_TOTAL = (ASSET_SIZES['/dataset.json'] ?? 0) + (ASSET_SIZES['/positions.json'] ?? 0);

async function fetchJson<T>(url: string, onBytes?: (received: number) => void): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    if (!onBytes || !response.body) return response.json() as Promise<T>;

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        onBytes(received);
    }

    const all = new Uint8Array(received);
    let off = 0;
    for (const c of chunks) { all.set(c, off); off += c.length; }
    return JSON.parse(new TextDecoder().decode(all)) as T;
}

export async function loadData(onProgress?: ProgressCallback) {
    let datasetBytes = 0;
    let positionsBytes = 0;

    function report() {
        const recv = datasetBytes + positionsBytes;
        onProgress?.(ASSET_TOTAL ? Math.min(1, recv / ASSET_TOTAL) : 0, recv, ASSET_TOTAL || null);
    }

    const [dataset, positions] = await Promise.all([
        fetchJson<Dataset>('/dataset.json', onProgress ? (recv) => { datasetBytes = recv; report(); } : undefined),
        fetchJson<Positions>('/positions.json', onProgress ? (recv) => { positionsBytes = recv; report(); } : undefined),
    ]);
    onProgress?.(1, datasetBytes + positionsBytes, ASSET_TOTAL || null);
    return { dataset, positions };
}
