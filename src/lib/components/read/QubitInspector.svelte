<script lang="ts">
    import { dashboardState } from "$lib/state/dashboard.svelte";
    import Sparkline from "$lib/components/Sparkline.svelte";
    import { microseconds, percent, exponential } from "$lib/viz/format";

    let inspectedId = $derived(dashboardState.selectedId);

    let inspectedQubit = $derived.by(() => {
        if (inspectedId === null) return null;
        return dashboardState.snap.qubits[inspectedId] ?? null;
    });

    let connEdges = $derived.by(() => {
        if (inspectedId === null) return [];
        return dashboardState.snap.edges.filter(
            (e) => e.source === inspectedId || e.target === inspectedId,
        );
    });

    let inCluster = $derived(
        inspectedId !== null && dashboardState.cluster.includes(inspectedId),
    );

    let history = $derived.by(() => {
        if (inspectedId === null) return null;
        const snaps = dashboardState.deviceSnapshots;
        if (snaps.length < 2) return null;
        const id = inspectedId;
        const series = (sel: (q: (typeof snaps)[number]["qubits"][number]) => number | null) =>
            snaps.map((s) => {
                const q = s.qubits[id];
                return q ? sel(q) : null;
            });
        return {
            T1: series((q) => q.T1),
            T2: series((q) => q.T2),
            ro: series((q) => q.readout_error),
        };
    });

    function closeDetail() {
        dashboardState.selectedId = null;
    }
</script>

{#if inspectedQubit !== null && inspectedId !== null}
    <div class="fade-in">
        {#if dashboardState.clusterStats}
            <button class="insp-back" onclick={closeDetail}
                >‹ Back to cluster</button
            >
        {:else}
            <div class="eyebrow mb">Selection</div>
        {/if}

        <div class="insp-qhead">
            <span class="pr-qid">Q{String(inspectedId).padStart(3, "0")}</span>
            {#if dashboardState.clusterStats}
                <span
                    class="mem-badge"
                    class:in={inCluster}
                    class:out={!inCluster}
                >
                    {inCluster ? "✓ in cluster" : "not in cluster"}
                </span>
            {/if}
        </div>

        <div>
            <div class="pr-row">
                <span class="pr-l">T₁</span>
                {#if history}
                    <span class="spark-wrap">
                        <Sparkline
                            values={history.T1}
                            currentIdx={dashboardState.timeIdx}
                        />
                    </span>
                {/if}
                <span class="pr-v">{microseconds(inspectedQubit.T1, 1)}</span>
            </div>
            <div class="pr-row">
                <span class="pr-l">T₂</span>
                {#if history}
                    <span class="spark-wrap">
                        <Sparkline
                            values={history.T2}
                            currentIdx={dashboardState.timeIdx}
                        />
                    </span>
                {/if}
                <span class="pr-v">{microseconds(inspectedQubit.T2, 1)}</span>
            </div>
            <div class="pr-row">
                <span class="pr-l">Readout error</span>
                {#if history}
                    <span class="spark-wrap">
                        <Sparkline
                            values={history.ro}
                            currentIdx={dashboardState.timeIdx}
                        />
                    </span>
                {/if}
                <span class="pr-v"
                    >{percent(inspectedQubit.readout_error, 2)}</span
                >
            </div>
            <div class="pr-row">
                <span class="pr-l">P0|1</span>
                <span class="pr-v">{percent(inspectedQubit.p01, 2)}</span>
            </div>
            <div class="pr-row">
                <span class="pr-l">P1|0</span>
                <span class="pr-v">{percent(inspectedQubit.p10, 2)}</span>
            </div>
        </div>

        {#if connEdges.length > 0}
            <div class="pr-cxh">
                2Q gate · {connEdges.length} link{connEdges.length !== 1
                    ? "s"
                    : ""}
            </div>
            {#each connEdges.slice(0, 8) as e (`${e.source}-${e.target}`)}
                {@const nb = e.source === inspectedId ? e.target : e.source}
                <div class="pr-row">
                    <span class="pr-l font-mono">↔ Q{nb}</span>
                    <span class="pr-v">{exponential(e.twoq_error, 2)}</span>
                </div>
            {/each}
        {/if}
    </div>
{/if}

<style>
    .pr-row {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 10px;
        padding: 6px 0;
        border-bottom: 1px solid var(--border);
    }
    .pr-row:last-child {
        border-bottom: none;
    }
    .pr-l {
        font-size: 13px;
        color: var(--text-2);
        white-space: nowrap;
    }
    .pr-v {
        font-size: 14px;
        color: var(--text);
        white-space: nowrap;
        font-family: var(--font-mono);
    }
    .pr-qid {
        font-size: 24px;
        color: var(--accent);
        line-height: 1;
        font-family: var(--font-mono);
    }
    .pr-cxh {
        font-size: 11px;
        color: var(--text-3);
        letter-spacing: 0.08em;
        text-transform: uppercase;
        margin: 15px 0 4px;
    }
    .spark-wrap {
        margin-left: auto;
        margin-right: 2px;
        display: inline-flex;
        align-items: center;
        align-self: center;
    }

    .insp-back {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: none;
        border: none;
        color: var(--text-3);
        cursor: pointer;
        font-size: 12.5px;
        font-family: var(--font-sans);
        padding: 0;
        margin-bottom: 13px;
        transition: color var(--dur-fast);
    }
    .insp-back:hover {
        color: var(--accent);
    }
    .insp-qhead {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 12px;
    }
    .mem-badge {
        font-size: 10.5px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        font-weight: 600;
        padding: 3px 8px;
        border-radius: 99px;
        white-space: nowrap;
    }
    .mem-badge.in {
        color: var(--accent);
        background: var(--accent-surface);
        border: 1px solid var(--accent-border);
    }
    .mem-badge.out {
        color: var(--text-3);
        background: var(--read-bg);
        border: 1px solid var(--border);
    }
</style>
