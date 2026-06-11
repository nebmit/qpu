<script lang="ts">
    import { onDestroy } from "svelte";
    import { dashboardState } from "$lib/state/dashboard.svelte";

    let timeStart = $derived(dashboardState.deviceSnapshots[0]?.date || "—");
    let timeEnd = $derived(dashboardState.deviceSnapshots.at(-1)?.date || "—");

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
            <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                <rect x="2.5" y="2" width="2.6" height="8" rx="0.8" />
                <rect x="6.9" y="2" width="2.6" height="8" rx="0.8" />
            </svg>
        {:else}
            <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
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

<style>
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
    .ends {
        display: flex;
        justify-content: space-between;
        margin-top: 7px;
        font-size: 10px;
        font-family: var(--font-mono);
        color: var(--text-3);
    }
</style>
