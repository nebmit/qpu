<script lang="ts">
    import { extent, scaleLinear } from "d3";
    import { dashboardState } from "$lib/state.svelte";
    import {
        metricScore,
        metricNodeColor,
        edgeColor,
        edgeScore,
    } from "$lib/utils/data";

    type LatticePos = {
        id: number;
        x?: number;
        y?: number;
        row?: number;
        col?: number;
    };

    let {
        positions,
        width,
        height,
        interactive = true,
    } = $props<{
        positions: LatticePos[];
        width: number;
        height: number;
        interactive?: boolean;
    }>();

    const BASE_PAD = { t: 60, l: 120, r: 120, b: 60 };

    const DEAD_EDGE_STROKE = "oklch(82% 0.005 220)";
    const DEAD_NODE_FILL = "oklch(87% 0.005 220)";

    const PAD = $derived.by(() => {
        const largeScreen = width >= 1200;
        return {
            t: BASE_PAD.t,
            b: BASE_PAD.b,
            l: largeScreen ? BASE_PAD.l * 3 : BASE_PAD.l,
            r: largeScreen ? BASE_PAD.r * 3 : BASE_PAD.r,
        };
    });

    let innerW = $derived(Math.max(0, width - PAD.l - PAD.r));
    let innerH = $derived(Math.max(0, height - PAD.t - PAD.b));

    const sanitizeExtent = (ext: [number | undefined, number | undefined]) => {
        const min = Number.isFinite(ext[0]) ? (ext[0] as number) : 0;
        const max = Number.isFinite(ext[1]) ? (ext[1] as number) : 1;
        return [min, max] as [number, number];
    };

    let xExtent = $derived.by(() => {
        const xs: number[] = positions.map((p: LatticePos) =>
            typeof p.x === "number" ? p.x : (p.col ?? 0),
        );
        return extent(xs) as [number | undefined, number | undefined];
    });
    let yExtent = $derived.by(() => {
        const ys: number[] = positions.map((p: LatticePos) =>
            typeof p.y === "number" ? p.y : (p.row ?? 0),
        );
        return extent(ys) as [number | undefined, number | undefined];
    });

    let xScale = $derived.by(() => {
        const [minX, maxX] = sanitizeExtent(xExtent ?? [0, 1]);
        const spanX = Math.max(1e-6, maxX - minX);
        const scaleX = innerW / spanX;
        return scaleLinear()
            .domain([minX, maxX])
            .range([PAD.l, PAD.l + spanX * scaleX]);
    });

    let yScale = $derived.by(() => {
        const [minY, maxY] = sanitizeExtent(yExtent ?? [0, 1]);
        const spanY = Math.max(1e-6, maxY - minY);
        const scaleY = innerH / spanY;
        return scaleLinear()
            .domain([minY, maxY])
            .range([PAD.t, PAD.t + spanY * scaleY]);
    });

    let R = $derived.by(() => {
        const [minY, maxY] = sanitizeExtent(yExtent ?? [0, 1]);
        const spanY = Math.max(1e-6, maxY - minY);
        const scaleY = innerH / spanY;
        return Math.max(3.5, Math.min(10, scaleY * 0.012));
    });

    let xy = $derived(
        new Map<number, { x: number; y: number }>(
            positions.map((p: LatticePos) => [
                p.id,
                {
                    x: xScale(typeof p.x === "number" ? p.x : (p.col ?? 0)),
                    y: yScale(typeof p.y === "number" ? p.y : (p.row ?? 0)),
                },
            ]),
        ),
    );

    const edgeKey = (e: { source: number; target: number }) =>
        `${Math.min(e.source, e.target)}-${Math.max(e.source, e.target)}`;

    let clSet = $derived(new Set(dashboardState.cluster));
    let filteredEdgeKeys = $derived(
        new Set(dashboardState.filteredEdges.map(edgeKey)),
    );
</script>

