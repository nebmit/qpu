<script lang="ts">
    import { dashboardState, INPUT_LIMITS } from "$lib/state/dashboard.svelte";
    import { TOPOLOGIES, TOPO_HINT } from "$lib/domain/cluster";
    import RangeControl from "$lib/components/operate/RangeControl.svelte";
    import TimelineScrubber from "$lib/components/operate/TimelineScrubber.svelte";

    let { mobileOpen = false, onClose, onFind } = $props<{
        mobileOpen?: boolean;
        onClose?: () => void;
        onFind?: () => void;
    }>();

    const clearClusterDuringSliderInput = () => {
        dashboardState.pauseTimeline();
        dashboardState.clearCluster();
    };

    let qualifyCount = $derived(dashboardState.allowedQubitIds.size);

    function resetInputs() {
        dashboardState.resetInputs();
    }
</script>

<aside class="plate-operate" class:mob-open={mobileOpen}>
    <button
        type="button"
        class="sheet-handle"
        onclick={onClose}
        aria-label="Close controls"
    >
        <span class="sheet-handle-bar"></span>
    </button>

    <div class="op-device">
        <div class="op-head">
            <div class="op-head-l">
                <span class="step">1</span>
                <span class="eyebrow">Device</span>
            </div>
            <button
                type="button"
                class="reset-defaults"
                onclick={resetInputs}
                title="Reset filters, cluster, and inputs to defaults"
                aria-label="Reset filters, cluster, and inputs to defaults"
            >
                <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                >
                    <path d="M4.6 5.1A4.8 4.8 0 1 1 3.3 8.4" />
                    <path d="M4.7 2.4v2.8H2" />
                </svg>
                <span>Reset</span>
            </button>
        </div>
        <div class="dd full">
            <select
                value={dashboardState.device}
                onchange={(e) =>
                    dashboardState.setDevice(
                        (e.currentTarget as HTMLSelectElement).value,
                    )}
            >
                {#each dashboardState.devices as d (d)}
                    <option value={d}>{d}</option>
                {/each}
            </select>
            <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                aria-hidden="true"
            >
                <path
                    d="M2 4l3 3 3-3"
                    stroke="currentColor"
                    stroke-width="1.4"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                />
            </svg>
        </div>
    </div>

    <div class="op-group">
        <div class="op-head">
            <div class="op-head-l">
                <span class="step">2</span>
                <span class="eyebrow">Snapshot</span>
            </div>
            <span class="date-val font-mono">{dashboardState.snap.date || "—"}</span>
        </div>
        <TimelineScrubber />
    </div>

    <div class="op-group">
        <div class="op-head">
            <div class="op-head-l">
                <span class="step">3</span>
                <span class="eyebrow">Quality filters</span>
            </div>
            <span class="qualify font-mono" aria-live="polite">
                {#key qualifyCount}
                    <b class="qualify-n">{qualifyCount}</b>
                {/key}/{dashboardState.totalQubits}&nbsp;Q
            </span>
        </div>

        <div class="sld-sub-h">
            <span class="t">Error ceilings</span>
            <span class="op font-mono">≤</span>
            <span class="rule"></span>
        </div>

        <RangeControl
            label="Readout error"
            bind:value={dashboardState.errorCutoffs.readoutPct}
            min={INPUT_LIMITS.readoutPct.min}
            max={INPUT_LIMITS.readoutPct.max}
            step={0.1}
            unit="%"
            decimals={1}
            ariaLabel="Readout error ceiling"
            ariaValueText="{dashboardState.errorCutoffs.readoutPct.toFixed(1)} percent"
            oninput={clearClusterDuringSliderInput}
        />

        <div class="sld-gap"></div>

        <RangeControl
            label="2Q gate error"
            bind:value={dashboardState.errorCutoffs.twoqPct}
            min={INPUT_LIMITS.twoqPct.min}
            max={INPUT_LIMITS.twoqPct.max}
            step={0.1}
            unit="%"
            decimals={1}
            ariaLabel="Two-qubit gate error ceiling"
            ariaValueText="{dashboardState.errorCutoffs.twoqPct.toFixed(1)} percent"
            oninput={clearClusterDuringSliderInput}
        />

        <div class="sld-gap"></div>

        <div class="sld-sub-h">
            <span class="t">Coherence floors</span>
            <span class="op font-mono">≥</span>
            <span class="rule"></span>
        </div>

        <RangeControl
            label="T₁ relaxation"
            bind:value={dashboardState.coherenceCutoffs.minT1}
            min={INPUT_LIMITS.minT1.min}
            max={INPUT_LIMITS.minT1.max}
            step={1}
            unit="μs"
            ariaLabel="T1 relaxation floor"
            ariaValueText="{dashboardState.coherenceCutoffs.minT1} microseconds"
            oninput={clearClusterDuringSliderInput}
        />

        <div class="sld-gap"></div>

        <RangeControl
            label="T₂ dephasing"
            bind:value={dashboardState.coherenceCutoffs.minT2}
            min={INPUT_LIMITS.minT2.min}
            max={INPUT_LIMITS.minT2.max}
            step={1}
            unit="μs"
            ariaLabel="T2 dephasing floor"
            ariaValueText="{dashboardState.coherenceCutoffs.minT2} microseconds"
            oninput={clearClusterDuringSliderInput}
        />
    </div>

    <div class="op-group">
        <div class="op-head">
            <div class="op-head-l">
                <span class="step">4</span>
                <span class="eyebrow">Find cluster</span>
            </div>
        </div>

        <RangeControl
            label="Cluster size"
            bind:value={dashboardState.clusterSize}
            min={INPUT_LIMITS.clusterSize.min}
            max={dashboardState.clusterSizeLimit.max}
            step={1}
            unit="Q"
            ariaLabel="Cluster size"
            ariaValueText="{dashboardState.clusterSize} qubits"
            oninput={clearClusterDuringSliderInput}
        />

        <div class="ctrl-lbl">Topology preference</div>
        <div class="seg full">
            {#each TOPOLOGIES as t (t.value)}
                <button
                    class="seg-btn {dashboardState.topology === t.value
                        ? 'on'
                        : ''}"
                    aria-pressed={dashboardState.topology === t.value}
                    onclick={() => {
                        dashboardState.pauseTimeline();
                        dashboardState.topology = t.value;
                        dashboardState.clearCluster();
                    }}
                >
                    {t.label}
                </button>
            {/each}
        </div>
        <p class="topo-hint">{TOPO_HINT[dashboardState.topology]}</p>

        <div style="height: 14px"></div>

        <button
            class="find"
            disabled={dashboardState.totalConnections === 0}
            onclick={() => {
                dashboardState.runFindCluster();
                onFind?.();
            }}
        >
            Find best match <span class="arr">→</span>
        </button>
    </div>
</aside>

<style>
    .date-val {
        font-size: 12px;
        color: var(--text-2);
    }

    .reset-defaults {
        height: 24px;
        min-width: 0;
        border: none;
        border-radius: 5px;
        background: transparent;
        color: var(--text-3);
        font-family: var(--font-sans);
        font-size: 10.5px;
        font-weight: 500;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 0 4px;
        white-space: nowrap;
        transition:
            color var(--dur-fast),
            background var(--dur-fast),
            transform var(--dur-fast);
    }
    .reset-defaults svg {
        width: 12px;
        height: 12px;
        flex: 0 0 auto;
    }
    .reset-defaults:hover {
        color: var(--text-2);
        background: color-mix(in oklch, var(--surface) 72%, transparent);
    }
    .reset-defaults:active {
        transform: translateY(1px);
    }

    .op-device {
        margin-bottom: 22px;
        padding-bottom: 22px;
        border-bottom: 1px solid var(--border);
    }

    .op-group {
        margin-bottom: 22px;
    }
    .op-group:last-child {
        margin-bottom: 0;
    }
    .op-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 15px;
    }
    .op-head-l {
        display: flex;
        align-items: center;
        gap: 9px;
    }
    .op-head .eyebrow {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.06em;
        color: var(--text-2);
    }
    .op-head .step {
        font-family: var(--font-mono);
        font-size: 10.5px;
        color: var(--accent);
        width: 18px;
        height: 18px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid var(--accent-border);
        border-radius: 5px;
    }

    .qualify {
        font-size: 11px;
        color: var(--text-3);
        white-space: nowrap;
    }
    .qualify-n {
        font-weight: 600;
        animation: count-tick var(--dur-base) var(--ease-out) both;
    }

    .sld-sub-h {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 11px;
    }
    .sld-sub-h .t {
        font-size: 9.5px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-3);
        white-space: nowrap;
    }
    .sld-sub-h .op {
        font-family: var(--font-mono);
        font-size: 10px;
        color: var(--accent);
        background: var(--accent-surface);
        border: 1px solid var(--accent-border);
        border-radius: 4px;
        padding: 1px 5px;
        line-height: 1.4;
    }
    .sld-sub-h .rule {
        flex: 1;
        height: 1px;
        background: var(--border);
    }
    .sld-gap {
        height: 16px;
    }
    .ctrl-lbl {
        font-size: 12px;
        color: var(--text-2);
        margin: 16px 0 9px;
    }
    .topo-hint {
        font-size: 10.5px;
        line-height: 1.5;
        color: var(--text-3);
        margin-top: 9px;
        text-wrap: pretty;
    }

    .find {
        width: 100%;
        padding: 11px 14px;
        background: var(--accent);
        border: none;
        border-radius: var(--radius-sm);
        color: var(--accent-fg);
        font-size: 13px;
        font-family: var(--font-sans);
        font-weight: 500;
        cursor: pointer;
        transition:
            opacity var(--dur-fast),
            box-shadow var(--dur-fast),
            transform var(--dur-fast);
        letter-spacing: 0.01em;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
    }
    .find:hover {
        opacity: 0.92;
        box-shadow: 0 3px 14px
            color-mix(in oklch, var(--accent) 40%, transparent);
    }
    .find:active {
        transform: translateY(1px);
    }
    .find:disabled {
        opacity: 0.35;
        cursor: not-allowed;
    }
    .find .arr {
        font-family: var(--font-mono);
    }

    .dd {
        position: relative;
        display: inline-flex;
        align-items: center;
    }
    .dd.full {
        display: flex;
        width: 100%;
    }
    .dd.full select {
        width: 100%;
    }
    .dd select {
        appearance: none;
        -webkit-appearance: none;
        padding: 8px 30px 8px 13px;
        border: 1px solid var(--border-mid);
        border-radius: 8px;
        background: var(--surface);
        color: var(--text);
        font-family: var(--font-mono);
        font-size: 12.5px;
        cursor: pointer;
        outline: none;
        transition: border-color var(--dur-fast);
    }
    .dd select:hover {
        border-color: var(--accent-border);
    }
    .dd select:focus {
        border-color: var(--accent);
    }
    .dd svg {
        position: absolute;
        right: 12px;
        pointer-events: none;
        color: var(--text-3);
    }
</style>
