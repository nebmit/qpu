<script lang="ts">
    import { flip } from "svelte/animate";
    import { DUR, ease, prefersReducedMotion } from "$lib/viz/motion";
    import { dashboardState } from "$lib/state/dashboard.svelte";
    import { metricNodeColor, edgeColor } from "$lib/viz/color";
    import { microseconds, percent, exponential, deltaLabel } from "$lib/viz/format";

    // ── color scale endpoints for legend bars ─────────────────────────
    const NODE_LO = metricNodeColor(0); // bad end (dark indigo)
    const NODE_HI = metricNodeColor(1); // good end (yellow-green)
    const EDGE_LO = edgeColor(0); // high error (muted lavender)
    const EDGE_HI = edgeColor(1); // low error (deep indigo)

    let nodeLegend = $derived.by(() => {
        const m = dashboardState.metricMode;
        const r = dashboardState.ranges;
        if (m === "T1")
            return {
                label: "T₁ coherence · nodes",
                lo: `${r.T1[0].toFixed(0)} μs`,
                hi: `${r.T1[1].toFixed(0)} μs`,
                reversed: false,
            };
        if (m === "T2")
            return {
                label: "T₂ coherence · nodes",
                lo: `${r.T2[0].toFixed(0)} μs`,
                hi: `${r.T2[1].toFixed(0)} μs`,
                reversed: false,
            };
        return {
            label: "Readout error · nodes",
            lo: `${(r.readout[0] * 100).toFixed(1)}%`,
            hi: `${(r.readout[1] * 100).toFixed(1)}%`,
            reversed: true,
        };
    });

    let edgeLegend = $derived.by(() => {
        const r = dashboardState.ranges;
        return {
            lo: `${(r.cx[0] * 100).toFixed(2)}%`,
            hi: `${(r.cx[1] * 100).toFixed(2)}%`,
        };
    });

    // Inspector state: which qubit detail to show
    let inspectedId = $derived(dashboardState.selectedId);

    let inspectedQubit = $derived.by(() => {
        if (inspectedId === null) return null;
        return dashboardState.snap.qubits[inspectedId] ?? null;
    });

    let connEdges = $derived.by(() => {
        if (inspectedId === null) return [];
        return dashboardState.snap.edges.filter(
            (e) => e.source === inspectedId || e.target === inspectedId,
        );
    });

    let inCluster = $derived(
        inspectedId !== null && dashboardState.cluster.includes(inspectedId),
    );

    function closeDetail() {
        dashboardState.selectedId = null;
    }
</script>

