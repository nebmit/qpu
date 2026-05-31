<script lang="ts">
    import { dashboardState } from "$lib/state.svelte";
    import { metricNodeColor, edgeColor } from "$lib/utils/data";

    // ── color scale endpoints for legend bars ─────────────────────────
    const NODE_LO = metricNodeColor(0);   // bad end (dark indigo)
    const NODE_HI = metricNodeColor(1);   // good end (yellow-green)
    const EDGE_LO = edgeColor(0);         // high error (muted lavender)
    const EDGE_HI = edgeColor(1);         // low error (deep indigo)

    let nodeLegend = $derived.by(() => {
        const m = dashboardState.metricMode;
        const r = dashboardState.ranges;
        if (m === "T1") return { label: "T₁ coherence · nodes", lo: `${r.T1[0].toFixed(0)} μs`, hi: `${r.T1[1].toFixed(0)} μs`, reversed: false };
        if (m === "T2") return { label: "T₂ coherence · nodes", lo: `${r.T2[0].toFixed(0)} μs`, hi: `${r.T2[1].toFixed(0)} μs`, reversed: false };
        return { label: "Readout error · nodes", lo: `${(r.readout[0] * 100).toFixed(1)}%`, hi: `${(r.readout[1] * 100).toFixed(1)}%`, reversed: true };
    });

    let edgeLegend = $derived.by(() => {
        const r = dashboardState.ranges;
        return { lo: `${(r.cx[0] * 100).toFixed(2)}%`, hi: `${(r.cx[1] * 100).toFixed(2)}%` };
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

    const fmt = (v: number | null, unit: string, scale = 1, digits = 2) =>
        v == null ? "—" : `${(v * scale).toFixed(digits)}${unit}`;

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
                <button class="insp-back" onclick={closeDetail}>‹ Back to cluster</button>
            {:else}
                <div class="eyebrow mb">Selection</div>
            {/if}

            <div class="insp-qhead">
                <span class="pr-qid">Q{String(inspectedId).padStart(3, "0")}</span>
                {#if dashboardState.clusterStats}
                    <span class="mem-badge {inCluster ? 'in' : 'out'}">
                        {inCluster ? "✓ in cluster" : "not in cluster"}
                    </span>
                {/if}
            </div>

            <div>
                <div class="pr-row">
                    <span class="pr-l">T₁</span>
                    <span class="pr-v">{fmt(inspectedQubit.T1, " μs", 1, 1)}</span>
                </div>
                <div class="pr-row">
                    <span class="pr-l">T₂</span>
                    <span class="pr-v">{fmt(inspectedQubit.T2, " μs", 1, 1)}</span>
                </div>
                <div class="pr-row">
                    <span class="pr-l">Readout error</span>
                    <span class="pr-v">{fmt(inspectedQubit.readout_error, "%", 100, 2)}</span>
                </div>
                <div class="pr-row">
                    <span class="pr-l">P0|1</span>
                    <span class="pr-v">{fmt(inspectedQubit.p01, "%", 100, 2)}</span>
                </div>
                <div class="pr-row">
                    <span class="pr-l">P1|0</span>
                    <span class="pr-v">{fmt(inspectedQubit.p10, "%", 100, 2)}</span>
                </div>
            </div>

            {#if connEdges.length > 0}
                <div class="pr-cxh">CX gate · {connEdges.length} link{connEdges.length !== 1 ? "s" : ""}</div>
                {#each connEdges.slice(0, 8) as e (`${e.source}-${e.target}`)}
                    {@const nb = e.source === inspectedId ? e.target : e.source}
                    <div class="pr-row">
                        <span class="pr-l font-mono">↔ Q{nb}</span>
                        <span class="pr-v">{e.cx_error == null ? "—" : e.cx_error.toExponential(2)}</span>
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
                <button class="cr-clear" onclick={() => dashboardState.clearCluster()}>Clear ×</button>
            </div>

            <div class="cr-size">
                <span class="cr-n">{dashboardState.cluster.length}</span>
                <span class="cr-q">qubits matched · {dashboardState.topology}</span>
            </div>

            {#each [
                { l: "T₁", v: cs.T1 !== "—" ? `${cs.T1} μs` : "—", d: cs.deltaT1 },
                { l: "T₂", v: cs.T2 !== "—" ? `${cs.T2} μs` : "—", d: cs.deltaT2 },
                { l: "Readout", v: cs.ro !== "—" ? `${cs.ro}%` : "—", d: cs.deltaRo },
            ] as row (row.l)}
                <div class="cr-row">
                    <span class="cr-l">{row.l}</span>
                    <span class="cr-v">{row.v}</span>
                    {#if row.d}
                        <span class="cr-delta {row.d.dir}">
                            {row.d.dir === "up" ? "▲" : row.d.dir === "down" ? "▼" : "—"} {row.d.label}
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
                        class="qchip {dashboardState.selectedId === id ? 'on' : ''}"
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
                Click any qubit in the figure to read its full calibration record — or <b>find a cluster</b> to evaluate a candidate region.
            </div>
        </div>
    {/if}

    <!-- ── BOTTOM: reference medians + legend ── -->
    <div class="read-foot">
        <div class="eyebrow mb">{dashboardState.device} · medians</div>
        <div class="pr-row">
            <span class="pr-l">T₁</span>
            <span class="pr-v">{dashboardState.medians.T1}{dashboardState.medians.T1 !== "—" ? " μs" : ""}</span>
        </div>
        <div class="pr-row">
            <span class="pr-l">T₂</span>
            <span class="pr-v">{dashboardState.medians.T2}{dashboardState.medians.T2 !== "—" ? " μs" : ""}</span>
        </div>
        <div class="pr-row">
            <span class="pr-l">Readout</span>
            <span class="pr-v">{dashboardState.medians.ro}{dashboardState.medians.ro !== "—" ? "%" : ""}</span>
        </div>
        <div class="pr-row">
            <span class="pr-l">CX gate</span>
            <span class="pr-v">{dashboardState.medians.cx}</span>
        </div>
        <div class="pr-row">
            <span class="pr-l">Lattice</span>
            <span class="pr-v">{dashboardState.stats.qubitsCount}Q · {dashboardState.stats.edgesCount}E</span>
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
                        style="background: linear-gradient(to right, {nodeLegend.reversed ? NODE_HI : NODE_LO}, {nodeLegend.reversed ? NODE_LO : NODE_HI})"
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
