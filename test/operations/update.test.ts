import { describe, it, expect, beforeEach, vi } from 'vitest';
import { updateKnowledgeHandler } from '../../src/tools/update.js';
import type { UpdateArgs, ServerContext, KnowledgeEntry } from '../../src/types/index.js';
import { 
  fileExists, 
  readKnowledgeEntry, 
  writeKnowledgeEntry,
  ensureJsonExtension,
  validateEntryMove,
  moveEntryWithReferences
} from '../../src/utils/index.js';

// Mock the utils for this specific test file
vi.mock('../../src/utils/index.js', () => ({
  ensureJsonExtension: vi.fn((path: string) => path.endsWith('.json') ? path : `${path}.json`),
  fileExists: vi.fn(),
  readKnowledgeEntry: vi.fn(),
  writeKnowledgeEntry: vi.fn(),
  validateRequiredFields: vi.fn(),
  validateEntryMove: vi.fn(),
  moveEntryWithReferences: vi.fn()
}));

describe('Update Knowledge Tool', () => {
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
    vi.mocked(ensureJsonExtension).mockImplementation((path: string) => 
      path.endsWith('.json') ? path : `${path}.json`
    );
  });

  describe('Basic update functionality', () => {
    it('should successfully update basic fields', async () => {
      const originalEntry: KnowledgeEntry = {
        priority: 'COMMON',
        problem: 'Original problem',
        solution: 'Original solution',
        title: 'Original title'
      };

      const expectedUpdatedEntry: KnowledgeEntry = {
        priority: 'CRITICAL',
        problem: 'Updated problem',
        solution: 'Updated solution',
        title: 'Updated title',
        category: 'testing',
        updated_at: expect.any(String)
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readKnowledgeEntry).mockResolvedValue(originalEntry);
      vi.mocked(writeKnowledgeEntry).mockResolvedValue(undefined);

      const args: UpdateArgs = {
        path: 'test.json',
        updates: {
          title: 'Updated title',
          priority: 'CRITICAL',
          problem: 'Updated problem',
          solution: 'Updated solution',
          category: 'testing'
        }
      };

      const result = await updateKnowledgeHandler(args, mockContext);
      
      expect(result.content[0].text).toContain('✅ Successfully updated test.json');
      expect(result.content[0].text).toContain('Updated fields: title, priority, problem, solution, category');

      // Verify the entry was written with updates
      expect(writeKnowledgeEntry).toHaveBeenCalledWith(
        '/test/knowledge/test.json',
        expectedUpdatedEntry
      );

      // Verify broadcast was called
      expect(mockContext.broadcastUpdate).toHaveBeenCalledWith('entryUpdated', {
        path: 'test.json',
        data: expectedUpdatedEntry
      });
    });

    it('should handle paths without .json extension', async () => {
      const originalEntry: KnowledgeEntry = {
        priority: 'REQUIRED',
        problem: 'Test problem',
        solution: 'Test solution'
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readKnowledgeEntry).mockResolvedValue(originalEntry);
      vi.mocked(writeKnowledgeEntry).mockResolvedValue(undefined);

      const args: UpdateArgs = {
        path: 'test', // No .json extension
        updates: {
          priority: 'CRITICAL'
        }
      };

      const result = await updateKnowledgeHandler(args, mockContext);
      
      expect(result.content[0].text).toContain('✅ Successfully updated test.json');
      expect(ensureJsonExtension).toHaveBeenCalledWith('test');
      expect(fileExists).toHaveBeenCalledWith('/test/knowledge/test.json');
    });

    it('should return error when entry does not exist', async () => {
      vi.mocked(fileExists).mockResolvedValue(false);

      const args: UpdateArgs = {
        path: 'non-existent.json',
        updates: {
          title: 'New title'
        }
      };

      const result = await updateKnowledgeHandler(args, mockContext);
      
      expect(result.content[0].text).toBe('❌ Entry not found: non-existent.json');
      expect(readKnowledgeEntry).not.toHaveBeenCalled();
      expect(writeKnowledgeEntry).not.toHaveBeenCalled();
    });

    it('should handle corrupted JSON files', async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readKnowledgeEntry).mockRejectedValue(new Error('Invalid JSON'));

      const args: UpdateArgs = {
        path: 'corrupted.json',
        updates: {
          title: 'New title'
        }
      };

      const result = await updateKnowledgeHandler(args, mockContext);
      
      expect(result.content[0].text).toBe('❌ Failed to read entry: corrupted.json');
      expect(writeKnowledgeEntry).not.toHaveBeenCalled();
    });
  });

  describe('Field validation', () => {
    beforeEach(() => {
      const baseEntry: KnowledgeEntry = {
        priority: 'COMMON',
        problem: 'Base problem',
        solution: 'Base solution'
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readKnowledgeEntry).mockResolvedValue(baseEntry);
    });

    it('should validate title field', async () => {
      const args: UpdateArgs = {
        path: 'test.json',
        updates: {
          title: '' // Empty title
        }
      };

      const result = await updateKnowledgeHandler(args, mockContext);
      
      expect(result.content[0].text).toContain('❌ Validation failed:');
      expect(result.content[0].text).toContain('Title must be a non-empty string');
      expect(writeKnowledgeEntry).not.toHaveBeenCalled();
    });

    it('should validate priority field', async () => {
      const args: UpdateArgs = {
        path: 'test.json',
        updates: {
          priority: 'INVALID' as any
        }
      };

      const result = await updateKnowledgeHandler(args, mockContext);
      
      expect(result.content[0].text).toContain('❌ Validation failed:');
      expect(result.content[0].text).toContain('Invalid priority value');
      expect(writeKnowledgeEntry).not.toHaveBeenCalled();
    });

    it('should validate problem field', async () => {
      const args: UpdateArgs = {
        path: 'test.json',
        updates: {
          problem: '' // Empty problem
        }
      };

      const result = await updateKnowledgeHandler(args, mockContext);
      
      expect(result.content[0].text).toContain('❌ Validation failed:');
      expect(result.content[0].text).toContain('Problem must be a non-empty string');
      expect(writeKnowledgeEntry).not.toHaveBeenCalled();
    });

    it('should validate solution field', async () => {
      const args: UpdateArgs = {
        path: 'test.json',
        updates: {
          solution: '' // Empty solution
        }
      };

      const result = await updateKnowledgeHandler(args, mockContext);
      
      expect(result.content[0].text).toContain('❌ Validation failed:');
      expect(result.content[0].text).toContain('Solution must be a non-empty string');
      expect(writeKnowledgeEntry).not.toHaveBeenCalled();
    });

    it('should validate tags field', async () => {
      const args: UpdateArgs = {
        path: 'test.json',
        updates: {
          tags: 'not an array' as any
        }
      };

      const result = await updateKnowledgeHandler(args, mockContext);
      
      expect(result.content[0].text).toContain('❌ Validation failed:');
      expect(result.content[0].text).toContain('Tags must be an array of strings');
      expect(writeKnowledgeEntry).not.toHaveBeenCalled();
    });

    it('should accept valid priority values', async () => {
      vi.mocked(writeKnowledgeEntry).mockResolvedValue(undefined);
      
      const validPriorities = ['CRITICAL', 'REQUIRED', 'COMMON', 'EDGE-CASE'];
      
      for (const priority of validPriorities) {
        const args: UpdateArgs = {
          path: 'test.json',
          updates: {
            priority: priority as any
          }
        };

        const result = await updateKnowledgeHandler(args, mockContext);
        expect(result.content[0].text).toContain('✅ Successfully updated');
      }
    });

    it('should accept valid tags array', async () => {
      vi.mocked(writeKnowledgeEntry).mockResolvedValue(undefined);

      const args: UpdateArgs = {
        path: 'test.json',
        updates: {
          tags: ['testing', 'validation', 'arrays']
        }
      };

      const result = await updateKnowledgeHandler(args, mockContext);
      expect(result.content[0].text).toContain('✅ Successfully updated');
      
      expect(writeKnowledgeEntry).toHaveBeenCalledWith(
        '/test/knowledge/test.json',
        expect.objectContaining({
          tags: ['testing', 'validation', 'arrays']
        })
      );
    });

    it('should accumulate multiple validation errors', async () => {
      const args: UpdateArgs = {
        path: 'test.json',
        updates: {
          title: '', // Empty title
          priority: 'INVALID' as any, // Invalid priority
          problem: '', // Empty problem
          tags: 'not an array' as any // Invalid tags
        }
      };

      const result = await updateKnowledgeHandler(args, mockContext);
      expect(result.content[0].text).toContain('❌ Validation failed:');
      expect(result.content[0].text).toContain('Title must be a non-empty string');
      expect(result.content[0].text).toContain('Invalid priority value');
      expect(result.content[0].text).toContain('Problem must be a non-empty string');
      expect(result.content[0].text).toContain('Tags must be an array of strings');
    });
  });

  describe('Advanced field updates', () => {
    beforeEach(() => {
      const baseEntry: KnowledgeEntry = {
        priority: 'COMMON',
        problem: 'Base problem',
        solution: 'Base solution'
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readKnowledgeEntry).mockResolvedValue(baseEntry);
      vi.mocked(writeKnowledgeEntry).mockResolvedValue(undefined);
    });

    it('should update all optional fields', async () => {
      const args: UpdateArgs = {
        path: 'test.json',
        updates: {
          title: 'Complete title',
          slug: 'complete-slug',
          category: 'complete-category',
          tags: ['complete', 'test'],
          context: 'Complete context',
          examples: [
            {
              title: 'Example 1',
              description: 'First example',
              code: 'console.log("example 1");',
              language: 'javascript'
            }
          ],
          code: 'legacy code example',
          author: 'Test Author',
          version: '1.0.0'
        }
      };

      const result = await updateKnowledgeHandler(args, mockContext);
      expect(result.content[0].text).toContain('✅ Successfully updated');
      
      expect(writeKnowledgeEntry).toHaveBeenCalledWith(
        '/test/knowledge/test.json',
        expect.objectContaining({
          title: 'Complete title',
          slug: 'complete-slug',
          category: 'complete-category',
          tags: ['complete', 'test'],
          context: 'Complete context',
          examples: expect.arrayContaining([
            expect.objectContaining({
              title: 'Example 1',
              language: 'javascript'
            })
          ]),
          code: 'legacy code example',
          author: 'Test Author',
          version: '1.0.0',
          updated_at: expect.any(String)
        })
      );
    });

    it('should update timestamp on every update', async () => {
      const beforeUpdate = new Date().toISOString();
      
      const args: UpdateArgs = {
        path: 'test.json',
        updates: {
          title: 'Timestamped update'
        }
      };

      const result = await updateKnowledgeHandler(args, mockContext);
      expect(result.content[0].text).toContain('✅ Successfully updated');
      
      const writtenEntry = vi.mocked(writeKnowledgeEntry).mock.calls[0][1];
      expect(writtenEntry.updated_at).toBeDefined();
      expect(new Date(writtenEntry.updated_at!).getTime()).toBeGreaterThanOrEqual(new Date(beforeUpdate).getTime());
    });

    it('should handle undefined updates gracefully', async () => {
      const args: UpdateArgs = {
        path: 'test.json',
        updates: {
          title: undefined,
          category: 'defined',
          tags: undefined
        }
      };

      const result = await updateKnowledgeHandler(args, mockContext);
      expect(result.content[0].text).toContain('✅ Successfully updated');
      expect(result.content[0].text).toContain('Updated fields: category');
      
      const writtenEntry = vi.mocked(writeKnowledgeEntry).mock.calls[0][1];
      expect(writtenEntry.category).toBe('defined');
      expect(writtenEntry.title).toBeUndefined();
      expect(writtenEntry.tags).toBeUndefined();
    });
  });

  describe('Relationship management', () => {
    beforeEach(() => {
      const baseEntry: KnowledgeEntry = {
        priority: 'CRITICAL',
        problem: 'Main entry',
        solution: 'Main solution'
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readKnowledgeEntry).mockResolvedValue(baseEntry);
      vi.mocked(writeKnowledgeEntry).mockResolvedValue(undefined);
    });

    it('should add new relationships', async () => {
      // Mock that linked entries exist
      vi.mocked(fileExists)
        .mockResolvedValueOnce(true) // Main entry exists
        .mockResolvedValueOnce(true) // related1.json exists
        .mockResolvedValueOnce(true); // related2.json exists

      const args: UpdateArgs = {
        path: 'main.json',
        updates: {
          related_to: [
            { path: 'related1.json', relationship: 'implements' },
            { path: 'related2.json', relationship: 'supersedes', description: 'Replaces old approach' }
          ]
        }
      };

      const result = await updateKnowledgeHandler(args, mockContext);
      expect(result.content[0].text).toContain('✅ Successfully updated');
      
      const writtenEntry = vi.mocked(writeKnowledgeEntry).mock.calls[0][1];
      expect(writtenEntry.related_to).toHaveLength(2);
      expect(writtenEntry.related_to![0]).toEqual({
        path: 'related1.json',
        relationship: 'implements'
      });
      expect(writtenEntry.related_to![1]).toEqual({
        path: 'related2.json',
        relationship: 'supersedes',
        description: 'Replaces old approach'
      });
    });

    it('should validate that linked entries exist', async () => {
      vi.mocked(fileExists)
        .mockResolvedValueOnce(true) // Main entry exists
        .mockResolvedValueOnce(false); // non-existent.json does not exist

      const args: UpdateArgs = {
        path: 'main.json',
        updates: {
          related_to: [
            { path: 'non-existent.json', relationship: 'related' }
          ]
        }
      };

      const result = await updateKnowledgeHandler(args, mockContext);
      expect(result.content[0].text).toContain('❌ Validation failed:');
      expect(result.content[0].text).toContain('Linked entry does not exist: non-existent.json');
      expect(writeKnowledgeEntry).not.toHaveBeenCalled();
    });

    it('should handle bidirectional relationships', async () => {
      const bidirectionalEntry: KnowledgeEntry = {
        priority: 'REQUIRED',
        problem: 'Bidirectional',
        solution: 'Bidirectional solution'
      };

      // Mock file existence and reading
      vi.mocked(fileExists)
        .mockResolvedValueOnce(true) // main.json exists
        .mockResolvedValueOnce(true); // bidirectional.json exists
      
      vi.mocked(readKnowledgeEntry)
        .mockResolvedValueOnce({ priority: 'CRITICAL', problem: 'Main', solution: 'Main solution' }) // Main entry
        .mockResolvedValueOnce(bidirectionalEntry); // Bidirectional entry for reverse link

      const args: UpdateArgs = {
        path: 'main.json',
        updates: {
          related_to: [
            { path: 'bidirectional.json', relationship: 'related', description: 'Bidirectional link' }
          ]
        }
      };

      const result = await updateKnowledgeHandler(args, mockContext);
      expect(result.content[0].text).toContain('✅ Successfully updated');
      
      // Check that writeKnowledgeEntry was called twice - once for main, once for bidirectional
      expect(writeKnowledgeEntry).toHaveBeenCalledTimes(2);
      
      // First call should be for the bidirectional entry (reverse link)
      const [firstCallPath, firstCallEntry] = vi.mocked(writeKnowledgeEntry).mock.calls[0];
      expect(firstCallPath).toBe('/test/knowledge/bidirectional.json');
      expect(firstCallEntry.related_to).toContainEqual({
        path: 'main.json',
        relationship: 'related',
        description: 'Bidirectional link'
      });

      // Second call should be for the main entry
      const [secondCallPath, secondCallEntry] = vi.mocked(writeKnowledgeEntry).mock.calls[1];
      expect(secondCallPath).toBe('/test/knowledge/main.json');
      expect(secondCallEntry.related_to).toContainEqual({
        path: 'bidirectional.json',
        relationship: 'related',
        description: 'Bidirectional link'
      });
    });

    it('should handle conflicts_with as bidirectional relationship', async () => {
      const conflictEntry: KnowledgeEntry = {
        priority: 'REQUIRED',
        problem: 'Conflicting approach',
        solution: 'Alternative solution'
      };

      vi.mocked(fileExists)
        .mockResolvedValueOnce(true) // main.json exists
        .mockResolvedValueOnce(true); // conflict.json exists
      
      vi.mocked(readKnowledgeEntry)
        .mockResolvedValueOnce({ priority: 'CRITICAL', problem: 'Main', solution: 'Main solution' })
        .mockResolvedValueOnce(conflictEntry);

      const args: UpdateArgs = {
        path: 'main.json',
        updates: {
          related_to: [
            { path: 'conflict.json', relationship: 'conflicts_with', description: 'Conflicting approach' }
          ]
        }
      };

      const result = await updateKnowledgeHandler(args, mockContext);
      expect(result.content[0].text).toContain('✅ Successfully updated');
      
      // Both entries should be updated with conflicts_with relationship
      expect(writeKnowledgeEntry).toHaveBeenCalledTimes(2);
      
      const calls = vi.mocked(writeKnowledgeEntry).mock.calls;
      const conflictCall = calls.find(call => call[0].includes('conflict.json'));
      const mainCall = calls.find(call => call[0].includes('main.json'));
      
      expect(conflictCall![1].related_to![0].relationship).toBe('conflicts_with');
      expect(mainCall![1].related_to![0].relationship).toBe('conflicts_with');
    });

    it('should handle non-bidirectional relationships without creating reverse links', async () => {
      vi.mocked(fileExists)
        .mockResolvedValueOnce(true) // main.json exists
        .mockResolvedValueOnce(true) // related1.json exists
        .mockResolvedValueOnce(true); // related2.json exists

      const args: UpdateArgs = {
        path: 'main.json',
        updates: {
          related_to: [
            { path: 'related1.json', relationship: 'implements' },
            { path: 'related2.json', relationship: 'supersedes' }
          ]
        }
      };

      const result = await updateKnowledgeHandler(args, mockContext);
      expect(result.content[0].text).toContain('✅ Successfully updated');
      
      // Only the main entry should be updated (no reverse links for non-bidirectional relationships)
      expect(writeKnowledgeEntry).toHaveBeenCalledTimes(1);
      expect(writeKnowledgeEntry).toHaveBeenCalledWith(
        '/test/knowledge/main.json',
        expect.objectContaining({
          related_to: expect.arrayContaining([
            { path: 'related1.json', relationship: 'implements' },
            { path: 'related2.json', relationship: 'supersedes' }
          ])
        })
      );
    });
  });

  describe('Broadcasting and integration', () => {
    beforeEach(() => {
      const baseEntry: KnowledgeEntry = {
        priority: 'COMMON',
        problem: 'Base problem',
        solution: 'Base solution'
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readKnowledgeEntry).mockResolvedValue(baseEntry);
      vi.mocked(writeKnowledgeEntry).mockResolvedValue(undefined);
    });

    it('should broadcast update events', async () => {
      const args: UpdateArgs = {
        path: 'broadcast.json',
        updates: {
          title: 'Broadcast test'
        }
      };

      const result = await updateKnowledgeHandler(args, mockContext);
      expect(result.content[0].text).toContain('✅ Successfully updated');
      
      expect(mockContext.broadcastUpdate).toHaveBeenCalledTimes(1);
      expect(mockContext.broadcastUpdate).toHaveBeenCalledWith('entryUpdated', {
        path: 'broadcast.json',
        data: expect.objectContaining({
          title: 'Broadcast test',
          updated_at: expect.any(String)
        })
      });
    });
  });

  describe('explicit path update', () => {
    it('should move entry to explicit new_path', async () => {
      const args: UpdateArgs = {
        path: 'old-path.json',
        new_path: 'category/subcategory/new-path',
        updates: {
          title: 'Updated title'
        }
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readKnowledgeEntry).mockResolvedValue({
        title: 'Original title',
        priority: 'REQUIRED',
        problem: 'Test problem',
        solution: 'Test solution'
      });
      vi.mocked(validateEntryMove).mockResolvedValue({ valid: true, warnings: [] });
      vi.mocked(moveEntryWithReferences).mockResolvedValue({ success: true, updatedEntries: [] });
      vi.mocked(writeKnowledgeEntry).mockResolvedValue(undefined);

      const result = await updateKnowledgeHandler(args, mockContext);
      expect(result.content[0].text).toContain('✅ Successfully updated and moved to explicit path');
      expect(result.content[0].text).toContain('Old path: old-path.json');
      expect(result.content[0].text).toContain('New path: category/subcategory/new-path.json');
      
      expect(validateEntryMove).toHaveBeenCalledWith('old-path.json', 'category/subcategory/new-path.json', mockContext);
      expect(moveEntryWithReferences).toHaveBeenCalledWith('old-path.json', 'category/subcategory/new-path.json', mockContext);
    });

    it('should normalize new_path with .json extension', async () => {
      const args: UpdateArgs = {
        path: 'old-entry',
        new_path: 'new-location/entry',
        updates: {
          priority: 'CRITICAL'
        }
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readKnowledgeEntry).mockResolvedValue({
        title: 'Test entry',
        priority: 'COMMON',
        problem: 'Test problem',
        solution: 'Test solution'
      });
      vi.mocked(validateEntryMove).mockResolvedValue({ valid: true, warnings: [] });
      vi.mocked(moveEntryWithReferences).mockResolvedValue({ success: true, updatedEntries: [] });
      vi.mocked(writeKnowledgeEntry).mockResolvedValue(undefined);

      const result = await updateKnowledgeHandler(args, mockContext);
      expect(result.content[0].text).toContain('✅ Successfully updated and moved to explicit path');
      expect(result.content[0].text).toContain('Old path: old-entry.json');
      expect(result.content[0].text).toContain('New path: new-location/entry.json');
    });

    it('should fail when new_path already exists', async () => {
      const args: UpdateArgs = {
        path: 'source.json',
        new_path: 'existing-target.json',
        updates: {
          title: 'Updated'
        }
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readKnowledgeEntry).mockResolvedValue({
        title: 'Source entry',
        priority: 'COMMON',
        problem: 'Test problem',
        solution: 'Test solution'
      });
      vi.mocked(validateEntryMove).mockResolvedValue({ 
        valid: false, 
        warnings: ['Target path already exists'] 
      });

      const result = await updateKnowledgeHandler(args, mockContext);
      expect(result.content[0].text).toContain('❌ Cannot move entry to existing-target.json');
      expect(result.content[0].text).toContain('Target path already exists');
    });

    it('should handle move failure gracefully', async () => {
      const args: UpdateArgs = {
        path: 'source.json',
        new_path: 'target.json',
        updates: {
          title: 'Updated'
        }
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readKnowledgeEntry).mockResolvedValue({
        title: 'Source entry',
        priority: 'COMMON',
        problem: 'Test problem',
        solution: 'Test solution'
      });
      vi.mocked(validateEntryMove).mockResolvedValue({ valid: true, warnings: [] });
      vi.mocked(moveEntryWithReferences).mockResolvedValue({ 
        success: false, 
        error: 'Permission denied' 
      });

      const result = await updateKnowledgeHandler(args, mockContext);
      expect(result.content[0].text).toContain('❌ Failed to move entry: Permission denied');
    });

    it('should not move when new_path equals current path', async () => {
      const args: UpdateArgs = {
        path: 'same-path.json',
        new_path: 'same-path',
        updates: {
          title: 'Updated title'
        }
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readKnowledgeEntry).mockResolvedValue({
        title: 'Original title',
        priority: 'REQUIRED',
        problem: 'Test problem',
        solution: 'Test solution'
      });
      vi.mocked(writeKnowledgeEntry).mockResolvedValue(undefined);

      const result = await updateKnowledgeHandler(args, mockContext);
      expect(result.content[0].text).toContain('✅ Successfully updated same-path.json');
      expect(result.content[0].text).not.toContain('moved');
      
      expect(validateEntryMove).not.toHaveBeenCalled();
      expect(moveEntryWithReferences).not.toHaveBeenCalled();
    });

    it('should prioritize new_path over regenerate_path', async () => {
      const args: UpdateArgs = {
        path: 'old.json',
        new_path: 'explicit-path',
        regenerate_path: true,
        updates: {
          title: 'This Should Not Generate Path'
        }
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readKnowledgeEntry).mockResolvedValue({
        title: 'Old title',
        priority: 'REQUIRED',
        problem: 'Test problem',
        solution: 'Test solution'
      });
      vi.mocked(validateEntryMove).mockResolvedValue({ valid: true, warnings: [] });
      vi.mocked(moveEntryWithReferences).mockResolvedValue({ success: true, updatedEntries: [] });
      vi.mocked(writeKnowledgeEntry).mockResolvedValue(undefined);

      const result = await updateKnowledgeHandler(args, mockContext);
      expect(result.content[0].text).toContain('moved to explicit path');
      expect(result.content[0].text).toContain('New path: explicit-path.json');
      
      // Should not call generatePathFromTitle
      expect(result.content[0].text).not.toContain('regenerated');
    });
  });
});