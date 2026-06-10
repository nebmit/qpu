<script lang="ts">
    import { page } from '$app/state';

    const STATUS_LABELS: Record<number, string> = {
        404: 'Page not found',
        403: 'Access denied',
        500: 'Internal server error',
        503: 'Service unavailable',
    };

    const label = $derived(STATUS_LABELS[page.status] ?? 'Something went wrong');
    const detail = $derived(page.error?.message);

    function handleHome() {
        window.location.replace('/');
    }
</script>

<svelte:head>
    <title>Error {page.status} · QPU</title>
</svelte:head>

<div class="shell">
    <svg class="deco" viewBox="0 0 120 100" fill="none" aria-hidden="true">
        <line x1="60" y1="20" x2="60" y2="42" stroke="var(--dead-edge)" stroke-width="1.5" stroke-dasharray="3 3"/>
        <line x1="60" y1="58" x2="60" y2="80" stroke="var(--dead-edge)" stroke-width="1.5" stroke-dasharray="3 3"/>
        <line x1="18" y1="50" x2="42" y2="50" stroke="var(--dead-edge)" stroke-width="1.5" stroke-dasharray="3 3"/>
        <line x1="78" y1="50" x2="102" y2="50" stroke="var(--dead-edge)" stroke-width="1.5" stroke-dasharray="3 3"/>
        <circle cx="60" cy="14" r="6" fill="var(--dead-node)" stroke="var(--node-stroke)" stroke-width="1"/>
        <circle cx="60" cy="86" r="6" fill="var(--dead-node)" stroke="var(--node-stroke)" stroke-width="1"/>
        <circle cx="12" cy="50" r="6" fill="var(--dead-node)" stroke="var(--node-stroke)" stroke-width="1"/>
        <circle cx="108" cy="50" r="6" fill="var(--dead-node)" stroke="var(--node-stroke)" stroke-width="1"/>
        <circle cx="60" cy="50" r="9" fill="var(--neg-bg)" stroke="var(--neg)" stroke-width="1.5" class="err-node"/>
        <line x1="56" y1="46" x2="64" y2="54" stroke="var(--neg)" stroke-width="1.8" stroke-linecap="round"/>
        <line x1="64" y1="46" x2="56" y2="54" stroke="var(--neg)" stroke-width="1.8" stroke-linecap="round"/>
    </svg>

    <p class="code">{page.status}</p>
    <h1 class="headline">{label}</h1>
    {#if detail}
        <p class="detail">{detail}</p>
    {/if}

    <button class="home-btn" onclick={handleHome}>Return to dashboard</button>
</div>

<style>
    .shell {
        width: 100vw;
        height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: var(--bg);
        animation: fadeIn var(--dur-base) var(--ease-out) both;
    }

    .deco {
        width: 96px;
        height: 80px;
        margin-bottom: 32px;
    }

    .err-node {
        animation: err-pulse 2.4s ease-in-out infinite;
    }

    @keyframes err-pulse {
        0%, 100% { opacity: 1; }
        50%       { opacity: 0.45; }
    }

    .code {
        font-family: var(--font-mono);
        font-size: 52px;
        font-weight: 600;
        line-height: 1;
        letter-spacing: -0.02em;
        color: var(--text-3);
        margin: 0 0 10px;
        font-variant-numeric: tabular-nums;
    }

    .headline {
        font-size: 17px;
        font-weight: 500;
        color: var(--text);
        margin: 0 0 8px;
        text-align: center;
    }

    .detail {
        font-family: var(--font-mono);
        font-size: 11.5px;
        color: var(--text-3);
        max-width: 340px;
        text-align: center;
        margin: 0 0 28px;
        word-break: break-word;
        line-height: 1.65;
    }

    .home-btn {
        margin-top: 28px;
        font-size: 13px;
        font-weight: 500;
        font-family: var(--font-sans);
        padding: 8px 18px;
        border-radius: var(--radius-md);
        background: var(--accent-surface);
        color: var(--accent);
        border: 1px solid var(--accent-border);
        transition: background var(--dur-fast), box-shadow var(--dur-fast);
        cursor: pointer;
    }

    .home-btn:hover {
        background: var(--accent-border);
        box-shadow: var(--shadow-panel);
    }
</style>
