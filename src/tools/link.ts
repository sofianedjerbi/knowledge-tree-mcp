/**
 * Link knowledge tool implementation
 * Creates relationships between existing knowledge entries
 */

import { join } from 'path';
import type { 
  ToolHandler, 
  LinkArgs, 
  MCPResponse, 
  ServerContext,
  KnowledgeEntry 
} from '../types/index.js';
import { isBidirectionalRelationship } from '../constants/index.js';
import {
  ensureJsonExtension,
  fileExists,
  readKnowledgeEntry,
  writeKnowledgeEntry
} from '../utils/index.js';

/**
 * Handler for the link_knowledge tool
 */
export const linkKnowledgeHandler: ToolHandler = async (
  args: LinkArgs,
  context: ServerContext
): Promise<MCPResponse> => {
  const { from, to, relationship, description } = args;
  
  // Ensure paths end with .json
  const fromPath = ensureJsonExtension(from);
  const toPath = ensureJsonExtension(to);
  
  const fromFullPath = join(context.knowledgeRoot, fromPath);
  const toFullPath = join(context.knowledgeRoot, toPath);
  
  // Read the source entry
  let fromEntry: KnowledgeEntry;
  try {
    if (!await fileExists(fromFullPath)) {
      throw new Error(`Source entry does not exist: ${fromPath}`);
    }
    fromEntry = await readKnowledgeEntry(fromFullPath);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ Cannot read source entry: ${fromPath}`,
        },
      ],
    };
  }
  
  // Verify target exists
  if (!await fileExists(toFullPath)) {
    return {
      content: [
        {
          type: "text",
          text: `❌ Target entry does not exist: ${toPath}`,
        },
      ],
    };
  }
  
  // Initialize related_to array if it doesn't exist
  if (!fromEntry.related_to) {
    fromEntry.related_to = [];
  }
  
  // Check if link already exists
  const existingLink = fromEntry.related_to.find(link => link.path === toPath);
  if (existingLink) {
    // Update existing link
    existingLink.relationship = relationship;
    if (description) existingLink.description = description;
  } else {
    // Add new link
    const newLink: any = { path: toPath, relationship };
    if (description) newLink.description = description;
    fromEntry.related_to.push(newLink);
  }
  
  // Save updated entry
  await writeKnowledgeEntry(fromFullPath, fromEntry);
  
  // Create bidirectional links only for symmetric relationships
  if (isBidirectionalRelationship(relationship)) {
    try {
      const targetEntry = await readKnowledgeEntry(toFullPath);
      
      if (!targetEntry.related_to) {
        targetEntry.related_to = [];
      }
      
      const reverseLink = targetEntry.related_to.find(link => link.path === fromPath);
      if (!reverseLink) {
        const newReverseLink: any = { 
          path: fromPath, 
          relationship: relationship
        };
        if (description) newReverseLink.description = description;
        targetEntry.related_to.push(newReverseLink);
        await writeKnowledgeEntry(toFullPath, targetEntry);
      }
    } catch (error) {
      // Silently continue if we can't update the reverse link
    }
  }
  
  // Broadcast the updated entry
  await context.broadcastUpdate('entryUpdated', {
    path: fromPath,
    data: fromEntry
  });
  
  return {
    content: [
      {
        type: "text",
        text: `Link created: ${fromPath} ${relationship} ${toPath}`,
      },
    ],
  };
};