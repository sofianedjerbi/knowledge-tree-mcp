import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ServerContextImpl } from '../../src/server/ServerContext.js';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import type { KnowledgeEntry, ServerOptions } from '../../src/types/index.js';
import { tmpdir } from 'os';

describe('ServerContext readWithDepth', () => {
  let serverContext: ServerContextImpl;
  let testKnowledgeRoot: string;

  beforeEach(() => {
    // Create a temporary test directory
    testKnowledgeRoot = join(tmpdir(), `knowledge-test-${Date.now()}`);
    const testLogsDir = join(testKnowledgeRoot, 'logs');
    mkdirSync(testKnowledgeRoot, { recursive: true });
    mkdirSync(testLogsDir, { recursive: true });
    
    // Setup server context with real file system
    const options: ServerOptions = {
      knowledgeRoot: testKnowledgeRoot,
      logsDir: testLogsDir,
      webPort: 3000
    };
    serverContext = new ServerContextImpl(options, new Set());
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(testKnowledgeRoot)) {
      rmSync(testKnowledgeRoot, { recursive: true, force: true });
    }
  });

  // Helper function to create test knowledge entries
  const createKnowledgeEntry = (path: string, entry: KnowledgeEntry) => {
    const fullPath = join(testKnowledgeRoot, path);
    const dir = join(fullPath, '..');
    mkdirSync(dir, { recursive: true });
    writeFileSync(fullPath, JSON.stringify(entry, null, 2));
  };

  describe('Basic read functionality', () => {
    it('should read a single entry with depth 1', async () => {
      const mockEntry: KnowledgeEntry = {
        priority: 'CRITICAL',
        problem: 'How to handle errors',
        solution: 'Use try-catch blocks',
        code: 'try { } catch(e) { }'
      };

      createKnowledgeEntry('errors.json', mockEntry);

      const result = await serverContext.readWithDepth(
        join(testKnowledgeRoot, 'errors.json'),
        'errors.json',
        1,
        new Set()
      );

      expect(result).toEqual({
        path: 'errors.json',
        ...mockEntry
      });
    });

    it('should handle circular references', async () => {
      const visited = new Set(['errors.json']);
      
      const result = await serverContext.readWithDepth(
        join(testKnowledgeRoot, 'errors.json'),
        'errors.json',
        2,
        visited
      );

      expect(result).toEqual({ circular_reference: 'errors.json' });
    });

    it('should handle read errors', async () => {
      // Don't create the file - it should fail
      await expect(
        serverContext.readWithDepth(
          join(testKnowledgeRoot, 'missing.json'),
          'missing.json',
          1,
          new Set()
        )
      ).rejects.toThrow();
    });

    it('should handle invalid JSON', async () => {
      // Create a file with invalid JSON
      const fullPath = join(testKnowledgeRoot, 'invalid.json');
      writeFileSync(fullPath, 'invalid json');

      await expect(
        serverContext.readWithDepth(
          fullPath,
          'invalid.json',
          1,
          new Set()
        )
      ).rejects.toThrow();
    });
  });

  describe('Deep reading with relationships', () => {
    it('should follow relationships with depth > 1', async () => {
      const mainEntry: KnowledgeEntry = {
        priority: 'CRITICAL',
        problem: 'Main entry',
        solution: 'Main solution',
        related_to: [
          { path: 'related/first.json', relationship: 'related' },
          { path: 'related/second.json', relationship: 'implements' }
        ]
      };

      const firstRelated: KnowledgeEntry = {
        priority: 'REQUIRED',
        problem: 'First related',
        solution: 'First solution'
      };

      const secondRelated: KnowledgeEntry = {
        priority: 'COMMON',
        problem: 'Second related',
        solution: 'Second solution'
      };

      createKnowledgeEntry('main.json', mainEntry);
      createKnowledgeEntry('related/first.json', firstRelated);
      createKnowledgeEntry('related/second.json', secondRelated);

      const result = await serverContext.readWithDepth(
        join(testKnowledgeRoot, 'main.json'),
        'main.json',
        2,
        new Set()
      );

      expect(result.path).toBe('main.json');
      expect(result.linked_entries).toBeDefined();
      expect(result.linked_entries['related/first.json']).toEqual({
        relationship: 'related',
        content: {
          path: 'related/first.json',
          ...firstRelated
        }
      });
      expect(result.linked_entries['related/second.json']).toEqual({
        relationship: 'implements',
        content: {
          path: 'related/second.json',
          ...secondRelated
        }
      });
    });

    it('should not follow relationships when depth is 1', async () => {
      const entry: KnowledgeEntry = {
        priority: 'CRITICAL',
        problem: 'Entry with links',
        solution: 'Solution',
        related_to: [
          { path: 'other.json', relationship: 'related' }
        ]
      };

      createKnowledgeEntry('entry.json', entry);
      createKnowledgeEntry('other.json', { priority: 'COMMON', problem: 'Other', solution: 'Other solution' });

      const result = await serverContext.readWithDepth(
        join(testKnowledgeRoot, 'entry.json'),
        'entry.json',
        1,
        new Set()
      );

      expect(result.linked_entries).toBeUndefined();
    });

    it('should follow relationships recursively with depth > 2', async () => {
      const level1: KnowledgeEntry = {
        priority: 'CRITICAL',
        problem: 'Level 1',
        solution: 'Solution 1',
        related_to: [
          { path: 'level2.json', relationship: 'related' }
        ]
      };

      const level2: KnowledgeEntry = {
        priority: 'REQUIRED',
        problem: 'Level 2',
        solution: 'Solution 2',
        related_to: [
          { path: 'level3.json', relationship: 'implements' }
        ]
      };

      const level3: KnowledgeEntry = {
        priority: 'COMMON',
        problem: 'Level 3',
        solution: 'Solution 3'
      };

      createKnowledgeEntry('level1.json', level1);
      createKnowledgeEntry('level2.json', level2);
      createKnowledgeEntry('level3.json', level3);

      const result = await serverContext.readWithDepth(
        join(testKnowledgeRoot, 'level1.json'),
        'level1.json',
        3,
        new Set()
      );

      // Check nested structure
      expect(result.linked_entries['level2.json'].content.linked_entries).toBeDefined();
      expect(result.linked_entries['level2.json'].content.linked_entries['level3.json']).toBeDefined();
      expect(result.linked_entries['level2.json'].content.linked_entries['level3.json'].content.path).toBe('level3.json');
    });

    it('should handle missing linked entries gracefully', async () => {
      const entry: KnowledgeEntry = {
        priority: 'CRITICAL',
        problem: 'Entry with broken link',
        solution: 'Solution',
        related_to: [
          { path: 'missing.json', relationship: 'related', description: 'This file does not exist' }
        ]
      };

      createKnowledgeEntry('broken.json', entry);
      // Don't create missing.json

      const result = await serverContext.readWithDepth(
        join(testKnowledgeRoot, 'broken.json'),
        'broken.json',
        2,
        new Set()
      );

      expect(result.linked_entries['missing.json']).toEqual({
        relationship: 'related',
        description: 'This file does not exist',
        error: 'Failed to load linked entry'
      });
    });

    it('should handle circular references in deep traversal', async () => {
      const entry1: KnowledgeEntry = {
        priority: 'CRITICAL',
        problem: 'Entry 1',
        solution: 'Solution 1',
        related_to: [
          { path: 'entry2.json', relationship: 'related' }
        ]
      };

      const entry2: KnowledgeEntry = {
        priority: 'REQUIRED',
        problem: 'Entry 2',
        solution: 'Solution 2',
        related_to: [
          { path: 'entry1.json', relationship: 'related' } // Circular reference
        ]
      };

      createKnowledgeEntry('entry1.json', entry1);
      createKnowledgeEntry('entry2.json', entry2);

      const result = await serverContext.readWithDepth(
        join(testKnowledgeRoot, 'entry1.json'),
        'entry1.json',
        3,
        new Set()
      );

      // Should handle circular reference gracefully
      expect(result.linked_entries['entry2.json'].content).toBeDefined();
      expect(result.linked_entries['entry2.json'].content.linked_entries['entry1.json'].content).toEqual({
        circular_reference: 'entry1.json'
      });
    });
  });

  describe('Relationship descriptions', () => {
    it('should include relationship descriptions when available', async () => {
      const entry: KnowledgeEntry = {
        priority: 'CRITICAL',
        problem: 'Main entry',
        solution: 'Solution',
        related_to: [
          { 
            path: 'explained.json', 
            relationship: 'supersedes',
            description: 'This supersedes the old approach'
          },
          {
            path: 'simple.json',
            relationship: 'related'
            // No description
          }
        ]
      };

      const explained: KnowledgeEntry = {
        priority: 'COMMON',
        problem: 'Explained entry',
        solution: 'Old solution'
      };

      const simple: KnowledgeEntry = {
        priority: 'REQUIRED',
        problem: 'Simple entry',
        solution: 'Simple solution'
      };

      createKnowledgeEntry('main.json', entry);
      createKnowledgeEntry('explained.json', explained);
      createKnowledgeEntry('simple.json', simple);

      const result = await serverContext.readWithDepth(
        join(testKnowledgeRoot, 'main.json'),
        'main.json',
        2,
        new Set()
      );

      expect(result.linked_entries['explained.json'].description).toBe('This supersedes the old approach');
      expect(result.linked_entries['simple.json'].description).toBeUndefined();
    });
  });

  describe('Visited set management', () => {
    it('should pass independent visited sets for each branch', async () => {
      const root: KnowledgeEntry = {
        priority: 'CRITICAL',
        problem: 'Root',
        solution: 'Root solution',
        related_to: [
          { path: 'branch1/entry.json', relationship: 'related' },
          { path: 'branch2/entry.json', relationship: 'related' }
        ]
      };

      const shared: KnowledgeEntry = {
        priority: 'COMMON',
        problem: 'Shared entry',
        solution: 'Shared solution'
      };

      const branch1: KnowledgeEntry = {
        priority: 'REQUIRED',
        problem: 'Branch 1',
        solution: 'Solution 1',
        related_to: [
          { path: 'shared.json', relationship: 'implements' }
        ]
      };

      const branch2: KnowledgeEntry = {
        priority: 'REQUIRED',
        problem: 'Branch 2',
        solution: 'Solution 2',
        related_to: [
          { path: 'shared.json', relationship: 'implements' }
        ]
      };

      createKnowledgeEntry('root.json', root);
      createKnowledgeEntry('branch1/entry.json', branch1);
      createKnowledgeEntry('branch2/entry.json', branch2);
      createKnowledgeEntry('shared.json', shared);

      const result = await serverContext.readWithDepth(
        join(testKnowledgeRoot, 'root.json'),
        'root.json',
        3,
        new Set()
      );

      // Both branches should be able to read the shared entry
      expect(result.linked_entries['branch1/entry.json'].content.linked_entries['shared.json'].content.problem).toBe('Shared entry');
      expect(result.linked_entries['branch2/entry.json'].content.linked_entries['shared.json'].content.problem).toBe('Shared entry');
    });
  });

  describe('Metadata inclusion', () => {
    it('should include correct metadata at each level', async () => {
      const entry: KnowledgeEntry = {
        priority: 'CRITICAL',
        problem: 'Entry with metadata',
        solution: 'Solution',
        related_to: [
          { path: 'nested/deep.json', relationship: 'related' }
        ]
      };

      const nested: KnowledgeEntry = {
        priority: 'REQUIRED',
        problem: 'Nested entry',
        solution: 'Nested solution'
      };

      createKnowledgeEntry('top.json', entry);
      createKnowledgeEntry('nested/deep.json', nested);

      const result = await serverContext.readWithDepth(
        join(testKnowledgeRoot, 'top.json'),
        'top.json',
        3,
        new Set()
      );

      expect(result.path).toBe('top.json');

      expect(result.linked_entries['nested/deep.json'].content.path).toBe('nested/deep.json');
    });
  });

  describe('Edge cases', () => {
    it('should handle entries with no related_to field', async () => {
      const entry: KnowledgeEntry = {
        priority: 'CRITICAL',
        problem: 'Standalone entry',
        solution: 'No relationships'
        // No related_to field
      };

      createKnowledgeEntry('standalone.json', entry);

      const result = await serverContext.readWithDepth(
        join(testKnowledgeRoot, 'standalone.json'),
        'standalone.json',
        2,
        new Set()
      );

      expect(result.linked_entries).toBeUndefined();
      expect(result.priority).toBe('CRITICAL');
    });

    it('should handle empty related_to array', async () => {
      const entry: KnowledgeEntry = {
        priority: 'COMMON',
        problem: 'Entry with empty relations',
        solution: 'Solution',
        related_to: []
      };

      createKnowledgeEntry('empty-relations.json', entry);

      const result = await serverContext.readWithDepth(
        join(testKnowledgeRoot, 'empty-relations.json'),
        'empty-relations.json',
        2,
        new Set()
      );

      expect(result.linked_entries).toBeUndefined();
    });

    it('should handle depth 0', async () => {
      const entry: KnowledgeEntry = {
        priority: 'CRITICAL',
        problem: 'Entry',
        solution: 'Solution',
        related_to: [
          { path: 'other.json', relationship: 'related' }
        ]
      };

      createKnowledgeEntry('entry.json', entry);
      createKnowledgeEntry('other.json', { priority: 'COMMON', problem: 'Other', solution: 'Other solution' });

      const result = await serverContext.readWithDepth(
        join(testKnowledgeRoot, 'entry.json'),
        'entry.json',
        0,
        new Set()
      );

      // With depth 0, should still read the entry but not follow links
      expect(result.path).toBe('entry.json');
      expect(result.linked_entries).toBeUndefined();
    });
  });
});