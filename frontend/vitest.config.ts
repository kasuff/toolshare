import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}', 'src/tests/**/*.{test,spec}.{ts,tsx}'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: 'forks',
    maxWorkers: process.env.CI ? 1 : undefined,
    poolOptions: {
      forks: {
        // In CI, run all test files in one long-lived fork instead of
        // spawning/tearing down a process per file. That removes the
        // process churn that intermittently triggers
        // "Worker exited unexpectedly" on the memory-constrained runner.
        singleFork: !!process.env.CI,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'cobertura', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'src/**/*.d.ts',
      ],
    },
    reporters: ['default', 'junit'],
    outputFile: {
      junit: './junit.xml',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
