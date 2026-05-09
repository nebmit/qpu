<script lang="ts">
    import type { UiQubit, UiEdge } from '$lib/types';

    let { qubit, edges, onClose } = $props<{
        qubit: UiQubit;
        edges: UiEdge[];
        onClose: () => void;
    }>();

    let qubitId = $derived(qubit.id);
    let connEdges = $derived(
        edges.filter((e: UiEdge) => e.source === qubitId || e.target === qubitId),
    );

    const formatPercent = (val: number | null) => {
        if (val == null) return "—";
        return `${(val * 100).toFixed(2)}%`;
    };
</script>

<div
    class="absolute top-4 left-4 w-64 bg-[#f2f0eb]/95 border border-(--border-mid) rounded-[10px] py-4.5 px-5 z-100 shadow-[0_8px_32px_rgba(0,0,0,0.1)] backdrop-blur-[20px] animate-[fadeIn_0.2s_ease_forwards]"
>
    <div class="flex justify-between items-start mb-[14px]">
        <div>
            <div class="font-mono text-[22px] font-normal text-(--text) leading-none">
                Q{String(qubitId).padStart(3, "0")}
            </div>
            <div class="text-[11.5px] text-(--text-3) mt-1">
                {connEdges.length} connection{connEdges.length !== 1 ? "s" : ""}
            </div>
        </div>
        <button
            onclick={onClose}
            class="bg-transparent border-none text-(--text-3) cursor-pointer text-[20px] leading-none py-0.5 px-1"
            >×</button
        >
    </div>
    <div class="flex justify-between items-baseline py-1.75 border-b border-black/5">
        <span class="text-[12px] text-(--text-2)">T₁</span>
        <span class="font-mono text-[13px] text-(--text)"
            >{qubit.T1 == null ? "—" : `${qubit.T1.toFixed(1)} μs`}</span
        >
    </div>
    <div class="flex justify-between items-baseline py-1.75 border-b border-black/5">
        <span class="text-[12px] text-(--text-2)">T₂</span>
        <span class="font-mono text-[13px] text-(--text)"
            >{qubit.T2 == null ? "—" : `${qubit.T2.toFixed(1)} μs`}</span
        >
    </div>
    <div class="flex justify-between items-baseline py-1.75 border-b border-black/5">
        <span class="text-[12px] text-(--text-2)">Readout error</span>
        <span class="font-mono text-[13px] text-(--text)">{formatPercent(qubit.readout_error)}</span>
    </div>
    <div class="flex justify-between items-baseline py-1.75 border-b border-black/5">
        <span class="text-[12px] text-(--text-2)">P0 | 1</span>
        <span class="font-mono text-[13px] text-(--text)">{formatPercent(qubit.p01)}</span>
    </div>
    <div class="flex justify-between items-baseline py-1.75 border-b border-black/5">
        <span class="text-[12px] text-(--text-2)">P1 | 0</span>
        <span class="font-mono text-[13px] text-(--text)">{formatPercent(qubit.p10)}</span>
    </div>
    {#if connEdges.length > 0}
        <div class="mt-3.25 mb-1.75 text-[11px] text-(--text-3) tracking-[0.06em] uppercase font-medium">
            CX Gate Errors
        </div>
        {#each connEdges as e}
            {@const nb = e.source === qubitId ? e.target : e.source}
            <div class="flex justify-between items-baseline py-1.25 border-b border-black/5">
                <span class="text-[12px] text-(--text-3) font-mono">↔ Q{nb}</span>
                <span class="font-mono text-[13px] text-(--text)"
                    >{e.cx_error == null ? "—" : e.cx_error.toExponential(2)}</span
                >
            </div>
        {/each}
    {/if}
</div>
