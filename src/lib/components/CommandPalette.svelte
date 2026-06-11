<script lang="ts">
    import { dashboardState } from "$lib/state/dashboard.svelte";
    import { themeState } from "$lib/state/theme.svelte";
    import { METRIC_OPTIONS } from "$lib/domain/metrics";
    import { TOPOLOGIES } from "$lib/domain/cluster";

    let { open = $bindable(false) } = $props<{ open?: boolean }>();

    let query = $state("");
    let activeIdx = $state(0);
    let inputEl = $state<HTMLInputElement | null>(null);

    type Cmd = {
        id: string;
        label: string;
        hint?: string;
        keywords?: string[];
        run: () => void;
    };

    let hasClusterResult = $derived(
        dashboardState.cluster.length > 0 || dashboardState.findFailed,
    );

    function stepSnapshot(dir: number) {
        const next = dashboardState.timeIdx + dir;
        if (next < 0 || next > dashboardState.timeCount - 1) return;
        dashboardState.setSnapshotIndex(next, { clearCluster: true });
    }

    let commands = $derived.by(() => {
        const cmds: Cmd[] = [];

        const m = query.trim().match(/^q?\s*(\d{1,3})$/i);
        if (m) {
            const id = Number(m[1]);
            if (dashboardState.snap.qubits[id]) {
                cmds.push({
                    id: `qubit-${id}`,
                    label: `Jump to qubit Q${String(id).padStart(3, "0")}`,
                    hint: "inspect",
                    run: () => {
                        dashboardState.selectedId = id;
                    },
                });
            }
        }

        cmds.push(
            {
                id: "find",
                label: "Find best cluster",
                hint: "F",
                keywords: ["build", "cluster", "search"],
                run: () => {
                    if (dashboardState.totalConnections > 0) {
                        dashboardState.runFindCluster();
                    }
                },
            },
            {
                id: "reset",
                label: "Reset filters and inputs",
                hint: "defaults",
                keywords: ["clear", "defaults", "filters", "cluster"],
                run: () => dashboardState.resetInputs(),
            },
            {
                id: "theme",
                label: themeState.dark
                    ? "Switch to light mode"
                    : "Switch to dark mode",
                keywords: ["appearance"],
                run: () => themeState.toggle(),
            },
        );
        if (hasClusterResult) {
            cmds.splice(2, 0, {
                id: "clear-cluster",
                label: "Clear cluster result",
                keywords: ["remove selection"],
                run: () => dashboardState.clearCluster(),
            });
        }
        if (dashboardState.timeCount > 1) {
            cmds.push(
                {
                    id: "timeline-toggle",
                    label: dashboardState.isPlaying
                        ? "Pause snapshot playback"
                        : "Play snapshot timeline",
                    hint: dashboardState.isPlaying ? "pause" : "play",
                    keywords: ["timeline", "snapshots"],
                    run: () => {
                        if (dashboardState.isPlaying) {
                            dashboardState.pauseTimeline();
                            return;
                        }
                        dashboardState.playTimeline();
                    },
                },
                {
                    id: "snapshot-prev",
                    label: "Previous snapshot",
                    hint: "[",
                    keywords: ["timeline", "date"],
                    run: () => stepSnapshot(-1),
                },
                {
                    id: "snapshot-next",
                    label: "Next snapshot",
                    hint: "]",
                    keywords: ["timeline", "date"],
                    run: () => stepSnapshot(1),
                },
                {
                    id: "snapshot-latest",
                    label: "Jump to latest snapshot",
                    keywords: ["timeline", "date"],
                    run: () =>
                        dashboardState.setSnapshotIndex(dashboardState.timeCount - 1, {
                            clearCluster: true,
                        }),
                },
            );
        }
        for (const opt of METRIC_OPTIONS) {
            cmds.push({
                id: `metric-${opt.value}`,
                label: `View metric: ${opt.label}`,
                hint: opt.value === dashboardState.metricMode ? "active" : "metric",
                keywords: ["color", "colour", "metric"],
                run: () => (dashboardState.metricMode = opt.value),
            });
        }
        for (const t of TOPOLOGIES) {
            cmds.push({
                id: `topo-${t.value}`,
                label: `Set topology: ${t.label}`,
                hint: t.value === dashboardState.topology ? "active" : undefined,
                keywords: ["shape", "cluster"],
                run: () => {
                    dashboardState.pauseTimeline();
                    dashboardState.topology = t.value;
                    dashboardState.clearCluster();
                },
            });
        }
        for (const d of dashboardState.devices) {
            cmds.push({
                id: `dev-${d}`,
                label: `Switch device: ${d}`,
                hint: d === dashboardState.device ? "active" : undefined,
                keywords: ["backend", "qpu"],
                run: () => dashboardState.setDevice(d),
            });
        }
        return cmds;
    });

    let filtered = $derived.by(() => {
        const q = query.trim().toLowerCase();
        if (!q) return commands;
        return commands.filter((c) => {
            const haystack = [c.id, c.label, c.hint, ...(c.keywords ?? [])]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            return c.id.startsWith("qubit-") || haystack.includes(q);
        });
    });

    $effect(() => {
        if (activeIdx > filtered.length - 1) {
            activeIdx = Math.max(0, filtered.length - 1);
        }
    });

    $effect(() => {
        if (open) {
            query = "";
            activeIdx = 0;
            queueMicrotask(() => inputEl?.focus());
        }
    });

    function close() {
        open = false;
    }

    function run(cmd: Cmd | undefined) {
        if (!cmd) return;
        close();
        cmd.run();
    }

    function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") {
            e.preventDefault();
            close();
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            activeIdx = filtered.length
                ? Math.min(activeIdx + 1, filtered.length - 1)
                : 0;
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            activeIdx = filtered.length ? Math.max(activeIdx - 1, 0) : 0;
        } else if (e.key === "Enter") {
            e.preventDefault();
            run(filtered[activeIdx]);
        }
    }
