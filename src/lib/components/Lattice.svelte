<script lang="ts">
    import { onDestroy } from "svelte";
    import { Tween } from "svelte/motion";
    import {
        DUR,
        ENTRY_CASCADE_MS,
        ease,
        prefersReducedMotion,
    } from "$lib/viz/motion";
    import { extent, scaleLinear } from "d3";
    import { dashboardState } from "$lib/state/dashboard.svelte";
    import { metricScore, edgeScore } from "$lib/domain/metrics";
    import { edgeKey } from "$lib/domain/lattice";
    import { metricNodeColor, LIVE_EDGE_STROKE } from "$lib/viz/color";
    import { SvelteMap, SvelteSet } from "svelte/reactivity";

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

    const DEAD_EDGE_STROKE = "var(--dead-edge)";
    const DEAD_NODE_FILL = "var(--dead-node)";

    const PAD = $derived.by(() => {
        return {
            t: 60,
            b: 60,
            l: Math.min(360, width * 0.1),
            r: Math.min(360, width * 0.1),
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

    // Opacities for de-emphasizing non-cluster content while a cluster is shown.
    // "Early" values (during the reveal cascade) dim less so context stays
    // readable mid-animation; once settled, the dimming deepens.
    const OUT_NODE = 0.38;
    const OUT_NODE_EARLY = 0.68;
    const OUT_EDGE = 0.11;
    const OUT_EDGE_EARLY = 0.38;
    const IN_EDGE = 0.85;

    let revealPhase = $state<"idle" | "early" | "settle">("idle");
    let revealActive = $state<Set<number>>(new Set());
    let pingRings = $state<{ id: number; key: number }[]>([]);
    let revealTimers: ReturnType<typeof setTimeout>[] = [];
    let pingKey = 0;

    let clSet = $derived(
        new Set(
            dashboardState.findFailed
                ? dashboardState.nearestCluster
                : dashboardState.cluster,
        ),
    );
    let filteredEdgeKeys = $derived(
        new Set(dashboardState.filteredEdges.map((e) => edgeKey(e.source, e.target))),
    );

    let dimNodeOpacity = $derived.by(() => {
        if (!clSet.size) return 1;
        return revealPhase === "early" ? OUT_NODE_EARLY : OUT_NODE;
    });
    let dimEdgeOpacity = $derived.by(() => {
        if (!clSet.size) return null;
        return revealPhase === "early" ? OUT_EDGE_EARLY : OUT_EDGE;
    });

    function clearRevealTimers() {
        revealTimers.forEach((t) => clearTimeout(t));
        revealTimers = [];
    }

    function resetReveal() {
        clearRevealTimers();
        revealActive = new Set();
        pingRings = [];
        revealPhase = "idle";
    }

    function assembleOrder(cluster: number[]) {
        if (!cluster.length) return [] as number[];
        const set = new Set(cluster);
        const adj = new SvelteMap<number, number[]>();
        for (const id of cluster) adj.set(id, []);
        for (const e of dashboardState.filteredEdges) {
            if (!set.has(e.source) || !set.has(e.target)) continue;
            adj.get(e.source)?.push(e.target);
            adj.get(e.target)?.push(e.source);
        }
        let seed = cluster[0];
        let best = -1;
        for (const id of cluster) {
            const d = adj.get(id)?.length ?? 0;
            if (d > best) {
                best = d;
                seed = id;
            }
        }
        const depth = new SvelteMap<number, number>([[seed, 0]]);
        const order = [seed];
        const queue = [seed];
        while (queue.length) {
            const cur = queue.shift()!;
            const nbrs = (adj.get(cur) || []).slice().sort((a, b) => {
                const ca = xy.get(a);
                const cb = xy.get(b);
                const cc = xy.get(cur);
                if (!ca || !cb || !cc) return 0;
                return (
                    Math.hypot(ca.x - cc.x, ca.y - cc.y) -
                    Math.hypot(cb.x - cc.x, cb.y - cc.y)
                );
            });
            for (const nb of nbrs) {
                if (!depth.has(nb)) {
                    depth.set(nb, (depth.get(cur) ?? 0) + 1);
                    order.push(nb);
                    queue.push(nb);
                }
            }
        }
        for (const id of cluster) {
            if (!depth.has(id)) order.push(id);
        }
        return order;
    }

    function addPing(id: number) {
        const key = pingKey++;
        pingRings = [...pingRings, { id, key }];
        const t = setTimeout(() => {
            pingRings = pingRings.filter((p) => p.key !== key);
        }, 720);
        revealTimers.push(t);
    }

    function startReveal() {
        clearRevealTimers();
        const cluster = [...clSet];
        if (!cluster.length) {
            resetReveal();
            return;
        }
        if (prefersReducedMotion.current) {
            revealActive = new Set(cluster);
            revealPhase = "settle";
            pingRings = [];
            return;
        }

        revealActive = new Set();
        pingRings = [];
        revealPhase = "early";
        const order = assembleOrder(cluster);
        // Per-node stagger: aim for a ~820ms total cascade, but keep each step
        // in a 55–115ms band so small clusters don't crawl and large ones don't blur.
        const step = Math.round(
            Math.max(55, Math.min(115, 820 / Math.max(1, order.length))),
        );
        order.forEach((id, i) => {
            const t = setTimeout(() => {
                revealActive = new SvelteSet(revealActive).add(id);
                addPing(id);
            }, i * step);
            revealTimers.push(t);
        });
        const settle = setTimeout(
            () => {
                revealPhase = "settle";
            },
            order.length * step + 160,
        );
        revealTimers.push(settle);
    }

    $effect(() => {
        startReveal();
    });

    onDestroy(() => {
        clearRevealTimers();
    });

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
            {#each dashboardState.snap.edges as e (edgeKey(e.source, e.target))}
                {#if !filteredEdgeKeys.has(edgeKey(e.source, e.target))}
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
            {#each dashboardState.filteredEdges as e (edgeKey(e.source, e.target))}
                {@const a = xy.get(e.source)}
                {@const b = xy.get(e.target)}
                {#if a && b}
                    {@const inCl = clSet.has(e.source) && clSet.has(e.target)}
                    {@const hasErr =
                        typeof e.twoq_error === "number" &&
                        Number.isFinite(e.twoq_error)}
                    {@const t = edgeScore(e, dashboardState.ranges)}
                    {@const baseOpacity = hasErr ? 0.5 : 0.2}
                    {@const qw = hasErr ? 0.5 + t * 2.0 : 0.7}
                    {@const isActive =
                        revealActive.has(e.source) &&
                        revealActive.has(e.target)}
                    <line
                        class="entry-edge edge-live"
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke={LIVE_EDGE_STROKE}
                        style:stroke-width={inCl ? (isActive ? qw + 1.0 : qw + 0.4) : qw}
                        style:stroke-opacity={inCl
                            ? isActive
                                ? IN_EDGE
                                : baseOpacity
                            : clSet.size > 0
                              ? (dimEdgeOpacity ?? baseOpacity)
                              : baseOpacity}
                        stroke-linecap="round"
                    />
                {/if}
            {/each}

            <!-- Cluster halo discs (behind live nodes) -->
            <g class="halo-back-layer">
                {#each Array.from(clSet) as id (id)}
                    {@const c = xy.get(id)}
                    {#if c}
                        <circle
                            class="cl-halo-disc"
                            cx={c.x}
                            cy={c.y}
                            r={R * 1.9}
                            fill="var(--cl-halo)"
                            filter="url(#f-glow)"
                            style:opacity={revealActive.has(id) ? 0.22 : 0}
                        />
                    {/if}
                {/each}
            </g>

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

                    <g
                        transform={`translate(${p.x},${p.y})`}
                        style:opacity={clSet.size > 0 && !inCl
                            ? dimNodeOpacity
                            : 1}
                        class="qnode {interactive
                            ? 'cursor-pointer'
                            : 'pointer-events-none'}"
                        role="button"
                        aria-label="Qubit {pos.id}"
                        tabindex={interactive ? 0 : -1}
                        onmouseenter={() => (dashboardState.hoveredId = pos.id)}
                        onmouseleave={() => (dashboardState.hoveredId = null)}
                        onfocus={() => (dashboardState.hoveredId = pos.id)}
                        onblur={() => (dashboardState.hoveredId = null)}
                        onclick={() =>
                            (dashboardState.selectedId =
                                dashboardState.selectedId === pos.id
                                    ? null
                                    : pos.id)}
                        onkeydown={(ev) => {
                            if (ev.key === "Enter" || ev.key === " ") {
                                ev.preventDefault();
                                dashboardState.selectedId =
                                    dashboardState.selectedId === pos.id
                                        ? null
                                        : pos.id;
                            }
                        }}
                    >
                        <g
                            class="entry-node"
                            style="--entry-delay: {entryDelays.get(pos.id) ??
                                0}ms"
                        >
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

            <!-- Ping rings (above nodes) -->
            <g class="halo-layer">
                {#each pingRings as p (p.key)}
                    {@const c = xy.get(p.id)}
                    {#if c}
                        <circle
                            class="cl-ping"
                            cx={c.x}
                            cy={c.y}
                            r={R}
                            fill="none"
                            stroke="var(--cl-halo)"
                            stroke-width={2}
                            style="--r0: {R}px"
                        />
                    {/if}
                {/each}
            </g>
        </g>
    </svg>
{/if}

<style>
    .qnode,
    .edge-live,
    .entry-node-dead {
        transition: opacity var(--dur-base) var(--ease-out);
    }
    .edge-live {
        transition:
            stroke-opacity var(--dur-base) var(--ease-out),
            stroke-width var(--dur-base) var(--ease-out);
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
