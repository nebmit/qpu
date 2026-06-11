<script lang="ts">
    import { dashboardState } from "$lib/state/dashboard.svelte";
    import { microseconds, percent, exponential } from "$lib/viz/format";
</script>

{#if dashboardState.hoveredId !== null && dashboardState.snap.qubits[dashboardState.hoveredId]}
    {@const q = dashboardState.snap.qubits[dashboardState.hoveredId]}
    <div class="tooltip">
        <span class="tooltip-id font-mono"
            >Q{String(dashboardState.hoveredId).padStart(3, "0")}</span
        >
        <div class="tooltip-divider"></div>
        <div class="tooltip-row">
            <span class="tooltip-lbl">T₁</span>
            <span class="tooltip-val font-mono">{microseconds(q.T1, 1)}</span>
        </div>
        <div class="tooltip-row">
            <span class="tooltip-lbl">T₂</span>
            <span class="tooltip-val font-mono">{microseconds(q.T2, 1)}</span>
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
            <span class="tooltip-val font-mono">{percent(q.p01, 2)}</span>
        </div>
        <div class="tooltip-row">
            <span class="tooltip-lbl">P1|0</span>
            <span class="tooltip-val font-mono">{percent(q.p10, 2)}</span>
        </div>
    </div>
{:else if dashboardState.hoveredEdge}
    {@const he = dashboardState.hoveredEdge}
    {@const edge = dashboardState.filteredEdges.find(
        (e) => e.source === he.source && e.target === he.target,
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

<style>
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
</style>
