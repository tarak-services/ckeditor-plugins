import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    testTimeout: 60000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
