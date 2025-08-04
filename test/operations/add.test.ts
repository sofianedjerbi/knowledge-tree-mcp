import { describe, it, expect, beforeEach, vi } from 'vitest';
import { addKnowledgeHandler } from '../../src/tools/add.js';
import type { ServerContext, KnowledgeEntry } from '../../src/types/index.js';
import { 
  fileExists, 
  writeKnowledgeEntry,
  readKnowledgeEntry,
  ensureDirectory,
  parseMarkdownToEntry,
  ensureJsonExtension
} from '../../src/utils/index.js';
import { generatePathFromTitle, normalizeUserPath } from '../../src/utils/pathGeneration/index.js';
import { isBidirectionalRelationship } from '../../src/constants/index.js';
import { findRelatedEntries } from '../../src/utils/findRelated.js';

// Mock the utils
vi.mock('../../src/utils/index.js');
vi.mock('../../src/utils/pathGeneration/index.js');
vi.mock('../../src/constants/index.js');
vi.mock('../../src/utils/findRelated.js');

describe('Add Knowledge Tool', () => {
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
    vi.mocked(ensureDirectory).mockResolvedValue(true);
    vi.mocked(writeKnowledgeEntry).mockResolvedValue(undefined);
    vi.mocked(ensureJsonExtension).mockImplementation((path: string) => 
      path.endsWith('.json') ? path : `${path}.json`
    );
    vi.mocked(isBidirectionalRelationship).mockImplementation((relationship: string) => 
      relationship === 'related' || relationship === 'conflicts_with'
    );
    vi.mocked(findRelatedEntries).mockResolvedValue([]);
  });

  describe('Basic creation functionality', () => {
    it('should successfully create entry from valid markdown with user path', async () => {
      const markdownContent = `---
title: Test Entry
priority: CRITICAL
category: testing
tags: [unit, vitest]
---

# Problem

This is a test problem.

# Solution

This is the solution.`;

      const expectedEntry: KnowledgeEntry = {
        title: 'Test Entry',
        priority: 'CRITICAL',
        category: 'testing',
        tags: ['unit', 'vitest'],
        problem: 'This is a test problem.',
        solution: 'This is the solution.',
        created_at: expect.any(String),
        updated_at: expect.any(String)
      };

      vi.mocked(parseMarkdownToEntry).mockReturnValue(expectedEntry);
      vi.mocked(normalizeUserPath).mockReturnValue('custom/test.json');
      vi.mocked(fileExists).mockResolvedValue(false);

      const args = {
        path: 'custom/test',
        content: markdownContent
      };

      const result = await addKnowledgeHandler(args, mockContext);
      
      expect(result.content[0].text).toContain('✅ Created successfully!');
      expect(result.content[0].text).toContain('📁 Path: custom/test');
      
      expect(writeKnowledgeEntry).toHaveBeenCalledWith(
        '/test/knowledge/custom/test.json',
        expectedEntry
      );
      
      expect(mockContext.broadcastUpdate).toHaveBeenCalledWith('entryAdded', {
        path: 'custom/test.json',
        data: expectedEntry
      });
    });

    it('should auto-generate path from title when no path provided', async () => {
      const markdownContent = `---
title: React Hooks Tutorial
priority: REQUIRED
---

# Problem

Understanding React hooks.

# Solution

Use useState and useEffect.`;

      const expectedEntry: KnowledgeEntry = {
        title: 'React Hooks Tutorial',
        priority: 'REQUIRED',
        problem: 'Understanding React hooks.',
        solution: 'Use useState and useEffect.',
        created_at: expect.any(String),
        updated_at: expect.any(String)
      };

      vi.mocked(parseMarkdownToEntry).mockReturnValue(expectedEntry);
      vi.mocked(generatePathFromTitle).mockReturnValue('frontend/react/how-to/hooks.json');
      vi.mocked(fileExists).mockResolvedValue(false);

      const args = {
        content: markdownContent
      };

      const result = await addKnowledgeHandler(args, mockContext);
      
      expect(result.content[0].text).toContain('✅ Created successfully!');
      expect(result.content[0].text).toContain('📁 Path: frontend/react/how-to/hooks');
      expect(result.content[0].text).toContain('🏷️  REQUIRED | React Hooks Tutorial');
      
      expect(generatePathFromTitle).toHaveBeenCalledWith('React Hooks Tutorial', {
        category: undefined,
        tags: undefined,
        priority: 'REQUIRED'
      });
    });

    it('should return error when entry already exists', async () => {
      const markdownContent = `---
title: Existing Entry
priority: COMMON
---

# Problem
Test

# Solution
Test`;

      const existingEntry: KnowledgeEntry = {
        title: 'Existing Entry',
        priority: 'COMMON',
        problem: 'Test',
        solution: 'Test'
      };

      vi.mocked(parseMarkdownToEntry).mockReturnValue(existingEntry);
      vi.mocked(normalizeUserPath).mockReturnValue('existing.json');
      vi.mocked(fileExists).mockResolvedValue(true); // File exists

      const args = {
        path: 'existing',
        content: markdownContent
      };

      const result = await addKnowledgeHandler(args, mockContext);
      
      expect(result.content[0].text).toBe('❌ Entry already exists at existing.json. Use update_knowledge to modify it.');
      expect(writeKnowledgeEntry).not.toHaveBeenCalled();
    });

    it('should return error when auto-generation fails due to missing title', async () => {
      const markdownContent = `---
priority: COMMON
---

# Problem
Test

# Solution
Test`;

      const entryWithoutTitle: KnowledgeEntry = {
        priority: 'COMMON',
        problem: 'Test',
        solution: 'Test'
      };

      vi.mocked(parseMarkdownToEntry).mockReturnValue(entryWithoutTitle);

      const args = {
        content: markdownContent
      };

      const result = await addKnowledgeHandler(args, mockContext);
      
      expect(result.content[0].text).toBe('❌ Cannot auto-generate path: title is required in the entry metadata.');
      expect(writeKnowledgeEntry).not.toHaveBeenCalled();
    });
  });

  describe('Markdown parsing validation', () => {
    it('should return error when markdown parsing fails', async () => {
      const invalidMarkdown = 'This is not valid markdown format';

      vi.mocked(parseMarkdownToEntry).mockReturnValue(null);

      const args = {
        path: 'test.json',
        content: invalidMarkdown
      };

      const result = await addKnowledgeHandler(args, mockContext);
      
      expect(result.content[0].text).toContain('❌ Failed to create entry');
      expect(result.content[0].text).toContain('Unknown parsing error');
      expect(result.content[0].text).toContain('📝 Example format:');
      expect(writeKnowledgeEntry).not.toHaveBeenCalled();
    });

    it('should handle markdown with all optional fields', async () => {
      const fullMarkdownContent = `---
title: Complete Entry
priority: CRITICAL
slug: complete-entry
category: examples
tags: [complete, full, test]
author: Test Author
version: 1.0.0
created_at: 2024-01-01T00:00:00.000Z
updated_at: 2024-01-02T00:00:00.000Z
---

# Problem

This is a complete problem description.

# Context

This is the context where this applies.

# Solution

This is the complete solution.

# Examples

## Basic Example
*This shows a basic implementation*

\`\`\`javascript
console.log('Hello World');
\`\`\`

# Related

- related: other/entry.json - Related entry
- implements: base/implementation.json`;

      const fullEntry: KnowledgeEntry = {
        title: 'Complete Entry',
        priority: 'CRITICAL',
        slug: 'complete-entry',
        category: 'examples',
        tags: ['complete', 'full', 'test'],
        problem: 'This is a complete problem description.',
        context: 'This is the context where this applies.',
        solution: 'This is the complete solution.',
        examples: [
          {
            title: 'Basic Example',
            description: 'This shows a basic implementation',
            code: 'console.log(\'Hello World\');',
            language: 'javascript'
          }
        ],
        related_to: [
          { path: 'other/entry.json', relationship: 'related', description: 'Related entry' },
          { path: 'base/implementation.json', relationship: 'implements' }
        ],
        author: 'Test Author',
        version: '1.0.0',
        created_at: '2024-01-01T00:00:00.000Z',
        updated_at: '2024-01-02T00:00:00.000Z'
      };

      vi.mocked(parseMarkdownToEntry).mockReturnValue(fullEntry);
      vi.mocked(normalizeUserPath).mockReturnValue('complete.json');
      vi.mocked(fileExists).mockResolvedValue(false);

      const args = {
        path: 'complete',
        content: fullMarkdownContent
      };

      const result = await addKnowledgeHandler(args, mockContext);
      
      // Should fail because related entries don't exist
      expect(result.content[0].text).toContain('❌ Related entries not found:');
      expect(result.content[0].text).toContain('• other/entry.json');
      expect(result.content[0].text).toContain('• base/implementation.json');
      
      // Now mock fileExists to return true for related entries but false for complete.json
      vi.mocked(fileExists).mockImplementation(async (path: string) => {
        if (path.includes('complete.json')) {
          return false; // Entry doesn't exist yet
        }
        return path.includes('other/entry.json') || 
               path.includes('base/implementation.json');
      });
      
      // Try again with existing related entries
      const result2 = await addKnowledgeHandler(args, mockContext);
      expect(result2.content[0].text).toContain('✅ Created successfully!');
      expect(result2.content[0].text).toContain('🏷️  CRITICAL | Complete Entry');
      
      expect(writeKnowledgeEntry).toHaveBeenCalledWith(
        '/test/knowledge/complete.json',
        fullEntry
      );
    });
  });

  describe('Timestamp handling', () => {
    it('should add timestamps when not present in markdown', async () => {
      const markdownContent = `---
title: Timestamped Entry
priority: COMMON
---

# Problem
Test

# Solution
Test`;

      const entryWithoutTimestamps: KnowledgeEntry = {
        title: 'Timestamped Entry',
        priority: 'COMMON',
        problem: 'Test',
        solution: 'Test'
      };

      vi.mocked(parseMarkdownToEntry).mockReturnValue(entryWithoutTimestamps);
      vi.mocked(normalizeUserPath).mockReturnValue('timestamped.json');
      vi.mocked(fileExists).mockResolvedValue(false);

      const args = {
        path: 'timestamped',
        content: markdownContent
      };

      const result = await addKnowledgeHandler(args, mockContext);
      
      expect(result.content[0].text).toContain('✅ Created successfully!');
      
      const writtenEntry = vi.mocked(writeKnowledgeEntry).mock.calls[0][1];
      expect(writtenEntry.created_at).toBeDefined();
      expect(writtenEntry.updated_at).toBeDefined();
      expect(new Date(writtenEntry.created_at!).getTime()).toBeGreaterThan(0);
      expect(new Date(writtenEntry.updated_at!).getTime()).toBeGreaterThan(0);
    });

    it('should preserve existing timestamps from markdown', async () => {
      const markdownContent = `---
title: Pre-timestamped Entry
priority: COMMON
created_at: 2023-01-01T00:00:00.000Z
updated_at: 2023-01-02T00:00:00.000Z
---

# Problem
Test

# Solution
Test`;

      const entryWithTimestamps: KnowledgeEntry = {
        title: 'Pre-timestamped Entry',
        priority: 'COMMON',
        problem: 'Test',
        solution: 'Test',
        created_at: '2023-01-01T00:00:00.000Z',
        updated_at: '2023-01-02T00:00:00.000Z'
      };

      vi.mocked(parseMarkdownToEntry).mockReturnValue(entryWithTimestamps);
      vi.mocked(normalizeUserPath).mockReturnValue('pre-timestamped.json');
      vi.mocked(fileExists).mockResolvedValue(false);

      const args = {
        path: 'pre-timestamped',
        content: markdownContent
      };

      const result = await addKnowledgeHandler(args, mockContext);
      
      expect(result.content[0].text).toContain('✅ Created successfully!');
      
      const writtenEntry = vi.mocked(writeKnowledgeEntry).mock.calls[0][1];
      expect(writtenEntry.created_at).toBe('2023-01-01T00:00:00.000Z');
      expect(writtenEntry.updated_at).toBe('2023-01-02T00:00:00.000Z');
    });
  });

  describe('Bidirectional relationship handling', () => {
    beforeEach(() => {
      vi.mocked(readKnowledgeEntry).mockResolvedValue({
        priority: 'COMMON',
        problem: 'Target entry',
        solution: 'Target solution'
      });
    });

    it('should create bidirectional relationships for related links', async () => {
      const markdownContent = `---
title: Main Entry
priority: CRITICAL
---

# Problem
Main problem

# Solution
Main solution

# Related

- related: target.json - Related entry`;

      const entryWithRelations: KnowledgeEntry = {
        title: 'Main Entry',
        priority: 'CRITICAL',
        problem: 'Main problem',
        solution: 'Main solution',
        related_to: [
          { path: 'target.json', relationship: 'related', description: 'Related entry' }
        ]
      };

      vi.mocked(parseMarkdownToEntry).mockReturnValue(entryWithRelations);
      vi.mocked(normalizeUserPath).mockReturnValue('main.json');
      
      // Mock fileExists - target.json exists for relationship validation
      vi.mocked(fileExists).mockImplementation(async (path: string) => {
        return path.includes('target.json');
      });
      
      // Mock bidirectional relationship
      vi.mocked(isBidirectionalRelationship).mockImplementation((rel) => rel === 'related');
      
      // Mock reading target entry
      vi.mocked(readKnowledgeEntry).mockResolvedValue({
        title: 'Target Entry',
        priority: 'COMMON',
        problem: 'Target problem',
        solution: 'Target solution'
      });

      const args = {
        path: 'main',
        content: markdownContent
      };

      const result = await addKnowledgeHandler(args, mockContext);
      
      expect(result.content[0].text).toContain('✅ Created successfully!');
      
      // Should read target entries to create reverse links
      expect(readKnowledgeEntry).toHaveBeenCalledWith('/test/knowledge/target.json');
      
      // Should write reverse links (bidirectional relationships)
      expect(writeKnowledgeEntry).toHaveBeenCalledTimes(2); // main + 1 reverse link
    });

    it('should handle non-bidirectional relationships without creating reverse links', async () => {
      const markdownContent = `---
title: Implementation Entry
priority: REQUIRED
---

# Problem
Implementation problem

# Solution
Implementation solution

# Related

- implements: interface.json
- supersedes: old-version.json`;

      const entryWithNonBidirectional: KnowledgeEntry = {
        title: 'Implementation Entry',
        priority: 'REQUIRED',
        problem: 'Implementation problem',
        solution: 'Implementation solution',
        related_to: [
          { path: 'interface.json', relationship: 'implements' },
          { path: 'old-version.json', relationship: 'supersedes' }
        ]
      };

      vi.mocked(parseMarkdownToEntry).mockReturnValue(entryWithNonBidirectional);
      vi.mocked(normalizeUserPath).mockReturnValue('implementation.json');
      
      // Mock fileExists - related entries exist
      vi.mocked(fileExists).mockImplementation(async (path: string) => {
        return path.includes('interface.json') || path.includes('old-version.json');
      });
      
      // Mock non-bidirectional relationships
      vi.mocked(isBidirectionalRelationship).mockImplementation(() => false);

      const args = {
        path: 'implementation',
        content: markdownContent
      };

      const result = await addKnowledgeHandler(args, mockContext);
      
      expect(result.content[0].text).toContain('✅ Created successfully!');
      
      // Should not read target entries for non-bidirectional relationships
      expect(readKnowledgeEntry).not.toHaveBeenCalled();
      
      // Should only write the main entry
      expect(writeKnowledgeEntry).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in reverse link creation gracefully', async () => {
      const markdownContent = `---
title: Robust Entry
priority: CRITICAL
---

# Problem
Robust problem

# Solution
Robust solution

# Related

- related: broken-target.json`;

      const entryWithBrokenLink: KnowledgeEntry = {
        title: 'Robust Entry',
        priority: 'CRITICAL',
        problem: 'Robust problem',
        solution: 'Robust solution',
        related_to: [
          { path: 'broken-target.json', relationship: 'related' }
        ]
      };

      vi.mocked(parseMarkdownToEntry).mockReturnValue(entryWithBrokenLink);
      vi.mocked(normalizeUserPath).mockReturnValue('robust.json');
      
      // Mock fileExists - broken-target.json exists
      vi.mocked(fileExists).mockImplementation(async (path: string) => {
        return path.includes('broken-target.json');
      });
      
      // Mock bidirectional relationship
      vi.mocked(isBidirectionalRelationship).mockImplementation(() => true);
      
      // Mock read to throw error (simulating corruption)
      vi.mocked(readKnowledgeEntry).mockRejectedValue(new Error('File not found'));

      const args = {
        path: 'robust',
        content: markdownContent
      };

      const result = await addKnowledgeHandler(args, mockContext);
      
      // Should still succeed despite reverse link failure
      expect(result.content[0].text).toContain('✅ Created successfully!');
      
      // Should write the main entry
      expect(writeKnowledgeEntry).toHaveBeenCalledWith(
        '/test/knowledge/robust.json',
        expect.objectContaining({
          title: 'Robust Entry',
          related_to: entryWithBrokenLink.related_to
        })
      );
    });

    it('should not create duplicate reverse links', async () => {
      const existingTargetEntry: KnowledgeEntry = {
        priority: 'COMMON',
        problem: 'Target entry',
        solution: 'Target solution',
        related_to: [
          { path: 'main.json', relationship: 'related' } // Reverse link already exists
        ]
      };

      const markdownContent = `---
title: Main Entry
priority: CRITICAL
---

# Problem
Main problem

# Solution
Main solution

# Related

- related: target.json`;

      const entryWithRelation: KnowledgeEntry = {
        title: 'Main Entry',
        priority: 'CRITICAL',
        problem: 'Main problem',
        solution: 'Main solution',
        related_to: [
          { path: 'target.json', relationship: 'related' }
        ]
      };

      vi.mocked(parseMarkdownToEntry).mockReturnValue(entryWithRelation);
      vi.mocked(normalizeUserPath).mockReturnValue('main.json');
      
      // Mock fileExists - target.json exists
      vi.mocked(fileExists).mockImplementation(async (path: string) => {
        return path.includes('target.json');
      });
      
      // Mock bidirectional relationship
      vi.mocked(isBidirectionalRelationship).mockImplementation(() => true);
      vi.mocked(readKnowledgeEntry).mockResolvedValue(existingTargetEntry);

      const args = {
        path: 'main',
        content: markdownContent
      };

      const result = await addKnowledgeHandler(args, mockContext);
      
      expect(result.content[0].text).toContain('✅ Created successfully!');
      
      // Should read the target entry
      expect(readKnowledgeEntry).toHaveBeenCalledWith('/test/knowledge/target.json');
      
      // Should only write the main entry (no duplicate reverse link created)
      expect(writeKnowledgeEntry).toHaveBeenCalledTimes(1);
      expect(writeKnowledgeEntry).toHaveBeenCalledWith(
        '/test/knowledge/main.json',
        expect.objectContaining({ title: 'Main Entry' })
      );
    });
  });

  describe('Directory creation', () => {
    it('should ensure directory exists before writing file', async () => {
      const markdownContent = `---
title: Nested Entry
priority: COMMON
---

# Problem
Test

# Solution
Test`;

      const simpleEntry: KnowledgeEntry = {
        title: 'Nested Entry',
        priority: 'COMMON',
        problem: 'Test',
        solution: 'Test'
      };

      vi.mocked(parseMarkdownToEntry).mockReturnValue(simpleEntry);
      vi.mocked(normalizeUserPath).mockReturnValue('deep/nested/path/entry.json');
      vi.mocked(fileExists).mockResolvedValue(false);

      const args = {
        path: 'deep/nested/path/entry',
        content: markdownContent
      };

      const result = await addKnowledgeHandler(args, mockContext);
      
      expect(result.content[0].text).toContain('✅ Created successfully!');
      
      // Should ensure directory exists
      expect(ensureDirectory).toHaveBeenCalledWith('/test/knowledge/deep/nested/path');
      
      expect(writeKnowledgeEntry).toHaveBeenCalledWith(
        '/test/knowledge/deep/nested/path/entry.json',
        expect.objectContaining({ title: 'Nested Entry' })
      );
    });
  });

  describe('Response formatting', () => {
    it('should include all entry details in success response', async () => {
      const markdownContent = `---
title: Detailed Entry
priority: CRITICAL
category: examples
tags: [detail, response, test]
---

# Problem
Detailed problem

# Solution
Detailed solution`;

      const detailedEntry: KnowledgeEntry = {
        title: 'Detailed Entry',
        priority: 'CRITICAL',
        category: 'examples',
        tags: ['detail', 'response', 'test'],
        problem: 'Detailed problem',
        solution: 'Detailed solution'
      };

      vi.mocked(parseMarkdownToEntry).mockReturnValue(detailedEntry);
      vi.mocked(normalizeUserPath).mockReturnValue('detailed.json');
      vi.mocked(fileExists).mockResolvedValue(false);

      const args = {
        path: 'detailed',
        content: markdownContent
      };

      const result = await addKnowledgeHandler(args, mockContext);
      
      const responseText = result.content[0].text;
      expect(responseText).toContain('✅ Created successfully!');
      expect(responseText).toContain('📁 Path: detailed');
      expect(responseText).toContain('🏷️  CRITICAL | Detailed Entry');
    });
  });
});