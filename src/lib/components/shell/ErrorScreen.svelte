<script lang="ts">
    let { message = null, onRetry } = $props<{
        message?: string | null;
        onRetry?: () => void;
    }>();
</script>

<div
    class="fade-in fixed inset-0 z-(--z-loader) flex flex-col items-center justify-center bg-(--bg)"
>
    <div
        class="w-10 h-10 mb-5 rounded-full flex items-center justify-center"
        style="background:var(--neg-bg)"
    >
        <svg
            class="w-5 h-5"
            style="color:var(--neg)"
            viewBox="0 0 20 20"
            fill="currentColor"
        >
            <path
                fill-rule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clip-rule="evenodd"
            />
        </svg>
    </div>
    <h2 class="text-[15px] font-medium mb-2" style="color:var(--text)">
        Failed to load calibration data
    </h2>
    {#if message}
        <p
            class="text-[12px] font-mono mb-6 max-w-85 text-center break-all"
            style="color:var(--text-3)"
        >
            {message}
        </p>
    {/if}
    <button
        onclick={onRetry}
        class="text-[13px] px-4 py-2 rounded-sm font-medium cursor-pointer border-none"
        style="background:var(--accent-surface); color:var(--accent)"
    >
        Retry
    </button>
</div>
