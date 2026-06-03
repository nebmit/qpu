<script lang="ts">
    import { dashboardState } from "$lib/state/dashboard.svelte";
    import { QPU_DEVICES } from "$lib/data/calibration";
    import { findCluster, TOPOLOGIES, TOPO_HINT } from "$lib/domain/cluster";

    let timeStart = $derived.by(() => {
        const list = dashboardState.snapshotsByDevice[dashboardState.device] || [];
        return list[0]?.date || "—";
    });
    let timeEnd = $derived.by(() => {
        const list = dashboardState.snapshotsByDevice[dashboardState.device] || [];
        return list[list.length - 1]?.date || "—";
    });

    function runFind() {
        try {
            dashboardState.cluster = findCluster(
                $state.snapshot(dashboardState.connRules),
                $state.snapshot(dashboardState.snap.qubits),
                $state.snapshot(dashboardState.filteredEdges),
                new Set(dashboardState.allowedQubitIds),
            );
            dashboardState.clusterError = null;
            dashboardState.selectedId = null;
        } catch (e) {
            dashboardState.clusterError = e instanceof Error ? e.message : "Could not find a cluster.";
            dashboardState.cluster = [];
        }
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
        {#if dashboardState.clusterError}
            <div class="find-status err fade-in">
                <span class="fs-warn">⚠</span>
                <span>{dashboardState.clusterError}</span>
                <button class="fs-clear" onclick={() => dashboardState.clearCluster()}>Clear</button>
            </div>
        {:else if dashboardState.clusterStats}
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

    /* ── Section heads ─────────────────────────────────────────────── */
    .op-device { margin-bottom: 22px; padding-bottom: 22px; border-bottom: 1px solid var(--border); }

    .op-group       { margin-bottom: 22px; }
    .op-group:last-child { margin-bottom: 0; }
    .op-head        { display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; }
    .op-head-l      { display: flex; align-items: center; gap: 9px; }
    .op-head .eyebrow { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; color: var(--text-2); }
    .op-head .step  { font-family: var(--font-mono); font-size: 10.5px; color: var(--accent); width: 18px; height: 18px;
                      display: inline-flex; align-items: center; justify-content: center;
                      border: 1px solid var(--accent-border); border-radius: 5px; }

    /* ── Sliders ───────────────────────────────────────────────────── */
    .sld        { margin-bottom: 14px; }
    .sld:last-child { margin-bottom: 0; }
    .sld-top    { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 8px; }
    .sld-lbl    { font-size: 12px; color: var(--text-2); white-space: nowrap; }
    .sld-val    { font-size: 11.5px; color: var(--text); font-family: var(--font-mono); }
    .sld-val i  { color: var(--text-3); font-style: normal; margin-left: 1px; }
    .sld-sub-h  { display: flex; align-items: center; gap: 8px; margin-bottom: 11px; }
    .sld-sub-h .t  { font-size: 9.5px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-3); white-space: nowrap; }
    .sld-sub-h .op { font-family: var(--font-mono); font-size: 10px; color: var(--accent); background: var(--accent-surface);
                     border: 1px solid var(--accent-border); border-radius: 4px; padding: 1px 5px; line-height: 1.4; }
    .sld-sub-h .rule { flex: 1; height: 1px; background: var(--border); }
    .sld-gap    { height: 16px; }
    .ctrl-lbl   { font-size: 12px; color: var(--text-2); margin: 16px 0 9px; }
    .topo-hint  { font-size: 10.5px; line-height: 1.5; color: var(--text-3); margin-top: 9px; text-wrap: pretty; }
    .ends       { display: flex; justify-content: space-between; margin-top: 7px; font-size: 10px; font-family: var(--font-mono); color: var(--text-3); }

    /* ── Find button ───────────────────────────────────────────────── */
    .find      { width: 100%; padding: 11px 14px; background: var(--accent); border: none; border-radius: var(--radius-sm);
                 color: var(--accent-fg); font-size: 13px; font-family: var(--font-sans); font-weight: 500; cursor: pointer;
                 transition: opacity var(--dur-fast), box-shadow var(--dur-fast), transform var(--dur-fast); letter-spacing: 0.01em;
                 display: flex; align-items: center; justify-content: center; gap: 8px; }
    .find:hover  { opacity: 0.92; box-shadow: 0 3px 14px color-mix(in oklch, var(--accent) 40%, transparent); }
    .find:active { transform: translateY(1px); }
    .find:disabled { opacity: 0.35; cursor: not-allowed; }
    .find .arr { font-family: var(--font-mono); }

    /* ── Find status pill ──────────────────────────────────────────── */
    .find-status   { margin-top: 14px; display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: var(--text-2);
                     background: var(--accent-surface); border: 1px solid var(--accent-border);
                     border-radius: var(--radius-sm); padding: 9px 11px; }
    .find-status b { color: var(--text); font-weight: 600; }
    .find-status .fs-check { color: var(--accent); font-weight: 700; flex-shrink: 0; }
    .find-status .fs-clear { margin-left: auto; background: none; border: none; color: var(--text-3); cursor: pointer;
                             font-size: 11px; text-decoration: underline; text-underline-offset: 2px; padding: 0; flex-shrink: 0; }
    .find-status .fs-clear:hover { color: var(--text-2); }
    .find-status.err { align-items: flex-start; line-height: 1.45;
                       background: oklch(96% 0.04 70); border-color: oklch(82% 0.09 70); color: var(--text-2); }
    .find-status.err .fs-warn { color: oklch(60% 0.16 60); font-weight: 700; flex-shrink: 0; }
    :global([data-theme='dark']) .find-status.err { background: oklch(33% 0.06 60); border-color: oklch(48% 0.09 60); }
    :global([data-theme='dark']) .find-status.err .fs-warn { color: oklch(78% 0.13 70); }

    /* ── Dropdown ──────────────────────────────────────────────────── */
    .dd        { position: relative; display: inline-flex; align-items: center; }
    .dd.full   { display: flex; width: 100%; }
    .dd.full select { width: 100%; }
    .dd select { appearance: none; -webkit-appearance: none; padding: 8px 30px 8px 13px; border: 1px solid var(--border-mid);
                 border-radius: 8px; background: var(--surface); color: var(--text); font-family: var(--font-mono);
                 font-size: 12.5px; cursor: pointer; outline: none; transition: border-color var(--dur-fast); }
    .dd select:hover { border-color: var(--accent-border); }
    .dd select:focus { border-color: var(--accent); }
    .dd svg    { position: absolute; right: 12px; pointer-events: none; color: var(--text-3); }
</style>
