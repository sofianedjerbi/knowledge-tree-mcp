import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    clearMocks: true,     // Clear mock history before each test
    restoreMocks: true,   // Restore original implementation before each test
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
        'src/index.ts' // Exclude main entry point
      ]
    },
    include: ['test/**/*.test.ts'],
    testTimeout: 10000,
    setupFiles: ['./test/setup.ts'],
    pool: 'forks', // Use forks to ensure proper isolation
    poolOptions: {
      forks: {
        singleFork: true // Run tests sequentially to avoid file system conflicts
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@test': resolve(__dirname, './test')
    }
  }
});