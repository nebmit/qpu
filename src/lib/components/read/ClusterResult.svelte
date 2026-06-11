<script lang="ts">
    import { flip } from "svelte/animate";
    import { DUR, ease, prefersReducedMotion } from "$lib/viz/motion";
    import { dashboardState } from "$lib/state/dashboard.svelte";
    import { microseconds, percent, exponential, deltaLabel } from "$lib/viz/format";

    let { stats } = $props<{
        stats: NonNullable<ReturnType<typeof dashboardState.statsFor>>;
    }>();

    let requestedSize = $derived(
        dashboardState.clusterRequested > 0
            ? dashboardState.clusterRequested
            : dashboardState.cluster.length,
    );

    let isPartial = $derived(
        dashboardState.cluster.length > 0 &&
            requestedSize > dashboardState.cluster.length,
    );

    let timelineAbove = $derived(
        dashboardState.clusterTimeline.filter(
            (p) => p.cluster != null && p.cluster >= p.device,
        ).length,
    );
    let onLatestSnapshot = $derived(
        dashboardState.timeIdx >= dashboardState.timeCount - 1,
    );
</script>

{#snippet metricRows(cs: NonNullable<ReturnType<typeof dashboardState.statsFor>>)}
    <div class="cr-metrics">
        {#each [{ l: "T₁", v: microseconds(cs.T1, 0), d: cs.deltaT1 }, { l: "T₂", v: microseconds(cs.T2, 0), d: cs.deltaT2 }, { l: "Readout err", v: percent(cs.ro, 2), d: cs.deltaRo }, { l: "2Q gate err", v: cs.twoq != null ? exponential(cs.twoq, 2) : "—", d: cs.deltaTwoq }] as row, i (row.l)}
            <div class="cr-mrow" style="--i: {i}">
                <span class="cr-ml">{row.l}</span>
                <span class="cr-mv">{row.v}</span>
                {#if row.d}
                    <span
                        class="cr-delta"
                        class:up={row.d.dir === "up"}
                        class:down={row.d.dir === "down"}
                        class:flat={row.d.dir === "flat"}
                    >
                        {row.d.dir === "up"
                            ? "▲"
                            : row.d.dir === "down"
                              ? "▼"
                              : "—"}
                        {deltaLabel(row.d.magnitude)}
                    </span>
                {:else}
                    <span class="cr-delta flat">—</span>
                {/if}
            </div>
        {/each}
    </div>
{/snippet}

<div class="cr fade-in">
    <div class="cr-top">
        <span class="cr-eye"><span class="cr-dot"></span>Best cluster</span>
        <button
            class="cr-x"
            onclick={() => dashboardState.clearCluster()}
            title="Clear cluster"
            aria-label="Clear cluster"
        >
            <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
            >
                <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
        </button>
    </div>

    <div class="cr-hero">
        <span class="cr-n">{dashboardState.cluster.length}</span>
        <span class="cr-of">/ {requestedSize} Q</span>
        <span class="cr-topo">{dashboardState.topology}</span>
    </div>

    {#if isPartial}
        <div class="cr-warn">
            <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <path d="M8 2.2 1.6 13.4h12.8L8 2.2Z" />
                <path d="M8 6.4v3.1" />
                <circle
                    cx="8"
                    cy="11.4"
                    r="0.5"
                    fill="currentColor"
                    stroke="none"
                />
            </svg>
            <div class="cr-warn-tx">
                <b>{dashboardState.cluster.length} of {requestedSize}</b>
                qubits placed — the qualifying subgraph is fragmented. Loosen a filter
                or lower the size for a complete block.
            </div>
        </div>
    {/if}

    {@render metricRows(stats)}
    <div class="cr-vsmed">vs device median · ▲ = better</div>

    {#if dashboardState.clusterTimeline.length > 1}
        <div class="cr-time">
            <div class="cr-time-h">
                <span class="cr-mem-t">History</span>
                <span class="cr-mem-hint">
                    above median in {timelineAbove} of {dashboardState
                        .clusterTimeline.length}
                </span>
            </div>
            <div
                class="cr-bars"
                role="group"
                aria-label="Cluster quality across snapshots"
            >
                {#each dashboardState.clusterTimeline as pt, i (i)}
                    <button
                        class="cr-bar"
                        class:cur={i === dashboardState.timeIdx}
                        title={pt.date}
                        aria-label="View this cluster on {pt.date}"
                        onclick={() => dashboardState.jumpToSnapshot(i)}
                    >
                        <span
                            class="cr-bar-fill"
                            class:above={pt.cluster != null &&
                                pt.cluster >= pt.device}
                            style="height: {Math.max(
                                14,
                                (pt.cluster ?? 0) * 100,
                            )}%"
                        ></span>
                    </button>
                {/each}
            </div>
            {#if !onLatestSnapshot}
                <div class="cr-time-note">
                    viewing {dashboardState.snap.date} ·
                    <button
                        class="cr-time-latest"
                        onclick={() =>
                            dashboardState.jumpToSnapshot(
                                dashboardState.timeCount - 1,
                            )}
                    >
                        back to latest
                    </button>
                </div>
            {/if}
        </div>
    {/if}

    <div class="cr-mem">
        <div class="cr-mem-h">
            <span class="cr-mem-t">
                {dashboardState.cluster.length} members
            </span>
            <span class="cr-mem-hint">click to inspect →</span>
        </div>
        <div class="cr-chips">
            {#each dashboardState.cluster as id (id)}
                <button
                    class="qchip"
                    class:on={dashboardState.selectedId === id}
                    animate:flip={{
                        duration: prefersReducedMotion.current ? 0 : DUR.ui,
                        easing: ease,
                    }}
                    onclick={() => (dashboardState.selectedId = id)}
                >
                    Q{id}
                </button>
            {/each}
        </div>
    </div>
</div>

<style>
    .cr {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-panel);
        overflow: hidden;
    }
    .cr-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 13px 16px 0;
    }
    .cr-eye {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        font-size: 11.5px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--accent);
        font-weight: 600;
    }
    .cr-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--accent);
        box-shadow: 0 0 0 3px color-mix(in oklch, var(--accent) 22%, transparent);
        animation: dot-pulse 0.9s var(--ease-standard) both;
    }
    .cr-x {
        width: 22px;
        height: 22px;
        border-radius: var(--radius-sm);
        border: 1px solid transparent;
        background: transparent;
        color: var(--text-3);
        cursor: pointer;
        display: grid;
        place-items: center;
        transition: all var(--dur-fast);
    }
    .cr-x:hover {
        color: var(--text);
        background: var(--read-bg);
        border-color: var(--border);
    }
    .cr-x svg {
        width: 12px;
        height: 12px;
    }
    .cr-x:disabled {
        opacity: 0.3;
        cursor: default;
    }

    .cr-hero {
        padding: 8px 16px 16px;
        display: flex;
        align-items: baseline;
        gap: 9px;
    }
    .cr-n {
        font-size: 38px;
        font-weight: 500;
        color: var(--text);
        line-height: 0.9;
        font-family: var(--font-mono);
        letter-spacing: -0.02em;
    }
    .cr-of {
        font-size: 14px;
        color: var(--text-3);
        font-family: var(--font-mono);
    }
    .cr-topo {
        margin-left: auto;
        align-self: center;
        font-size: 11.5px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        color: var(--text-2);
        background: var(--read-bg);
        border: 1px solid var(--border);
        border-radius: 99px;
        padding: 3px 9px;
        font-weight: 500;
    }

    .cr-metrics {
        padding: 0 16px;
    }
    .cr-mrow {
        display: grid;
        grid-template-columns: 1fr auto auto;
        align-items: baseline;
        gap: 10px;
        padding: 8px 0;
        border-top: 1px solid var(--border);
        animation: fadeIn var(--dur-base) var(--ease-out) both;
        animation-delay: calc(var(--i, 0) * 40ms);
    }
    .cr-mrow:first-child {
        border-top: none;
    }
    .cr-ml {
        font-size: 13px;
        color: var(--text-2);
    }
    .cr-mv {
        font-size: 14.5px;
        color: var(--text);
        font-family: var(--font-mono);
    }
    .cr-delta {
        font-size: 11.5px;
        font-family: var(--font-mono);
        padding: 1px 6px;
        border-radius: 99px;
        line-height: 1.5;
        white-space: nowrap;
        display: inline-flex;
        align-items: center;
        gap: 3px;
        min-width: 46px;
        justify-content: center;
    }
    .cr-delta.up {
        color: var(--pos);
        background: var(--pos-bg);
    }
    .cr-delta.down {
        color: var(--neg);
        background: var(--neg-bg);
    }
    .cr-delta.flat {
        color: var(--text-3);
        background: var(--read-bg);
    }
    .cr-vsmed {
        font-size: 11px;
        color: var(--text-3);
        text-align: right;
        padding: 6px 16px 0;
    }

    .cr-time {
        padding: 11px 16px 0;
        margin-top: 10px;
        border-top: 1px solid var(--border);
    }
    .cr-time-h {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 8px;
    }
    .cr-bars {
        display: flex;
        align-items: flex-end;
        gap: 2px;
        height: 28px;
    }
    .cr-bar {
        flex: 1;
        height: 100%;
        display: flex;
        align-items: flex-end;
        background: none;
        border: none;
        padding: 0;
        cursor: pointer;
        border-radius: 2px;
        transition: background var(--dur-fast);
    }
    .cr-bar:hover {
        background: var(--read-bg);
    }
    .cr-bar-fill {
        width: 100%;
        border-radius: 1.5px;
        background: var(--border-mid);
        transition:
            height var(--dur-fast) var(--ease-out),
            background var(--dur-fast);
    }
    .cr-bar-fill.above {
        background: color-mix(in oklch, var(--accent) 55%, transparent);
    }
    .cr-bar.cur .cr-bar-fill {
        background: var(--accent);
    }
    .cr-time-note {
        font-size: 11px;
        color: var(--text-3);
        padding: 7px 0 2px;
        font-family: var(--font-mono);
    }
    .cr-time-latest {
        background: none;
        border: none;
        padding: 0;
        font-size: 11px;
        font-family: var(--font-mono);
        color: var(--accent);
        cursor: pointer;
    }
    .cr-time-latest:hover {
        text-decoration: underline;
    }

    .cr-mem {
        padding: 13px 16px 15px;
        margin-top: 13px;
        border-top: 1px solid var(--border);
        background: var(--read-bg);
    }
    .cr-mem-h {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 10px;
    }
    .cr-mem-t {
        font-size: 11px;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: var(--text-3);
        font-weight: 600;
    }
    .cr-mem-hint {
        font-size: 11px;
        color: var(--text-3);
    }
    .cr-chips {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        max-height: 116px;
        overflow-y: auto;
    }
    .qchip {
        font-size: 12px;
        padding: 4px 8px;
        border-radius: 5px;
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text-2);
        cursor: pointer;
        transition: all var(--dur-fast);
        font-family: var(--font-mono);
    }
    .qchip:hover {
        color: var(--text);
        border-color: var(--accent);
    }
    .qchip.on {
        background: var(--accent);
        color: var(--accent-fg);
        border-color: var(--accent);
    }

    .cr-warn {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        margin: 0 16px 14px;
        padding: 9px 11px;
        background: var(--warn-bg);
        border: 1px solid var(--warn-border);
        border-radius: var(--radius-sm);
    }
    .cr-warn svg {
        width: 14px;
        height: 14px;
        color: var(--warn);
        flex-shrink: 0;
        margin-top: 1px;
    }
    .cr-warn-tx {
        font-size: 12.5px;
        line-height: 1.5;
        color: var(--text-2);
    }
    .cr-warn-tx b {
        color: var(--text);
        font-weight: 600;
    }

    @media (min-width: 768px) and (max-width: 1199px) {
        .cr-n {
            font-size: 30px;
        }
    }
</style>
