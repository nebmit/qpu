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
