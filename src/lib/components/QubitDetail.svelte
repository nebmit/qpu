<script lang="ts">
    import type { UiQubit, UiEdge } from "$lib/types";

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

<div class="panel animate-[fadeIn_0.2s_ease_forwards]">
    <div class="panel-header">
        <div>
            <div class="qubit-id font-mono">Q{String(qubitId).padStart(3, "0")}</div>
            <div class="conn-count">
                <span class="conn-pill">{connEdges.length}</span>
                connection{connEdges.length !== 1 ? "s" : ""}
            </div>
        </div>
        <button onclick={onClose} class="close-btn" aria-label="Close">×</button>
    </div>

    <div class="rows">
        <div class="row">
            <span class="row-label">T₁</span>
            <span class="row-value font-mono">{qubit.T1 == null ? "—" : `${qubit.T1.toFixed(1)} μs`}</span>
        </div>
        <div class="row">
            <span class="row-label">T₂</span>
            <span class="row-value font-mono">{qubit.T2 == null ? "—" : `${qubit.T2.toFixed(1)} μs`}</span>
        </div>
        <div class="row">
            <span class="row-label">Readout error</span>
            <span class="row-value font-mono">{formatPercent(qubit.readout_error)}</span>
        </div>
        <div class="row">
            <span class="row-label">P0 | 1</span>
            <span class="row-value font-mono">{formatPercent(qubit.p01)}</span>
        </div>
        <div class="row last">
            <span class="row-label">P1 | 0</span>
            <span class="row-value font-mono">{formatPercent(qubit.p10)}</span>
        </div>
    </div>

    {#if connEdges.length > 0}
        <div class="cx-header">CX Gate Errors</div>
        {#each connEdges as e (e.source + '-' + e.target)}
            {@const nb = e.source === qubitId ? e.target : e.source}
            <div class="row {connEdges.indexOf(e) === connEdges.length - 1 ? 'last' : ''}">
                <span class="row-label font-mono">↔ Q{nb}</span>
                <span class="row-value font-mono">
                    {e.cx_error == null ? "—" : e.cx_error.toExponential(2)}
                </span>
            </div>
        {/each}
    {/if}
</div>

<style>
    .panel {
        position: absolute;
        top: 16px;
        left: 16px;
        width: 256px;
        background: var(--surface);
        border: 1px solid var(--border-mid);
        border-radius: var(--radius-md);
        padding: 16px 18px;
        z-index: 100;
        box-shadow: var(--shadow-pop);
        backdrop-filter: blur(20px);
    }

    .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 14px;
    }

    .qubit-id {
        font-size: 22px;
        font-weight: 400;
        color: var(--text);
        line-height: 1;
    }

    .conn-count {
        font-size: 11.5px;
        color: var(--text-3);
        margin-top: 4px;
        display: flex;
        align-items: center;
        gap: 5px;
    }
    .conn-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 18px;
        height: 18px;
        padding: 0 5px;
        border-radius: 99px;
        background: var(--accent-surface);
        color: var(--accent);
        font-size: 10.5px;
        font-weight: 500;
        line-height: 1;
    }

    .close-btn {
        background: transparent;
        border: none;
        color: var(--text-3);
        cursor: pointer;
        font-size: 20px;
        line-height: 1;
        padding: 2px 4px;
        border-radius: 4px;
        transition: color 0.12s, background 0.12s;
    }
    .close-btn:hover { color: var(--text-2); background: var(--border); }

    .rows { margin-bottom: 2px; }

    .row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        padding: 6px 0;
        border-bottom: 1px solid var(--border);
    }
    .row.last { border-bottom: none; }

    .row-label {
        font-size: 12px;
        color: var(--text-2);
    }
    .row-value {
        font-size: 13px;
        color: var(--text);
    }

    .cx-header {
        font-size: 10.5px;
        color: var(--text-3);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        font-weight: 500;
        padding-top: 10px;
        margin-bottom: 2px;
        border-top: 1px solid var(--border);
    }
</style>
