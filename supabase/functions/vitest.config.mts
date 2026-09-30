import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Unit tests for the Deno-free parts of the edge functions. `@mise/core` resolves as in each deno.json.
export default defineConfig({
  resolve: {
    alias: {
      '@mise/core': fileURLToPath(
        new URL('../../packages/core/src/index.ts', import.meta.url),
      ),
    },
  },
  test: {
    name: 'functions',
    globals: true,
    environment: 'node',
    include: ['**/*.spec.ts'],
    exclude: ['**/node_modules/**'],
  },
});
