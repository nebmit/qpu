<script lang="ts">
    import { Tween } from "svelte/motion";
    import {
        DUR,
        ENTRY_CASCADE_MS,
        ease,
        prefersReducedMotion,
    } from "$lib/motion";
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
        entryAnimating = false,
    } = $props<{
        positions: LatticePos[];
        width: number;
        height: number;
        interactive?: boolean;
        entryAnimating?: boolean;
    }>();

    const BASE_PAD = { t: 60, l: 120, r: 120, b: 60 };

    // Dead colours are read at render time from CSS custom properties
    // so they automatically follow the light/dark theme.
    const DEAD_EDGE_STROKE = "var(--dead-edge)";
    const DEAD_NODE_FILL = "var(--dead-node)";

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

    // Per-node entry delay: center-out cascade (closer to centroid = earlier)
    let entryDelays = $derived.by(() => {
        const m = new Map<number, number>();
        if (!positions.length) return m;
        const pts: { id: number; x: number; y: number }[] = [];
        for (const p of positions) {
            const c = xy.get(p.id);
            if (c) pts.push({ id: p.id, x: c.x, y: c.y });
        }
        if (!pts.length) return m;
        const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
        const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
        const dists = pts.map((p) => Math.hypot(p.x - cx, p.y - cy));
        const maxDist = Math.max(1, ...dists);
        return new Map(
            pts.map((p, i) => [p.id, (dists[i] / maxDist) * ENTRY_CASCADE_MS]),
        );
    });

    let targetScores = $derived.by(() => {
        const entries: [number, number][] = [];
        for (const pos of positions) {
            const q = dashboardState.snap.qubits[pos.id];
            if (q)
                entries.push([
                    pos.id,
                    metricScore(
                        q,
                        dashboardState.metricMode,
                        dashboardState.ranges,
                    ),
                ]);
        }
        return new Map(entries);
    });

    const scoreTween = Tween.of(() => targetScores, {
        easing: ease,
        duration: () => (prefersReducedMotion.current ? 0 : DUR.base),
        interpolate: (a, b) => (t) =>
            new Map(
                [...b].map(([id, to]) => {
                    const from = a.get(id) ?? to;
                    return [id, from + (to - from) * t];
                }),
            ),
    });

    let displayScores = $derived(scoreTween.current);
</script>

{#if positions.length}
    <svg {width} {height} class="block" class:entry-animating={entryAnimating}>
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
                            class="entry-edge"
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
                        class="entry-node entry-node-dead"
                        style="--entry-delay: {entryDelays.get(pos.id) ?? 0}ms"
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
                    {@const hasErr =
                        typeof e.cx_error === "number" &&
                        Number.isFinite(e.cx_error)}
                    {@const t = edgeScore(e, dashboardState.ranges)}
                    <line
                        class="entry-edge edge-live"
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke={edgeColor(t)}
                        style:stroke-width={inCl ? 1.8 : 1}
                        style:stroke-opacity={inCl
                            ? 0.75
                            : clSet.size > 0
                              ? 0.06
                              : hasErr
                                ? 0.45
                                : 0.2}
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
                    {@const score =
                        displayScores.get(pos.id) ??
                        metricScore(
                            q,
                            dashboardState.metricMode,
                            dashboardState.ranges,
                        )}
                    {@const fill = metricNodeColor(score)}
                    {@const r = isHov ? R * 1.35 : R}

                    <!-- svelte-ignore a11y_no_static_element_interactions, a11y_click_events_have_key_events -->
                    <g
                        transform={`translate(${p.x},${p.y})`}
                        style:opacity={clSet.size > 0 && !inCl ? 0.22 : 1}
                        class="qnode {interactive
                            ? 'cursor-pointer'
                            : 'pointer-events-none'}"
                        onmouseenter={() => (dashboardState.hoveredId = pos.id)}
                        onmouseleave={() => (dashboardState.hoveredId = null)}
                        onclick={() =>
                            (dashboardState.selectedId =
                                dashboardState.selectedId === pos.id
                                    ? null
                                    : pos.id)}
                    >
                        <g
                            class="entry-node"
                            style="--entry-delay: {entryDelays.get(pos.id) ??
                                0}ms"
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
                                stroke={isHov
                                    ? "var(--node-stroke-hov)"
                                    : inCl
                                      ? "var(--node-stroke-hov)"
                                      : "var(--node-stroke)"}
                                stroke-width={isHov ? 1 : inCl ? 1 : 0.75}
                                filter={inCl ? "url(#f-glow)" : undefined}
                            />
                        </g>
                    </g>
                {/if}
            {/each}
        </g>
    </svg>
{/if}

<style>
    .qnode {
        transition: opacity var(--dur-ui) ease;
    }
    .edge-live {
        transition:
            stroke-opacity var(--dur-ui) ease,
            stroke-width var(--dur-ui) ease;
    }

    .entry-animating .entry-node {
        transform-box: fill-box;
        transform-origin: center;
        animation: node-pop var(--dur-entry) var(--ease-overshoot) both;
        animation-delay: var(--entry-delay, 0ms);
    }
    .entry-animating .entry-node-dead {
        animation-name: dead-node-pop;
    }
    .entry-animating .entry-edge {
        animation: edge-appear var(--dur-entry) var(--ease-standard) both;
        animation-delay: var(--dur-ui);
    }
</style>
