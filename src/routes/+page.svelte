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
    import LoadingOverlay from "$lib/components/shell/LoadingOverlay.svelte";
    import ErrorScreen from "$lib/components/shell/ErrorScreen.svelte";
    import HoverTooltip from "$lib/components/shell/HoverTooltip.svelte";
    import MobileNav from "$lib/components/shell/MobileNav.svelte";
    import { dashboardState } from "$lib/state/dashboard.svelte";
    import { applyUrlState, serializeUrlQuery } from "$lib/state/url";
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
    let activeSheet = $state<"controls" | "results" | null>(null);
    let isMobile = $state(false);
    let mediaQuery: MediaQueryList | null = null;
    let paletteOpen = $state(false);

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
    <LoadingOverlay
        progress={smoothProgress.current}
        {bytesReceived}
        {bytesTotal}
        transitioning={loadStatus === "transitioning"}
    />
{/if}

{#if loadStatus === "error"}
    <ErrorScreen message={loadError} onRetry={fetchData} />
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

                    <HoverTooltip />
                </div>
            </div>

            <ReadPanel
                mobileOpen={activeSheet === "results"}
                onClose={closeSheet}
            />

            <MobileNav
                {activeSheet}
                {hasResults}
                onToggle={toggleSheet}
                onClose={closeSheet}
            />
        </div>
    </div>

    <CommandPalette bind:open={paletteOpen} />
{/if}

<style>
    .plate-enter {
        animation: plate-fade-in var(--dur-base) var(--ease-standard) both;
    }
</style>
