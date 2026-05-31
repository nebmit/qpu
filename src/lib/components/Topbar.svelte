<script lang="ts">
    import { dashboardState } from "$lib/state.svelte";
    import { onMount } from "svelte";

    const repositoryUrl = "https://github.com/nebmit/qpu";

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

    const METRICS = [
        { k: "readout" as const, l: "Readout" },
        { k: "T1" as const,     l: "T₁" },
        { k: "T2" as const,     l: "T₂" },
    ];
</script>

<header class="topbar">
    <!-- brand zone (aligns with OPERATE column) -->
    <div class="tb-left">
        <span class="brand-word">QPU&nbsp;Calibration&nbsp;<b>Visualizer</b></span>
        <a
            href={repositoryUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View source on GitHub"
            class="gh"
            title="View source on GitHub"
        >
            <svg viewBox="0 0 24 24" width="13" height="13" class="fill-current" aria-hidden="true">
                <path d="M12 .5C5.648.5.5 5.734.5 12.21c0 5.18 3.292 9.57 7.865 11.11.575.11.784-.254.784-.564 0-.279-.01-1.017-.016-1.996-3.2.71-3.878-1.575-3.878-1.575-.524-1.356-1.281-1.716-1.281-1.716-1.048-.737.08-.722.08-.722 1.16.084 1.77 1.216 1.77 1.216 1.03 1.8 2.703 1.28 3.36.98.104-.762.402-1.28.73-1.574-2.553-.298-5.238-1.31-5.238-5.83 0-1.288.438-2.34 1.157-3.164-.117-.3-.5-1.506.11-3.14 0 0 .943-.31 3.088 1.208a10.4 10.4 0 0 1 2.81-.387 10.4 10.4 0 0 1 2.81.387c2.145-1.518 3.088-1.208 3.088-1.208.61 1.634.227 2.84.11 3.14.72.824 1.157 1.876 1.157 3.164 0 4.53-2.69 5.53-5.252 5.82.413.366.78 1.088.78 2.195 0 1.584-.014 2.862-.014 3.25 0 .313.207.68.79.564C20.21 21.78 23.5 17.39 23.5 12.21 23.5 5.734 18.352.5 12 .5Z"/>
            </svg>
        </a>
    </div>

    <!-- figure zone (center stage) — view selector lives in the figure header -->
    <div class="tb-center">
        <div class="tb-figgrp">
            <span class="fig-no">Fig.&nbsp;01</span>
            <div class="seg">
                {#each METRICS as m (m.k)}
                    <button
                        class="seg-btn {dashboardState.metricMode === m.k ? 'on' : ''}"
                        onclick={() => (dashboardState.metricMode = m.k)}
                    >
                        {m.l}
                    </button>
                {/each}
            </div>
        </div>
    </div>

    <!-- controls zone (aligns with READ column) -->
    <div class="tb-right">
        <!-- Theme toggle -->
        <button class="ibtn" onclick={toggleDark} aria-label="Toggle dark mode" title={dark ? "Switch to light mode" : "Switch to dark mode"}>
            {#if dark}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="4"/>
                    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
                </svg>
            {:else}
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
            {/if}
        </button>
    </div>
</header>

<style>
    .tb-left {
        justify-content: space-between;
    }
</style>
