import { cubicOut } from 'svelte/easing';
export { prefersReducedMotion } from 'svelte/motion';

export const DUR = {
	fast: 120,
	ui: 220,
	base: 280,
	entry: 500
} as const;

export const ENTRY_CASCADE_MS = 280;

export const ease = cubicOut;
