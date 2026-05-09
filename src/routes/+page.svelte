<script lang="ts">
    import { onMount } from "svelte";
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

    let latticePositions = $derived.by(() => {
        const devicePositions = positionsByDevice?.[dashboardState.device];
        if (!devicePositions) return BASE_POS;
        return Object.entries(devicePositions).map(([id, pos]) => ({
            id: Number(id),
            x: pos.x,
            y: pos.y,
        }));
    });

    onMount(async () => {
        try {
            const { dataset, positions } = await loadData();
            positionsByDevice = positions;
            dashboardState.applyDataset(dataset);
        } catch (err) {
            console.error("Failed to load lattice data", err);
        }
    });

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

<div class="flex h-screen w-screen overflow-hidden bg-[var(--bg)]">
    <Sidebar />

    <div class="flex flex-col flex-1 overflow-hidden min-w-0">
        <Topbar />

        <div
            class="flex-1 overflow-hidden relative bg-[var(--bg)] flex justify-center"
        >
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
                    {@const q =
                        dashboardState.snap.qubits[dashboardState.hoveredId]}
                    <div
                        class="absolute bottom-[18px] left-1/2 -translate-x-1/2 bg-[#f2f0eb]/95 border border-[var(--border-mid)] rounded-lg py-2 px-[18px] flex gap-5 items-center pointer-events-none whitespace-nowrap shadow-[0_4px_20px_rgba(0,0,0,0.1)] z-50"
                    >
                        <span class="font-mono text-[13px] text-[var(--text)]">
                            Q{String(dashboardState.hoveredId).padStart(3, "0")}
                        </span>
                        <span class="text-[12px]">
                            <span class="text-[var(--text-3)]">T₁ </span>
                            <span class="text-[var(--text-2)] font-mono"
                                >{q.T1 == null
                                    ? "—"
                                    : `${q.T1.toFixed(0)} μs`}</span
                            >
                        </span>
                        <span class="text-[12px]">
                            <span class="text-[var(--text-3)]">T₂ </span>
                            <span class="text-[var(--text-2)] font-mono"
                                >{q.T2 == null
                                    ? "—"
                                    : `${q.T2.toFixed(0)} μs`}</span
                            >
                        </span>
                        <span class="text-[12px]">
                            <span class="text-[var(--text-3)]">RO </span>
                            <span class="text-[var(--text-2)] font-mono"
                                >{q.readout_error == null
                                    ? "—"
                                    : `${(q.readout_error * 100).toFixed(2)}%`}</span
                            >
                        </span>
                        <span class="text-[12px]">
                            <span class="text-[var(--text-3)]">P0 | 1 </span>
                            <span class="text-[var(--text-2)] font-mono"
                                >{q.p01 == null
                                    ? "—"
                                    : `${(q.p01 * 100).toFixed(2)}%`}</span
                            >
                        </span>
                        <span class="text-[12px]">
                            <span class="text-[var(--text-3)]">P1 | 0 </span>
                            <span class="text-[var(--text-2)] font-mono"
                                >{q.p10 == null
                                    ? "—"
                                    : `${(q.p10 * 100).toFixed(2)}%`}</span
                            >
                        </span>
                    </div>
                {/if}

                <!-- Color scale legend -->
                {#if dashboardState.filteredQubits.length > 0}
                    <div
                        class="absolute bottom-[18px] right-[18px] pointer-events-none z-30 bg-[#f2f0eb]/95 border border-[var(--border-mid)] rounded-[10px] shadow-[0_4px_16px_rgba(0,0,0,0.07)] py-[11px] px-[13px] min-w-[148px]"
                    >
                        <div
                            class="text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-[7px]"
                        >
                            {nodeLegend.label}
                        </div>
                        <div
                            class="h-[5px] rounded-full mb-[5px]"
                            style="background: linear-gradient(to right, {nodeLegend.reversed ? NODE_COLOR_HI : NODE_COLOR_LO}, {nodeLegend.reversed ? NODE_COLOR_LO : NODE_COLOR_HI})"
                        ></div>
                        <div
                            class="flex justify-between text-[9px] font-mono text-[var(--text-3)]"
                        >
                            <span>{nodeLegend.lo}</span>
                            <span>{nodeLegend.hi}</span>
                        </div>

                        <div class="h-px bg-[var(--border)] my-[9px]"></div>

                        <div
                            class="text-[9px] tracking-[0.1em] uppercase text-[var(--text-3)] mb-[7px]"
                        >
                            CX Gate Error
                        </div>
                        <div
                            class="h-[5px] rounded-full mb-[5px]"
                            style="background: linear-gradient(to right, {EDGE_COLOR_HI}, {EDGE_COLOR_LO})"
                        ></div>
                        <div
                            class="flex justify-between text-[9px] font-mono text-[var(--text-3)]"
                        >
                            <span>{edgeLegend.lo}</span>
                            <span>{edgeLegend.hi}</span>
                        </div>
                    </div>
                {/if}

                <!-- Detail panel -->
                {#if dashboardState.selectedId !== null && dashboardState.snap.qubits[dashboardState.selectedId]}
                    {@const qubit =
                        dashboardState.snap.qubits[dashboardState.selectedId]}
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
