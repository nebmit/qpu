import type { Dataset, Positions } from '$lib/types';

export const QPU_DEVICES = ['ibm_fez', 'ibm_kingston', 'ibm_marrakesh'];

export type ProgressCallback = (pct: number, received: number, total: number | null) => void;

async function fetchJson<T>(url: string, onProgress?: ProgressCallback): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    if (!onProgress || !response.body) return response.json() as Promise<T>;

    const contentEncoding = response.headers.get('Content-Encoding');
    const isCompressed = !!contentEncoding && contentEncoding !== 'identity';
    const total = isCompressed ? null : parseInt(response.headers.get('Content-Length') ?? '') || null;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        onProgress(total ? received / total : 0, received, total);
    }

    const all = new Uint8Array(received);
    let off = 0;
    for (const c of chunks) { all.set(c, off); off += c.length; }
    return JSON.parse(new TextDecoder().decode(all)) as T;
}

export async function loadData(onProgress?: ProgressCallback) {
    let datasetBytes = 0;
    let datasetTotal: number | null = null;
    let positionsBytes = 0;
    let positionsTotal: number | null = null;

    function combined() {
        const recv = datasetBytes + positionsBytes;
        const total =
            datasetTotal !== null && positionsTotal !== null
                ? datasetTotal + positionsTotal
                : null;
        const p = total ? recv / total : datasetTotal ? datasetBytes / datasetTotal * 0.95 : 0;
        onProgress?.(Math.min(1, p), recv, total);
    }

    const [dataset, positions] = await Promise.all([
        fetchJson<Dataset>('/dataset.json', onProgress ? (_, recv, total) => {
            datasetBytes = recv;
            datasetTotal = total;
            combined();
        } : undefined),
        fetchJson<Positions>('/positions.json', onProgress ? (_, recv, total) => {
            positionsBytes = recv;
            positionsTotal = total;
            combined();
        } : undefined),
    ]);
    onProgress?.(1, datasetBytes + positionsBytes, datasetTotal !== null && positionsTotal !== null ? datasetTotal + positionsTotal : null);
    return { dataset, positions };
}
