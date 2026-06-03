import { cubicOut } from 'svelte/easing';
export { prefersReducedMotion } from 'svelte/motion';

/** Animation durations in ms — mirror of the `--dur-*` tokens in motion.css. */
export const DUR = {
	fast: 120, // hovers, presses, micro-interactions
	ui: 220, // state transitions: cluster dim, edge emphasis, loader handoff
	base: 280, // score morph, theme crossfade + icon, chip flip, fade-in
	entry: 500 // node / edge entrance cascade
} as const;

/** Center-out entry-cascade max stagger (ms). */
export const ENTRY_CASCADE_MS = 280;

/** Standard easing for JS-driven motion (Tween / transitions / flip). */
export const ease = cubicOut;
