<script lang="ts">
    import { dashboardState } from "$lib/state.svelte";
    import { QPU_DEVICES, TOTAL_QUBITS, findCluster } from "$lib/utils/data";

    const repositoryUrl = "https://github.com/nebmit/qpu";

    let timeStart = $derived.by(() => {
        const list = dashboardState.snapshotsByDevice[dashboardState.device] || [];
        return list[0]?.date || "—";
    });
    let timeEnd = $derived.by(() => {
        const list = dashboardState.snapshotsByDevice[dashboardState.device] || [];
        return list[list.length - 1]?.date || "—";
    });
</script>

<div
    class="sidebar {dashboardState.sidebarOpen ? 'open' : 'closed'}"
>
    <div class="sidebar-inner">
        <!-- Logo -->
        <div class="section-gap-lg">
            <div class="flex items-center justify-between gap-3">
                <div>
                    <div class="eyebrow mb-1.5">Quantum Calibration</div>
                    <div class="wordmark">QPU Visualizer</div>
                </div>

                <a
                    href={repositoryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open repository"
                    class="gh-link"
                    title="Open repository"
                >
                    <svg viewBox="0 0 24 24" class="h-3.5 w-3.5 fill-current" aria-hidden="true">
                        <path d="M12 .5C5.648.5.5 5.734.5 12.21c0 5.18 3.292 9.57 7.865 11.11.575.11.784-.254.784-.564 0-.279-.01-1.017-.016-1.996-3.2.71-3.878-1.575-3.878-1.575-.524-1.356-1.281-1.716-1.281-1.716-1.048-.737.08-.722.08-.722 1.16.084 1.77 1.216 1.77 1.216 1.03 1.8 2.703 1.28 3.36.98.104-.762.402-1.28.73-1.574-2.553-.298-5.238-1.31-5.238-5.83 0-1.288.438-2.34 1.157-3.164-.117-.3-.5-1.506.11-3.14 0 0 .943-.31 3.088 1.208a10.4 10.4 0 0 1 2.81-.387 10.4 10.4 0 0 1 2.81.387c2.145-1.518 3.088-1.208 3.088-1.208.61 1.634.227 2.84.11 3.14.72.824 1.157 1.876 1.157 3.164 0 4.53-2.69 5.53-5.252 5.82.413.366.78 1.088.78 2.195 0 1.584-.014 2.862-.014 3.25 0 .313.207.68.79.564C20.21 21.78 23.5 17.39 23.5 12.21 23.5 5.734 18.352.5 12 .5Z"/>
                    </svg>
                    <svg viewBox="0 0 24 24" class="h-3 w-3 stroke-current fill-none" aria-hidden="true">
                        <path d="M7 17L17 7" stroke-width="1.8" stroke-linecap="round"/>
                        <path d="M10 7h7v7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                </a>
            </div>
        </div>

        <!-- Device -->
        <div class="section-gap">
            <div class="eyebrow mb-2">Device</div>
            {#each QPU_DEVICES as d (d)}
                <button
                    class="d-tab {dashboardState.device === d ? 'active' : ''}"
                    onclick={() => dashboardState.setDevice(d)}
                >
                    {d}
                </button>
            {/each}
        </div>

        <div class="divider"></div>

        <!-- Date -->
        <div class="section-gap">
            <div class="flex justify-between items-baseline mb-2.5">
                <span class="eyebrow">Date</span>
                <span class="font-mono text-[12px]" style="color:var(--text-2)">{dashboardState.snap.date || "—"}</span>
            </div>
            <input
                type="range"
                min="0"
                max={Math.max(0, dashboardState.timeCount - 1)}
                bind:value={dashboardState.timeIdx}
                onchange={() => dashboardState.clearCluster()}
                disabled={dashboardState.timeCount <= 1}
            />
            <div class="range-ends">
                <span>{timeStart}</span>
                <span>{timeEnd}</span>
            </div>
        </div>

        <div class="divider"></div>

        <!-- Error cutoff -->
        <div class="section-gap">
            <div class="eyebrow mb-3">Error cutoff</div>

            <div class="control-row">
                <div class="control-label">Readout error</div>
                <input type="range" min="0" max="100" step="0.1"
                    bind:value={dashboardState.errorCutoffs.readoutPct} />
            </div>
            <div class="control-input-row">
                <input
                    type="number" min="0" max="100" step="0.1"
                    bind:value={dashboardState.errorCutoffs.readoutPct}
                    class="num-input"
                />
                <span class="unit">%</span>
            </div>

            <div class="control-row mt-3">
                <div class="control-label">CX gate error</div>
                <input type="range" min="0" max="100" step="0.1"
                    bind:value={dashboardState.errorCutoffs.cxPct} />
            </div>
            <div class="control-input-row">
                <input
                    type="number" min="0" max="100" step="0.1"
                    bind:value={dashboardState.errorCutoffs.cxPct}
                    class="num-input"
                />
                <span class="unit">%</span>
            </div>
        </div>

        <div class="divider"></div>

        <!-- Coherence minimums -->
        <div class="section-gap">
            <div class="eyebrow mb-3">Coherence min</div>

            <div class="control-row">
                <div class="control-label">T₁ min</div>
                <input type="range" min="0" max="500" step="1"
                    bind:value={dashboardState.coherenceCutoffs.minT1} />
            </div>
            <div class="control-input-row">
                <input
                    type="number" min="0" max="500" step="1"
                    bind:value={dashboardState.coherenceCutoffs.minT1}
                    class="num-input"
                />
                <span class="unit">μs</span>
            </div>

            <div class="control-row mt-3">
                <div class="control-label">T₂ min</div>
                <input type="range" min="0" max="500" step="1"
                    bind:value={dashboardState.coherenceCutoffs.minT2} />
            </div>
            <div class="control-input-row">
                <input
                    type="number" min="0" max="500" step="1"
                    bind:value={dashboardState.coherenceCutoffs.minT2}
                    class="num-input"
                />
                <span class="unit">μs</span>
            </div>
        </div>

        <div class="divider"></div>

        <!-- Connectivity -->
        <div class="section-gap">
            <div class="eyebrow mb-3">Connectivity</div>

            <div class="grid grid-cols-3 gap-2 mb-3">
                {#each [
                    { label: "1-link", sub: "endpoint", key: "endpoint" as const },
                    { label: "2-link", sub: "chain",    key: "chain"    as const },
                    { label: "3-link", sub: "junction", key: "junction" as const },
                ] as col (col.key)}
                    <div class="conn-col">
                        <span class="conn-label">{col.label}</span>
                        <input
                            type="number" min="0" max={TOTAL_QUBITS} step="1"
                            bind:value={dashboardState.connRules[col.key]}
                            onchange={() => dashboardState.clearCluster()}
                            class="conn-input"
                        />
                        <span class="conn-sub">{col.sub}</span>
                    </div>
                {/each}
            </div>

            <div class="flex justify-between text-[12px]" style="color:var(--text-3)">
                <span>Total</span>
                <span
                    class="font-mono {dashboardState.totalConnections > TOTAL_QUBITS ? 'over' : ''}"
                    style={dashboardState.totalConnections <= TOTAL_QUBITS ? 'color:var(--text-2)' : ''}
                >
                    {dashboardState.totalConnections}Q{dashboardState.totalConnections > TOTAL_QUBITS ? " ⚠" : ""}
                </span>
            </div>
        </div>

        <div class="divider"></div>

        <!-- Find cluster -->
        <button
            class="find-btn"
            disabled={dashboardState.totalConnections === 0}
            onclick={() => {
                dashboardState.cluster = findCluster(
                    $state.snapshot(dashboardState.connRules),
                    $state.snapshot(dashboardState.snap.qubits),
                    $state.snapshot(dashboardState.filteredEdges),
                    new Set(dashboardState.allowedQubitIds),
                );
                dashboardState.selectedId = null;
            }}
        >
            Find Best Cluster
        </button>

        <!-- Cluster stats -->
        {#if dashboardState.clusterStats}
            <div class="cluster-card animate-[fadeIn_0.2s_ease_forwards]">
                <div class="cluster-header">
                    <span class="cluster-title">
                        Cluster · {dashboardState.cluster.length}Q
                    </span>
                    <button
                        onclick={() => dashboardState.clearCluster()}
                        class="cluster-close"
                    >×</button>
                </div>
                <div class="flex gap-5">
                    {#each [
                        { l: "T₁",      v: dashboardState.clusterStats.T1, s: "μs" },
                        { l: "T₂",      v: dashboardState.clusterStats.T2, s: "μs" },
                        { l: "Readout", v: dashboardState.clusterStats.ro, s: "%"  },
                    ] as s (s.l)}
                        {@const showUnit = s.v !== "—"}
                        <div class="cluster-stat">
                            <span class="cluster-stat-label">{s.l}</span>
                            <span class="cluster-stat-value font-mono">
                                {s.v}{#if showUnit}<span class="cluster-stat-unit">{s.s}</span>{/if}
                            </span>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </div>
</div>

<style>
    .sidebar {
        height: 100%;
        overflow: hidden;
        flex-shrink: 0;
        background: var(--sidebar-bg);
        border-right: 1px solid var(--border);
        display: flex;
        flex-direction: column;
        transition: width 0.15s ease-out, min-width 0.15s ease-out;
    }
    .sidebar.open   { width: 284px; min-width: 284px; }
    .sidebar.closed { width: 0;     min-width: 0; }

    .sidebar-inner {
        flex: 1;
        overflow-y: auto;
        padding: 24px 20px 24px;
    }

    /* Typography helpers */
    .eyebrow {
        font-size: 10.5px;
        font-weight: 500;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--text-3);
    }
    .wordmark {
        font-size: 18px;
        font-weight: 300;
        color: var(--text);
        letter-spacing: -0.02em;
        line-height: 1;
    }

    /* Spacing */
    .section-gap    { margin-bottom: 20px; }
    .section-gap-lg { margin-bottom: 24px; }
    .divider {
        height: 1px;
        background: var(--border);
        margin: 20px 0;
    }

    /* GitHub link */
    .gh-link {
        display: inline-flex;
        flex-shrink: 0;
        align-items: center;
        gap: 4px;
        border-radius: 99px;
        border: 1px solid var(--border);
        background: var(--sidebar-bg);
        padding: 5px 10px;
        font-size: 9.5px;
        color: var(--text-2);
        transition: background 0.12s, color 0.12s;
        text-decoration: none;
    }
    .gh-link:hover {
        background: var(--surface);
        color: var(--text);
    }

    /* Device tabs */
    .d-tab {
        display: block;
        width: 100%;
        text-align: left;
        padding: 6px 10px;
        border-radius: var(--radius-sm);
        border: none;
        background: transparent;
        color: var(--text-3);
        font-size: 12px;
        cursor: pointer;
        font-family: var(--font-mono);
        font-weight: 300;
        transition: color 0.12s, background 0.12s;
    }
    .d-tab:hover  { color: var(--text-2); background: var(--border); }
    .d-tab.active { color: var(--text);   background: rgba(0,0,0,0.06); }
    :global([data-theme='dark']) .d-tab.active { background: rgba(255,255,255,0.07); }

    /* Range labels */
    .range-ends {
        display: flex;
        justify-content: space-between;
        margin-top: 6px;
        font-size: 11px;
        color: var(--text-3);
    }

    /* Controls */
    .control-row   { margin-bottom: 6px; }
    .control-label {
        font-size: 12.5px;
        color: var(--text-2);
        margin-bottom: 6px;
    }
    .control-input-row {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 4px;
        margin-top: 6px;
    }
    .num-input {
        width: 64px;
        padding: 4px 8px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-mid);
        background: var(--surface);
        font-size: 12px;
        font-family: var(--font-mono);
        color: var(--text);
        text-align: right;
    }
    .unit {
        font-size: 11px;
        color: var(--text-3);
        width: 16px;
    }

    /* Connectivity grid */
    .conn-col {
        display: flex;
        flex-direction: column;
        gap: 5px;
        align-items: center;
    }
    .conn-label {
        font-size: 10px;
        font-weight: 500;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--text-3);
        text-align: center;
    }
    .conn-input {
        width: 100%;
        padding: 6px 4px;
        border-radius: var(--radius-sm);
        border: 1px solid var(--border-mid);
        background: var(--bg);
        font-size: 14px;
        font-family: var(--font-mono);
        color: var(--text);
        text-align: center;
    }
    .conn-sub {
        font-size: 9.5px;
        color: var(--text-3);
        text-align: center;
    }
    .over { color: oklch(55% 0.14 25) !important; }

    /* Find button */
    .find-btn {
        width: 100%;
        padding: 10px 14px;
        background: var(--accent);
        border: none;
        border-radius: var(--radius-sm);
        color: #fff;
        font-size: 13px;
        font-family: var(--font-sans);
        font-weight: 500;
        cursor: pointer;
        transition: opacity 0.14s, box-shadow 0.14s;
        letter-spacing: 0.01em;
    }
    .find-btn:hover  { opacity: 0.88; box-shadow: 0 2px 8px color-mix(in oklch, var(--accent) 35%, transparent); }
    .find-btn:active { opacity: 0.76; transform: scale(0.99); }
    .find-btn:disabled { opacity: 0.35; cursor: not-allowed; box-shadow: none; }

    /* Cluster card */
    .cluster-card {
        margin-top: 14px;
        padding: 13px 14px;
        background: var(--surface);
        border: 1px solid var(--accent-border);
        border-left: 3px solid var(--accent);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-panel);
    }
    .cluster-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
    }
    .cluster-title {
        font-size: 11px;
        color: var(--accent);
        letter-spacing: 0.07em;
        text-transform: uppercase;
        font-weight: 500;
    }
    .cluster-close {
        background: none;
        border: none;
        color: var(--text-3);
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        padding: 0 2px;
        transition: color 0.12s;
    }
    .cluster-close:hover { color: var(--text-2); }

    .cluster-stat { display: flex; flex-direction: column; gap: 2px; }
    .cluster-stat-label {
        font-size: 10px;
        color: var(--text-3);
        letter-spacing: 0.05em;
        text-transform: uppercase;
    }
    .cluster-stat-value {
        font-size: 15px;
        color: var(--text);
        line-height: 1;
    }
    .cluster-stat-unit {
        font-size: 9.5px;
        margin-left: 2px;
        color: var(--text-3);
    }
</style>
