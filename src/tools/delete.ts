/**
 * Delete knowledge tool implementation
 * Removes knowledge entries and cleans up references
 */

import { join } from 'path';
import type { 
  ToolHandler, 
  DeleteArgs, 
  MCPResponse, 
  ServerContext,
  KnowledgeEntry 
} from '../types/index.js';
import {
  ensureJsonExtension,
  fileExists,
  readKnowledgeEntry,
  writeKnowledgeEntry,
  deleteFile
} from '../utils/index.js';

/**
 * Handler for the delete_knowledge tool
 */
export const deleteKnowledgeHandler: ToolHandler = async (
  args: DeleteArgs,
  context: ServerContext
): Promise<MCPResponse> => {
  const { path, cleanup_links = true } = args;
  
  // Ensure path ends with .json
  const jsonPath = ensureJsonExtension(path);
  const fullPath = join(context.knowledgeRoot, jsonPath);
  
  // Check if file exists
  if (!await fileExists(fullPath)) {
    return {
      content: [
        {
          type: "text",
          text: `❌ Entry not found: ${jsonPath}`,
        },
      ],
    };
  }
  
  // Read the entry before deletion for cleanup
  let entryData: KnowledgeEntry | null = null;
  if (cleanup_links) {
    try {
      entryData = await readKnowledgeEntry(fullPath);
    } catch (error) {
      // Continue with deletion even if we can't parse
    }
  }
  
  // Delete the file
  try {
    await deleteFile(fullPath);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ Failed to delete entry: ${error}`,
        },
      ],
    };
  }
  
  // Clean up references in other entries
  let cleanedCount = 0;
  if (cleanup_links) {
    const allEntries = await context.scanKnowledgeTree();
    
    for (const entryPath of allEntries) {
      const entryFullPath = join(context.knowledgeRoot, entryPath);
      
      try {
        const entry = await readKnowledgeEntry(entryFullPath);
        
        if (entry.related_to && entry.related_to.length > 0) {
          const originalLength = entry.related_to.length;
          entry.related_to = entry.related_to.filter(
            link => link.path !== jsonPath
          );
          
          if (entry.related_to.length < originalLength) {
            await writeKnowledgeEntry(entryFullPath, entry);
            cleanedCount++;
          }
        }
      } catch (error) {
        // Skip entries we can't process
      }
    }
  }
  
  // Broadcast deletion
  await context.broadcastUpdate('entryDeleted', {
    path: jsonPath
  });
  
  let responseText = `✅ Successfully deleted: ${jsonPath}`;
  if (cleanup_links && cleanedCount > 0) {
    responseText += `\n🧹 Cleaned up references in ${cleanedCount} other entries`;
  }
  
  return {
    content: [
      {
        type: "text",
        text: responseText,
      },
    ],
  };
};