</script>

{#if open}
    <div class="cp-wrap">
        <div class="cp-backdrop" onclick={close} aria-hidden="true"></div>
        <div
            class="cp"
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
        >
            <input
                bind:this={inputEl}
                class="cp-input"
                placeholder="Type a command or qubit id…"
                bind:value={query}
                oninput={() => (activeIdx = 0)}
                onkeydown={onKey}
                role="combobox"
                aria-expanded="true"
                aria-controls="cp-list"
                aria-activedescendant={filtered[activeIdx]
                    ? `cp-opt-${filtered[activeIdx].id}`
                    : undefined}
            />
            <ul class="cp-list" id="cp-list" role="listbox">
                {#each filtered as cmd, i (cmd.id)}
                    <li
                        id="cp-opt-{cmd.id}"
                        role="option"
                        aria-selected={i === activeIdx}
                    >
                        <button
                            class="cp-item"
                            class:active={i === activeIdx}
                            tabindex="-1"
                            onmouseenter={() => (activeIdx = i)}
                            onclick={() => run(cmd)}
                        >
                            <span>{cmd.label}</span>
                            {#if cmd.hint}
                                <span class="cp-hint">{cmd.hint}</span>
                            {/if}
                        </button>
                    </li>
                {:else}
                    <li class="cp-empty">No matching command</li>
                {/each}
            </ul>
            <div class="cp-foot">
                <span><b>↑↓</b> navigate · <b>⏎</b> run · <b>esc</b> close</span>
                <span><b>F</b> find · <b>M</b> metric · <b>[ ]</b> snapshot</span>
            </div>
        </div>
    </div>
{/if}

<style>
    .cp-wrap {
        position: fixed;
        inset: 0;
        z-index: var(--z-palette);
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding: 16vh 16px 16px;
    }
    .cp-backdrop {
        position: absolute;
        inset: 0;
        background: color-mix(in oklch, var(--bg) 55%, transparent);
        animation: plate-fade-in var(--dur-fast) var(--ease-out) both;
    }
    .cp {
        position: relative;
        width: min(520px, 100%);
        background: var(--surface);
        border: 1px solid var(--border-mid);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-pop);
        overflow: hidden;
        animation: fadeIn var(--dur-fast) var(--ease-out) both;
    }
    .cp-input {
        width: 100%;
        border: none;
        outline: none;
        background: transparent;
        padding: 14px 16px;
        font-size: 14px;
        font-family: var(--font-sans);
        color: var(--text);
        border-bottom: 1px solid var(--border);
    }
    .cp-input::placeholder {
        color: var(--text-3);
    }
    .cp-list {
        list-style: none;
        margin: 0;
        padding: 5px;
        max-height: 320px;
        overflow-y: auto;
    }
    .cp-item {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 8px 11px;
        border: none;
        border-radius: var(--radius-sm);
        background: transparent;
        color: var(--text-2);
        font-size: 13px;
        font-family: var(--font-sans);
        text-align: left;
        cursor: pointer;
    }
    .cp-item.active {
        background: var(--accent-surface);
        color: var(--text);
    }
    .cp-hint {
        font-family: var(--font-mono);
        font-size: 10px;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--text-3);
        flex-shrink: 0;
    }
    .cp-empty {
        padding: 14px 11px;
        font-size: 13px;
        color: var(--text-3);
    }
    .cp-foot {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 8px 14px;
        border-top: 1px solid var(--border);
        font-size: 10.5px;
        color: var(--text-3);
    }
    .cp-foot b {
        font-weight: 600;
        color: var(--text-2);
        font-family: var(--font-mono);
    }

    @media (max-width: 767px) {
        .cp-wrap {
            display: none;
        }
    }
</style>
