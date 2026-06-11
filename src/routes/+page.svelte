<script lang="ts">
    import { onMount } from "svelte";
    import { Tween } from "svelte/motion";
    import { replaceState } from "$app/navigation";
    import { resolve } from "$app/paths";
    import { DUR, ease } from "$lib/viz/motion";
    import Topbar from "$lib/components/Topbar.svelte";
    import OperatePanel from "$lib/components/OperatePanel.svelte";
    import ReadPanel from "$lib/components/ReadPanel.svelte";
    import Lattice from "$lib/components/Lattice.svelte";
    import CommandPalette from "$lib/components/CommandPalette.svelte";
    import { dashboardState } from "$lib/state/dashboard.svelte";
    import { applyUrlState, serializeUrlQuery } from "$lib/state/url";
    import { BASE_POS } from "$lib/domain/lattice";
    import type { Positions } from "$lib/types";
    import { loadData } from "$lib/data/calibration";
    import { microseconds, percent, exponential } from "$lib/viz/format";

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
    let activeSheet = $state<"controls" | "results" | null>(null);
    let isMobile = $state(false);
    let mediaQuery: MediaQueryList | null = null;
    let paletteOpen = $state(false);
    let loaderWidth = $state(1280);

    const LOADER_EXIT_MS = 450;
    const ENTRY_SETTLE_MS = 1300;

    let hasResults = $derived(
        dashboardState.cluster.length > 0 || dashboardState.findFailed,
    );

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
                bytesReceived = recv;
                if (total !== null) {
                    bytesTotal = total;
                }
            });
            positionsByDevice = positions;
            dashboardState.applyDataset(dataset);
            applyUrlState(
                dashboardState,
                new URLSearchParams(window.location.search),
            );
            await smoothProgress.set(1);
            loadStatus = "transitioning";
            entryAnimating = true;
            setTimeout(() => {
                loadStatus = "ready";
            }, LOADER_EXIT_MS);
            setTimeout(() => {
                entryAnimating = false;
            }, ENTRY_SETTLE_MS);
        } catch (err) {
            console.error("Failed to load calibration data", err);
            loadError = err instanceof Error ? err.message : "Unknown error";
            loadStatus = "error";
        }
    }

    onMount(fetchData);

    function toggleSheet(which: "controls" | "results") {
        activeSheet = activeSheet === which ? null : which;
    }

    function closeSheet() {
        activeSheet = null;
    }

    onMount(() => {
        mediaQuery = window.matchMedia("(max-width: 767px)");
        isMobile = mediaQuery.matches;
        const handle = (e: MediaQueryListEvent) => {
            isMobile = e.matches;
            if (!e.matches) closeSheet();
        };
        mediaQuery.addEventListener("change", handle);
        return () => mediaQuery?.removeEventListener("change", handle);
    });

    $effect(() => {
        if (loadStatus !== "ready") return;
        if (dashboardState.isPlaying) return;
        const qs = serializeUrlQuery(dashboardState);
        const timer = setTimeout(() => {
            try {
                // eslint-disable-next-line svelte/no-navigation-without-resolve -- query-string-only update of the current route; resolve() produces pathnames and cannot carry a query
                replaceState(resolve("/") + qs, {});
            } catch {
                history.replaceState(history.state, "", qs);
            }
        }, 250);
        return () => clearTimeout(timer);
    });

    function isEditableTarget(e: KeyboardEvent) {
        const t = e.target as HTMLElement | null;
        if (!t) return false;
        return (
            t.tagName === "INPUT" ||
            t.tagName === "SELECT" ||
            t.tagName === "TEXTAREA" ||
            t.isContentEditable
        );
    }

    function onWindowKeydown(e: KeyboardEvent) {
        if (loadStatus !== "ready") return;
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
            if (!isMobile) {
                e.preventDefault();
                paletteOpen = !paletteOpen;
            }
            return;
        }
        if (e.key === "Escape") {
            if (paletteOpen) {
                paletteOpen = false;
            } else if (activeSheet !== null) {
                closeSheet();
            } else if (dashboardState.selectedId !== null) {
                dashboardState.selectedId = null;
            }
            return;
        }
        if (
            paletteOpen ||
            isEditableTarget(e) ||
            e.metaKey ||
            e.ctrlKey ||
            e.altKey
        )
            return;
        const k = e.key.toLowerCase();
        if (k === "f") {
            e.preventDefault();
            if (dashboardState.totalConnections > 0)
                dashboardState.runFindCluster();
        } else if (k === "m") {
            e.preventDefault();
            dashboardState.cycleMetric();
        } else if (e.key === "[") {
            e.preventDefault();
            dashboardState.stepSnapshot(-1);
        } else if (e.key === "]") {
            e.preventDefault();
            dashboardState.stepSnapshot(1);
        }
    }
</script>

<svelte:window onkeydown={onWindowKeydown} />

