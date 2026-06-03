<script lang="ts">
    import { flip } from "svelte/animate";
    import { DUR, ease, prefersReducedMotion } from "$lib/viz/motion";
    import { dashboardState } from "$lib/state/dashboard.svelte";
    import { metricNodeColor, edgeColor } from "$lib/viz/color";
    import {
        microseconds,
        percent,
        exponential,
        deltaLabel,
    } from "$lib/viz/format";

    // ── color scale endpoints for legend bars ─────────────────────────
    const NODE_LO = metricNodeColor(0); // bad end (dark indigo)
    const NODE_HI = metricNodeColor(1); // good end (yellow-green)
    const EDGE_LO = edgeColor(0); // high error (muted lavender)
    const EDGE_HI = edgeColor(1); // low error (deep indigo)

    let { mobileOpen = false, onClose } = $props<{
        mobileOpen?: boolean;
        onClose?: () => void;
    }>();

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

    let requestedSize = $derived.by(() =>
        dashboardState.clusterRequested > 0
            ? dashboardState.clusterRequested
            : dashboardState.cluster.length,
    );

    let isPartial = $derived.by(
        () =>
            dashboardState.cluster.length > 0 &&
            requestedSize > dashboardState.cluster.length,
    );

    function closeDetail() {
        dashboardState.selectedId = null;
    }
</script>

