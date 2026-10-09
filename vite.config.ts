import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: '127.0.0.1', strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/application/**/*.ts', 'src/domain/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.d.ts'],
      thresholds: { lines: 25, functions: 15, branches: 10, statements: 25 },
    },
  },
  build: { chunkSizeWarningLimit: 500 },
});
