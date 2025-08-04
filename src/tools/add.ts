/**
 * Add knowledge tool implementation
 * Creates a new knowledge entry from Markdown content (stored as JSON)
 */

import { join } from 'path';
import type { 
  ToolHandler, 
  MCPResponse, 
  ServerContext,
  KnowledgeEntry 
} from '../types/index.js';
import { 
  isBidirectionalRelationship 
} from '../constants/index.js';
import {
  ensureJsonExtension,
  ensureDirectory,
  fileExists,
  writeKnowledgeEntry,
  readKnowledgeEntry,
  parseMarkdownToEntry
} from '../utils/index.js';
import { generatePathFromTitle, normalizeUserPath } from '../utils/pathGeneration/index.js';
import { findRelatedEntries } from '../utils/findRelated.js';
import { loadProjectConfig } from '../utils/projectConfig.js';

interface AddArgs {
  path?: string;  // Now optional - will be auto-generated from title
  content: string;
}

/**
 * Handler for the add_knowledge tool
 */
export const addKnowledgeHandler: ToolHandler = async (
  args: AddArgs,
  context: ServerContext
): Promise<MCPResponse> => {
  const { path: userPath, content } = args;
  
  // Parse the markdown content
  const parseResult = parseMarkdownToEntry(content);
  
  // Check if it's an error result
  if (!parseResult || 'errors' in parseResult) {
    const errors = parseResult?.errors || ['Unknown parsing error'];
    return {
      content: [
        {
          type: "text",
          text: `❌ Failed to create entry:\n\n${errors.map(e => `• ${e}`).join('\n')}\n\n📝 Example format:\n---\ntitle: How to Handle Redis Connection Errors\npriority: REQUIRED\ntags: [redis, connection, error-handling]\n---\n\n# Problem\nDescribe the issue\n\n# Solution\nHow to solve it\n\n💡 Title Best Practices:\n• Be specific: "OAuth2 Implementation Guide" not "MyApp OAuth2 Implementation Guide"\n• Focus on the topic: "Database Migration Strategy" not "Project X Database Migration"\n• Let the path provide context: title="Redis Caching" → path="backend/redis/caching"`,
        },
      ],
    };
  }
  
  const entry = parseResult;
  
  // Generate or normalize the path
  let jsonPath: string;
  if (userPath) {
    // User provided a path
    let normalizedPath = normalizeUserPath(userPath);
    
    // Check if it's a directory path (ends with /)
    if (userPath.endsWith('/') || !normalizedPath.includes('.json') || normalizedPath.endsWith('/.json')) {
      // It's a directory - we need to add the filename from the title
      if (!entry.title) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Cannot generate filename: title is required when providing only a directory path.`,
            },
          ],
        };
      }
      
      // Load project configuration for filename generation
      const projectConfig = await loadProjectConfig(context.knowledgeRoot);
      
      // Generate just the filename part
      const { extractFilename } = await import('../utils/pathGeneration/extractor.js');
      const filename = extractFilename(entry.title);
      
      // Combine directory with filename
      const directory = normalizedPath.replace(/\.json$/, '').replace(/\/$/, '');
      jsonPath = directory ? `${directory}/${filename}.json` : `${filename}.json`;
    } else {
      // Full path provided
      jsonPath = normalizedPath;
    }
  } else {
    // Auto-generate path from title
    if (!entry.title) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Cannot auto-generate path: title is required in the entry metadata.`,
          },
        ],
      };
    }
    // Load project configuration
    const projectConfig = await loadProjectConfig(context.knowledgeRoot);
    
    jsonPath = generatePathFromTitle(entry.title, {
      category: entry.category,
      tags: entry.tags,
      priority: entry.priority,
      projectConfig: projectConfig || undefined
    });
  }
  
  const fullPath = join(context.knowledgeRoot, jsonPath);
  
  // Check if file already exists
  if (await fileExists(fullPath)) {
    return {
      content: [
        {
          type: "text",
          text: `❌ Entry already exists at ${jsonPath}. Use update_knowledge to modify it.`,
        },
      ],
    };
  }
  
  // Validate related entries exist
  if (entry.related_to && entry.related_to.length > 0) {
    const missingEntries: string[] = [];
    for (const link of entry.related_to) {
      const targetPath = join(context.knowledgeRoot, ensureJsonExtension(link.path));
      if (!await fileExists(targetPath)) {
        missingEntries.push(link.path);
      }
    }
    
    if (missingEntries.length > 0) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Related entries not found:\n\n${missingEntries.map(p => `• ${p}`).join('\n')}\n\n💡 Create these entries first or remove the references`,
          },
        ],
      };
    }
  }
  
  // Create the directory structure if it doesn't exist
  const dir = join(context.knowledgeRoot, jsonPath).replace(/\/[^/]+$/, '');
  await ensureDirectory(dir);
  
  // Add timestamps if not present
  const now = new Date().toISOString();
  if (!entry.created_at) entry.created_at = now;
  if (!entry.updated_at) entry.updated_at = now;
  
  // Write the file
  await writeKnowledgeEntry(fullPath, entry);
  
  // Create bidirectional links if needed
  if (entry.related_to) {
    for (const link of entry.related_to) {
      if (isBidirectionalRelationship(link.relationship)) {
        try {
          const targetPath = join(context.knowledgeRoot, ensureJsonExtension(link.path));
          const targetEntry = await readKnowledgeEntry(targetPath);
          
          if (!targetEntry.related_to) {
            targetEntry.related_to = [];
          }
          
          // Check if reverse link already exists
          const reverseExists = targetEntry.related_to.some(
            reverseLink => reverseLink.path === jsonPath
          );
          
          if (!reverseExists) {
            const reverseLink: any = {
              path: jsonPath,
              relationship: link.relationship,
              description: link.description
            };
            targetEntry.related_to.push(reverseLink);
            await writeKnowledgeEntry(targetPath, targetEntry);
          }
        } catch (error) {
          // Continue if we can't create reverse link
        }
      }
    }
  }
  
  // Find related entries
  const relatedEntries = await findRelatedEntries(entry, jsonPath, context, 5);
  
  // Build success response
  const pathWithoutExt = jsonPath.replace(/\.json$/, '');
  
  let responseText = `✅ Created successfully!\n\n`;
  responseText += `📁 Path: ${pathWithoutExt}\n`;
  responseText += `🏷️  ${entry.priority} | ${entry.title}\n`;
  
  if (relatedEntries.length > 0) {
    responseText += `\n🔗 Suggested related entries:\n`;
    relatedEntries.forEach((related, idx) => {
      responseText += `${idx + 1}. ${related.path} (${related.reason})\n`;
    });
    
    responseText += `\n💡 To link entries, use update_knowledge:\n`;
    responseText += `{\n`;
    responseText += `  "path": "${pathWithoutExt}",\n`;
    responseText += `  "updates": {\n`;
    responseText += `    "related_to": [\n`;
    responseText += `      { "path": "entry-path", "relationship": "related" },\n`;
    responseText += `      { "path": "another", "relationship": "implements" }\n`;
    responseText += `    ]\n`;
    responseText += `  }\n`;
    responseText += `}\n\n`;
    responseText += `📌 Relationships: related | supersedes | conflicts_with | implements`;
  }
  
  // Broadcast the new entry to all WebSocket clients
  await context.broadcastUpdate('entryAdded', {
    path: jsonPath,
    data: entry
  });
  
  return {
    content: [
      {
        type: "text",
        text: responseText,
      },
    ],
  };
};