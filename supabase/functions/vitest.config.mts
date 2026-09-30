import { defineConfig } from 'vitest/config';

// Unit tests for the pure, Deno-free modules shared by edge functions.
export default defineConfig({
  test: {
    name: 'functions',
    globals: true,
    environment: 'node',
    include: ['_shared/**/*.spec.ts'],
  },
});
