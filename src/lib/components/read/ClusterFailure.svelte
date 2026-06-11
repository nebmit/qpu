<script lang="ts">
    import { dashboardState } from "$lib/state/dashboard.svelte";

    let requestedSize = $derived(
        dashboardState.clusterRequested > 0
            ? dashboardState.clusterRequested
            : dashboardState.cluster.length,
    );
</script>

<div class="cl-fail fade-in">
    <div class="cl-fail-head">
        <div class="cl-fail-ico">
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path d="m20 20-4.2-4.2" />
                <path d="M8.4 8.4l4.2 4.2M12.6 8.4l-4.2 4.2" />
            </svg>
        </div>
        <div>
            {#if dashboardState.findFailReason === "topology-unplaceable"}
                <div class="cl-fail-h">
                    Can't arrange {requestedSize} qubits as a {dashboardState.topology}
                    cluster
                </div>
                <div class="cl-fail-sub">
                    Qualifying region: <b>{dashboardState.nearestCluster.length}Q</b>
                    — the requested arrangement doesn't fit
                </div>
            {:else}
                <div class="cl-fail-h">
                    Can't place {requestedSize} qubits
                </div>
                <div class="cl-fail-sub">
                    Largest connected region available:
                    <b>{dashboardState.nearestCluster.length}Q</b>
                </div>
            {/if}
        </div>
    </div>

    {#if dashboardState.findFailReason === "topology-unplaceable"}
        <p class="cl-fail-p">
            A <b>{dashboardState.nearestCluster.length}Q</b> connected region
            qualifies, but no <b>{dashboardState.topology}</b> arrangement of
            {requestedSize} qubits fits within it. Lower the cluster size or switch
            to a different topology.
        </p>
    {:else}
        <p class="cl-fail-p">
            Only <b>{dashboardState.allowedQubitIds.size} qubits</b>
            qualify and they don't connect into a usable block under the current
            filters.
        </p>
    {/if}

    {#if dashboardState.relaxSuggestions?.candidates.length}
        <div class="cl-relax-h">Relax one constraint</div>
        <div class="cl-relax-list">
            {#each dashboardState.relaxSuggestions.candidates as c, i (c.label)}
                <button
                    class="cl-relax"
                    onclick={() => dashboardState.applyRelaxation(i)}
                >
                    <span class="cl-relax-l">{c.label}</span>
                    <span class="cl-relax-g">→ {c.comp}Q block</span>
                </button>
            {/each}
        </div>
    {/if}

    <div class="cl-fail-acts">
        {#if dashboardState.nearestCluster.length >= 2 && !(dashboardState.findFailReason === "topology-unplaceable" && dashboardState.nearestCluster.length >= requestedSize)}
            <button
                class="cl-fail-btn primary"
                onclick={() => dashboardState.shrinkToNearestAndRetry()}
            >
                <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M3 8.5l3.2 3.2L13 4.8" />
                </svg>
                Use the {dashboardState.nearestCluster.length}Q region
            </button>
        {/if}
    </div>
</div>

<style>
    .cl-fail {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-panel);
        padding: 18px 18px 20px;
    }
    .cl-fail-head {
        display: flex;
        align-items: center;
        gap: 12px;
        text-align: left;
        margin-bottom: 4px;
    }
    .cl-fail-ico {
        width: 40px;
        height: 40px;
        border-radius: 11px;
        flex-shrink: 0;
        display: grid;
        place-items: center;
        background: var(--warn-bg);
        color: var(--warn);
        border: 1px solid var(--warn-border);
    }
    .cl-fail-ico svg {
        width: 20px;
        height: 20px;
    }
    .cl-fail-h {
        font-size: 16px;
        font-weight: 600;
        color: var(--text);
    }
    .cl-fail-sub {
        font-size: 12.5px;
        color: var(--text-3);
        margin-top: 2px;
    }
    .cl-fail-sub b {
        color: var(--text-2);
        font-weight: 600;
        font-family: var(--font-mono);
    }
    .cl-fail-p {
        font-size: 13px;
        line-height: 1.6;
        color: var(--text-3);
        margin: 14px 0 4px;
        text-wrap: pretty;
    }
    .cl-fail-p b {
        color: var(--text-2);
        font-weight: 500;
    }

    .cl-relax-h {
        text-align: left;
        font-size: 11px;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        color: var(--text-3);
        font-weight: 600;
        margin: 16px 0 8px;
    }
    .cl-relax-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-bottom: 16px;
    }
    .cl-relax {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        width: 100%;
        padding: 9px 11px;
        background: var(--surface);
        border: 1px solid var(--border-mid);
        border-radius: var(--radius-sm);
        cursor: pointer;
        transition: all var(--dur-fast);
        text-align: left;
    }
    .cl-relax:hover {
        border-color: var(--accent);
        background: var(--accent-surface);
    }
    .cl-relax-l {
        font-size: 13.5px;
        color: var(--text);
        font-family: var(--font-mono);
        white-space: nowrap;
    }
    .cl-relax-g {
        font-size: 12.5px;
        color: var(--pos);
        font-weight: 600;
        font-family: var(--font-mono);
        white-space: nowrap;
        flex-shrink: 0;
        transition: transform var(--dur-fast) var(--ease-out);
    }
    .cl-relax:hover .cl-relax-g {
        transform: translateX(2px);
    }

    .cl-fail-acts {
        display: flex;
        flex-direction: column;
        gap: 7px;
    }
    .cl-fail-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        padding: 10px 12px;
        border-radius: var(--radius-sm);
        font-size: 13.5px;
        font-weight: 500;
        font-family: var(--font-sans);
        cursor: pointer;
        transition: all var(--dur-fast);
    }
    .cl-fail-btn.primary {
        background: var(--accent);
        border: 1px solid var(--accent);
        color: var(--accent-fg);
    }
    .cl-fail-btn.primary:hover {
        opacity: 0.92;
        box-shadow: 0 3px 14px color-mix(in oklch, var(--accent) 38%, transparent);
    }
    .cl-fail-btn svg {
        width: 13px;
        height: 13px;
    }
</style>
