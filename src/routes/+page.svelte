<script lang="ts">
    import { onMount } from "svelte";
    import { Tween } from "svelte/motion";
    import { cubicOut } from "svelte/easing";
    import Sidebar from "$lib/components/Sidebar.svelte";
    import Topbar from "$lib/components/Topbar.svelte";
    import Lattice from "$lib/components/Lattice.svelte";
    import QubitDetail from "$lib/components/QubitDetail.svelte";
    import { dashboardState } from "$lib/state.svelte";
    import { BASE_POS } from "$lib/utils/data";
    import type { Positions } from "$lib/types";
    import { loadData } from "$lib/utils/data";

    let containerWidth = $state(900);
    let containerHeight = $state(540);
    let positionsByDevice = $state<Positions | null>(null);
    let loadStatus = $state<"loading" | "ready" | "error">("loading");
    let loadError = $state<string | null>(null);
    const smoothProgress = new Tween(0, { duration: 200, easing: cubicOut });
    let bytesReceived = $state(0);
    let bytesTotal = $state<number | null>(null);

    let latticePositions = $derived.by(() => {
        const devicePositions = positionsByDevice?.[dashboardState.device];
        if (!devicePositions) return BASE_POS;
        return Object.entries(devicePositions).map(([id, pos]) => ({
            id: Number(id),
            x: pos.x,
            y: pos.y,
        }));
    });

    async function fetchData() {
        loadStatus = "loading";
        loadError = null;
        smoothProgress.set(0, { duration: 0 });
        bytesReceived = 0;
        bytesTotal = null;
        try {
            const { dataset, positions } = await loadData((p, recv, total) => {
                smoothProgress.set(p);
                if (total !== null) {
                    bytesReceived = recv;
                    bytesTotal = total;
                }
            });
            positionsByDevice = positions;
            dashboardState.applyDataset(dataset);
            await smoothProgress.set(1);
            loadStatus = "ready";
        } catch (err) {
            console.error("Failed to load calibration data", err);
            loadError = err instanceof Error ? err.message : "Unknown error";
            loadStatus = "error";
        }
    }

    onMount(fetchData);

    const NODE_COLOR_LO = "oklch(58% 0.19 35)";   // t=0 bad: rich amber
    const NODE_COLOR_HI = "oklch(55% 0.08 220)";  // t=1 good: muted steel blue
    const EDGE_COLOR_LO = "oklch(80% 0.03 220)"; // t=0 high error: light slate
    const EDGE_COLOR_HI = "oklch(52% 0.10 220)"; // t=1 low error: deep slate

    let nodeLegend = $derived.by(() => {
        const m = dashboardState.metricMode;
        const r = dashboardState.ranges;
        if (m === "T1") return { label: "T₁", lo: `${r.T1[0].toFixed(0)} μs`, hi: `${r.T1[1].toFixed(0)} μs`, reversed: false };
        if (m === "T2") return { label: "T₂", lo: `${r.T2[0].toFixed(0)} μs`, hi: `${r.T2[1].toFixed(0)} μs`, reversed: false };
        return { label: "Readout Error", lo: `${(r.readout[0] * 100).toFixed(1)}%`, hi: `${(r.readout[1] * 100).toFixed(1)}%`, reversed: true };
    });

    let edgeLegend = $derived.by(() => {
        const r = dashboardState.ranges;
        return { lo: `${(r.cx[0] * 100).toFixed(2)}%`, hi: `${(r.cx[1] * 100).toFixed(2)}%` };
    });
</script>

