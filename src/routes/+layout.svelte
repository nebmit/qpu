<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<title>QPU | TBW</title>
	<meta
		name="description"
		content="Explore time-series calibration data for IBM heavy-hex QPUs and find the best-quality connected qubit clusters across a 156-qubit lattice."
	/>
	<link rel="icon" href={favicon} />
</svelte:head>
{@render children()}
