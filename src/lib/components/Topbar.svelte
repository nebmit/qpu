<script lang="ts">
    import { dashboardState } from "$lib/state.svelte";
    import { onMount } from "svelte";

    const METRICS = [
        { k: "readout", l: "Readout" },
        { k: "T1", l: "T₁" },
        { k: "T2", l: "T₂" },
    ] as const;

    let dark = $state(false);

    function applyTheme(isDark: boolean) {
        document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    }

    function toggleDark() {
        dark = !dark;
        localStorage.setItem("theme", dark ? "dark" : "light");
        applyTheme(dark);
    }

    onMount(() => {
        const stored = localStorage.getItem("theme");
        if (stored === "dark" || stored === "light") {
            dark = stored === "dark";
        } else {
            dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        }
        applyTheme(dark);
    });
</script>

<div class="topbar">
    <div class="flex gap-0.5">
        {#each METRICS as m (m.k)}
            <button
                class="m-tab {dashboardState.metricMode === m.k ? 'active' : ''}"
                onclick={() => (dashboardState.metricMode = m.k)}
            >
                {m.l}
            </button>
        {/each}
    </div>

    <div class="flex-1"></div>

    <!-- Device stats -->
    <div class="stats-group">
        <div class="stat">
            <span class="stat-label">T₁</span>
            <span class="stat-value font-mono">
                {dashboardState.stats.T1}{#if dashboardState.stats.T1 !== "—"}<span class="stat-unit">μs</span>{/if}
            </span>
        </div>
        <div class="stat">
            <span class="stat-label">T₂</span>
            <span class="stat-value font-mono">
                {dashboardState.stats.T2}{#if dashboardState.stats.T2 !== "—"}<span class="stat-unit">μs</span>{/if}
            </span>
        </div>
        <div class="stat">
            <span class="stat-label">Readout</span>
            <span class="stat-value font-mono">
                {dashboardState.stats.ro}{#if dashboardState.stats.ro !== "—"}%{/if}
            </span>
        </div>
        <div class="stat">
            <span class="stat-label">CX</span>
            <span class="stat-value font-mono">{dashboardState.stats.cx}</span>
        </div>

        <div class="stat-divider"></div>
        <span class="qe-badge font-mono">{dashboardState.stats.qubitsCount}Q · {dashboardState.stats.edgesCount}E</span>
    </div>

    <!-- Dark mode toggle -->
    <button class="theme-btn" onclick={toggleDark} aria-label="Toggle dark mode" title={dark ? "Switch to light mode" : "Switch to dark mode"}>
        {#if dark}
            <!-- Sun -->
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="4"/>
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
            </svg>
        {:else}
            <!-- Moon -->
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
        {/if}
    </button>
</div>

<style>
    .topbar {
        height: 52px;
        flex-shrink: 0;
        background: var(--bg);
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: center;
        padding: 0 16px;
        gap: 4px;
    }

    .m-tab {
        padding: 5px 13px;
        border-radius: var(--radius-sm);
        font-size: 12.5px;
        font-weight: 450;
        cursor: pointer;
        border: none;
        background: transparent;
        color: var(--text-3);
        transition: color 0.12s, background 0.12s;
        font-family: var(--font-sans);
        letter-spacing: 0.01em;
    }
    .m-tab:hover  { color: var(--text-2); }
    .m-tab.active {
        color: var(--accent);
        background: var(--accent-surface);
    }

    .stats-group {
        display: flex;
        align-items: center;
        gap: 20px;
        padding: 0 14px;
        height: 32px;
        border: 1px solid var(--border);
        border-radius: var(--radius-sm);
        background: var(--surface);
    }

    .stat {
        display: flex;
        flex-direction: column;
        gap: 1px;
        align-items: flex-end;
    }
    .stat-label {
        font-size: 9.5px;
        color: var(--text-3);
        letter-spacing: 0.06em;
        text-transform: uppercase;
        line-height: 1;
    }
    .stat-value {
        font-size: 12.5px;
        color: var(--text-2);
        line-height: 1;
    }
    .stat-unit {
        font-size: 9px;
        margin-left: 2px;
        color: var(--text-3);
    }

    .stat-divider {
        width: 1px;
        height: 18px;
        background: var(--border);
    }

    .qe-badge {
        font-size: 11px;
        color: var(--text-3);
    }

    .theme-btn {
        margin-left: 8px;
        width: 32px;
        height: 32px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border);
        background: var(--surface);
        color: var(--text-3);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: color 0.12s, background 0.12s, border-color 0.12s;
        flex-shrink: 0;
    }
    .theme-btn:hover {
        color: var(--text-2);
        background: var(--sidebar-bg);
        border-color: var(--border-mid);
    }
</style>
