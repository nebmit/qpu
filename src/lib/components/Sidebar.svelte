<script lang="ts">
    import { dashboardState } from "$lib/state.svelte";
    import { QPU_DEVICES, TOTAL_QUBITS, findCluster } from "$lib/utils/data";

    const repositoryUrl = "https://github.com/nebmit/qpu";

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
</script>

<div
    class="h-full overflow-hidden shrink-0 bg-[var(--sidebar-bg)] border-r border-[var(--border)] flex flex-col transition-[width,min-width] duration-150 ease-out {dashboardState.sidebarOpen
        ? 'w-[264px] min-w-[264px]'
        : 'w-0 min-w-0'}"
>
    <div class="flex-1 overflow-y-auto pt-6 px-5 pb-6">
        <!-- Logo -->
        <div class="mb-7">
            <div class="flex items-center justify-between gap-3">
                <div>
                    <div
                        class="text-[10px] text-[var(--text-3)] tracking-[0.12em] uppercase mb-[5px] font-medium"
                    >
                        Quantum Calibration
                    </div>
                    <div
                        class="text-[18px] font-light text-[var(--text)] tracking-[-0.02em] leading-none"
                    >
                        QPU Visualizer
                    </div>
                </div>

                <a
                    href={repositoryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open repository"
                    class="group inline-flex shrink-0 items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--sidebar-bg)] px-2.5 py-1 text-[9.5px] text-[var(--text-2)] transition-colors hover:bg-[#f2f0eb] hover:text-[var(--text)]"
                    title="Open repository"
                >
                    <svg
                        viewBox="0 0 24 24"
                        class="h-3.5 w-3.5 fill-current"
                        aria-hidden="true"
                    >
                        <path
                            d="M12 .5C5.648.5.5 5.734.5 12.21c0 5.18 3.292 9.57 7.865 11.11.575.11.784-.254.784-.564 0-.279-.01-1.017-.016-1.996-3.2.71-3.878-1.575-3.878-1.575-.524-1.356-1.281-1.716-1.281-1.716-1.048-.737.08-.722.08-.722 1.16.084 1.77 1.216 1.77 1.216 1.03 1.8 2.703 1.28 3.36.98.104-.762.402-1.28.73-1.574-2.553-.298-5.238-1.31-5.238-5.83 0-1.288.438-2.34 1.157-3.164-.117-.3-.5-1.506.11-3.14 0 0 .943-.31 3.088 1.208a10.4 10.4 0 0 1 2.81-.387 10.4 10.4 0 0 1 2.81.387c2.145-1.518 3.088-1.208 3.088-1.208.61 1.634.227 2.84.11 3.14.72.824 1.157 1.876 1.157 3.164 0 4.53-2.69 5.53-5.252 5.82.413.366.78 1.088.78 2.195 0 1.584-.014 2.862-.014 3.25 0 .313.207.68.79.564C20.21 21.78 23.5 17.39 23.5 12.21 23.5 5.734 18.352.5 12 .5Z"
                        />
                    </svg>
                    <svg
                        viewBox="0 0 24 24"
                        class="h-3.25 w-3.25 stroke-current fill-none"
                        aria-hidden="true"
                    >
                        <path
                            d="M7 17L17 7"
                            stroke-width="1.8"
                            stroke-linecap="round"
                        />
                        <path
                            d="M10 7h7v7"
                            stroke-width="1.8"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        />
                    </svg>
                </a>
            </div>
        </div>

        <!-- Device -->
        <div class="mb-[18px]">
            <div
                class="text-[10.5px] font-medium tracking-[0.06em] uppercase text-[var(--text-3)] mb-2.25"
            >
                Device
            </div>
            {#each QPU_DEVICES as d (d)}
                <button
                    class="d-tab {dashboardState.device === d ? 'active' : ''}"
                    onclick={() => {
                        dashboardState.setDevice(d);
                    }}
                >
                    {d}
                </button>
            {/each}
        </div>

        <!-- Date -->
        <div class="mb-1">
            <div class="flex justify-between items-baseline mb-[9px]">
                <span
                    class="text-[10.5px] font-medium tracking-[0.06em] uppercase text-[var(--text-3)] mb-0"
                    >Date</span
                >
                <span class="font-mono text-[12px] text-[var(--text-2)]"
                    >{dashboardState.snap.date || "—"}</span
                >
            </div>
            <input
                type="range"
                min="0"
                max={Math.max(0, dashboardState.timeCount - 1)}
                bind:value={dashboardState.timeIdx}
                onchange={() => dashboardState.clearCluster()}
                disabled={dashboardState.timeCount <= 1}
            />
            <div
                class="flex justify-between mt-[5px] text-[11px] text-[var(--text-3)]"
            >
                <span>{timeStart}</span>
                <span>{timeEnd}</span>
            </div>
        </div>

        <div class="h-px bg-[var(--border)] my-[18px]"></div>

        <!-- Error cutoff -->
        <div class="mb-1">
            <div class="flex justify-between items-baseline mb-2.25">
                <span
                    class="text-[10.5px] font-medium tracking-[0.06em] uppercase text-[var(--text-3)]"
                    >Error cutoff</span
                >
            </div>

            <div class="flex items-center gap-3 py-2">
                <div class="flex-1">
                    <div class="text-[13px] text-[var(--text-2)] mb-1">
                        Readout error
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.1"
                        bind:value={dashboardState.errorCutoffs.readoutPct}
                    />
                </div>
                <div class="flex items-center gap-1">
                    <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        bind:value={dashboardState.errorCutoffs.readoutPct}
                        class="w-[64px] px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--sidebar-bg)] text-[12px] font-mono text-[var(--text)]"
                    />
                    <span class="text-[11px] text-[var(--text-3)]">%</span>
                </div>
            </div>

            <div class="flex items-center gap-3 py-2">
                <div class="flex-1">
                    <div class="text-[13px] text-[var(--text-2)] mb-1">
                        CX gate error
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.1"
                        bind:value={dashboardState.errorCutoffs.cxPct}
                    />
                </div>
                <div class="flex items-center gap-1">
                    <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        bind:value={dashboardState.errorCutoffs.cxPct}
                        class="w-[64px] px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--sidebar-bg)] text-[12px] font-mono text-[var(--text)]"
                    />
                    <span class="text-[11px] text-[var(--text-3)]">%</span>
                </div>
            </div>
        </div>

        <div class="h-px bg-(--border) my-4.5"></div>

        <!-- Coherence minimums -->
        <div class="mb-1">
            <div class="flex justify-between items-baseline mb-2.25">
                <span
                    class="text-[10.5px] font-medium tracking-[0.06em] uppercase text-(--text-3)"
                    >Coherence min</span
                >
            </div>

            <div class="flex items-center gap-3 py-2">
                <div class="flex-1">
                    <div class="text-[13px] text-[var(--text-2)] mb-1">
                        T₁ min
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="500"
                        step="1"
                        bind:value={dashboardState.coherenceCutoffs.minT1}
                    />
                </div>
                <div class="flex items-center gap-1">
                    <input
                        type="number"
                        min="0"
                        max="500"
                        step="1"
                        bind:value={dashboardState.coherenceCutoffs.minT1}
                        class="w-[64px] px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--sidebar-bg)] text-[12px] font-mono text-[var(--text)]"
                    />
                    <span class="text-[11px] text-[var(--text-3)]">μs</span>
                </div>
            </div>

            <div class="flex items-center gap-3 py-2">
                <div class="flex-1">
                    <div class="text-[13px] text-[var(--text-2)] mb-1">
                        T₂ min
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="500"
                        step="1"
                        bind:value={dashboardState.coherenceCutoffs.minT2}
                    />
                </div>
                <div class="flex items-center gap-1">
                    <input
                        type="number"
                        min="0"
                        max="500"
                        step="1"
                        bind:value={dashboardState.coherenceCutoffs.minT2}
                        class="w-[64px] px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--sidebar-bg)] text-[12px] font-mono text-[var(--text)]"
                    />
                    <span class="text-[11px] text-[var(--text-3)]">μs</span>
                </div>
            </div>
        </div>

        <div class="h-px bg-[var(--border)] my-[18px]"></div>

        <!-- Connectivity -->
        <div class="mb-1">
            <div class="mb-2.25">
                <span
                    class="text-[10.5px] font-medium tracking-[0.06em] uppercase text-(--text-3)"
                >
                    Connectivity
                </span>
            </div>

            <div class="grid grid-cols-3 gap-2 mb-2.5">
                <div class="flex flex-col gap-1.5">
                    <span
                        class="text-[10px] font-medium uppercase tracking-[0.06em] text-(--text-3) text-center"
                        >1-link</span
                    >
                    <input
                        type="number"
                        min="0"
                        max={TOTAL_QUBITS}
                        step="1"
                        bind:value={dashboardState.connRules.endpoint}
                        onchange={() => dashboardState.clearCluster()}
                        class="w-full px-1.5 py-1.5 rounded-md border border-(--border) bg-(--bg) text-[14px] font-mono text-(--text) text-center"
                    />
                    <span class="text-[9.5px] text-(--text-3) text-center"
                        >endpoint</span
                    >
                </div>
                <div class="flex flex-col gap-1.5">
                    <span
                        class="text-[10px] font-medium uppercase tracking-[0.06em] text-(--text-3) text-center"
                        >2-link</span
                    >
                    <input
                        type="number"
                        min="0"
                        max={TOTAL_QUBITS}
                        step="1"
                        bind:value={dashboardState.connRules.chain}
                        onchange={() => dashboardState.clearCluster()}
                        class="w-full px-1.5 py-1.5 rounded-md border border-(--border) bg-(--bg) text-[14px] font-mono text-(--text) text-center"
                    />
                    <span class="text-[9.5px] text-(--text-3) text-center"
                        >chain</span
                    >
                </div>
                <div class="flex flex-col gap-1.5">
                    <span
                        class="text-[10px] font-medium uppercase tracking-[0.06em] text-(--text-3) text-center"
                        >3-link</span
                    >
                    <input
                        type="number"
                        min="0"
                        max={TOTAL_QUBITS}
                        step="1"
                        bind:value={dashboardState.connRules.junction}
                        onchange={() => dashboardState.clearCluster()}
                        class="w-full px-1.5 py-1.5 rounded-md border border-(--border) bg-(--bg) text-[14px] font-mono text-(--text) text-center"
                    />
                    <span class="text-[9.5px] text-(--text-3) text-center"
                        >junction</span
                    >
                </div>
            </div>

            <div class="flex justify-between text-[12px] text-(--text-3)">
                <span>Total</span>
                <span
                    class="font-mono {dashboardState.totalConnections >
                    TOTAL_QUBITS
                        ? 'text-[oklch(55%_0.14_25)]'
                        : 'text-[var(--text-2)]'}"
                >
                    {dashboardState.totalConnections}Q{dashboardState.totalConnections >
                    TOTAL_QUBITS
                        ? " ⚠"
                        : ""}
                </span>
            </div>
        </div>

        <div class="h-px bg-[var(--border)] my-[18px]"></div>

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
            <div
                class="animate-[fadeIn_0.2s_ease_forwards] mt-[14px] py-[13px] px-[14px] bg-[oklch(90%_0.04_198)] border border-[oklch(78%_0.07_198)] rounded-lg"
            >
                <div class="flex justify-between items-center mb-[11px]">
                    <span
                        class="text-[11px] text-[oklch(45%_0.1_198)] tracking-[0.07em] uppercase font-medium"
                    >
                        Cluster · {dashboardState.cluster.length}Q
                    </span>
                    <button
                        onclick={() => dashboardState.clearCluster()}
                        class="bg-none border-none text-[oklch(60%_0.08_198)] cursor-pointer text-[16px] leading-none"
                        >×</button
                    >
                </div>
                <div class="flex gap-4">
                    {#each [{ l: "T₁", v: dashboardState.clusterStats.T1, s: "μs" }, { l: "T₂", v: dashboardState.clusterStats.T2, s: "μs" }, { l: "Readout", v: dashboardState.clusterStats.ro, s: "%" }] as s (s.l)}
                        {@const showUnit = s.v !== "—"}
                        <div class="flex flex-col gap-0.5">
                            <span
                                class="text-[10px] text-[oklch(55%_0.08_198)] tracking-[0.05em] uppercase"
                                >{s.l}</span
                            >
                            <span
                                class="font-mono text-[15px] text-[oklch(35%_0.1_198)] leading-none"
                            >
                                {s.v}{#if showUnit}<span
                                        class="text-[9.5px] ml-0.5 text-[oklch(55%_0.08_198)]"
                                        >{s.s}</span
                                    >{/if}
                            </span>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </div>
</div>

<style>
    .d-tab {
        display: block;
        width: 100%;
        text-align: left;
        padding: 7px 10px;
        border-radius: 6px;
        border: none;
        background: transparent;
        color: var(--text-3);
        font-size: 12px;
        cursor: pointer;
        font-family: var(--font-mono);
        font-weight: 300;
        transition: all 0.12s;
    }
    .d-tab:hover {
        color: var(--text-2);
        background: rgba(0, 0, 0, 0.04);
    }
    .d-tab.active {
        color: var(--text);
        background: rgba(0, 0, 0, 0.07);
    }

    .find-btn {
        width: 100%;
        padding: 10px 14px;
        background: var(--text);
        border: none;
        border-radius: 7px;
        color: var(--bg);
        font-size: 13px;
        font-family: var(--font-sans);
        font-weight: 500;
        cursor: pointer;
        transition: opacity 0.14s;
        letter-spacing: 0.01em;
    }
    .find-btn:hover {
        opacity: 0.85;
    }
    .find-btn:active {
        opacity: 0.75;
        transform: scale(0.99);
    }
    .find-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
</style>