<!-- Loading screen -->
{#if loadStatus === "loading"}
    <div class="fixed inset-0 z-100 flex flex-col items-center justify-center gap-6 bg-(--bg)">
        <div class="flex flex-col items-center gap-5">
            <div class="flex flex-col items-center gap-1.5 mb-1">
                <p class="text-[10.5px] tracking-[0.08em] uppercase font-medium" style="color:var(--text-3)">
                    Loading calibration data
                </p>
            </div>
            <div class="w-56 flex flex-col gap-2">
                <div class="w-full h-0.75 rounded-full overflow-hidden" style="background:var(--border-mid)">
                    <div
                        class="h-full rounded-full transition-none"
                        style="width:{(smoothProgress.current * 100).toFixed(1)}%; background:var(--accent)"
                    ></div>
                </div>
                <div class="flex justify-between">
                    <span class="text-[11px] font-mono" style="color:var(--text-3)">
                        {(bytesReceived / 1e6).toFixed(1)}{bytesTotal ? ` / ${(bytesTotal / 1e6).toFixed(1)} MB` : " MB"}
                    </span>
                    <span class="text-[11px] font-mono" style="color:var(--text-3)">
                        {(smoothProgress.current * 100).toFixed(0)}%
                    </span>
                </div>
            </div>
        </div>
    </div>

<!-- Error screen -->
{:else if loadStatus === "error"}
    <div class="fixed inset-0 z-100 flex flex-col items-center justify-center bg-(--bg)">
        <div class="w-10 h-10 mb-5 rounded-full flex items-center justify-center" style="background:var(--data-warm-light)">
            <svg class="w-5 h-5" style="color:var(--data-warm)" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"/>
            </svg>
        </div>
        <h2 class="text-[15px] font-medium mb-2" style="color:var(--text)">Failed to load calibration data</h2>
        {#if loadError}
            <p class="text-[12px] font-mono mb-6 max-w-85 text-center break-all" style="color:var(--text-3)">{loadError}</p>
        {/if}
        <button
            onclick={fetchData}
            class="text-[13px] px-4 py-2 rounded-sm font-medium transition-opacity cursor-pointer border-none"
            style="background:var(--accent-surface); color:var(--accent)"
            onmouseenter={(e) => (e.currentTarget as HTMLElement).style.opacity = '0.8'}
            onmouseleave={(e) => (e.currentTarget as HTMLElement).style.opacity = '1'}
        >
            Retry
        </button>
    </div>

{:else}
<div class="flex h-screen w-screen overflow-hidden" style="background:var(--bg)">
    <Sidebar />

    <div class="flex flex-col flex-1 overflow-hidden min-w-0">
        <Topbar />

        <div class="flex-1 overflow-hidden relative flex justify-center" style="background:var(--bg)">
            <div
                bind:clientWidth={containerWidth}
                bind:clientHeight={containerHeight}
                class="w-full relative overflow-hidden"
            >
                <Lattice
                    positions={latticePositions}
                    width={containerWidth}
                    height={containerHeight}
                />

                <!-- Hover tooltip -->
                {#if dashboardState.hoveredId !== null && dashboardState.snap.qubits[dashboardState.hoveredId]}
                    {@const q = dashboardState.snap.qubits[dashboardState.hoveredId]}
                    <div class="tooltip">
                        <span class="tooltip-id font-mono">Q{String(dashboardState.hoveredId).padStart(3, "0")}</span>
                        <div class="tooltip-divider"></div>
                        <div class="tooltip-row">
                            <span class="tooltip-lbl">T₁</span>
                            <span class="tooltip-val font-mono">{q.T1 == null ? "—" : `${q.T1.toFixed(0)} μs`}</span>
                        </div>
                        <div class="tooltip-row">
                            <span class="tooltip-lbl">T₂</span>
                            <span class="tooltip-val font-mono">{q.T2 == null ? "—" : `${q.T2.toFixed(0)} μs`}</span>
                        </div>
                        <div class="tooltip-row">
                            <span class="tooltip-lbl">RO</span>
                            <span class="tooltip-val font-mono">{q.readout_error == null ? "—" : `${(q.readout_error * 100).toFixed(2)}%`}</span>
                        </div>
                        <div class="tooltip-divider"></div>
                        <div class="tooltip-row">
                            <span class="tooltip-lbl">P0|1</span>
                            <span class="tooltip-val font-mono">{q.p01 == null ? "—" : `${(q.p01 * 100).toFixed(2)}%`}</span>
                        </div>
                        <div class="tooltip-row">
                            <span class="tooltip-lbl">P1|0</span>
                            <span class="tooltip-val font-mono">{q.p10 == null ? "—" : `${(q.p10 * 100).toFixed(2)}%`}</span>
                        </div>
                    </div>
                {/if}

                <!-- Color scale legend -->
                {#if dashboardState.filteredQubits.length > 0}
                    <div class="legend">
                        <div class="legend-label">{nodeLegend.label}</div>
                        <div
                            class="legend-bar"
                            style="background:linear-gradient(to right,{nodeLegend.reversed ? NODE_COLOR_HI : NODE_COLOR_LO},{nodeLegend.reversed ? NODE_COLOR_LO : NODE_COLOR_HI})"
                        ></div>
                        <div class="legend-ends">
                            <span>{nodeLegend.lo}</span>
                            <span>{nodeLegend.hi}</span>
                        </div>

                        <div class="legend-divider"></div>

                        <div class="legend-label">CX Gate Error</div>
                        <div
                            class="legend-bar"
                            style="background:linear-gradient(to right,{EDGE_COLOR_HI},{EDGE_COLOR_LO})"
                        ></div>
                        <div class="legend-ends">
                            <span>{edgeLegend.lo}</span>
                            <span>{edgeLegend.hi}</span>
                        </div>
                    </div>
                {/if}

                <!-- Detail panel -->
                {#if dashboardState.selectedId !== null && dashboardState.snap.qubits[dashboardState.selectedId]}
                    {@const qubit = dashboardState.snap.qubits[dashboardState.selectedId]}
                    <QubitDetail
                        {qubit}
                        edges={dashboardState.snap.edges}
                        onClose={() => (dashboardState.selectedId = null)}
                    />
                {/if}
            </div>
        </div>
    </div>
</div>
{/if}

<style>
    .tooltip {
        position: absolute;
        bottom: 18px;
        left: 50%;
        transform: translateX(-50%);
        background: var(--surface);
        border: 1px solid var(--border-mid);
        border-radius: var(--radius-md);
        padding: 10px 14px;
        display: flex;
        align-items: center;
        gap: 10px;
        pointer-events: none;
        white-space: nowrap;
        box-shadow: var(--shadow-pop);
        z-index: 50;
    }

    .tooltip-id {
        font-size: 13px;
        color: var(--text);
        font-weight: 500;
    }

    .tooltip-divider {
        width: 1px;
        height: 20px;
        background: var(--border-mid);
        flex-shrink: 0;
    }

    .tooltip-row {
        display: flex;
        flex-direction: column;
        gap: 1px;
        align-items: flex-end;
    }
    .tooltip-lbl {
        font-size: 9.5px;
        color: var(--text-3);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        line-height: 1;
    }
    .tooltip-val {
        font-size: 12.5px;
        color: var(--text-2);
        line-height: 1;
    }

    .legend {
        position: absolute;
        bottom: 18px;
        right: 18px;
        pointer-events: none;
        z-index: 30;
        background: var(--surface);
        border: 1px solid var(--border-mid);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-panel);
        padding: 11px 13px;
        min-width: 148px;
    }

    .legend-label {
        font-size: 9px;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: var(--text-3);
        margin-bottom: 6px;
        font-weight: 500;
    }
    .legend-bar {
        height: 5px;
        border-radius: 3px;
        margin-bottom: 5px;
    }
    .legend-ends {
        display: flex;
        justify-content: space-between;
        font-size: 9px;
        font-family: var(--font-mono);
        color: var(--text-3);
    }
    .legend-divider {
        height: 1px;
        background: var(--border);
        margin: 9px 0;
    }
</style>
