<script lang="ts">
    import { dashboardState } from "$lib/state.svelte";

    const METRICS = [
        { k: "readout", l: "Readout" },
        { k: "T1", l: "T₁" },
        { k: "T2", l: "T₂" },
    ] as const;
</script>

<div
    class="h-11.5 shrink-0 bg-(--bg) border-b border-(--border) flex items-center px-4 gap-1"
>
    <div class="flex gap-0.5">
        {#each METRICS as m}
            <button
                class="m-tab {dashboardState.metricMode === m.k
                    ? 'active'
                    : ''}"
                onclick={() => (dashboardState.metricMode = m.k)}
            >
                {m.l}
            </button>
        {/each}
    </div>

    <div class="flex-1"></div>

    <!-- Device stats -->
    <div class="flex gap-5.5 items-center">
        <div class="flex flex-col gap-px items-end">
            <span class="text-[9.5px] text-(--text-3) tracking-[0.06em] uppercase">T₁</span>
            <span class="font-mono text-[13px] text-(--text-2) leading-none">
                {dashboardState.stats.T1}{#if dashboardState.stats.T1 !== "—"}<span
                        class="text-[9.5px] ml-0.5 text-(--text-3)">μs</span
                    >{/if}
            </span>
        </div>
        <div class="flex flex-col gap-px items-end">
            <span class="text-[9.5px] text-(--text-3) tracking-[0.06em] uppercase">T₂</span>
            <span class="font-mono text-[13px] text-(--text-2) leading-none">
                {dashboardState.stats.T2}{#if dashboardState.stats.T2 !== "—"}<span
                        class="text-[9.5px] ml-0.5 text-(--text-3)">μs</span
                    >{/if}
            </span>
        </div>
        <div class="flex flex-col gap-px items-end">
            <span class="text-[9.5px] text-(--text-3) tracking-[0.06em] uppercase">Readout</span>
            <span class="font-mono text-[13px] text-(--text-2) leading-none">
                {dashboardState.stats.ro}{#if dashboardState.stats.ro !== "—"}%{/if}
            </span>
        </div>
        <div class="flex flex-col gap-px items-end">
            <span class="text-[9.5px] text-(--text-3) tracking-[0.06em] uppercase">CX</span>
            <span class="font-mono text-[13px] text-(--text-2) leading-none">
                {dashboardState.stats.cx}
            </span>
        </div>

        <div class="w-px h-4.5 bg-(--border)"></div>
        <span class="text-[11px] font-mono text-(--text-3)"
            >{dashboardState.stats.qubitsCount}Q · {dashboardState.stats.edgesCount}E</span
        >
    </div>
</div>

<style>
    .m-tab {
        padding: 5px 13px; border-radius: 5px; font-size: 12px;
        cursor: pointer; border: none; background: transparent;
        color: var(--text-3); transition: all 0.12s;
        font-family: var(--font-sans); font-weight: 400;
    }
    .m-tab:hover  { color: var(--text-2); }
    .m-tab.active { color: var(--text); background: rgba(0,0,0,0.07); }
</style>
