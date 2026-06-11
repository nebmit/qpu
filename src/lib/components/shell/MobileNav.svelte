<script lang="ts">
    let { activeSheet = null, hasResults = false, onToggle, onClose } = $props<{
        activeSheet?: "controls" | "results" | null;
        hasResults?: boolean;
        onToggle?: (which: "controls" | "results") => void;
        onClose?: () => void;
    }>();
</script>

<nav class="mob-nav" aria-label="Navigation">
    <button
        class="mob-tab"
        class:on={activeSheet === "controls"}
        onclick={() => onToggle?.("controls")}
        aria-label="Controls"
    >
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <path d="M4 6h16M4 12h10M4 18h7" />
            <circle cx="18" cy="12" r="2.5" />
            <circle cx="14" cy="18" r="2.5" />
        </svg>
        <span>Controls</span>
    </button>
    <button
        class="mob-tab"
        class:on={activeSheet === "results"}
        onclick={() => onToggle?.("results")}
        aria-label="Results"
    >
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4l2.5 2.5" />
        </svg>
        <span>Results</span>
        <span class="mob-badge" class:show={hasResults}></span>
    </button>
</nav>
<div
    class="mob-backdrop"
    class:show={activeSheet !== null}
    onclick={onClose}
    aria-hidden="true"
></div>
