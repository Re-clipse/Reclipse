import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.js'],
    // E2E lives under tests/e2e and is run by Playwright, never by Vitest.
    exclude: ['tests/e2e/**', 'node_modules/**'],
    reporters: 'default',
    css: false,
  },
  resolve: {
    alias: {
      '@': rootDir,
    },
  },
});
