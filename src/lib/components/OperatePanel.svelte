<script lang="ts">
    import { dashboardState } from "$lib/state.svelte";
    import { QPU_DEVICES, findCluster, TOPOLOGIES, TOPO_HINT } from "$lib/utils/data";

    let timeStart = $derived.by(() => {
        const list = dashboardState.snapshotsByDevice[dashboardState.device] || [];
        return list[0]?.date || "—";
    });
    let timeEnd = $derived.by(() => {
        const list = dashboardState.snapshotsByDevice[dashboardState.device] || [];
        return list[list.length - 1]?.date || "—";
    });

    function runFind() {
        dashboardState.cluster = findCluster(
            $state.snapshot(dashboardState.connRules),
            $state.snapshot(dashboardState.snap.qubits),
            $state.snapshot(dashboardState.filteredEdges),
            new Set(dashboardState.allowedQubitIds),
        );
        dashboardState.selectedId = null;
    }
</script>

<aside class="plate-operate">

    <!-- ① Device -->
    <div class="op-device">
        <div class="op-head">
            <div class="op-head-l">
                <span class="step">1</span>
                <span class="eyebrow">Device</span>
            </div>
        </div>
        <div class="dd full">
            <select
                value={dashboardState.device}
                onchange={(e) => dashboardState.setDevice((e.currentTarget as HTMLSelectElement).value)}
            >
                {#each QPU_DEVICES as d (d)}
                    <option value={d}>{d}</option>
                {/each}
            </select>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                <path d="M2 4l3 3 3-3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>
    </div>

    <!-- ② Snapshot -->
    <div class="op-group">
        <div class="op-head">
            <div class="op-head-l">
                <span class="step">2</span>
                <span class="eyebrow">Snapshot</span>
            </div>
            <span class="date-val font-mono">{dashboardState.snap.date || "—"}</span>
        </div>
        <input
            type="range"
            min="0"
            max={Math.max(0, dashboardState.timeCount - 1)}
            bind:value={dashboardState.timeIdx}
            onchange={() => dashboardState.clearCluster()}
            disabled={dashboardState.timeCount <= 1}
        />
        <div class="ends">
            <span>{timeStart}</span>
            <span>{timeEnd}</span>
        </div>
    </div>

    <!-- ③ Quality filters -->
    <div class="op-group">
        <div class="op-head">
            <div class="op-head-l">
                <span class="step">3</span>
                <span class="eyebrow">Quality filters</span>
            </div>
        </div>

        <div class="sld-sub-h">
            <span class="t">Error ceilings</span>
            <span class="op font-mono">≤</span>
            <span class="rule"></span>
        </div>

        <div class="sld">
            <div class="sld-top">
                <span class="sld-lbl">Readout error</span>
                <span class="sld-val">{dashboardState.errorCutoffs.readoutPct.toFixed(1)}<i>%</i></span>
            </div>
            <input type="range" min="0" max="100" step="0.1"
                bind:value={dashboardState.errorCutoffs.readoutPct} />
        </div>

        <div class="sld-gap"></div>

        <div class="sld">
            <div class="sld-top">
                <span class="sld-lbl">CX gate error</span>
                <span class="sld-val">{dashboardState.errorCutoffs.cxPct.toFixed(1)}<i>%</i></span>
            </div>
            <input type="range" min="0" max="100" step="0.1"
                bind:value={dashboardState.errorCutoffs.cxPct} />
        </div>

        <div class="sld-gap"></div>

        <div class="sld-sub-h">
            <span class="t">Coherence floors</span>
            <span class="op font-mono">≥</span>
            <span class="rule"></span>
        </div>

        <div class="sld">
            <div class="sld-top">
                <span class="sld-lbl">T₁ relaxation</span>
                <span class="sld-val">{dashboardState.coherenceCutoffs.minT1}<i>μs</i></span>
            </div>
            <input type="range" min="0" max="500" step="1"
                bind:value={dashboardState.coherenceCutoffs.minT1} />
        </div>

        <div class="sld-gap"></div>

        <div class="sld">
            <div class="sld-top">
                <span class="sld-lbl">T₂ dephasing</span>
                <span class="sld-val">{dashboardState.coherenceCutoffs.minT2}<i>μs</i></span>
            </div>
            <input type="range" min="0" max="500" step="1"
                bind:value={dashboardState.coherenceCutoffs.minT2} />
        </div>
    </div>

    <!-- ④ Find cluster -->
    <div class="op-group">
        <div class="op-head">
            <div class="op-head-l">
                <span class="step">4</span>
                <span class="eyebrow">Find cluster</span>
            </div>
        </div>

        <div class="sld">
            <div class="sld-top">
                <span class="sld-lbl">Cluster size</span>
                <span class="sld-val">{dashboardState.clusterSize}<i>Q</i></span>
            </div>
            <input type="range" min="2" max="50" step="1"
                bind:value={dashboardState.clusterSize}
                onchange={() => dashboardState.clearCluster()} />
        </div>

        <div class="ctrl-lbl">Topology</div>
        <div class="seg full">
            {#each TOPOLOGIES as t (t.value)}
                <button
                    class="seg-btn {dashboardState.topology === t.value ? 'on' : ''}"
                    onclick={() => { dashboardState.topology = t.value; dashboardState.clearCluster(); }}
                >
                    {t.label}
                </button>
            {/each}
        </div>
        <p class="topo-hint">{TOPO_HINT[dashboardState.topology]}</p>

        <div style="height: 14px"></div>

        <!-- Find button -->
        <button
            class="find"
            disabled={dashboardState.totalConnections === 0}
            onclick={runFind}
        >
            Find best cluster <span class="arr">→</span>
        </button>

        <!-- Find status -->
        {#if dashboardState.clusterStats}
            <div class="find-status fade-in">
                <span class="fs-check">✓</span>
                <span>Best <b>{dashboardState.cluster.length}Q</b> cluster shown</span>
                <button class="fs-clear" onclick={() => dashboardState.clearCluster()}>Clear</button>
            </div>
        {/if}
    </div>

</aside>

<style>
    .date-val {
        font-size: 12px;
        color: var(--text-2);
    }
</style>
