import { defineConfig } from 'vitest/config';
import path from 'path';

// The mobile app runs on-device and only talks to the backend over HTTP, so CI
// neither builds nor bundles it. These tests exercise the pure business logic
// (date handling, inbox unread/read bookkeeping) in a plain Node environment;
// anything that touches the React Native / Expo runtime is mocked per-test.
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'cobertura', 'html', 'lcov'],
      reportsDirectory: './coverage',
      // Only the pure logic in utils/ is unit-testable off-device; screens,
      // components and hooks need the React Native / Expo runtime.
      include: ['utils/**/*.ts'],
      exclude: ['**/*.d.ts', 'utils/appStorage.ts'],
    },
    reporters: ['default', 'junit'],
    outputFile: {
      junit: './junit.xml',
    },
  },
  resolve: {
    alias: {
      '@toolshare/shared': path.resolve(__dirname, '../shared/index.ts'),
      zod: path.resolve(__dirname, 'node_modules/zod'),
    },
  },
});
