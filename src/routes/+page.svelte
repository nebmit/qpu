<script lang="ts">
    import { onMount } from "svelte";
    import { Tween } from "svelte/motion";
    import { DUR, ease } from "$lib/viz/motion";
    import Topbar from "$lib/components/Topbar.svelte";
    import OperatePanel from "$lib/components/OperatePanel.svelte";
    import ReadPanel from "$lib/components/ReadPanel.svelte";
    import Lattice from "$lib/components/Lattice.svelte";
    import { dashboardState } from "$lib/state/dashboard.svelte";
    import { BASE_POS } from "$lib/domain/lattice";
    import type { Positions } from "$lib/types";
    import { loadData } from "$lib/data/calibration";

    let containerWidth = $state(900);
    let containerHeight = $state(540);
    let positionsByDevice = $state<Positions | null>(null);
    let loadStatus = $state<"loading" | "transitioning" | "ready" | "error">(
        "loading",
    );
    let loadError = $state<string | null>(null);
    let entryAnimating = $state(false);
    const smoothProgress = new Tween(0, { duration: DUR.ui, easing: ease });
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
            loadStatus = "transitioning";
            entryAnimating = true;
            setTimeout(() => {
                loadStatus = "ready";
            }, 450);
            setTimeout(() => {
                entryAnimating = false;
            }, 1300);
        } catch (err) {
            console.error("Failed to load calibration data", err);
            loadError = err instanceof Error ? err.message : "Unknown error";
            loadStatus = "error";
        }
    }

    onMount(fetchData);
</script>

<!-- ─── Loading overlay ──────────────────────────────────────────────── -->
{#if loadStatus === "loading" || loadStatus === "transitioning"}
    <div
        class="loader-overlay fixed inset-0 z-100 flex flex-col items-center justify-center gap-6 bg-(--bg)"
        class:transitioning={loadStatus === "transitioning"}
    >
        <div class="loader-content flex flex-col items-center gap-5">
            <div class="loader-label flex flex-col items-center gap-1.5 mb-1">
                <p
                    class="text-[10.5px] tracking-[0.08em] uppercase font-medium"
                    style="color:var(--text-3)"
                >
                    Loading calibration data
                </p>
            </div>
            <div class="loader-bar-wrap flex flex-col gap-2">
                <div
                    class="loader-track h-0.75 rounded-full overflow-hidden"
                    style="background:var(--border-mid)"
                >
                    <div
                        class="loader-fill h-full rounded-full transition-none"
                        style="width:{(smoothProgress.current * 100).toFixed(
                            1,
                        )}%; background:var(--accent)"
                    ></div>
                </div>
                <div class="loader-meta flex justify-between">
                    <span
                        class="text-[11px] font-mono"
                        style="color:var(--text-3)"
                    >
                        {(bytesReceived / 1e6).toFixed(1)}{bytesTotal
                            ? ` / ${(bytesTotal / 1e6).toFixed(1)} MB`
                            : " MB"}
                    </span>
                    <span
                        class="text-[11px] font-mono"
                        style="color:var(--text-3)"
                    >
                        {(smoothProgress.current * 100).toFixed(0)}%
                    </span>
                </div>
            </div>
        </div>
    </div>
{/if}

