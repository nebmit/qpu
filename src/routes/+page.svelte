<script lang="ts">
    import { onMount } from "svelte";
    import { Tween } from "svelte/motion";
    import { SvelteURLSearchParams } from "svelte/reactivity";
    import { replaceState } from "$app/navigation";
    import { resolve } from "$app/paths";
    import { DUR, ease } from "$lib/viz/motion";
    import Topbar from "$lib/components/Topbar.svelte";
    import OperatePanel from "$lib/components/OperatePanel.svelte";
    import ReadPanel from "$lib/components/ReadPanel.svelte";
    import Lattice from "$lib/components/Lattice.svelte";
    import CommandPalette from "$lib/components/CommandPalette.svelte";
    import { dashboardState } from "$lib/state/dashboard.svelte";
    import { BASE_POS } from "$lib/domain/lattice";
    import type { MetricMode, Positions } from "$lib/types";
    import type { Topology } from "$lib/domain/cluster";
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
            applyUrlState();
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

    // ── Shareable URL state ────────────────────────────────────────────
    const TOPOLOGY_VALUES: Topology[] = ["compact", "linear", "branched"];
    const METRIC_VALUES: MetricMode[] = ["readout", "T1", "T2", "stability"];

    function applyUrlState() {
        const params = new URLSearchParams(window.location.search);
        if ([...params.keys()].length === 0) return;
        const num = (key: string) => {
            const v = params.get(key);
            if (v == null) return null;
            const n = Number(v);
            return Number.isFinite(n) ? n : null;
        };
        const clamp = (v: number, lo: number, hi: number) =>
            Math.min(hi, Math.max(lo, v));

        const dev = params.get("dev");
        if (dev && dashboardState.devices.includes(dev))
            dashboardState.setDevice(dev);
        const ro = num("ro");
        if (ro != null) dashboardState.errorCutoffs.readoutPct = clamp(ro, 0, 100);
        const tq = num("2q");
        if (tq != null) dashboardState.errorCutoffs.twoqPct = clamp(tq, 0, 100);
        const t1 = num("t1");
        if (t1 != null) dashboardState.coherenceCutoffs.minT1 = clamp(t1, 0, 500);
        const t2 = num("t2");
        if (t2 != null) dashboardState.coherenceCutoffs.minT2 = clamp(t2, 0, 500);
        const n = num("n");
        if (n != null) dashboardState.clusterSize = clamp(Math.round(n), 2, 50);
        const topo = params.get("topo") as Topology | null;
        if (topo && TOPOLOGY_VALUES.includes(topo)) dashboardState.topology = topo;
        const m = params.get("m") as MetricMode | null;
        if (m && METRIC_VALUES.includes(m)) dashboardState.metricMode = m;
        const t = num("t");
        if (t != null) dashboardState.jumpToSnapshot(Math.round(t));
        const cl = params.get("cl");
        if (cl) {
            const ids = cl
                .split(",")
                .map(Number)
                .filter((x) => Number.isInteger(x) && x >= 0);
            const valid = [...new Set(ids)].filter((id) =>
                dashboardState.allowedQubitIds.has(id),
            );
            if (valid.length >= 2) {
                dashboardState.cluster = valid;
                dashboardState.clusterRequested = valid.length;
                dashboardState.findFailed = false;
            }
        }
    }

    $effect(() => {
        if (loadStatus !== "ready") return;
        const params = new SvelteURLSearchParams();
        params.set("dev", dashboardState.device);
        params.set("t", String(dashboardState.timeIdx));
        params.set("ro", String(dashboardState.errorCutoffs.readoutPct));
        params.set("2q", String(dashboardState.errorCutoffs.twoqPct));
        params.set("t1", String(dashboardState.coherenceCutoffs.minT1));
        params.set("t2", String(dashboardState.coherenceCutoffs.minT2));
        params.set("n", String(dashboardState.clusterSize));
        params.set("topo", dashboardState.topology);
        params.set("m", dashboardState.metricMode);
        if (dashboardState.cluster.length)
            params.set("cl", dashboardState.cluster.join(","));
        const qs = `?${params.toString()}`;
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

    // ── Keyboard layer: Esc to back out, single-key accelerators ──────
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

    function stepSnapshot(dir: number) {
        // Mirrors range input: changing snapshot clears the cluster.
        const next = dashboardState.timeIdx + dir;
        if (next < 0 || next > dashboardState.timeCount - 1) return;
        dashboardState.isPlaying = false;
        dashboardState.timeIdx = next;
        dashboardState.clearCluster();
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
        if (paletteOpen || isEditableTarget(e) || e.metaKey || e.ctrlKey || e.altKey)
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
            stepSnapshot(-1);
        } else if (e.key === "]") {
            e.preventDefault();
            stepSnapshot(1);
        }
    }
</script>

<svelte:window onkeydown={onWindowKeydown} />

<!-- ─── Loading overlay ──────────────────────────────────────────────── -->
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
                        {bytesTotal
                            ? Math.round((bytesReceived / bytesTotal) * 100)
                            : Math.round(smoothProgress.current * 100)}%
                    </span>
                </div>
            </div>
        </div>
    </div>
{/if}

<!-- ─── Error state ──────────────────────────────────────────────────── -->
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
    <!-- ─── Plate shell ───────────────────────────────────────────────────── -->
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

                    <!-- Current snapshot date while the timeline plays -->
                    {#if dashboardState.isPlaying}
                        <div class="play-chip font-mono" aria-live="polite">
                            {dashboardState.snap.date}
                        </div>
                    {/if}

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
                                    >Q{String(he.source).padStart(
                                        3,
                                        "0",
                                    )} ↔ Q{String(he.target).padStart(
                                        3,
                                        "0",
                                    )}</span
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

            <!-- Mobile bottom nav -->
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
            <!-- Pointer-only dismiss layer; Esc handles keyboard dismissal -->
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
    /* ─── Plate entry animation (keyframes in motion.css) ────────────── */
    .plate-enter {
        animation: plate-fade-in var(--dur-base) var(--ease-standard) both;
    }

    /* ─── Playback date chip ─────────────────────────────────────────── */
    .play-chip {
        position: absolute;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        z-index: var(--z-stage-ui);
        background: var(--surface);
        border: 1px solid var(--border-mid);
        border-radius: 99px;
        padding: 4px 13px;
        font-size: 11.5px;
        color: var(--text-2);
        box-shadow: var(--shadow-panel);
        pointer-events: none;
        animation: fadeIn var(--dur-fast) var(--ease-out) both;
    }

    /* ─── Hover tooltip ──────────────────────────────────────────────── */
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

    /* ─── Loader → app handoff (bar-pulse keyframes in motion.css;
       reduced-motion handled by the global rule there) ──────────────── */
    .loader-bar-wrap {
        width: 14rem;
    }
    .loader-track {
        /* full-bleed stretch via transform (no layout work); --bar-scale is
           overlay-width / 14rem, computed inline on the overlay */
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
