import { beforeEach, afterEach, vi } from 'vitest';
import { join } from 'path';
import { mkdirSync, rmSync } from 'fs';

// Global test setup
beforeEach(() => {
  // Only clear mocks, don't reset to preserve functionality for integration tests
  vi.clearAllMocks();
});

afterEach(() => {
  // Restore mocks to clean state but preserve original implementations
  vi.restoreAllMocks();
});