<!-- ─── Error state ──────────────────────────────────────────────────── -->
{#if loadStatus === "error"}
    <div
        class="fixed inset-0 z-100 flex flex-col items-center justify-center bg-(--bg)"
    >
        <div
            class="w-10 h-10 mb-5 rounded-full flex items-center justify-center"
            style="background:var(--neg-bg)"
        >
            <svg
                class="w-5 h-5"
                style="color:var(--neg)"
                viewBox="0 0 20 20"
                fill="currentColor"
            >
                <path
                    fill-rule="evenodd"
                    d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                    clip-rule="evenodd"
                />
            </svg>
        </div>
        <h2 class="text-[15px] font-medium mb-2" style="color:var(--text)">
            Failed to load calibration data
        </h2>
        {#if loadError}
            <p
                class="text-[12px] font-mono mb-6 max-w-85 text-center break-all"
                style="color:var(--text-3)"
            >
                {loadError}
            </p>
        {/if}
        <button
            onclick={fetchData}
            class="text-[13px] px-4 py-2 rounded-sm font-medium cursor-pointer border-none"
            style="background:var(--accent-surface); color:var(--accent)"
        >
            Retry
        </button>
    </div>
{:else if loadStatus === "transitioning" || loadStatus === "ready"}
    <!-- ─── Plate shell ───────────────────────────────────────────────────── -->
    <div class="plate plate-enter">
        <Topbar />

        <div class="plate-body">
            <OperatePanel />

            <!-- Stage -->
            <div class="plate-stage">
                <div
                    class="fig-canvas"
                    bind:clientWidth={containerWidth}
                    bind:clientHeight={containerHeight}
                >
                    <Lattice
                        positions={latticePositions}
                        width={containerWidth}
                        height={containerHeight}
                        {entryAnimating}
                    />

                    <!-- Hover tooltip (bottom-center of canvas) -->
                    {#if dashboardState.hoveredId !== null && dashboardState.snap.qubits[dashboardState.hoveredId]}
                        {@const q =
                            dashboardState.snap.qubits[
                                dashboardState.hoveredId
                            ]}
                        <div class="tooltip">
                            <span class="tooltip-id font-mono"
                                >Q{String(dashboardState.hoveredId).padStart(
                                    3,
                                    "0",
                                )}</span
                            >
                            <div class="tooltip-divider"></div>
                            <div class="tooltip-row">
                                <span class="tooltip-lbl">T₁</span>
                                <span class="tooltip-val font-mono"
                                    >{q.T1 == null
                                        ? "—"
                                        : `${q.T1.toFixed(0)} μs`}</span
                                >
                            </div>
                            <div class="tooltip-row">
                                <span class="tooltip-lbl">T₂</span>
                                <span class="tooltip-val font-mono"
                                    >{q.T2 == null
                                        ? "—"
                                        : `${q.T2.toFixed(0)} μs`}</span
                                >
                            </div>
                            <div class="tooltip-row">
                                <span class="tooltip-lbl">RO</span>
                                <span class="tooltip-val font-mono"
                                    >{q.readout_error == null
                                        ? "—"
                                        : `${(q.readout_error * 100).toFixed(2)}%`}</span
                                >
                            </div>
                            <div class="tooltip-divider"></div>
                            <div class="tooltip-row">
                                <span class="tooltip-lbl">P0|1</span>
                                <span class="tooltip-val font-mono"
                                    >{q.p01 == null
                                        ? "—"
                                        : `${(q.p01 * 100).toFixed(2)}%`}</span
                                >
                            </div>
                            <div class="tooltip-row">
                                <span class="tooltip-lbl">P1|0</span>
                                <span class="tooltip-val font-mono"
                                    >{q.p10 == null
                                        ? "—"
                                        : `${(q.p10 * 100).toFixed(2)}%`}</span
                                >
                            </div>
                        </div>
                    {/if}
                </div>
            </div>

            <ReadPanel />
        </div>
    </div>
{/if}

<style>
    /* ─── Plate entry animation (keyframes in motion.css) ────────────── */
    .plate-enter {
        animation: plate-fade-in var(--dur-base) var(--ease-standard) both;
    }

    /* ─── Hover tooltip ──────────────────────────────────────────────── */
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

    /* ─── Loader → app handoff (bar-pulse keyframes in motion.css;
       reduced-motion handled by the global rule there) ──────────────── */
    .loader-bar-wrap {
        width: 14rem;
        transition: width var(--dur-base) var(--ease-in-out);
    }
    .loader-track {
        transition:
            background-color var(--dur-ui) ease-out,
            border-radius var(--dur-ui) ease-out;
    }
    .loader-label,
    .loader-meta {
        transition: opacity var(--dur-fast) ease-out;
    }
    .loader-overlay {
        transition: opacity var(--dur-ui) ease-out var(--dur-ui);
    }
    .loader-overlay.transitioning {
        opacity: 0;
        pointer-events: none;
    }
    .loader-overlay.transitioning .loader-bar-wrap {
        width: 100vw;
    }
    .loader-overlay.transitioning .loader-track {
        background-color: transparent;
        border-radius: 0;
        overflow: visible;
    }
    .loader-overlay.transitioning .loader-fill {
        animation: bar-pulse var(--dur-base) var(--ease-standard) both;
    }
    .loader-overlay.transitioning .loader-label,
    .loader-overlay.transitioning .loader-meta {
        opacity: 0;
    }
</style>
