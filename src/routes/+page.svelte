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

    const NODE_COLOR_LO = "oklch(88% 0.02 28)";
    const NODE_COLOR_HI = "oklch(54% 0.12 28)";
    const EDGE_COLOR_LO = "oklch(82% 0.025 28)";
    const EDGE_COLOR_HI = "oklch(62% 0.025 28)";

    // reversed=true means low value is good (errors): gradient and labels flip so good (lo) is on the right
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

{#if loadStatus === "loading"}
    <div class="fixed inset-0 z-100 flex flex-col items-center justify-center gap-5 bg-(--bg)">
        <p class="text-[11px] tracking-[0.12em] uppercase text-(--text-3)">Loading calibration data</p>
        <div class="w-60 flex flex-col gap-2">
            <div class="w-full h-1 rounded-full bg-(--border-mid) overflow-hidden">
                <div
                    class="h-full rounded-full bg-(--coral)"
                    style="width: {(smoothProgress.current * 100).toFixed(1)}%"
                ></div>
            </div>
            <div class="flex justify-between">
                <span class="text-[11px] font-mono text-(--text-3)">
                    {(bytesReceived / 1e6).toFixed(1)}{bytesTotal ? ` / ${(bytesTotal / 1e6).toFixed(1)} MB` : ' MB'}
                </span>
                <span class="text-[11px] font-mono text-(--text-3)">{(smoothProgress.current * 100).toFixed(0)}%</span>
            </div>
        </div>
    </div>
{:else if loadStatus === "error"}
    <div class="fixed inset-0 z-100 flex flex-col items-center justify-center bg-(--bg)">
        <div class="w-10 h-10 mb-5 rounded-full bg-(--coral-light) flex items-center justify-center">
            <svg class="w-5 h-5 text-(--coral)" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
            </svg>
        </div>
        <h2 class="text-[15px] font-medium text-(--text) mb-2">Failed to load calibration data</h2>
        {#if loadError}
            <p class="text-[12px] font-mono text-(--text-3) mb-6 max-w-85 text-center break-all">{loadError}</p>
        {/if}
        <button
            onclick={fetchData}
            class="text-[13px] px-4 py-2 rounded-lg bg-(--coral-light) text-(--coral) hover:bg-[oklch(86%_0.06_28)] transition-colors cursor-pointer"
        >
            Retry
        </button>
    </div>
{:else}
<div class="flex h-screen w-screen overflow-hidden bg-(--bg)">
    <Sidebar />

    <div class="flex flex-col flex-1 overflow-hidden min-w-0">
        <Topbar />

        <div class="flex-1 overflow-hidden relative bg-(--bg) flex justify-center">
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
                    <div
                        class="absolute bottom-4.5 left-1/2 -translate-x-1/2 bg-[#f2f0eb]/95 border border-(--border-mid) rounded-lg py-2 px-4.5 flex gap-5 items-center pointer-events-none whitespace-nowrap shadow-[0_4px_20px_rgba(0,0,0,0.1)] z-50"
                    >
                        <span class="font-mono text-[13px] text-(--text)">
                            Q{String(dashboardState.hoveredId).padStart(3, "0")}
                        </span>
                        <span class="text-[12px]">
                            <span class="text-(--text-3)">T₁ </span>
                            <span class="text-(--text-2) font-mono"
                                >{q.T1 == null ? "—" : `${q.T1.toFixed(0)} μs`}</span
                            >
                        </span>
                        <span class="text-[12px]">
                            <span class="text-(--text-3)">T₂ </span>
                            <span class="text-(--text-2) font-mono"
                                >{q.T2 == null ? "—" : `${q.T2.toFixed(0)} μs`}</span
                            >
                        </span>
                        <span class="text-[12px]">
                            <span class="text-(--text-3)">RO </span>
                            <span class="text-(--text-2) font-mono"
                                >{q.readout_error == null ? "—" : `${(q.readout_error * 100).toFixed(2)}%`}</span
                            >
                        </span>
                        <span class="text-[12px]">
                            <span class="text-(--text-3)">P0 | 1 </span>
                            <span class="text-(--text-2) font-mono"
                                >{q.p01 == null ? "—" : `${(q.p01 * 100).toFixed(2)}%`}</span
                            >
                        </span>
                        <span class="text-[12px]">
                            <span class="text-(--text-3)">P1 | 0 </span>
                            <span class="text-(--text-2) font-mono"
                                >{q.p10 == null ? "—" : `${(q.p10 * 100).toFixed(2)}%`}</span
                            >
                        </span>
                    </div>
                {/if}

                <!-- Color scale legend -->
                {#if dashboardState.filteredQubits.length > 0}
                    <div
                        class="absolute bottom-4.5 right-4.5 pointer-events-none z-30 bg-[#f2f0eb]/95 border border-(--border-mid) rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.07)] py-2.75 px-3.25 min-w-37"
                    >
                        <div class="text-[9px] tracking-widest uppercase text-(--text-3) mb-1.75">
                            {nodeLegend.label}
                        </div>
                        <div
                            class="h-1.25 rounded-full mb-1.25"
                            style="background: linear-gradient(to right, {nodeLegend.reversed ? NODE_COLOR_HI : NODE_COLOR_LO}, {nodeLegend.reversed ? NODE_COLOR_LO : NODE_COLOR_HI})"
                        ></div>
                        <div class="flex justify-between text-[9px] font-mono text-(--text-3)">
                            <span>{nodeLegend.lo}</span>
                            <span>{nodeLegend.hi}</span>
                        </div>

                        <div class="h-px bg-(--border) my-2.25"></div>

                        <div class="text-[9px] tracking-widest uppercase text-(--text-3) mb-1.75">
                            CX Gate Error
                        </div>
                        <div
                            class="h-1.25 rounded-full mb-1.25"
                            style="background: linear-gradient(to right, {EDGE_COLOR_HI}, {EDGE_COLOR_LO})"
                        ></div>
                        <div class="flex justify-between text-[9px] font-mono text-(--text-3)">
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
