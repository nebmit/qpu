<script lang="ts">
    import { dashboardState } from "$lib/state/dashboard.svelte";
    import QubitInspector from "$lib/components/read/QubitInspector.svelte";
    import ClusterFailure from "$lib/components/read/ClusterFailure.svelte";
    import ClusterResult from "$lib/components/read/ClusterResult.svelte";
    import ReadFooter from "$lib/components/read/ReadFooter.svelte";

    let { mobileOpen = false, onClose } = $props<{
        mobileOpen?: boolean;
        onClose?: () => void;
    }>();

    // Mirrors the inspector's own guard so the shell picks exactly one view.
    let inspecting = $derived(
        dashboardState.selectedId !== null &&
            dashboardState.snap.qubits[dashboardState.selectedId] != null,
    );
</script>

<aside class="plate-read" class:mob-open={mobileOpen}>
    <button
        type="button"
        class="sheet-handle"
        onclick={onClose}
        aria-label="Close results"
    >
        <span class="sheet-handle-bar"></span>
    </button>

    {#if inspecting}
        <QubitInspector />
    {:else if dashboardState.findFailed}
        <ClusterFailure />
    {:else if dashboardState.clusterStats}
        <ClusterResult stats={dashboardState.clusterStats} />
    {:else}
        <div>
            <div class="eyebrow mb">Inspector</div>
            <div class="insp-empty">
                Hover a qubit for a quick read, click it for the full
                calibration record. Set the filters on the left and
                <b>find a cluster</b>.
            </div>
        </div>
    {/if}

    <ReadFooter />
</aside>

<style>
    .insp-empty {
        font-size: 13.5px;
        color: var(--text-3);
        line-height: 1.7;
    }
    .insp-empty b {
        color: var(--text-2);
        font-weight: 500;
    }
</style>
