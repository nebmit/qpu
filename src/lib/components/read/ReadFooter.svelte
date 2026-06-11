<script lang="ts">
    import { dashboardState } from "$lib/state/dashboard.svelte";
    import { metricNodeColor, LIVE_EDGE_STROKE } from "$lib/viz/color";
    import { microseconds, percent, exponential } from "$lib/viz/format";

    const NODE_LO = metricNodeColor(0);
    const NODE_HI = metricNodeColor(1);

    let nodeLegend = $derived.by(() => {
        const m = dashboardState.metricMode;
        const r = dashboardState.ranges;
        if (m === "T1")
            return {
                label: "T₁ coherence · nodes",
                lo: `${r.T1[0].toFixed(0)} μs`,
                hi: `${r.T1[1].toFixed(0)} μs`,
                reversed: false,
            };
        if (m === "T2")
            return {
                label: "T₂ coherence · nodes",
                lo: `${r.T2[0].toFixed(0)} μs`,
                hi: `${r.T2[1].toFixed(0)} μs`,
                reversed: false,
            };
        if (m === "stability")
            return {
                label: "Stability · nodes",
                lo: "volatile",
                hi: "stable",
                reversed: false,
            };
        return {
            label: "Readout error · nodes",
            lo: `${(r.readout[0] * 100).toFixed(1)}%`,
            hi: `${(r.readout[1] * 100).toFixed(1)}%`,
            reversed: true,
        };
    });

    let edgeLegend = $derived.by(() => {
        const r = dashboardState.ranges;
        return {
            lo: `${(r.twoq[0] * 100).toFixed(2)}%`,
            hi: `${(r.twoq[1] * 100).toFixed(2)}%`,
        };
    });
</script>

<div class="read-foot">
    <div class="eyebrow mb">{dashboardState.device} · medians</div>
    <div class="pr-row">
        <span class="pr-l">T₁</span>
        <span class="pr-v">{microseconds(dashboardState.medians.T1, 0)}</span>
    </div>
    <div class="pr-row">
        <span class="pr-l">T₂</span>
        <span class="pr-v">{microseconds(dashboardState.medians.T2, 0)}</span>
    </div>
    <div class="pr-row">
        <span class="pr-l">Readout</span>
        <span class="pr-v">{percent(dashboardState.medians.ro, 2)}</span>
    </div>
    <div class="pr-row">
        <span class="pr-l">2Q gate</span>
        <span class="pr-v">{exponential(dashboardState.medians.twoq, 2)}</span>
    </div>
    <div class="pr-row">
        <span class="pr-l">Lattice</span>
        <span class="pr-v"
            >{dashboardState.stats.qubitsCount}Q · {dashboardState.stats
                .edgesCount}E</span
        >
    </div>

    <div class="read-divider"></div>

    <div class="eyebrow mb">Colour scale</div>

    {#if dashboardState.filteredQubits.length > 0}
        <div class="leg-inline">
            {#key dashboardState.metricMode}
                <div class="lg-pair lg-fade">
                    <div class="lg-label">{nodeLegend.label}</div>
                    <div
                        class="lg-bar"
                        style="background: linear-gradient(to right, {nodeLegend.reversed
                            ? NODE_HI
                            : NODE_LO}, {nodeLegend.reversed
                            ? NODE_LO
                            : NODE_HI})"
                    ></div>
                    <div class="lg-ends">
                        <span>{nodeLegend.lo}</span>
                        <span>{nodeLegend.hi}</span>
                    </div>
                </div>
            {/key}
            <div class="lg-pair">
                <div class="lg-label">2Q gate error · edges</div>
                <svg
                    class="lg-bar lg-bar-edge"
                    viewBox="0 0 100 8"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                >
                    <polygon
                        points="0,1.2 100,3.5 100,4.5 0,6.8"
                        fill={LIVE_EDGE_STROKE}
                    />
                </svg>
                <div class="lg-ends">
                    <span>{edgeLegend.lo}</span>
                    <span>{edgeLegend.hi}</span>
                </div>
            </div>
        </div>
    {/if}
</div>

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

    .read-foot {
        margin-top: auto;
        padding-top: 26px;
    }
    .read-divider {
        height: 1px;
        background: var(--border);
        margin: 22px 0;
    }

    .leg-inline .lg-label {
        font-size: 10.5px;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: var(--text-3);
        margin-bottom: 7px;
        font-weight: 500;
    }
    .leg-inline .lg-bar {
        height: 6px;
        border-radius: 3px;
        margin-bottom: 5px;
    }
    .leg-inline .lg-bar-edge {
        display: block;
        width: 100%;
    }
    .leg-inline .lg-ends {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        font-family: var(--font-mono);
        color: var(--text-3);
    }
    .leg-inline .lg-pair {
        margin-bottom: 15px;
    }
    .leg-inline .lg-pair:last-child {
        margin-bottom: 0;
    }
    .lg-fade {
        animation: fadeIn var(--dur-fast) var(--ease-out) both;
    }
</style>
