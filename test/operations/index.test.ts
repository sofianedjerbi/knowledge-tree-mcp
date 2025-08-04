import { describe, it, expect, beforeEach, vi } from 'vitest';
import { indexKnowledgeHandler } from '../../src/tools/indexKnowledge.js';
import type { IndexArgs, ServerContext, KnowledgeEntry } from '../../src/types/index.js';
import { readFile, getFileStats } from '../../src/utils/index.js';
import { INDEX_DEFAULTS } from '../../src/constants/index.js';

// Mock the utils
vi.mock('../../src/utils/index.js');

describe('Index Knowledge Tool', () => {
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

    // Setup default mocks
    vi.mocked(getFileStats).mockResolvedValue({
      birthtime: new Date('2024-01-01'),
      mtime: new Date('2024-01-02'),
      size: 1024
    } as any);
  });

  describe('Basic index functionality', () => {
    it('should return empty index when no entries exist', async () => {
      const args: IndexArgs = {};
      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue([]);

      const result = await indexKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.total_entries).toBe(0);
      expect(output.showing).toBe(0);
      expect(output.format).toBe('tree');
      expect(output.timestamp).toBeDefined();
      expect(output.statistics).toBeDefined();
    });

    it('should handle single entry with tree format', async () => {
      const args: IndexArgs = {};
      const mockEntry: KnowledgeEntry = {
        priority: 'CRITICAL',
        problem: 'How to handle authentication errors',
        solution: 'Check token expiry and refresh',
        related_to: []
      };

      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue(['auth/errors.json']);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockEntry));

      const result = await indexKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.total_entries).toBe(1);
      expect(output.showing).toBe(1);
      expect(output.format).toBe('tree');
      expect(output.index.auth.errors).toBeDefined();
      expect(output.index.auth.errors.priority).toBe('CRITICAL');
      expect(output.index.auth.errors.links).toBe(0);
    });

    it('should respect max_entries limit', async () => {
      const args: IndexArgs = { max_entries: 2 };
      const mockEntry: KnowledgeEntry = {
        priority: 'COMMON',
        problem: 'Test problem',
        solution: 'Test solution'
      };

      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue([
        'entry1.json',
        'entry2.json',
        'entry3.json',
        'entry4.json'
      ]);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockEntry));

      const result = await indexKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.total_entries).toBe(4);
      expect(output.showing).toBe(2);
    });

    it('should skip invalid JSON entries', async () => {
      const args: IndexArgs = {};
      const validEntry: KnowledgeEntry = {
        priority: 'REQUIRED',
        problem: 'Valid entry',
        solution: 'Valid solution'
      };

      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue([
        'valid.json',
        'invalid.json'
      ]);
      
      vi.mocked(readFile)
        .mockResolvedValueOnce(JSON.stringify(validEntry))
        .mockResolvedValueOnce('invalid json');

      const result = await indexKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.showing).toBe(1);
      expect(output.index.valid).toBeDefined();
    });
  });

  describe('Format variations', () => {
    const setupMockData = () => {
      const entries = [
        {
          path: 'testing/unit-tests.json',
          content: {
            priority: 'CRITICAL',
            problem: 'How to write effective unit tests',
            solution: 'Use mocking, test isolation, and proper assertions',
            code: 'test("example", () => { expect(1).toBe(1); });',
            related_to: [
              { path: 'testing/mocks.json', relationship: 'related' }
            ]
          }
        },
        {
          path: 'architecture/patterns.json',
          content: {
            priority: 'REQUIRED',
            problem: 'Which design patterns to use',
            solution: 'Follow SOLID principles and use appropriate patterns',
            examples: [
              { title: 'Singleton', code: 'class Singleton {}', language: 'ts' }
            ]
          }
        }
      ];

      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue(
        entries.map(e => e.path)
      );
      
      entries.forEach((entry, index) => {
        vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify(entry.content));
      });

      return entries;
    };

    it('should format as tree structure', async () => {
      const args: IndexArgs = { format: 'tree', include_content: false };
      setupMockData();

      const result = await indexKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.format).toBe('tree');
      expect(output.index.testing['unit-tests']).toBeDefined();
      expect(output.index.testing['unit-tests'].priority).toBe('CRITICAL');
      expect(output.index.testing['unit-tests'].links).toBe(1);
      expect(output.index.architecture.patterns).toBeDefined();
      expect(output.index.architecture.patterns.priority).toBe('REQUIRED');
    });

    it('should format as list structure', async () => {
      const args: IndexArgs = { format: 'list', include_content: false };
      setupMockData();

      const result = await indexKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.format).toBe('list');
      expect(output.index).toBeInstanceOf(Array);
      expect(output.index).toHaveLength(2);
      expect(output.index[0]).toHaveProperty('path', 'testing/unit-tests.json');
      expect(output.index[0]).toHaveProperty('priority', 'CRITICAL');
      expect(output.index[0]).toHaveProperty('relationships', 1);
      expect(output.index[0]).toHaveProperty('has_code', true);
    });

    it('should format as summary with stats', async () => {
      const args: IndexArgs = { format: 'summary' };
      setupMockData();

      const result = await indexKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.format).toBe('summary');
      expect(output.index[0]).toHaveProperty('file_info');
      expect(output.index[0].file_info).toHaveProperty('created');
      expect(output.index[0].file_info).toHaveProperty('modified');
      expect(output.index[0].file_info).toHaveProperty('size');
      expect(output.index[0]).toHaveProperty('features');
      expect(output.index[0].features).toHaveProperty('has_code', true);
      expect(output.index[1].features).toHaveProperty('has_examples', true);
    });

    it('should format as categories', async () => {
      const args: IndexArgs = { format: 'categories' };
      setupMockData();

      const result = await indexKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.format).toBe('categories');
      expect(output.index).toHaveProperty('testing');
      expect(output.index).toHaveProperty('architecture');
      
      expect(output.index.testing.count).toBe(1);
      expect(output.index.testing.priorities).toHaveProperty('CRITICAL', 1);
      expect(output.index.testing.entries).toHaveLength(1);
      
      expect(output.index.architecture.count).toBe(1);
      expect(output.index.architecture.priorities).toHaveProperty('REQUIRED', 1);
    });
  });

  describe('Content inclusion', () => {
    it('should include full content when include_content is true', async () => {
      const args: IndexArgs = { format: 'tree', include_content: true };
      const mockEntry: KnowledgeEntry = {
        priority: 'COMMON',
        problem: 'This is a detailed problem description that is longer than 50 characters',
        solution: 'This is a comprehensive solution that provides detailed step-by-step instructions on how to solve the problem effectively'
      };

      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue(['detailed.json']);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockEntry));

      const result = await indexKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.index.detailed.problem).toBe(mockEntry.problem);
      expect(output.index.detailed.solution).toContain('This is a comprehensive solution');
      expect(output.index.detailed.solution.endsWith('...')).toBe(true);
    });

    it('should truncate content when include_content is false', async () => {
      const args: IndexArgs = { format: 'tree', include_content: false };
      const mockEntry: KnowledgeEntry = {
        priority: 'EDGE-CASE',
        problem: 'This is a detailed problem description that is longer than 50 characters',
        solution: 'Long solution text'
      };

      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue(['truncated.json']);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(mockEntry));

      const result = await indexKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.index.truncated.problem.endsWith('...')).toBe(true);
      expect(output.index.truncated.problem.length).toBeLessThanOrEqual(53); // 50 chars + "..."
      expect(output.index.truncated.solution).toBeUndefined();
    });
  });

  describe('Statistics generation', () => {
    it('should generate accurate statistics', async () => {
      const args: IndexArgs = {};
      const entries = [
        { priority: 'CRITICAL', related_to: [{ path: 'other.json' }], code: 'code1' },
        { priority: 'CRITICAL', related_to: [] },
        { priority: 'REQUIRED', code: 'code2' },
        { priority: 'COMMON' },
        { priority: 'EDGE-CASE', related_to: [{ path: 'a.json' }, { path: 'b.json' }] }
      ];

      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue(
        entries.map((_, i) => `entry${i}.json`)
      );
      
      entries.forEach((entry) => {
        vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({
          problem: 'Problem',
          solution: 'Solution',
          ...entry
        }));
      });

      const result = await indexKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.statistics.by_priority).toEqual({
        CRITICAL: 2,
        REQUIRED: 1,
        COMMON: 1,
        'EDGE-CASE': 1
      });
      expect(output.statistics.with_relationships).toBe(2);
      expect(output.statistics.with_code).toBe(2);
    });

    it('should handle entries in nested categories', async () => {
      const args: IndexArgs = {};
      const paths = [
        'auth/login.json',
        'auth/logout.json',
        'api/rest/users.json',
        'api/graphql/queries.json',
        'root-entry.json'
      ];

      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue(paths);
      
      paths.forEach(() => {
        vi.mocked(readFile).mockResolvedValueOnce(JSON.stringify({
          priority: 'COMMON',
          problem: 'Problem',
          solution: 'Solution'
        }));
      });

      const result = await indexKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.statistics.by_category).toEqual({
        auth: 2,
        'api/rest': 1,
        'api/graphql': 1,
        root: 1
      });
    });
  });

  describe('Error handling', () => {
    it('should handle file read errors gracefully', async () => {
      const args: IndexArgs = {};
      
      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue([
        'good.json',
        'bad.json',
        'another-good.json'
      ]);
      
      vi.mocked(readFile)
        .mockResolvedValueOnce(JSON.stringify({ priority: 'CRITICAL', problem: 'Good 1', solution: 'Sol 1' }))
        .mockRejectedValueOnce(new Error('File read error'))
        .mockResolvedValueOnce(JSON.stringify({ priority: 'REQUIRED', problem: 'Good 2', solution: 'Sol 2' }));

      const result = await indexKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.total_entries).toBe(3);
      expect(output.showing).toBe(2); // Only valid entries
    });

    it('should handle missing priority in entries', async () => {
      const args: IndexArgs = {};
      const invalidEntry = {
        problem: 'Missing priority',
        solution: 'Should handle gracefully'
        // No priority field
      };

      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue(['invalid.json']);
      vi.mocked(readFile).mockResolvedValue(JSON.stringify(invalidEntry));

      const result = await indexKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      // Entry should be included even without priority
      expect(output.showing).toBe(1);
      expect(output.index.invalid.priority).toBeUndefined();
    });
  });

  describe('Default values', () => {
    it('should use default values from constants', async () => {
      const args: IndexArgs = {}; // No arguments provided

      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue([]);

      const result = await indexKnowledgeHandler(args, mockContext);
      const output = JSON.parse(result.content[0].text);

      expect(output.format).toBe(INDEX_DEFAULTS.FORMAT);
      // The handler should respect default max_entries
      expect(mockContext.scanKnowledgeTree).toHaveBeenCalled();
    });
  });
});