{#if loadStatus === "loading" || loadStatus === "transitioning"}
    <div
        class="loader-overlay fixed inset-0 z-(--z-loader) flex flex-col items-center justify-center gap-6 bg-(--bg)"
        class:transitioning={loadStatus === "transitioning"}
        bind:clientWidth={loaderWidth}
        style="--bar-scale: {(loaderWidth / 224).toFixed(3)}"
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
                        class:indeterminate={bytesTotal === null &&
                            bytesReceived > 0}
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
                        {bytesReceived < 1e6
                            ? `${Math.round(bytesReceived / 1e3)} KB`
                            : `${(bytesReceived / 1e6).toFixed(1)} MB`}{bytesTotal
                            ? ` / ${(bytesTotal / 1e6).toFixed(1)} MB`
                            : ""}
                    </span>
                    <span
                        class="text-[11px] font-mono"
                        style="color:var(--text-3)"
                    >
                        {#if bytesTotal === null}
                            —
                        {:else}
                            {Math.round((bytesReceived / bytesTotal) * 100)}%
                        {/if}
                    </span>
                </div>
            </div>
        </div>
    </div>
{/if}

{#if loadStatus === "error"}
    <div
        class="fade-in fixed inset-0 z-(--z-loader) flex flex-col items-center justify-center bg-(--bg)"
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
    <div class="plate plate-enter">
        <Topbar onOpenPalette={() => (paletteOpen = true)} />

        <div class="plate-body">
            <OperatePanel
                mobileOpen={activeSheet === "controls"}
                onClose={closeSheet}
                onFind={() => {
                    if (isMobile) {
                        setTimeout(() => {
                            activeSheet = "results";
                        }, 220);
                    }
                }}
            />

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
                                    >{microseconds(q.T1, 1)}</span
                                >
                            </div>
                            <div class="tooltip-row">
                                <span class="tooltip-lbl">T₂</span>
                                <span class="tooltip-val font-mono"
                                    >{microseconds(q.T2, 1)}</span
                                >
                            </div>
                            <div class="tooltip-row">
                                <span class="tooltip-lbl">RO</span>
                                <span class="tooltip-val font-mono"
                                    >{percent(q.readout_error, 2)}</span
                                >
                            </div>
                            <div class="tooltip-divider"></div>
                            <div class="tooltip-row">
                                <span class="tooltip-lbl">P0|1</span>
                                <span class="tooltip-val font-mono"
                                    >{percent(q.p01, 2)}</span
                                >
                            </div>
                            <div class="tooltip-row">
                                <span class="tooltip-lbl">P1|0</span>
                                <span class="tooltip-val font-mono"
                                    >{percent(q.p10, 2)}</span
                                >
                            </div>
                        </div>
                    {:else if dashboardState.hoveredEdge}
                        {@const he = dashboardState.hoveredEdge}
                        {@const edge = dashboardState.filteredEdges.find(
                            (e) =>
                                e.source === he.source &&
                                e.target === he.target,
                        )}
                        {#if edge}
                            <div class="tooltip">
                                <span class="tooltip-id font-mono"
                                    >Q{String(he.source).padStart(3, "0")} ↔ Q{String(
                                        he.target,
                                    ).padStart(3, "0")}</span
                                >
                                <div class="tooltip-divider"></div>
                                <div class="tooltip-row">
                                    <span class="tooltip-lbl">2Q gate err</span>
                                    <span class="tooltip-val font-mono"
                                        >{exponential(edge.twoq_error, 2)}</span
                                    >
                                </div>
                            </div>
                        {/if}
                    {/if}
                </div>
            </div>

            <ReadPanel
                mobileOpen={activeSheet === "results"}
                onClose={closeSheet}
            />

            <nav class="mob-nav" aria-label="Navigation">
                <button
                    class="mob-tab"
                    class:on={activeSheet === "controls"}
                    onclick={() => toggleSheet("controls")}
                    aria-label="Controls"
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.7"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                    >
                        <path d="M4 6h16M4 12h10M4 18h7" />
                        <circle cx="18" cy="12" r="2.5" />
                        <circle cx="14" cy="18" r="2.5" />
                    </svg>
                    <span>Controls</span>
                </button>
                <button
                    class="mob-tab"
                    class:on={activeSheet === "results"}
                    onclick={() => toggleSheet("results")}
                    aria-label="Results"
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.7"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true"
                    >
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 8v4l2.5 2.5" />
                    </svg>
                    <span>Results</span>
                    <span class="mob-badge" class:show={hasResults}></span>
                </button>
            </nav>
            <div
                class="mob-backdrop"
                class:show={activeSheet !== null}
                onclick={closeSheet}
                aria-hidden="true"
            ></div>
        </div>
    </div>

    <CommandPalette bind:open={paletteOpen} />
{/if}

<style>
    .plate-enter {
        animation: plate-fade-in var(--dur-base) var(--ease-standard) both;
    }

    @keyframes tip-in {
        from {
            opacity: 0;
            transform: translate(-50%, 4px);
        }
        to {
            opacity: 1;
            transform: translate(-50%, 0);
        }
    }
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
        z-index: var(--z-tooltip);
        animation: tip-in var(--dur-fast) var(--ease-out) both;
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

    @media (max-width: 767px) {
        .tooltip {
            bottom: auto;
            top: 12px;
        }
    }

    .loader-bar-wrap {
        width: 14rem;
    }
    @keyframes indeterminate-slide {
        0% {
            transform: translateX(-100%);
        }
        100% {
            transform: translateX(calc(100% / 0.3));
        }
    }
    .loader-fill.indeterminate {
        width: 30% !important;
        animation: indeterminate-slide 1.4s var(--ease-in-out, ease-in-out)
            infinite;
    }
    .loader-track {
        transform-origin: center;
        transition:
            transform var(--dur-base) var(--ease-in-out),
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
    .loader-overlay.transitioning .loader-track {
        transform: scaleX(var(--bar-scale, 6));
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