<aside class="plate-read">
    <!-- ── TOP: inspector priority: node detail > cluster result > empty ── -->

    {#if inspectedQubit !== null && inspectedId !== null}
        <!-- Node detail drill-down -->
        <div class="fade-in">
            {#if dashboardState.clusterStats}
                <button class="insp-back" onclick={closeDetail}
                    >‹ Back to cluster</button
                >
            {:else}
                <div class="eyebrow mb">Selection</div>
            {/if}

            <div class="insp-qhead">
                <span class="pr-qid"
                    >Q{String(inspectedId).padStart(3, "0")}</span
                >
                {#if dashboardState.clusterStats}
                    <span class="mem-badge" class:in={inCluster} class:out={!inCluster}>
                        {inCluster ? "✓ in cluster" : "not in cluster"}
                    </span>
                {/if}
            </div>

            <div>
                <div class="pr-row">
                    <span class="pr-l">T₁</span>
                    <span class="pr-v">{microseconds(inspectedQubit.T1, 1)}</span>
                </div>
                <div class="pr-row">
                    <span class="pr-l">T₂</span>
                    <span class="pr-v">{microseconds(inspectedQubit.T2, 1)}</span>
                </div>
                <div class="pr-row">
                    <span class="pr-l">Readout error</span>
                    <span class="pr-v">{percent(inspectedQubit.readout_error, 2)}</span>
                </div>
                <div class="pr-row">
                    <span class="pr-l">P0|1</span>
                    <span class="pr-v">{percent(inspectedQubit.p01, 2)}</span>
                </div>
                <div class="pr-row">
                    <span class="pr-l">P1|0</span>
                    <span class="pr-v">{percent(inspectedQubit.p10, 2)}</span>
                </div>
            </div>

            {#if connEdges.length > 0}
                <div class="pr-cxh">
                    CX gate · {connEdges.length} link{connEdges.length !== 1
                        ? "s"
                        : ""}
                </div>
                {#each connEdges.slice(0, 8) as e (`${e.source}-${e.target}`)}
                    {@const nb = e.source === inspectedId ? e.target : e.source}
                    <div class="pr-row">
                        <span class="pr-l font-mono">↔ Q{nb}</span>
                        <span class="pr-v">{exponential(e.cx_error, 2)}</span>
                    </div>
                {/each}
            {/if}
        </div>
    {:else if dashboardState.clusterStats}
        <!-- Cluster result card -->
        {@const cs = dashboardState.clusterStats}
        <div class="cluster-result fade-in">
            <div class="cr-head">
                <div class="cr-title">
                    <div class="cr-dot"></div>
                    Best cluster
                </div>
                <button
                    class="cr-clear"
                    onclick={() => dashboardState.clearCluster()}
                    >Clear ×</button
                >
            </div>

            <div class="cr-size">
                <span class="cr-n">{dashboardState.cluster.length}</span>
                <span class="cr-q"
                    >qubits matched · {dashboardState.topology}</span
                >
            </div>

            {#each [{ l: "T₁", v: microseconds(cs.T1, 0), d: cs.deltaT1 }, { l: "T₂", v: microseconds(cs.T2, 0), d: cs.deltaT2 }, { l: "Readout", v: percent(cs.ro, 2), d: cs.deltaRo }] as row (row.l)}
                <div class="cr-row">
                    <span class="cr-l">{row.l}</span>
                    <span class="cr-v">{row.v}</span>
                    {#if row.d}
                        <span
                            class="cr-delta"
                            class:up={row.d.dir === "up"}
                            class:down={row.d.dir === "down"}
                            class:flat={row.d.dir === "flat"}
                        >
                            {row.d.dir === "up"
                                ? "▲"
                                : row.d.dir === "down"
                                  ? "▼"
                                  : "—"}
                            {deltaLabel(row.d.magnitude)}
                        </span>
                    {:else}
                        <span class="cr-delta flat">—</span>
                    {/if}
                </div>
            {/each}
            <div class="cr-vsmed">▲ better than device median</div>

            <div class="cr-members-h">
                <span class="t">{dashboardState.cluster.length} members</span>
                <span class="hint">click to inspect →</span>
            </div>
            <div class="cr-members">
                {#each dashboardState.cluster as id (id)}
                    <button
                        class="qchip"
                        class:on={dashboardState.selectedId === id}
                        animate:flip={{
                            duration: prefersReducedMotion.current ? 0 : DUR.ui,
                            easing: ease,
                        }}
                        onclick={() => (dashboardState.selectedId = id)}
                    >
                        Q{id}
                    </button>
                {/each}
            </div>
        </div>
    {:else}
        <!-- Empty state -->
        <div>
            <div class="eyebrow mb">Inspector</div>
            <div class="insp-empty">
                Click any qubit in the figure to read its full calibration
                record — or <b>find a cluster</b> to evaluate a candidate region.
            </div>
        </div>
    {/if}

    <!-- ── BOTTOM: reference medians + legend ── -->
    <div class="read-foot">
        <div class="eyebrow mb">{dashboardState.device} · medians</div>
        <div class="pr-row">
            <span class="pr-l">T₁</span>
            <span class="pr-v">{microseconds(dashboardState.medians.T1, 0)}</span>
        </div>
        <div class="pr-row">
            <span class="pr-l">T₂</span>
            <span class="pr-v">{microseconds(dashboardState.medians.T2, 0)}</span>
        </div>
        <div class="pr-row">
            <span class="pr-l">Readout</span>
            <span class="pr-v">{percent(dashboardState.medians.ro, 2)}</span>
        </div>
        <div class="pr-row">
            <span class="pr-l">CX gate</span>
            <span class="pr-v">{exponential(dashboardState.medians.cx, 2)}</span>
        </div>
        <div class="pr-row">
            <span class="pr-l">Lattice</span>
            <span class="pr-v"
                >{dashboardState.stats.qubitsCount}Q · {dashboardState.stats
                    .edgesCount}E</span
            >
        </div>

        <div class="read-divider"></div>

        <div class="eyebrow mb">Colour scale</div>

        <!-- Color scale legend -->
        {#if dashboardState.filteredQubits.length > 0}
            <div class="leg-inline">
                <div class="lg-pair">
                    <div class="lg-label">{nodeLegend.label}</div>
                    <div
                        class="lg-bar"
                        style="background: linear-gradient(to right, {nodeLegend.reversed
                            ? NODE_HI
                            : NODE_LO}, {nodeLegend.reversed
                            ? NODE_LO
                            : NODE_HI})"
                    ></div>
                    <div class="lg-ends">
                        <span>{nodeLegend.lo}</span>
                        <span>{nodeLegend.hi}</span>
                    </div>
                </div>
                <div class="lg-pair">
                    <div class="lg-label">CX gate error · edges</div>
                    <div
                        class="lg-bar"
                        style="background: linear-gradient(to right, {EDGE_LO}, {EDGE_HI})"
                    ></div>
                    <div class="lg-ends">
                        <span>{edgeLegend.lo}</span>
                        <span>{edgeLegend.hi}</span>
                    </div>
                </div>
            </div>
        {/if}
    </div>
</aside>

<style>
    /* ═══ Read rows + footer ═══ */
    .pr-row  { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--border); }
    .pr-row:last-child { border-bottom: none; }
    .pr-l    { font-size: 11.5px; color: var(--text-2); white-space: nowrap; }
    .pr-v    { font-size: 12.5px; color: var(--text); white-space: nowrap; font-family: var(--font-mono); }
    .pr-qid  { font-size: 21px; color: var(--accent); line-height: 1; font-family: var(--font-mono); }
    .pr-cxh  { font-size: 9.5px; color: var(--text-3); letter-spacing: 0.08em; text-transform: uppercase; margin: 15px 0 4px; }

    .read-foot    { margin-top: auto; padding-top: 26px; }
    .read-divider { height: 1px; background: var(--border); margin: 22px 0; }

    /* ═══ Inline colour-scale legend ═══ */
    .leg-inline .lg-label { font-size: 9px; letter-spacing: 0.09em; text-transform: uppercase; color: var(--text-3); margin-bottom: 7px; font-weight: 500; }
    .leg-inline .lg-bar   { height: 6px; border-radius: 3px; margin-bottom: 5px; }
    .leg-inline .lg-ends  { display: flex; justify-content: space-between; font-size: 9.5px; font-family: var(--font-mono); color: var(--text-3); }
    .leg-inline .lg-pair  { margin-bottom: 15px; }
    .leg-inline .lg-pair:last-child { margin-bottom: 0; }

    /* ═══ Cluster result card ═══ */
    .cluster-result { background: var(--accent-surface); border: 1px solid var(--accent-border); border-radius: var(--radius-md); padding: 15px 16px; }
    .cr-head        { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .cr-title       { display: flex; align-items: center; gap: 7px; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent); font-weight: 600; }
    .cr-dot         { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 3px color-mix(in oklch, var(--accent) 22%, transparent); }
    .cr-clear       { background: none; border: none; color: var(--text-3); cursor: pointer; font-size: 11px; padding: 0; }
    .cr-clear:hover { color: var(--text-2); }
    .cr-size        { display: flex; align-items: baseline; gap: 7px; margin-bottom: 15px; }
    .cr-n           { font-size: 32px; font-weight: 500; color: var(--text); line-height: 1; font-family: var(--font-mono); }
    .cr-q           { font-size: 11.5px; color: var(--text-3); }
    .cr-row         { display: grid; grid-template-columns: 1fr auto auto; align-items: baseline; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--accent-border); }
    .cr-row:last-of-type { border-bottom: none; }
    .cr-l           { font-size: 11.5px; color: var(--text-2); }
    .cr-v           { font-size: 13px; color: var(--text); font-family: var(--font-mono); }
    .cr-delta       { font-size: 10px; font-family: var(--font-mono); padding: 1px 6px; border-radius: 99px; line-height: 1.5; white-space: nowrap; }
    .cr-delta.up    { color: var(--pos); background: var(--pos-bg); }
    .cr-delta.down  { color: var(--neg); background: var(--neg-bg); }
    .cr-delta.flat  { color: var(--text-3); background: transparent; }
    .cr-vsmed       { font-size: 9.5px; color: var(--text-3); text-align: right; margin-top: 6px; }
    .cr-members-h   { display: flex; align-items: center; justify-content: space-between; margin: 14px 0 9px; padding-top: 13px; border-top: 1px solid var(--accent-border); }
    .cr-members-h .t    { font-size: 9.5px; letter-spacing: 0.07em; text-transform: uppercase; color: var(--text-3); font-weight: 500; }
    .cr-members-h .hint { font-size: 9.5px; color: var(--text-3); }
    .cr-members     { display: flex; flex-wrap: wrap; gap: 4px; }

    .qchip         { font-size: 10.5px; padding: 3px 7px; border-radius: 5px; border: 1px solid var(--accent-border);
                     background: var(--surface); color: var(--text-2); cursor: pointer; transition: all var(--dur-fast); font-family: var(--font-mono); }
    .qchip:hover   { color: var(--text); border-color: var(--accent); }
    .qchip.on      { background: var(--accent); color: var(--accent-fg); border-color: var(--accent); }

    /* ═══ Inspector drill-down ═══ */
    .insp-back        { display: inline-flex; align-items: center; gap: 5px; background: none; border: none; color: var(--text-3);
                        cursor: pointer; font-size: 11px; font-family: var(--font-sans); padding: 0; margin-bottom: 13px; transition: color var(--dur-fast); }
    .insp-back:hover  { color: var(--accent); }
    .insp-qhead       { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 12px; }
    .mem-badge        { font-size: 9px; letter-spacing: 0.05em; text-transform: uppercase; font-weight: 600;
                        padding: 3px 8px; border-radius: 99px; white-space: nowrap; }
    .mem-badge.in     { color: var(--accent); background: var(--accent-surface); border: 1px solid var(--accent-border); }
    .mem-badge.out    { color: var(--text-3); background: var(--read-bg); border: 1px solid var(--border); }
    .insp-empty       { font-size: 12px; color: var(--text-3); line-height: 1.7; }
    .insp-empty b     { color: var(--text-2); font-weight: 500; }
</style>
