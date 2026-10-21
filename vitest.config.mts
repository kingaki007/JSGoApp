import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'apps/*/tests/**/*.{test,spec}.{ts,tsx}',
      'packages/*/tests/**/*.{test,spec}.{ts,tsx}',
    ],
  },
});
