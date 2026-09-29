import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'core',
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: '../../coverage/packages/core',
    },
  },
});
