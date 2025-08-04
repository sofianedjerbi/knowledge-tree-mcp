/**
 * Update knowledge tool implementation
 * Modifies existing knowledge entries with validation
 */

import { join } from 'path';
import type { 
  ToolHandler, 
  UpdateArgs, 
  MCPResponse, 
  ServerContext,
  KnowledgeEntry 
} from '../types/index.js';
import { 
  Constants,
  isBidirectionalRelationship 
} from '../constants/index.js';
import {
  ensureJsonExtension,
  fileExists,
  readKnowledgeEntry,
  writeKnowledgeEntry,
  validateRequiredFields,
  moveEntryWithReferences,
  validateEntryMove,
  generatePathFromTitle
} from '../utils/index.js';

/**
 * Handler for the update_knowledge tool
 */
export const updateKnowledgeHandler: ToolHandler = async (
  args: UpdateArgs,
  context: ServerContext
): Promise<MCPResponse> => {
  const { path, new_path, updates, regenerate_path = false } = args;
  
  // Ensure path ends with .json
  const jsonPath = ensureJsonExtension(path);
  const fullPath = join(context.knowledgeRoot, jsonPath);
  
  // Read existing entry
  let entry: KnowledgeEntry;
  try {
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
    entry = await readKnowledgeEntry(fullPath);
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ Failed to read entry: ${jsonPath}`,
        },
      ],
    };
  }
  
  // Validate updates
  const validationErrors: string[] = [];
  
  if (updates.title !== undefined && (!updates.title || typeof updates.title !== 'string')) {
    validationErrors.push("Title must be a non-empty string");
  }
  
  if (updates.priority && !Constants.isValidPriority(updates.priority)) {
    validationErrors.push("Invalid priority value");
  }
  
  if (updates.problem !== undefined && (!updates.problem || typeof updates.problem !== 'string')) {
    validationErrors.push("Problem must be a non-empty string");
  }
  
  if (updates.solution !== undefined && (!updates.solution || typeof updates.solution !== 'string')) {
    validationErrors.push("Solution must be a non-empty string");
  }
  
  if (updates.tags !== undefined && !Array.isArray(updates.tags)) {
    validationErrors.push("Tags must be an array of strings");
  }
  
  // Priority is no longer part of the filename - removed validation
  
  if (validationErrors.length > 0) {
    return {
      content: [
        {
          type: "text",
          text: `❌ Validation failed:\n${validationErrors.map(e => `• ${e}`).join('\n')}`,
        },
      ],
    };
  }
  
  // Apply updates
  const oldEntry = { ...entry };
  
  if (updates.title !== undefined) entry.title = updates.title;
  if (updates.slug !== undefined) entry.slug = updates.slug;
  if (updates.priority !== undefined) entry.priority = updates.priority;
  if (updates.category !== undefined) entry.category = updates.category;
  if (updates.tags !== undefined) entry.tags = updates.tags;
  if (updates.problem !== undefined) entry.problem = updates.problem;
  if (updates.context !== undefined) entry.context = updates.context;
  if (updates.solution !== undefined) entry.solution = updates.solution;
  if (updates.examples !== undefined) entry.examples = updates.examples;
  if (updates.code !== undefined) entry.code = updates.code;
  if (updates.author !== undefined) entry.author = updates.author;
  if (updates.version !== undefined) entry.version = updates.version;
  
  // Update the updated_at timestamp
  entry.updated_at = new Date().toISOString();
  
  // Check if path change is needed (explicit or regenerated)
  let finalPath = jsonPath;
  let pathChanged = false;
  let targetPath: string | null = null;
  
  // Handle explicit new_path parameter
  if (new_path) {
    targetPath = ensureJsonExtension(new_path);
  }
  // Handle automatic path regeneration
  else if (regenerate_path && entry.title) {
    targetPath = generatePathFromTitle(entry.title, {
      category: entry.category,
      tags: entry.tags,
      priority: entry.priority
    });
  }
  
  if (targetPath && targetPath !== jsonPath) {
    // Validate the move
    const moveValidation = await validateEntryMove(jsonPath, targetPath, context);
    
    if (!moveValidation.valid) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Cannot move entry to ${targetPath}: ${moveValidation.warnings.join(', ')}`,
          },
        ],
      };
    }
    
    // Perform the move
    const moveResult = await moveEntryWithReferences(jsonPath, targetPath, context);
    
    if (!moveResult.success) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to move entry: ${moveResult.error}`,
          },
        ],
      };
    }
    
    finalPath = targetPath;
    pathChanged = true;
    
    // Update the entry with the new path and save it
    const newFullPath = join(context.knowledgeRoot, finalPath);
    await writeKnowledgeEntry(newFullPath, entry);
    
    // Report what was updated including path change
    const updatedFields = Object.keys(updates).filter(key => updates[key as keyof typeof updates] !== undefined);
    const pathInfo = moveValidation.warnings.length > 0 ? 
      `\n⚠️  ${moveValidation.warnings.join('\n⚠️  ')}` : '';
    const moveType = new_path ? 'moved to explicit path' : 'moved with regenerated path';
    
    return {
      content: [
        {
          type: "text",
          text: `✅ Successfully updated and ${moveType}\n📁 Old path: ${jsonPath}\n📁 New path: ${finalPath}\n📝 Updated fields: ${updatedFields.join(', ')}${pathInfo}`,
        },
      ],
    };
  }
  
  // Handle relationship updates
  if (updates.related_to !== undefined) {
    // Validate new relationships
    for (const link of updates.related_to) {
      const linkPath = ensureJsonExtension(link.path);
      const linkFullPath = join(context.knowledgeRoot, linkPath);
      
      if (!await fileExists(linkFullPath)) {
        validationErrors.push(`Linked entry does not exist: ${linkPath}`);
      }
    }
    
    if (validationErrors.length > 0) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Validation failed:\n${validationErrors.map(e => `• ${e}`).join('\n')}`,
          },
        ],
      };
    }
    
    // Remove old bidirectional links
    if (oldEntry.related_to) {
      for (const oldLink of oldEntry.related_to) {
        if (isBidirectionalRelationship(oldLink.relationship)) {
          // Remove reverse link
          try {
            const targetPath = join(context.knowledgeRoot, oldLink.path);
            const targetEntry = await readKnowledgeEntry(targetPath);
            
            if (targetEntry.related_to) {
              targetEntry.related_to = targetEntry.related_to.filter(
                link => link.path !== jsonPath
              );
              await writeKnowledgeEntry(targetPath, targetEntry);
            }
          } catch (error) {
            // Continue if we can't update
          }
        }
      }
    }
    
    entry.related_to = updates.related_to;
    
    // Create new bidirectional links
    if (entry.related_to) {
      for (const link of entry.related_to) {
        if (isBidirectionalRelationship(link.relationship)) {
          try {
            const targetPath = join(context.knowledgeRoot, link.path);
            const targetEntry = await readKnowledgeEntry(targetPath);
            
            if (!targetEntry.related_to) {
              targetEntry.related_to = [];
            }
            
            const reverseExists = targetEntry.related_to.some(
              reverseLink => reverseLink.path === jsonPath
            );
            
            if (!reverseExists) {
              targetEntry.related_to.push({
                path: jsonPath,
                relationship: link.relationship,
                description: link.description
              });
              await writeKnowledgeEntry(targetPath, targetEntry);
            }
          } catch (error) {
            // Continue if we can't create reverse link
          }
        }
      }
    }
  }
  
  // Save updated entry (only if path didn't change)
  if (!pathChanged) {
    await writeKnowledgeEntry(fullPath, entry);
    
    // Broadcast update
    await context.broadcastUpdate('entryUpdated', {
      path: finalPath,
      data: entry
    });
  }
  
  // Report what was updated
  const updatedFields = Object.keys(updates).filter(key => updates[key as keyof typeof updates] !== undefined);
  
  return {
    content: [
      {
        type: "text",
        text: `✅ Successfully updated ${finalPath}\n📝 Updated fields: ${updatedFields.join(', ')}`,
      },
    ],
  };
};