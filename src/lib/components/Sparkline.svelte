<script lang="ts">
    let {
        values,
        currentIdx = -1,
        width = 44,
        height = 12,
    } = $props<{
        values: (number | null)[];
        currentIdx?: number;
        width?: number;
        height?: number;
    }>();

    const PAD = 1.5;

    let pts = $derived.by(() => {
        const ok = values.filter(
            (v: number | null): v is number =>
                typeof v === "number" && Number.isFinite(v),
        );
        if (ok.length < 2) return null;
        const lo = Math.min(...ok);
        const hi = Math.max(...ok);
        const spread = hi - lo || 1;
        const n = values.length;
        return values.map((v: number | null, i: number) =>
            v == null
                ? null
                : {
                      x:
                          n === 1
                              ? width / 2
                              : PAD + (i / (n - 1)) * (width - PAD * 2),
                      y: PAD + (1 - (v - lo) / spread) * (height - PAD * 2),
                  },
        );
    });

    let segments = $derived.by(() => {
        if (!pts) return [];
        const segs: string[] = [];
        let cur: string[] = [];
        for (const p of pts) {
            if (!p) {
                if (cur.length > 1) segs.push(cur.join(" "));
                cur = [];
                continue;
            }
            cur.push(`${p.x.toFixed(1)},${p.y.toFixed(1)}`);
        }
        if (cur.length > 1) segs.push(cur.join(" "));
        return segs;
    });

    let current = $derived(
        pts && currentIdx >= 0 ? (pts[currentIdx] ?? null) : null,
    );
</script>

{#if segments.length}
    <svg
        {width}
        {height}
        viewBox="0 0 {width} {height}"
        class="spark"
        aria-hidden="true"
    >
        {#each segments as seg, i (i)}
            <polyline points={seg} pathLength="1" />
        {/each}
        {#if current}
            <circle cx={current.x} cy={current.y} r="1.8" />
        {/if}
    </svg>
{/if}

<style>
    .spark {
        display: block;
        flex-shrink: 0;
        overflow: visible;
    }
    .spark polyline {
        fill: none;
        stroke: var(--accent);
        stroke-width: 1.2;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-dasharray: 1;
        animation: spark-in var(--dur-base) var(--ease-out) both;
    }
    .spark circle {
        fill: var(--accent);
    }
</style>
