<script lang="ts">
    import { onDestroy } from "svelte";
    import { dashboardState } from "$lib/state/dashboard.svelte";
    import { TOPOLOGIES, TOPO_HINT } from "$lib/domain/cluster";

    let {
        mobileOpen = false,
        onClose,
        onFind,
    } = $props<{
        mobileOpen?: boolean;
        onClose?: () => void;
        onFind?: () => void;
    }>();

    let timeStart = $derived.by(() => {
        const list =
            dashboardState.snapshotsByDevice[dashboardState.device] || [];
        return list[0]?.date || "—";
    });
    let timeEnd = $derived.by(() => {
        const list =
            dashboardState.snapshotsByDevice[dashboardState.device] || [];
        return list[list.length - 1]?.date || "—";
    });

    const clearClusterDuringSliderInput = () => {
        dashboardState.pauseTimeline();
        dashboardState.clearCluster();
    };

    let qualifyCount = $derived(dashboardState.allowedQubitIds.size);
    let timelineProgress = $derived.by(() => {
        const max = Math.max(1, dashboardState.timeCount - 1);
        return Math.min(100, Math.max(0, (dashboardState.timeIdx / max) * 100));
    });

    // Fast enough to scan a full 178-snapshot series in under 30s.
    const PLAY_STEP_MS = 150;
    let frameId: number | null = null;
    let lastFrameAt: number | null = null;
    let elapsedSinceStep = 0;

    function stopPlaybackLoop() {
        if (frameId !== null) {
            if (typeof cancelAnimationFrame === "function") {
                cancelAnimationFrame(frameId);
            }
            frameId = null;
        }
        lastFrameAt = null;
        elapsedSinceStep = 0;
    }

    function playbackFrame(now: number) {
        if (!dashboardState.isPlaying) {
            stopPlaybackLoop();
            return;
        }
        if (lastFrameAt === null) lastFrameAt = now;
        const delta = Math.min(now - lastFrameAt, PLAY_STEP_MS);
        lastFrameAt = now;
        elapsedSinceStep += delta;

        if (elapsedSinceStep >= PLAY_STEP_MS) {
            elapsedSinceStep %= PLAY_STEP_MS;
            const next = dashboardState.timeIdx + 1;
            const last = dashboardState.timeCount - 1;
            if (next >= last) {
                dashboardState.setSnapshotIndex(last, { pause: false });
                dashboardState.pauseTimeline();
                stopPlaybackLoop();
                return;
            }
            dashboardState.setSnapshotIndex(next, { pause: false });
        }

        frameId = requestAnimationFrame(playbackFrame);
    }

    $effect(() => {
        if (!dashboardState.isPlaying) {
            stopPlaybackLoop();
            return;
        }
        stopPlaybackLoop();
        frameId = requestAnimationFrame(playbackFrame);
        return stopPlaybackLoop;
    });

    onDestroy(stopPlaybackLoop);

    function onTimelineInput(e: Event) {
        const idx = Number((e.currentTarget as HTMLInputElement).value);
        dashboardState.setSnapshotIndex(idx, { clearCluster: true });
    }

    function togglePlay() {
        if (dashboardState.isPlaying) {
            dashboardState.pauseTimeline();
            return;
        }
        dashboardState.playTimeline();
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
            <span class="date-val font-mono"
                >{dashboardState.snap.date || "—"}</span
            >
        </div>
        <div class="snap-row">
            <button
                class="play"
                class:on={dashboardState.isPlaying}
                class:playing={dashboardState.isPlaying}
                onclick={togglePlay}
                disabled={dashboardState.timeCount <= 1}
                aria-pressed={dashboardState.isPlaying}
                aria-label={dashboardState.isPlaying
                    ? "Pause snapshot playback"
                    : "Play snapshot timeline"}
            >
                {#if dashboardState.isPlaying}
                    <svg
                        viewBox="0 0 12 12"
                        fill="currentColor"
                        aria-hidden="true"
                    >
                        <rect x="2.5" y="2" width="2.6" height="8" rx="0.8" />
                        <rect x="6.9" y="2" width="2.6" height="8" rx="0.8" />
                    </svg>
                {:else}
                    <svg
                        viewBox="0 0 12 12"
                        fill="currentColor"
                        aria-hidden="true"
                    >
                        <path
                            d="M3.4 2.2a.7.7 0 0 1 1.06-.6l6 3.8a.7.7 0 0 1 0 1.2l-6 3.8a.7.7 0 0 1-1.06-.6V2.2Z"
                        />
                    </svg>
                {/if}
            </button>
            <input
                class="timeline-range"
                class:playing={dashboardState.isPlaying}
                type="range"
                min="0"
                max={Math.max(0, dashboardState.timeCount - 1)}
                step="1"
                value={dashboardState.timeIdx}
                oninput={onTimelineInput}
                disabled={dashboardState.timeCount <= 1}
                style="--timeline-progress: {timelineProgress}%"
                aria-label="Calibration snapshot"
                aria-valuetext={dashboardState.snap.date || "no snapshot"}
            />
        </div>
        <div class="ends">
            <span>{timeStart}</span>
            <span>{timeEnd}</span>
        </div>
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

        <div class="sld">
            <div class="sld-top">
                <span class="sld-lbl">Readout error</span>
                <span class="sld-val"
                    >{dashboardState.errorCutoffs.readoutPct.toFixed(1)}<i>%</i
                    ></span
                >
            </div>
            <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                bind:value={dashboardState.errorCutoffs.readoutPct}
                oninput={clearClusterDuringSliderInput}
                aria-label="Readout error ceiling"
                aria-valuetext="{dashboardState.errorCutoffs.readoutPct.toFixed(
                    1,
                )} percent"
            />
        </div>

        <div class="sld-gap"></div>

        <div class="sld">
            <div class="sld-top">
                <span class="sld-lbl">2Q gate error</span>
                <span class="sld-val"
                    >{dashboardState.errorCutoffs.twoqPct.toFixed(1)}<i>%</i
                    ></span
                >
            </div>
            <input
                type="range"
                min="0"
                max="100"
                step="0.1"
                bind:value={dashboardState.errorCutoffs.twoqPct}
                oninput={clearClusterDuringSliderInput}
                aria-label="Two-qubit gate error ceiling"
                aria-valuetext="{dashboardState.errorCutoffs.twoqPct.toFixed(
                    1,
                )} percent"
            />
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
                <span class="sld-val"
                    >{dashboardState.coherenceCutoffs.minT1}<i>μs</i></span
                >
            </div>
            <input
                type="range"
                min="0"
                max="500"
                step="1"
                bind:value={dashboardState.coherenceCutoffs.minT1}
                oninput={clearClusterDuringSliderInput}
                aria-label="T1 relaxation floor"
                aria-valuetext="{dashboardState.coherenceCutoffs
                    .minT1} microseconds"
            />
        </div>

        <div class="sld-gap"></div>

        <div class="sld">
            <div class="sld-top">
                <span class="sld-lbl">T₂ dephasing</span>
                <span class="sld-val"
                    >{dashboardState.coherenceCutoffs.minT2}<i>μs</i></span
                >
            </div>
            <input
                type="range"
                min="0"
                max="500"
                step="1"
                bind:value={dashboardState.coherenceCutoffs.minT2}
                oninput={clearClusterDuringSliderInput}
                aria-label="T2 dephasing floor"
                aria-valuetext="{dashboardState.coherenceCutoffs
                    .minT2} microseconds"
            />
        </div>
    </div>

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
                <span class="sld-val">{dashboardState.clusterSize}<i>Q</i></span
                >
            </div>
            <input
                type="range"
                min="2"
                max="50"
                step="1"
                bind:value={dashboardState.clusterSize}
                oninput={clearClusterDuringSliderInput}
                aria-label="Cluster size"
                aria-valuetext="{dashboardState.clusterSize} qubits"
            />
        </div>

        <div class="ctrl-lbl">Topology</div>
        <div class="seg full">
            {#each TOPOLOGIES as t (t.value)}
                <button
                    class="seg-btn {dashboardState.topology === t.value
                        ? 'on'
                        : ''}"
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
            Find best cluster <span class="arr">→</span>
        </button>
    </div>
