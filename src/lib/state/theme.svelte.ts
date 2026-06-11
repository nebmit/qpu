import { flushSync } from 'svelte';
import { prefersReducedMotion } from '$lib/viz/motion';

class ThemeState {
    dark = $state(false);

    sync() {
        this.dark = document.documentElement.getAttribute('data-theme') === 'dark';
    }

    private commit(isDark: boolean) {
        this.dark = isDark;
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    }

    toggle() {
        const next = !this.dark;
        const doc = document as Document & {
            startViewTransition?: (cb: () => void) => unknown;
        };
        if (prefersReducedMotion.current || !doc.startViewTransition) {
            this.commit(next);
            return;
        }
        doc.startViewTransition(() => {
            this.commit(next);
            flushSync();
        });
    }
}

export const themeState = new ThemeState();
