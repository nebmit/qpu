<script lang="ts">
    let {
        label,
        value = $bindable(),
        min,
        max,
        step,
        unit,
        decimals = 0,
        ariaLabel,
        ariaValueText,
        oninput,
    } = $props<{
        label: string;
        value: number;
        min: number;
        max: number;
        step: number;
        unit: string;
        decimals?: number;
        ariaLabel: string;
        ariaValueText: string;
        oninput?: () => void;
    }>();
</script>

<div class="sld">
    <div class="sld-top">
        <span class="sld-lbl">{label}</span>
        <span class="sld-val">{value.toFixed(decimals)}<i>{unit}</i></span>
    </div>
    <input
        type="range"
        {min}
        {max}
        {step}
        bind:value
        {oninput}
        aria-label={ariaLabel}
        aria-valuetext={ariaValueText}
    />
</div>

<style>
    .sld {
        margin-bottom: 14px;
    }
    .sld:last-child {
        margin-bottom: 0;
    }
    .sld-top {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 8px;
    }
    .sld-lbl {
        font-size: 12px;
        color: var(--text-2);
        white-space: nowrap;
    }
    .sld-val {
        font-size: 11.5px;
        color: var(--text);
        font-family: var(--font-mono);
    }
    .sld-val i {
        color: var(--text-3);
        font-style: normal;
        margin-left: 1px;
    }
</style>
