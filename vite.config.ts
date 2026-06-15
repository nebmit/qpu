import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

function assetSizes() {
    const id = 'virtual:asset-sizes';
    const resolvedId = '\0' + id;
    const files = ['dataset.json', 'positions.json'];
    return {
        name: 'asset-sizes',
        resolveId(source: string) {
            return source === id ? resolvedId : null;
        },
        load(loadId: string) {
            if (loadId !== resolvedId) return null;
            const sizes: Record<string, number> = {};
            for (const file of files) {
                try {
                    sizes['/' + file] = statSync(resolve('static', file)).size;
                } catch {
                    // Asset missing at build time — leave its size unknown so the loader
                    // gracefully falls back to the indeterminate bar for it.
                }
            }
            return `export const ASSET_SIZES = ${JSON.stringify(sizes)};`;
        }
    };
}

export default defineConfig({
    plugins: [tailwindcss(), sveltekit(), assetSizes()],
    test: {
        include: ['src/**/*.test.ts'],
        environment: 'node'
    }
});
