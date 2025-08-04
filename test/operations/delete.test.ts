import { describe, it, expect, beforeEach, vi } from 'vitest';
import { deleteKnowledgeHandler } from '../../src/tools/delete.js';
import type { DeleteArgs, ServerContext, KnowledgeEntry } from '../../src/types/index.js';
import { 
  fileExists, 
  readKnowledgeEntry, 
  writeKnowledgeEntry, 
  deleteFile,
  ensureJsonExtension 
} from '../../src/utils/index.js';

// Mock the utils
vi.mock('../../src/utils/index.js');

describe('Delete Knowledge Tool', () => {
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

  describe('Basic deletion functionality', () => {
    it('should successfully delete an existing entry', async () => {
      const args: DeleteArgs = {
        path: 'test/entry.json',
        cleanup_links: false
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(deleteFile).mockResolvedValue(undefined);

      const result = await deleteKnowledgeHandler(args, mockContext);

      expect(fileExists).toHaveBeenCalledWith('/test/knowledge/test/entry.json');
      expect(deleteFile).toHaveBeenCalledWith('/test/knowledge/test/entry.json');
      expect(mockContext.broadcastUpdate).toHaveBeenCalledWith('entryDeleted', {
        path: 'test/entry.json'
      });
      
      expect(result.content[0]).toEqual({
        type: 'text',
        text: '✅ Successfully deleted: test/entry.json'
      });
    });

    it('should handle paths without .json extension', async () => {
      const args: DeleteArgs = {
        path: 'test/entry',
        cleanup_links: false
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(deleteFile).mockResolvedValue(undefined);

      const result = await deleteKnowledgeHandler(args, mockContext);

      expect(fileExists).toHaveBeenCalledWith('/test/knowledge/test/entry.json');
      expect(deleteFile).toHaveBeenCalledWith('/test/knowledge/test/entry.json');
      
      expect(result.content[0]).toEqual({
        type: 'text',
        text: '✅ Successfully deleted: test/entry.json'
      });
    });

    it('should return error when entry does not exist', async () => {
      const args: DeleteArgs = {
        path: 'non/existent.json'
      };

      vi.mocked(fileExists).mockResolvedValue(false);

      const result = await deleteKnowledgeHandler(args, mockContext);

      expect(fileExists).toHaveBeenCalledWith('/test/knowledge/non/existent.json');
      expect(deleteFile).not.toHaveBeenCalled();
      expect(mockContext.broadcastUpdate).not.toHaveBeenCalled();
      
      expect(result.content[0]).toEqual({
        type: 'text',
        text: '❌ Entry not found: non/existent.json'
      });
    });

    it('should handle deletion errors gracefully', async () => {
      const args: DeleteArgs = {
        path: 'test/entry.json'
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(deleteFile).mockRejectedValue(new Error('Permission denied'));

      const result = await deleteKnowledgeHandler(args, mockContext);

      expect(result.content[0]).toEqual({
        type: 'text',
        text: '❌ Failed to delete entry: Error: Permission denied'
      });
      expect(mockContext.broadcastUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Link cleanup functionality', () => {
    it('should clean up references in related entries when cleanup_links is true', async () => {
      const args: DeleteArgs = {
        path: 'test/deleted.json',
        cleanup_links: true
      };

      // Mock the entry to be deleted
      const deletedEntry: KnowledgeEntry = {
        priority: 'COMMON',
        problem: 'Test problem',
        solution: 'Test solution'
      };

      // Mock related entries
      const relatedEntry1: KnowledgeEntry = {
        priority: 'COMMON',
        problem: 'Related problem 1',
        solution: 'Related solution 1',
        related_to: [
          { path: 'test/deleted.json', relationship: 'related' },
          { path: 'other/entry.json', relationship: 'implements' }
        ]
      };

      const relatedEntry2: KnowledgeEntry = {
        priority: 'REQUIRED',
        problem: 'Related problem 2',
        solution: 'Related solution 2',
        related_to: [
          { path: 'test/deleted.json', relationship: 'supersedes' }
        ]
      };

      const unrelatedEntry: KnowledgeEntry = {
        priority: 'CRITICAL',
        problem: 'Unrelated problem',
        solution: 'Unrelated solution',
        related_to: [
          { path: 'other/entry.json', relationship: 'related' }
        ]
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readKnowledgeEntry)
        .mockResolvedValueOnce(deletedEntry) // First read for the deleted entry
        .mockResolvedValueOnce(relatedEntry1)
        .mockResolvedValueOnce(relatedEntry2)
        .mockResolvedValueOnce(unrelatedEntry);
      
      vi.mocked(deleteFile).mockResolvedValue(undefined);
      vi.mocked(writeKnowledgeEntry).mockResolvedValue(undefined);
      
      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue([
        'related/entry1.json',
        'related/entry2.json',
        'unrelated/entry.json'
      ]);

      const result = await deleteKnowledgeHandler(args, mockContext);

      // Verify the entry was deleted
      expect(deleteFile).toHaveBeenCalledWith('/test/knowledge/test/deleted.json');

      // Verify references were cleaned up
      expect(writeKnowledgeEntry).toHaveBeenCalledTimes(2);
      
      // Check first related entry was updated
      expect(writeKnowledgeEntry).toHaveBeenCalledWith(
        '/test/knowledge/related/entry1.json',
        expect.objectContaining({
          related_to: [
            { path: 'other/entry.json', relationship: 'implements' }
          ]
        })
      );

      // Check second related entry was updated
      expect(writeKnowledgeEntry).toHaveBeenCalledWith(
        '/test/knowledge/related/entry2.json',
        expect.objectContaining({
          related_to: []
        })
      );

      expect(result.content[0]).toEqual({
        type: 'text',
        text: '✅ Successfully deleted: test/deleted.json\n🧹 Cleaned up references in 2 other entries'
      });
    });

    it('should continue deletion even if reading entry for cleanup fails', async () => {
      const args: DeleteArgs = {
        path: 'test/corrupted.json',
        cleanup_links: true
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readKnowledgeEntry).mockRejectedValue(new Error('Invalid JSON'));
      vi.mocked(deleteFile).mockResolvedValue(undefined);
      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue([]);

      const result = await deleteKnowledgeHandler(args, mockContext);

      expect(deleteFile).toHaveBeenCalled();
      expect(result.content[0]).toEqual({
        type: 'text',
        text: '✅ Successfully deleted: test/corrupted.json'
      });
    });

    it('should skip cleanup when cleanup_links is false', async () => {
      const args: DeleteArgs = {
        path: 'test/entry.json',
        cleanup_links: false
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(deleteFile).mockResolvedValue(undefined);

      const result = await deleteKnowledgeHandler(args, mockContext);

      expect(readKnowledgeEntry).not.toHaveBeenCalled();
      expect(mockContext.scanKnowledgeTree).not.toHaveBeenCalled();
      expect(writeKnowledgeEntry).not.toHaveBeenCalled();
      
      expect(result.content[0]).toEqual({
        type: 'text',
        text: '✅ Successfully deleted: test/entry.json'
      });
    });

    it('should handle errors in individual entry cleanup gracefully', async () => {
      const args: DeleteArgs = {
        path: 'test/deleted.json',
        cleanup_links: true
      };

      const deletedEntry: KnowledgeEntry = {
        priority: 'COMMON',
        problem: 'Test problem',
        solution: 'Test solution'
      };

      const validEntry: KnowledgeEntry = {
        priority: 'COMMON',
        problem: 'Valid entry',
        solution: 'Valid solution',
        related_to: [
          { path: 'test/deleted.json', relationship: 'related' }
        ]
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(deleteFile).mockResolvedValue(undefined);
      
      vi.mocked(readKnowledgeEntry)
        .mockResolvedValueOnce(deletedEntry) // Deleted entry
        .mockRejectedValueOnce(new Error('Read error')) // First related entry fails
        .mockResolvedValueOnce(validEntry); // Second related entry succeeds

      vi.mocked(writeKnowledgeEntry).mockResolvedValue(undefined);
      
      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue([
        'corrupted/entry.json',
        'valid/entry.json'
      ]);

      const result = await deleteKnowledgeHandler(args, mockContext);

      // Should still update the valid entry
      expect(writeKnowledgeEntry).toHaveBeenCalledTimes(1);
      expect(writeKnowledgeEntry).toHaveBeenCalledWith(
        '/test/knowledge/valid/entry.json',
        expect.objectContaining({
          related_to: []
        })
      );

      expect(result.content[0]).toEqual({
        type: 'text',
        text: '✅ Successfully deleted: test/deleted.json\n🧹 Cleaned up references in 1 other entries'
      });
    });
  });

  describe('Broadcast functionality', () => {
    it('should broadcast deletion event after successful deletion', async () => {
      const args: DeleteArgs = {
        path: 'test/entry.json'
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(deleteFile).mockResolvedValue(undefined);
      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue([]);

      await deleteKnowledgeHandler(args, mockContext);

      expect(mockContext.broadcastUpdate).toHaveBeenCalledTimes(1);
      expect(mockContext.broadcastUpdate).toHaveBeenCalledWith('entryDeleted', {
        path: 'test/entry.json'
      });
    });

    it('should not broadcast if deletion fails', async () => {
      const args: DeleteArgs = {
        path: 'test/entry.json'
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(deleteFile).mockRejectedValue(new Error('Delete failed'));

      await deleteKnowledgeHandler(args, mockContext);

      expect(mockContext.broadcastUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Edge cases', () => {
    it('should handle entries with no related_to field', async () => {
      const args: DeleteArgs = {
        path: 'test/deleted.json',
        cleanup_links: true
      };

      const entryWithoutLinks: KnowledgeEntry = {
        priority: 'COMMON',
        problem: 'Entry without links',
        solution: 'No links'
        // No related_to field
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(deleteFile).mockResolvedValue(undefined);
      vi.mocked(readKnowledgeEntry)
        .mockResolvedValueOnce({ priority: 'COMMON', problem: 'Deleted', solution: 'Deleted' })
        .mockResolvedValueOnce(entryWithoutLinks);
      
      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue(['entry-without-links.json']);

      const result = await deleteKnowledgeHandler(args, mockContext);

      expect(writeKnowledgeEntry).not.toHaveBeenCalled();
      expect(result.content[0]).toEqual({
        type: 'text',
        text: '✅ Successfully deleted: test/deleted.json'
      });
    });

    it('should handle empty related_to arrays', async () => {
      const args: DeleteArgs = {
        path: 'test/deleted.json',
        cleanup_links: true
      };

      const entryWithEmptyLinks: KnowledgeEntry = {
        priority: 'COMMON',
        problem: 'Entry with empty links',
        solution: 'Empty array',
        related_to: []
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(deleteFile).mockResolvedValue(undefined);
      vi.mocked(readKnowledgeEntry)
        .mockResolvedValueOnce({ priority: 'COMMON', problem: 'Deleted', solution: 'Deleted' })
        .mockResolvedValueOnce(entryWithEmptyLinks);
      
      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue(['entry-empty-links.json']);

      const result = await deleteKnowledgeHandler(args, mockContext);

      expect(writeKnowledgeEntry).not.toHaveBeenCalled();
      expect(result.content[0]).toEqual({
        type: 'text',
        text: '✅ Successfully deleted: test/deleted.json'
      });
    });

    it('should handle when scanKnowledgeTree returns empty array', async () => {
      const args: DeleteArgs = {
        path: 'test/only-entry.json',
        cleanup_links: true
      };

      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(deleteFile).mockResolvedValue(undefined);
      vi.mocked(readKnowledgeEntry).mockResolvedValue({
        priority: 'COMMON',
        problem: 'Only entry',
        solution: 'No other entries exist'
      });
      
      mockContext.scanKnowledgeTree = vi.fn().mockResolvedValue([]);

      const result = await deleteKnowledgeHandler(args, mockContext);

      expect(writeKnowledgeEntry).not.toHaveBeenCalled();
      expect(result.content[0]).toEqual({
        type: 'text',
        text: '✅ Successfully deleted: test/only-entry.json'
      });
    });
  });
});