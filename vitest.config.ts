import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx', '**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist', 'functions'],
    testTimeout: 10000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['services/**/*.ts'],
      exclude: ['node_modules', 'dist', 'functions', '**/*.d.ts', 'services/firebase.ts'],
    },
  },
});
