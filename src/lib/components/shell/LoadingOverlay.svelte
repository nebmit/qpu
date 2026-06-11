<script lang="ts">
    let {
        progress,
        bytesReceived,
        bytesTotal,
        transitioning = false,
    } = $props<{
        progress: number;
        bytesReceived: number;
        bytesTotal: number | null;
        transitioning?: boolean;
    }>();

    let loaderWidth = $state(1280);
</script>

<div
    class="loader-overlay fixed inset-0 z-(--z-loader) flex flex-col items-center justify-center gap-6 bg-(--bg)"
    class:transitioning
    bind:clientWidth={loaderWidth}
    style="--bar-scale: {(loaderWidth / 224).toFixed(3)}"
>
    <div class="loader-content flex flex-col items-center gap-5">
        <div class="loader-label flex flex-col items-center gap-1.5 mb-1">
            <p
                class="text-[10.5px] tracking-[0.08em] uppercase font-medium"
                style="color:var(--text-3)"
            >
                Loading calibration data
            </p>
        </div>
        <div class="loader-bar-wrap flex flex-col gap-2">
            <div
                class="loader-track h-0.75 rounded-full overflow-hidden"
                style="background:var(--border-mid)"
            >
                <div
                    class="loader-fill h-full rounded-full transition-none"
                    class:indeterminate={bytesTotal === null &&
                        bytesReceived > 0}
                    style="width:{(progress * 100).toFixed(
                        1,
                    )}%; background:var(--accent)"
                ></div>
            </div>
            <div class="loader-meta flex justify-between">
                <span class="text-[11px] font-mono" style="color:var(--text-3)">
                    {bytesReceived < 1e6
                        ? `${Math.round(bytesReceived / 1e3)} KB`
                        : `${(bytesReceived / 1e6).toFixed(1)} MB`}{bytesTotal
                        ? ` / ${(bytesTotal / 1e6).toFixed(1)} MB`
                        : ""}
                </span>
                <span class="text-[11px] font-mono" style="color:var(--text-3)">
                    {#if bytesTotal === null}
                        —
                    {:else}
                        {Math.round((bytesReceived / bytesTotal) * 100)}%
                    {/if}
                </span>
            </div>
        </div>
    </div>
</div>

<style>
    .loader-bar-wrap {
        width: 14rem;
    }
    @keyframes indeterminate-slide {
        0% {
            transform: translateX(-100%);
        }
        100% {
            transform: translateX(calc(100% / 0.3));
        }
    }
    .loader-fill.indeterminate {
        width: 30% !important;
        animation: indeterminate-slide 1.4s var(--ease-in-out, ease-in-out)
            infinite;
    }
    .loader-track {
        transform-origin: center;
        transition:
            transform var(--dur-base) var(--ease-in-out),
            background-color var(--dur-ui) ease-out,
            border-radius var(--dur-ui) ease-out;
    }
    .loader-label,
    .loader-meta {
        transition: opacity var(--dur-fast) ease-out;
    }
    .loader-overlay {
        transition: opacity var(--dur-ui) ease-out var(--dur-ui);
    }
    .loader-overlay.transitioning {
        opacity: 0;
        pointer-events: none;
    }
    .loader-overlay.transitioning .loader-track {
        transform: scaleX(var(--bar-scale, 6));
        background-color: transparent;
        border-radius: 0;
        overflow: visible;
    }
    .loader-overlay.transitioning .loader-fill {
        animation: bar-pulse var(--dur-base) var(--ease-standard) both;
    }
    .loader-overlay.transitioning .loader-label,
    .loader-overlay.transitioning .loader-meta {
        opacity: 0;
    }
</style>
