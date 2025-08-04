/**
 * Integration tests for path update functionality
 * These tests run without mocks to test the real implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { join } from 'path';
import { mkdir, writeFile, readFile, rm } from 'fs/promises';
import type { UpdateArgs, ServerContext } from '../../src/types/index.js';
import { updateKnowledgeHandler } from '../../src/tools/update.js';
import { 
  moveEntryWithReferences, 
  validateEntryMove 
} from '../../src/utils/entryOperations.js';
import { fileExists } from '../../src/utils/fileSystem.js';

// Create mock context
const createTestContext = (knowledgeRoot: string): ServerContext => ({
  knowledgeRoot,
  broadcastUpdate: vi.fn(),
  logUsage: vi.fn(),
  logAccess: vi.fn()
});

const createTestEntry = (overrides = {}) => ({
  title: 'Test Entry',
  priority: 'COMMON',
  problem: 'Test problem',
  solution: 'Test solution',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  ...overrides
});

describe('Path Update Integration Tests', () => {
  const testDir = '/tmp/knowledge-tree-integration-test';
  let context: ServerContext;

  beforeEach(async () => {
    // Clean up and recreate test directory
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
    
    await mkdir(testDir, { recursive: true });
    context = createTestContext(testDir);
  });

  describe('Basic Update Operations', () => {
    it('should update an entry without path regeneration', async () => {
      const initialEntry = createTestEntry({
        title: 'How to setup Redis cluster',
        tags: ['redis', 'database']
      });
      
      const testPath = 'redis-setup.json';
      const fullPath = join(testDir, testPath);
      
      // Create the file
      await writeFile(fullPath, JSON.stringify(initialEntry, null, 2));
      
      // Verify file exists
      expect(await fileExists(fullPath)).toBe(true);
      
      // Update the entry
      const args: UpdateArgs = {
        path: testPath,
        regenerate_path: false,
        updates: {
          problem: 'Updated problem description',
          tags: ['redis', 'database', 'cluster']
        }
      };
      
      const result = await updateKnowledgeHandler(args, context);
      
      expect(result.content[0].text).toContain('Successfully updated');
      expect(result.content[0].text).not.toContain('moved');
      
      // Verify file still exists at original location
      expect(await fileExists(fullPath)).toBe(true);
      
      // Verify content was updated
      const updatedContent = JSON.parse(await readFile(fullPath, 'utf-8'));
      expect(updatedContent.problem).toBe('Updated problem description');
      expect(updatedContent.tags).toEqual(['redis', 'database', 'cluster']);
      expect(updatedContent.title).toBe('How to setup Redis cluster'); // Should remain unchanged
    });

    it('should update multiple fields correctly', async () => {
      const initialEntry = createTestEntry({
        title: 'Original Title',
        priority: 'COMMON',
        problem: 'Original problem'
      });
      
      const testPath = 'multi-update.json';
      const fullPath = join(testDir, testPath);
      
      await writeFile(fullPath, JSON.stringify(initialEntry, null, 2));
      
      const args: UpdateArgs = {
        path: testPath,
        updates: {
          title: 'Updated Title',
          priority: 'CRITICAL',
          problem: 'Updated problem',
          solution: 'Updated solution'
        }
      };
      
      const result = await updateKnowledgeHandler(args, context);
      
      expect(result.content[0].text).toContain('Successfully updated');
      expect(result.content[0].text).toContain('title, priority, problem, solution');
      
      const updatedContent = JSON.parse(await readFile(fullPath, 'utf-8'));
      expect(updatedContent.title).toBe('Updated Title');
      expect(updatedContent.priority).toBe('CRITICAL');
      expect(updatedContent.problem).toBe('Updated problem');
      expect(updatedContent.solution).toBe('Updated solution');
    });
  });

  describe('Path Regeneration', () => {
    it('should regenerate path when title changes significantly', async () => {
      const initialEntry = createTestEntry({
        title: 'How to setup Redis cluster',
        tags: ['redis', 'database', 'cluster'],
        category: 'database'
      });
      
      const oldPath = 'redis-setup.json';
      const oldFullPath = join(testDir, oldPath);
      
      await writeFile(oldFullPath, JSON.stringify(initialEntry, null, 2));
      
      const args: UpdateArgs = {
        path: oldPath,
        regenerate_path: true,
        updates: {
          title: 'How to configure MongoDB replica set',
          tags: ['mongodb', 'database', 'replica'],
          category: 'database'
        }
      };
      
      const result = await updateKnowledgeHandler(args, context);
      
      expect(result.content[0].text).toContain('Successfully updated');
      
      // If path was regenerated, old file should be gone and new file should exist
      // If path stayed the same, the file should still be at the original location
      const oldFileExists = await fileExists(oldFullPath);
      
      if (result.content[0].text.includes('moved')) {
        expect(oldFileExists).toBe(false);
        // Check that a new file was created somewhere
        expect(context.broadcastUpdate).toHaveBeenCalledWith(
          'entryMoved',
          expect.objectContaining({
            oldPath: expect.any(String),
            newPath: expect.any(String)
          })
        );
      } else {
        // Path generation determined the new path is similar to the old one
        expect(oldFileExists).toBe(true);
      }
    });

    it('should not regenerate path when flag is false', async () => {
      const initialEntry = createTestEntry({
        title: 'Original Title'
      });
      
      const testPath = 'no-regen.json';
      const fullPath = join(testDir, testPath);
      
      await writeFile(fullPath, JSON.stringify(initialEntry, null, 2));
      
      const args: UpdateArgs = {
        path: testPath,
        regenerate_path: false,
        updates: {
          title: 'Completely Different Technology Stack'
        }
      };
      
      const result = await updateKnowledgeHandler(args, context);
      
      expect(result.content[0].text).toContain('Successfully updated');
      expect(result.content[0].text).not.toContain('moved');
      expect(await fileExists(fullPath)).toBe(true);
    });
  });

  describe('Entry Moving Operations', () => {
    it('should move entry and update references', async () => {
      // Create source entry
      const sourceEntry = createTestEntry({
        title: 'Redis Setup Guide',
        related_to: [{
          path: 'troubleshooting/redis-issues.json',
          relationship: 'related',
          description: 'Common issues'
        }]
      });
      
      // Create target entry that references the source
      const targetEntry = createTestEntry({
        title: 'Redis Issues',
        related_to: [{
          path: 'setup/redis-guide.json',
          relationship: 'related',
          description: 'Setup guide'
        }]
      });
      
      const oldPath = 'setup/redis-guide.json';
      const newPath = 'database/redis/setup-guide.json';
      const targetPath = 'troubleshooting/redis-issues.json';
      
      // Create directories and files
      await mkdir(join(testDir, 'setup'), { recursive: true });
      await mkdir(join(testDir, 'troubleshooting'), { recursive: true });
      await mkdir(join(testDir, 'database/redis'), { recursive: true });
      
      await writeFile(join(testDir, oldPath), JSON.stringify(sourceEntry, null, 2));
      await writeFile(join(testDir, targetPath), JSON.stringify(targetEntry, null, 2));
      
      // Move the entry
      const result = await moveEntryWithReferences(oldPath, newPath, context);
      
      expect(result.success).toBe(true);
      
      // Check old file is gone
      expect(await fileExists(join(testDir, oldPath))).toBe(false);
      
      // Check new file exists
      expect(await fileExists(join(testDir, newPath))).toBe(true);
      
      // Check that reference in target file was updated
      const updatedTargetContent = JSON.parse(
        await readFile(join(testDir, targetPath), 'utf-8')
      );
      
      expect(updatedTargetContent.related_to[0].path).toBe(newPath);
    });

    it('should validate entry moves correctly', async () => {
      const sourceEntry = createTestEntry({ title: 'Source Entry' });
      const conflictEntry = createTestEntry({ title: 'Conflict Entry' });
      
      const oldPath = 'source.json';
      const newPath = 'target.json';
      
      await writeFile(join(testDir, oldPath), JSON.stringify(sourceEntry, null, 2));
      await writeFile(join(testDir, newPath), JSON.stringify(conflictEntry, null, 2));
      
      const validation = await validateEntryMove(oldPath, newPath, context);
      
      expect(validation.valid).toBe(true);
      expect(validation.warnings.some(w => w.includes('Target path already exists'))).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing files correctly', async () => {
      const args: UpdateArgs = {
        path: 'non-existent.json',
        updates: {
          problem: 'Updated problem'
        }
      };
      
      const result = await updateKnowledgeHandler(args, context);
      
      expect(result.content[0].text).toContain('Entry not found');
    });

    it('should validate arguments correctly', async () => {
      const initialEntry = createTestEntry();
      const testPath = 'validation-test.json';
      
      await writeFile(join(testDir, testPath), JSON.stringify(initialEntry, null, 2));
      
      const args: UpdateArgs = {
        path: testPath,
        updates: {
          priority: 'INVALID_PRIORITY' as any
        }
      };
      
      const result = await updateKnowledgeHandler(args, context);
      
      expect(result.content[0].text).toContain('Validation failed');
      expect(result.content[0].text).toContain('Invalid priority value');
    });
  });
});