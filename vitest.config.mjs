import { defineConfig } from 'vitest/config';
import { transformWithOxc } from 'vite';
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
  // Next.js components are JSX in .js files; compile them as JSX so tests can import them.
  plugins: [{
    name: 'jsx-in-js',
    enforce: 'pre',
    transform(code, id) {
      if (!/\/(app|components)\/.*\.js$/.test(id)) return null;
      return transformWithOxc(code, id.replace(/\.js$/, '.jsx'), { jsx: { runtime: 'automatic' } });
    },
  }],
  resolve: {
    alias: {
      '@': rootDir,
    },
  },
});
