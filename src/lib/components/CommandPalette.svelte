<script lang="ts">
    import { dashboardState } from "$lib/state/dashboard.svelte";
    import { themeState } from "$lib/state/theme.svelte";
    import { METRIC_OPTIONS } from "$lib/domain/metrics";
    import { TOPOLOGIES } from "$lib/domain/cluster";

    let { open = $bindable(false) } = $props<{ open?: boolean }>();

    let query = $state("");
    let activeIdx = $state(0);
    let inputEl = $state<HTMLInputElement | null>(null);

    type Cmd = { id: string; label: string; hint?: string; run: () => void };

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
                run: () => dashboardState.runFindCluster(),
            },
            {
                id: "clear",
                label: "Clear cluster",
                run: () => dashboardState.clearCluster(),
            },
            {
                id: "theme",
                label: themeState.dark
                    ? "Switch to light mode"
                    : "Switch to dark mode",
                run: () => themeState.toggle(),
            },
        );
        for (const opt of METRIC_OPTIONS) {
            cmds.push({
                id: `metric-${opt.value}`,
                label: `Colour by ${opt.label}`,
                hint: "metric",
                run: () => (dashboardState.metricMode = opt.value),
            });
        }
        for (const t of TOPOLOGIES) {
            cmds.push({
                id: `topo-${t.value}`,
                label: `Topology: ${t.label}`,
                run: () => {
                    dashboardState.topology = t.value;
                    dashboardState.clearCluster();
                },
            });
        }
        for (const d of dashboardState.devices) {
            cmds.push({
                id: `dev-${d}`,
                label: `Device: ${d}`,
                run: () => dashboardState.setDevice(d),
            });
        }
        return cmds;
    });

    let filtered = $derived.by(() => {
        const q = query.trim().toLowerCase();
        if (!q) return commands;
        return commands.filter(
            (c) => c.id.startsWith("qubit-") || c.label.toLowerCase().includes(q),
        );
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
            activeIdx = Math.min(activeIdx + 1, filtered.length - 1);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            activeIdx = Math.max(activeIdx - 1, 0);
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
                <span><b>F</b> find · <b>B</b> build · <b>M</b> metric · <b>[ ]</b> snapshot</span>
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
