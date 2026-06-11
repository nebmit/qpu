import { flushSync } from 'svelte';
import { prefersReducedMotion } from '$lib/viz/motion';

/**
 * Shared theme state. The theme is resolved and applied pre-paint by the
 * inline script in app.html; `sync()` (called once by the Topbar on mount)
 * aligns this store with what's already on the document. Both the Topbar
 * toggle and the command palette flip it through `toggle()`, which wraps the
 * switch in a View Transition when motion is allowed.
 */
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