</aside>

<style>
    .date-val {
        font-size: 12px;
        color: var(--text-2);
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

    .snap-row {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    .snap-row input[type="range"] {
        flex: 1;
        min-width: 0;
    }
    .snap-row input.timeline-range {
        background: linear-gradient(
            90deg,
            var(--accent) 0 var(--timeline-progress, 0%),
            var(--border-mid) var(--timeline-progress, 0%) 100%
        );
        transition: background var(--dur-fast) var(--ease-out);
    }
    .snap-row input.timeline-range:disabled {
        background: var(--border-mid);
    }
    .play {
        width: 24px;
        height: 24px;
        flex-shrink: 0;
        display: grid;
        place-items: center;
        border: 1px solid var(--border-mid);
        border-radius: 50%;
        background: var(--surface);
        color: var(--text-2);
        cursor: pointer;
        transition:
            color var(--dur-fast),
            border-color var(--dur-fast),
            background var(--dur-fast);
    }
    .play svg {
        width: 11px;
        height: 11px;
    }
    .play:hover:not(:disabled) {
        color: var(--accent);
        border-color: var(--accent-border);
    }
    .play.on {
        color: var(--accent);
        background: var(--accent-surface);
        border-color: var(--accent-border);
    }
    .play.playing {
        box-shadow: 0 0 0 3px
            color-mix(in oklch, var(--accent) 12%, transparent);
    }
    .play:disabled {
        opacity: 0.35;
        cursor: not-allowed;
    }
    .snap-row input.timeline-range::-webkit-slider-thumb {
        transition:
            box-shadow var(--dur-fast),
            transform var(--dur-fast);
    }
    .snap-row input.timeline-range.playing::-webkit-slider-thumb {
        transform: scale(1.04);
    }
    .snap-row input.timeline-range:not(:disabled):active::-webkit-slider-thumb {
        transform: scale(1.16);
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

    .sld {
        margin-bottom: 14px;
    }
    .sld:last-child {
        margin-bottom: 0;
    }
    .sld-top {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 8px;
    }
    .sld-lbl {
        font-size: 12px;
        color: var(--text-2);
        white-space: nowrap;
    }
    .sld-val {
        font-size: 11.5px;
        color: var(--text);
        font-family: var(--font-mono);
    }
    .sld-val i {
        color: var(--text-3);
        font-style: normal;
        margin-left: 1px;
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
    .ends {
        display: flex;
        justify-content: space-between;
        margin-top: 7px;
        font-size: 10px;
        font-family: var(--font-mono);
        color: var(--text-3);
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
