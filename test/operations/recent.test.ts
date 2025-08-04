import { describe, it, expect, beforeEach, vi } from 'vitest';
import { recentKnowledgeHandler } from '../../src/tools/recent.js';
import type { RecentArgs, ServerContext, KnowledgeEntry } from '../../src/types/index.js';
import { readFile, getFileStats } from '../../src/utils/index.js';
import { RECENT_DEFAULTS } from '../../src/constants/index.js';

// Mock the utils
vi.mock('../../src/utils/index.js');

describe('Recent Knowledge Tool', () => {
  let mockContext: ServerContext;
  const mockKnowledgeRoot = '/test/knowledge';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock context
    mockContext = {
      knowledgeRoot: mockKnowledgeRoot,
      scanKnowledgeTree: vi.fn().mockResolvedValue([]),
      broadcastUpdate: vi.fn().mockResolvedValue(undefined),
      logUsage: vi.fn()
    };
  });

  describe('Basic recent entries functionality', () => {
    it('should return empty results when no entries exist', async () => {
      const args: RecentArgs = {};
      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue([]);

      const result = await recentKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.period.days).toBe(RECENT_DEFAULTS.DAYS);
      expect(output.summary.total_changes).toBe(0);
      expect(output.summary.showing).toBe(0);
      expect(output.entries).toEqual([]);
    });

    it('should find recently added entries', async () => {
      const args: RecentArgs = { days: 7 };
      const now = new Date();
      const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      
      const mockEntry: KnowledgeEntry = {
        priority: 'CRITICAL',
        problem: 'Recent problem',
        solution: 'Recent solution'
      };

      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue(['recent.json']);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockEntry));
      vi.mocked(getFileStats).mockResolvedValue({
        birthtime: recentDate,
        mtime: recentDate,
        size: 1024
      } as any);

      const result = await recentKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.summary.total_changes).toBe(1);
      expect(output.summary.added).toBe(1);
      expect(output.summary.modified).toBe(0);
      expect(output.entries[0].change_type).toBe('added');
      expect(output.entries[0].path).toBe('recent.json');
    });

    it('should find recently modified entries', async () => {
      const args: RecentArgs = { days: 7 };
      const now = new Date();
      const oldDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      const recentDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      
      const mockEntry: KnowledgeEntry = {
        priority: 'REQUIRED',
        problem: 'Modified problem',
        solution: 'Modified solution with updated content'
      };

      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue(['modified.json']);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockEntry));
      vi.mocked(getFileStats).mockResolvedValue({
        birthtime: oldDate,
        mtime: recentDate,
        size: 2048
      } as any);

      const result = await recentKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.summary.total_changes).toBe(1);
      expect(output.summary.added).toBe(0);
      expect(output.summary.modified).toBe(1);
      expect(output.entries[0].change_type).toBe('modified');
    });

    it('should not include old entries', async () => {
      const args: RecentArgs = { days: 7 };
      const now = new Date();
      const oldDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      
      const mockEntry: KnowledgeEntry = {
        priority: 'COMMON',
        problem: 'Old problem',
        solution: 'Old solution'
      };

      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue(['old.json']);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockEntry));
      vi.mocked(getFileStats).mockResolvedValue({
        birthtime: oldDate,
        mtime: oldDate,
        size: 512
      } as any);

      const result = await recentKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.summary.total_changes).toBe(0);
      expect(output.entries).toEqual([]);
    });
  });

  describe('Filtering and sorting', () => {
    const setupMockEntries = () => {
      const now = new Date();
      const entries = [
        {
          path: 'added1.json',
          birthtime: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
          mtime: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
          content: { priority: 'CRITICAL', problem: 'Added 1', solution: 'Solution 1' }
        },
        {
          path: 'modified1.json',
          birthtime: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000), // Created 10 days ago
          mtime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // Modified 2 days ago
          content: { priority: 'REQUIRED', problem: 'Modified 1', solution: 'Solution 2' }
        },
        {
          path: 'added2.json',
          birthtime: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          mtime: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
          content: { priority: 'COMMON', problem: 'Added 2', solution: 'Solution 3' }
        },
        {
          path: 'modified2.json',
          birthtime: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000), // Created 20 days ago
          mtime: new Date(now.getTime() - 0.5 * 24 * 60 * 60 * 1000), // Modified 12 hours ago
          content: { 
            priority: 'EDGE-CASE', 
            problem: 'Modified 2', 
            solution: 'Solution 4',
            related_to: [{ path: 'other.json', relationship: 'related' }]
          }
        }
      ];

      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue(
        entries.map(e => e.path)
      );

      entries.forEach((entry, index) => {
        vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(entry.content));
        vi.mocked(getFileStats).mockResolvedValueOnce({
          birthtime: entry.birthtime,
          mtime: entry.mtime,
          size: 1024 * (index + 1)
        } as any);
      });

      return entries;
    };

    it('should filter by type "added"', async () => {
      const args: RecentArgs = { days: 7, type: 'added' };
      setupMockEntries();

      const result = await recentKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.summary.total_changes).toBe(2); // Only added entries
      expect(output.entries).toHaveLength(2);
      expect(output.entries.every(e => e.change_type === 'added')).toBe(true);
    });

    it('should filter by type "modified"', async () => {
      const args: RecentArgs = { days: 7, type: 'modified' };
      setupMockEntries();

      const result = await recentKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.summary.total_changes).toBe(2); // Only modified entries
      expect(output.entries).toHaveLength(2);
      expect(output.entries.every(e => e.change_type === 'modified')).toBe(true);
    });

    it('should include all types by default', async () => {
      const args: RecentArgs = { days: 7 };
      setupMockEntries();

      const result = await recentKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.summary.total_changes).toBe(4);
      expect(output.summary.added).toBe(2);
      expect(output.summary.modified).toBe(2);
    });

    it('should sort by modification time (newest first)', async () => {
      const args: RecentArgs = { days: 7, type: 'all' };
      setupMockEntries();

      const result = await recentKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      // Check that entries are sorted by mtime descending
      for (let i = 0; i < output.entries.length - 1; i++) {
        const current = new Date(output.entries[i].modified_at);
        const next = new Date(output.entries[i + 1].modified_at);
        expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
      }

      // The most recently modified should be first
      expect(output.entries[0].path).toBe('modified2.json');
    });

    it('should respect limit parameter', async () => {
      const args: RecentArgs = { days: 7, limit: 2 };
      setupMockEntries();

      const result = await recentKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.summary.total_changes).toBe(4); // Total found
      expect(output.summary.showing).toBe(2); // Limited to 2
      expect(output.entries).toHaveLength(2);
    });
  });

  describe('Content formatting', () => {
    it('should truncate long solutions', async () => {
      const args: RecentArgs = { days: 7 };
      const now = new Date();
      const recentDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      
      const longSolution = 'A'.repeat(150); // 150 characters
      const mockEntry: KnowledgeEntry = {
        priority: 'CRITICAL',
        problem: 'Problem with long solution',
        solution: longSolution
      };

      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue(['long.json']);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockEntry));
      vi.mocked(getFileStats).mockResolvedValue({
        birthtime: recentDate,
        mtime: recentDate,
        size: 2048
      } as any);

      const result = await recentKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.entries[0].solution).toHaveLength(103); // 100 chars + '...'
      expect(output.entries[0].solution.endsWith('...')).toBe(true);
    });

    it('should not add ellipsis to short solutions', async () => {
      const args: RecentArgs = { days: 7 };
      const now = new Date();
      const recentDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      
      const shortSolution = 'Short solution';
      const mockEntry: KnowledgeEntry = {
        priority: 'COMMON',
        problem: 'Problem with short solution',
        solution: shortSolution
      };

      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue(['short.json']);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockEntry));
      vi.mocked(getFileStats).mockResolvedValue({
        birthtime: recentDate,
        mtime: recentDate,
        size: 512
      } as any);

      const result = await recentKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.entries[0].solution).toBe(shortSolution);
      expect(output.entries[0].solution).not.toContain('...');
    });

    it('should include relationship count', async () => {
      const args: RecentArgs = { days: 7 };
      const now = new Date();
      const recentDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
      
      const mockEntry: KnowledgeEntry = {
        priority: 'REQUIRED',
        problem: 'Entry with relationships',
        solution: 'Solution',
        related_to: [
          { path: 'rel1.json', relationship: 'related' },
          { path: 'rel2.json', relationship: 'implements' },
          { path: 'rel3.json', relationship: 'supersedes' }
        ]
      };

      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue(['related.json']);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockEntry));
      vi.mocked(getFileStats).mockResolvedValue({
        birthtime: recentDate,
        mtime: recentDate,
        size: 1024
      } as any);

      const result = await recentKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.entries[0].relationships).toBe(3);
    });
  });

  describe('Period calculation', () => {
    it('should calculate correct cutoff date', async () => {
      const args: RecentArgs = { days: 3 };
      const now = new Date();
      
      // Create entries at various times
      const entries = [
        { path: 'within.json', daysAgo: 2 }, // Should be included
        { path: 'exact.json', daysAgo: 2.99 }, // Just within boundary - should be included
        { path: 'outside.json', daysAgo: 3.01 } // Just outside boundary - should NOT be included
      ];

      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue(
        entries.map(e => e.path)
      );

      entries.forEach(entry => {
        const date = new Date(now.getTime() - entry.daysAgo * 24 * 60 * 60 * 1000);
        vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({
          priority: 'COMMON',
          problem: `Entry ${entry.daysAgo} days old`,
          solution: 'Solution'
        }));
        vi.mocked(getFileStats).mockResolvedValueOnce({
          birthtime: date,
          mtime: date,
          size: 1024
        } as any);
      });

      const result = await recentKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.summary.total_changes).toBe(2);
      expect(output.entries.map(e => e.path)).toContain('within.json');
      expect(output.entries.map(e => e.path)).toContain('exact.json');
      expect(output.entries.map(e => e.path)).not.toContain('outside.json');
    });

    it('should include period information in output', async () => {
      const args: RecentArgs = { days: 14 };
      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue([]);

      const result = await recentKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.period.days).toBe(14);
      expect(output.period.from).toBeDefined();
      expect(output.period.to).toBeDefined();
      
      const from = new Date(output.period.from);
      const to = new Date(output.period.to);
      const diffInDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
      
      expect(diffInDays).toBeCloseTo(14, 1);
    });
  });

  describe('Error handling', () => {
    it('should skip entries with read errors', async () => {
      const args: RecentArgs = { days: 7 };
      const now = new Date();
      const recentDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue([
        'good.json',
        'bad.json',
        'another-good.json'
      ]);

      // First entry - good
      vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({
        priority: 'CRITICAL',
        problem: 'Good 1',
        solution: 'Solution 1'
      }));
      vi.mocked(getFileStats).mockResolvedValueOnce({
        birthtime: recentDate,
        mtime: recentDate,
        size: 1024
      } as any);

      // Second entry - error
      vi.mocked(readFile).mockRejectedValueOnce(new Error('Read error'));

      // Third entry - good
      vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({
        priority: 'REQUIRED',
        problem: 'Good 2',
        solution: 'Solution 2'
      }));
      vi.mocked(getFileStats).mockResolvedValueOnce({
        birthtime: recentDate,
        mtime: recentDate,
        size: 2048
      } as any);

      const result = await recentKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.entries).toHaveLength(2);
      expect(output.entries[0].path).toBe('good.json');
      expect(output.entries[1].path).toBe('another-good.json');
    });

    it('should skip entries with invalid JSON', async () => {
      const args: RecentArgs = { days: 7 };
      const now = new Date();
      const recentDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue(['invalid.json']);
      vi.mocked(readFile).mockResolvedValue('not valid json');
      vi.mocked(getFileStats).mockResolvedValue({
        birthtime: recentDate,
        mtime: recentDate,
        size: 1024
      } as any);

      const result = await recentKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.entries).toHaveLength(0);
    });
  });

  describe('Default values', () => {
    it('should use default values from constants', async () => {
      const args: RecentArgs = {}; // No arguments
      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue([]);

      const result = await recentKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.period.days).toBe(RECENT_DEFAULTS.DAYS);
      expect(output.summary.showing).toBe(0); // No entries, but limit would be RECENT_DEFAULTS.LIMIT
    });
  });
});