<aside class="plate-read" class:mob-open={mobileOpen}>
    <div class="sheet-handle" onclick={onClose} aria-label="Close results">
        <span class="sheet-handle-bar"></span>
    </div>
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
                    <span
                        class="mem-badge"
                        class:in={inCluster}
                        class:out={!inCluster}
                    >
                        {inCluster ? "✓ in cluster" : "not in cluster"}
                    </span>
                {/if}
            </div>

            <div>
                <div class="pr-row">
                    <span class="pr-l">T₁</span>
                    <span class="pr-v"
                        >{microseconds(inspectedQubit.T1, 1)}</span
                    >
                </div>
                <div class="pr-row">
                    <span class="pr-l">T₂</span>
                    <span class="pr-v"
                        >{microseconds(inspectedQubit.T2, 1)}</span
                    >
                </div>
                <div class="pr-row">
                    <span class="pr-l">Readout error</span>
                    <span class="pr-v"
                        >{percent(inspectedQubit.readout_error, 2)}</span
                    >
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
    {:else if dashboardState.findFailed}
        <div class="cl-fail fade-in">
            <div class="cl-fail-head">
                <div class="cl-fail-ico">
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.7"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <circle cx="10.5" cy="10.5" r="6.5" />
                        <path d="m20 20-4.2-4.2" />
                        <path d="M8.4 8.4l4.2 4.2M12.6 8.4l-4.2 4.2" />
                    </svg>
                </div>
                <div>
                    <div class="cl-fail-h">
                        Can't place {requestedSize} qubits
                    </div>
                    <div class="cl-fail-sub">
                        Largest connected region available:
                        <b>{dashboardState.nearestCluster.length}Q</b>
                    </div>
                </div>
            </div>

            <p class="cl-fail-p">
                    Only <b>{dashboardState.allowedQubitIds.size} qubits</b>
                    qualify and they don't connect into a usable block under the
                    current filters.
                </p>

            {#if dashboardState.relaxSuggestions?.candidates.length}
                <div class="cl-relax-h">Relax one constraint</div>
                <div class="cl-relax-list">
                    {#each dashboardState.relaxSuggestions.candidates as c, i (c.label)}
                        <button
                            class="cl-relax"
                            onclick={() => dashboardState.applyRelaxation(i)}
                        >
                            <span class="cl-relax-l">{c.label}</span>
                            <span class="cl-relax-g">→ {c.comp}Q block</span>
                        </button>
                    {/each}
                </div>
            {/if}

            <div class="cl-fail-acts">
                {#if dashboardState.nearestCluster.length >= 2}
                    <button
                        class="cl-fail-btn primary"
                        onclick={() => dashboardState.shrinkToNearestAndRetry()}
                    >
                        <svg
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="M3 8.5l3.2 3.2L13 4.8" />
                        </svg>
                        Use the {dashboardState.nearestCluster.length}Q region
                    </button>
                {/if}
            </div>
        </div>
    {:else if dashboardState.clusterStats}
        <!-- Cluster result card -->
        {@const cs = dashboardState.clusterStats}
        <div class="cr fade-in">
            <div class="cr-top">
                <span class="cr-eye"
                    ><span class="cr-dot"></span>Best cluster</span
                >
                <button
                    class="cr-x"
                    onclick={() => dashboardState.clearCluster()}
                    title="Clear"
                >
                    <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.7"
                        stroke-linecap="round"
                    >
                        <path d="M4 4l8 8M12 4l-8 8" />
                    </svg>
                </button>
            </div>

            <div class="cr-hero">
                <span class="cr-n">{dashboardState.cluster.length}</span>
                <span class="cr-of">/ {requestedSize} Q</span>
                <span class="cr-topo">{dashboardState.topology}</span>
            </div>

            {#if isPartial}
                <div class="cr-warn">
                    <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.6"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M8 2.2 1.6 13.4h12.8L8 2.2Z" />
                        <path d="M8 6.4v3.1" />
                        <circle
                            cx="8"
                            cy="11.4"
                            r="0.5"
                            fill="currentColor"
                            stroke="none"
                        />
                    </svg>
                    <div class="cr-warn-tx">
                        <b>{dashboardState.cluster.length} of {requestedSize}</b
                        >
                        qubits placed — the qualifying subgraph is fragmented. Loosen
                        a filter or lower the size for a complete block.
                    </div>
                </div>
            {/if}

            <div class="cr-metrics">
                {#each [{ l: "T₁", v: microseconds(cs.T1, 0), d: cs.deltaT1 }, { l: "T₂", v: microseconds(cs.T2, 0), d: cs.deltaT2 }, { l: "Readout err", v: percent(cs.ro, 2), d: cs.deltaRo }, { l: "CX gate err", v: cs.cx != null ? exponential(cs.cx, 2) : "—", d: cs.deltaCx }] as row (row.l)}
                    <div class="cr-mrow">
                        <span class="cr-ml">{row.l}</span>
                        <span class="cr-mv">{row.v}</span>
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
            </div>
            <div class="cr-vsmed">vs device median · ▲ = better</div>

            <div class="cr-mem">
                <div class="cr-mem-h">
                    <span class="cr-mem-t">
                        {dashboardState.cluster.length} members
                    </span>
                    <span class="cr-mem-hint">click to inspect →</span>
                </div>
                <div class="cr-chips">
                    {#each dashboardState.cluster as id (id)}
                        <button
                            class="qchip"
                            class:on={dashboardState.selectedId === id}
                            animate:flip={{
                                duration: prefersReducedMotion.current
                                    ? 0
                                    : DUR.ui,
                                easing: ease,
                            }}
                            onclick={() => (dashboardState.selectedId = id)}
                        >
                            Q{id}
                        </button>
                    {/each}
                </div>
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
            <span class="pr-v"
                >{microseconds(dashboardState.medians.T1, 0)}</span
            >
        </div>
        <div class="pr-row">
            <span class="pr-l">T₂</span>
            <span class="pr-v"
                >{microseconds(dashboardState.medians.T2, 0)}</span
            >
        </div>
        <div class="pr-row">
            <span class="pr-l">Readout</span>
            <span class="pr-v">{percent(dashboardState.medians.ro, 2)}</span>
        </div>
        <div class="pr-row">
            <span class="pr-l">CX gate</span>
            <span class="pr-v">{exponential(dashboardState.medians.cx, 2)}</span
            >
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
    .pr-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 10px;
        padding: 6px 0;
        border-bottom: 1px solid var(--border);
    }
    .pr-row:last-child {
        border-bottom: none;
    }
    .pr-l {
        font-size: 13px;
        color: var(--text-2);
        white-space: nowrap;
    }
    .pr-v {
        font-size: 14px;
        color: var(--text);
        white-space: nowrap;
        font-family: var(--font-mono);
    }
    .pr-qid {
        font-size: 24px;
        color: var(--accent);
        line-height: 1;
        font-family: var(--font-mono);
    }
    .pr-cxh {
        font-size: 11px;
        color: var(--text-3);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin: 15px 0 4px;
    }

    .read-foot {
        margin-top: auto;
        padding-top: 26px;
    }
    .read-divider {
        height: 1px;
        background: var(--border);
        margin: 22px 0;
    }

    /* ═══ Inline colour-scale legend ═══ */
    .leg-inline .lg-label {
        font-size: 10.5px;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: var(--text-3);
        margin-bottom: 7px;
        font-weight: 500;
    }
    .leg-inline .lg-bar {
        height: 6px;
        border-radius: 3px;
        margin-bottom: 5px;
    }
    .leg-inline .lg-ends {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        font-family: var(--font-mono);
        color: var(--text-3);
    }
    .leg-inline .lg-pair {
        margin-bottom: 15px;
    }
    .leg-inline .lg-pair:last-child {
        margin-bottom: 0;
    }

    /* ═══ Cluster result card ═══ */
    .cr {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-panel);
        overflow: hidden;
    }
    .cr-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 13px 16px 0;
    }
    .cr-eye {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-size: 11.5px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--accent);
        font-weight: 600;
    }
    .cr-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--accent);
        box-shadow: 0 0 0 3px
            color-mix(in oklch, var(--accent) 22%, transparent);
    }
    .cr-x {
        width: 22px;
        height: 22px;
        border-radius: var(--radius-sm);
        border: 1px solid transparent;
        background: transparent;
        color: var(--text-3);
        cursor: pointer;
        display: grid;
        place-items: center;
        transition: all var(--dur-fast);
    }
    .cr-x:hover {
        color: var(--text);
        background: var(--read-bg);
        border-color: var(--border);
    }
    .cr-x svg {
        width: 12px;
        height: 12px;
    }

    .cr-hero {
        padding: 8px 16px 16px;
        display: flex;
        align-items: baseline;
        gap: 9px;
    }
    .cr-n {
        font-size: 38px;
        font-weight: 500;
        color: var(--text);
        line-height: 0.9;
        font-family: var(--font-mono);
        letter-spacing: -0.02em;
    }
    .cr-of {
        font-size: 14px;
        color: var(--text-3);
        font-family: var(--font-mono);
    }
    .cr-topo {
        margin-left: auto;
        align-self: center;
        font-size: 11.5px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--text-2);
        background: var(--read-bg);
        border: 1px solid var(--border);
        border-radius: 99px;
        padding: 3px 9px;
        font-weight: 500;
    }

    .cr-metrics {
        padding: 0 16px;
    }
    .cr-mrow {
        display: grid;
        grid-template-columns: 1fr auto auto;
        align-items: baseline;
        gap: 10px;
        padding: 8px 0;
        border-top: 1px solid var(--border);
    }
    .cr-mrow:first-child {
        border-top: none;
    }
    .cr-ml {
        font-size: 13px;
        color: var(--text-2);
    }
    .cr-mv {
        font-size: 14.5px;
        color: var(--text);
        font-family: var(--font-mono);
    }
    .cr-delta {
        font-size: 11.5px;
        font-family: var(--font-mono);
        padding: 1px 6px;
        border-radius: 99px;
        line-height: 1.5;
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        gap: 3px;
        min-width: 46px;
        justify-content: center;
    }
    .cr-delta.up {
        color: var(--pos);
        background: var(--pos-bg);
    }
    .cr-delta.down {
        color: var(--neg);
        background: var(--neg-bg);
    }
    .cr-delta.flat {
        color: var(--text-3);
        background: var(--read-bg);
    }
    .cr-vsmed {
        font-size: 11px;
        color: var(--text-3);
        text-align: right;
        padding: 6px 16px 0;
    }

    .cr-mem {
        padding: 13px 16px 15px;
        margin-top: 13px;
        border-top: 1px solid var(--border);
        background: var(--read-bg);
    }
    .cr-mem-h {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
    }
    .cr-mem-t {
        font-size: 11px;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: var(--text-3);
        font-weight: 600;
    }
    .cr-mem-hint {
        font-size: 11px;
        color: var(--text-3);
    }
    .cr-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        max-height: 116px;
        overflow-y: auto;
    }
    .qchip {
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 5px;
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text-2);
        cursor: pointer;
        transition: all var(--dur-fast);
        font-family: var(--font-mono);
    }
    .qchip:hover {
        color: var(--text);
        border-color: var(--accent);
    }
    .qchip.on {
        background: var(--accent);
        color: var(--accent-fg);
        border-color: var(--accent);
    }

    .cr-warn {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        margin: 0 16px 14px;
        padding: 9px 11px;
        background: var(--warn-bg);
        border: 1px solid var(--warn-border);
        border-radius: var(--radius-sm);
    }
    .cr-warn svg {
        width: 14px;
        height: 14px;
        color: var(--warn);
        flex-shrink: 0;
        margin-top: 1px;
    }
    .cr-warn-tx {
        font-size: 12.5px;
        line-height: 1.5;
        color: var(--text-2);
    }
    .cr-warn-tx b {
        color: var(--text);
        font-weight: 600;
    }

    /* ═══ Failure card ═══ */
    .cl-fail {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-panel);
        padding: 18px 18px 20px;
    }
    .cl-fail-head {
        display: flex;
        align-items: center;
        gap: 12px;
        text-align: left;
        margin-bottom: 4px;
    }
    .cl-fail-ico {
        width: 40px;
        height: 40px;
        border-radius: 11px;
        flex-shrink: 0;
        display: grid;
        place-items: center;
        background: var(--warn-bg);
        color: var(--warn);
        border: 1px solid var(--warn-border);
    }
    .cl-fail-ico svg {
        width: 20px;
        height: 20px;
    }
    .cl-fail-h {
        font-size: 16px;
        font-weight: 600;
        color: var(--text);
    }
    .cl-fail-sub {
        font-size: 12.5px;
        color: var(--text-3);
        margin-top: 2px;
    }
    .cl-fail-sub b {
        color: var(--text-2);
        font-weight: 600;
        font-family: var(--font-mono);
    }
    .cl-fail-p {
        font-size: 13px;
        line-height: 1.6;
        color: var(--text-3);
        margin: 14px 0 4px;
        text-wrap: pretty;
    }
    .cl-fail-p b {
        color: var(--text-2);
        font-weight: 500;
    }

    .cl-relax-h {
        text-align: left;
        font-size: 11px;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: var(--text-3);
        font-weight: 600;
        margin: 16px 0 8px;
    }
    .cl-relax-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 16px;
    }
    .cl-relax {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        width: 100%;
        padding: 9px 11px;
        background: var(--surface);
        border: 1px solid var(--border-mid);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all var(--dur-fast);
        text-align: left;
    }
    .cl-relax:hover {
        border-color: var(--accent);
        background: var(--accent-surface);
    }
    .cl-relax-l {
        font-size: 13.5px;
        color: var(--text);
        font-family: var(--font-mono);
        white-space: nowrap;
    }
    .cl-relax-g {
        font-size: 12.5px;
        color: var(--pos);
        font-weight: 600;
        font-family: var(--font-mono);
        white-space: nowrap;
        flex-shrink: 0;
    }

    .cl-fail-acts {
        display: flex;
        flex-direction: column;
        gap: 7px;
    }
    .cl-fail-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        padding: 10px 12px;
        border-radius: var(--radius-sm);
        font-size: 13.5px;
        font-weight: 500;
        font-family: var(--font-sans);
        cursor: pointer;
        transition: all var(--dur-fast);
    }
    .cl-fail-btn.primary {
        background: var(--accent);
        border: 1px solid var(--accent);
        color: var(--accent-fg);
    }
    .cl-fail-btn.primary:hover {
        opacity: 0.92;
        box-shadow: 0 3px 14px
            color-mix(in oklch, var(--accent) 38%, transparent);
    }
    .cl-fail-btn svg {
        width: 13px;
        height: 13px;
    }

    /* ═══ Inspector drill-down ═══ */
    .insp-back {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: none;
        border: none;
        color: var(--text-3);
        cursor: pointer;
        font-size: 12.5px;
        font-family: var(--font-sans);
        padding: 0;
        margin-bottom: 13px;
        transition: color var(--dur-fast);
    }
    .insp-back:hover {
        color: var(--accent);
    }
    .insp-qhead {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 12px;
    }
    .mem-badge {
        font-size: 10.5px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 99px;
        white-space: nowrap;
    }
    .mem-badge.in {
        color: var(--accent);
        background: var(--accent-surface);
        border: 1px solid var(--accent-border);
    }
    .mem-badge.out {
        color: var(--text-3);
        background: var(--read-bg);
        border: 1px solid var(--border);
    }
    .insp-empty {
        font-size: 13.5px;
        color: var(--text-3);
        line-height: 1.7;
    }
    .insp-empty b {
        color: var(--text-2);
        font-weight: 500;
    }

    @media (min-width: 768px) and (max-width: 1199px) {
        .cr-n {
            font-size: 30px;
        }
    }
</style>