{#if positions.length}
    <svg {width} {height} class="block">
        <defs>
            <filter id="f-glow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="5" result="b" />
                <feMerge
                    ><feMergeNode in="b" />
                    <feMergeNode in="SourceGraphic" /></feMerge
                >
            </filter>
        </defs>
        <g>
            <!-- Dead edges (behind live content) -->
            {#each dashboardState.snap.edges as e (edgeKey(e))}
                {#if !filteredEdgeKeys.has(edgeKey(e))}
                    {@const a = xy.get(e.source)}
                    {@const b = xy.get(e.target)}
                    {#if a && b}
                        <line
                            x1={a.x}
                            y1={a.y}
                            x2={b.x}
                            y2={b.y}
                            stroke={DEAD_EDGE_STROKE}
                            stroke-width={0.8}
                            stroke-opacity={0.25}
                            stroke-linecap="round"
                        />
                    {/if}
                {/if}
            {/each}

            <!-- Dead nodes (behind live content) -->
            {#each positions as pos (pos.id)}
                {@const p = xy.get(pos.id)}
                {@const isAllowed = dashboardState.allowedQubitIds.has(pos.id)}
                {#if p && !isAllowed}
                    <circle
                        cx={p.x}
                        cy={p.y}
                        r={R}
                        fill={DEAD_NODE_FILL}
                        opacity={0.35}
                        pointer-events="none"
                    />
                {/if}
            {/each}

            <!-- Live edges -->
            {#each dashboardState.filteredEdges as e (edgeKey(e))}
                {@const a = xy.get(e.source)}
                {@const b = xy.get(e.target)}
                {#if a && b}
                    {@const inCl = clSet.has(e.source) && clSet.has(e.target)}
                    {@const hasErr = typeof e.cx_error === "number" && Number.isFinite(e.cx_error)}
                    {@const t = edgeScore(e, dashboardState.ranges)}
                    <line
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke={edgeColor(t)}
                        stroke-width={inCl ? 1.8 : 1}
                        stroke-opacity={inCl ? 0.75 : clSet.size > 0 ? 0.06 : hasErr ? 0.45 : 0.2}
                        stroke-linecap="round"
                    />
                {/if}
            {/each}

            <!-- Live nodes -->
            {#each positions as pos (pos.id)}
                {@const q = dashboardState.snap.qubits[pos.id]}
                {@const p = xy.get(pos.id)}
                {@const isAllowed = dashboardState.allowedQubitIds.has(pos.id)}
                {#if q && p && isAllowed}
                    {@const inCl = clSet.has(pos.id)}
                    {@const isHov = dashboardState.hoveredId === pos.id}
                    {@const score = metricScore(q, dashboardState.metricMode, dashboardState.ranges)}
                    {@const fill = metricNodeColor(score)}
                    {@const r = isHov ? R * 1.35 : R}

                    <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
                    <g
                        transform={`translate(${p.x},${p.y})`}
                        opacity={clSet.size > 0 && !inCl ? 0.22 : 1}
                        class={interactive ? "cursor-pointer" : "pointer-events-none"}
                        onmouseenter={() => (dashboardState.hoveredId = pos.id)}
                        onmouseleave={() => (dashboardState.hoveredId = null)}
                        onclick={() =>
                            (dashboardState.selectedId =
                                dashboardState.selectedId === pos.id
                                    ? null
                                    : pos.id)}
                    >
                        {#if inCl}
                            <!-- Halo ring — white in dark mode, dark in light mode -->
                            <circle
                                r={r + 4}
                                fill="none"
                                style="stroke: var(--cl-halo)"
                                stroke-width={2}
                                filter="url(#f-glow)"
                            />
                        {/if}
                        <circle
                            {r}
                            {fill}
                            stroke={isHov ? "rgba(0,0,0,0.3)" : inCl ? "rgba(0,0,0,0.18)" : "rgba(0,0,0,0.09)"}
                            stroke-width={isHov ? 1 : inCl ? 1 : 0.75}
                            filter={inCl ? "url(#f-glow)" : undefined}
                        />
                    </g>
                {/if}
            {/each}
        </g>
    </svg>
{/if}
