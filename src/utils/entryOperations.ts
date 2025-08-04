/**
 * Entry operations for moving and managing knowledge entries
 */

import { join, dirname } from 'path';
import { unlink, mkdir } from 'fs/promises';
import type { KnowledgeEntry, ServerContext } from '../types/index.js';
import { 
  ensureJsonExtension,
  fileExists,
  readKnowledgeEntry,
  writeKnowledgeEntry,
  ensureDirectory
} from './index.js';

/**
 * Move a knowledge entry from old path to new path and update all references
 */
export async function moveEntryWithReferences(
  oldPath: string,
  newPath: string,
  context: ServerContext
): Promise<{ success: boolean; error?: string; conflictResolution?: string }> {
  const oldJsonPath = ensureJsonExtension(oldPath);
  const newJsonPath = ensureJsonExtension(newPath);
  const oldFullPath = join(context.knowledgeRoot, oldJsonPath);
  const newFullPath = join(context.knowledgeRoot, newJsonPath);
  
  // Check if old file exists
  if (!await fileExists(oldFullPath)) {
    return { success: false, error: `Source entry not found: ${oldJsonPath}` };
  }
  
  // Handle path conflict
  if (await fileExists(newFullPath)) {
    // Generate unique path by adding timestamp
    const timestamp = Date.now();
    const pathParts = newJsonPath.split('.');
    pathParts[pathParts.length - 2] += `-${timestamp}`;
    const uniquePath = pathParts.join('.');
    const uniqueFullPath = join(context.knowledgeRoot, uniquePath);
    
    // Update newPath to the unique path
    const resolvedPath = uniquePath;
    const resolvedFullPath = uniqueFullPath;
    
    return moveEntryWithReferences(oldPath, resolvedPath, context);
  }
  
  try {
    // Read the entry
    const entry = await readKnowledgeEntry(oldFullPath);
    
    // Create target directory if needed
    await ensureDirectory(dirname(newFullPath));
    
    // Write to new location
    await writeKnowledgeEntry(newFullPath, entry);
    
    // Update all references to this entry in other files
    await updateReferencesToEntry(oldJsonPath, newJsonPath, context);
    
    // Remove old file
    await unlink(oldFullPath);
    
    // Broadcast move event
    await context.broadcastUpdate('entryMoved', {
      oldPath: oldJsonPath,
      newPath: newJsonPath,
      data: entry
    });
    
    return { success: true };
    
  } catch (error) {
    return { 
      success: false, 
      error: `Failed to move entry: ${error instanceof Error ? error.message : 'Unknown error'}` 
    };
  }
}

/**
 * Update all references to an entry that has been moved
 */
export async function updateReferencesToEntry(
  oldPath: string,
  newPath: string,
  context: ServerContext
): Promise<void> {
  // This is a simplified implementation
  // In a real system, you'd want to scan all files for references
  // For now, we'll implement basic bidirectional link updates
  
  const oldJsonPath = ensureJsonExtension(oldPath);
  const newJsonPath = ensureJsonExtension(newPath);
  
  // Find all JSON files that might contain references
  const { glob } = await import('glob');
  const pattern = join(context.knowledgeRoot, '**/*.json');
  const files = await glob(pattern);
  
  for (const file of files) {
    try {
      if (file === join(context.knowledgeRoot, oldJsonPath) || 
          file === join(context.knowledgeRoot, newJsonPath)) {
        continue; // Skip the moved file itself
      }
      
      const entry = await readKnowledgeEntry(file);
      let hasChanges = false;
      
      // Update related_to references
      if (entry.related_to) {
        for (const relation of entry.related_to) {
          if (relation.path === oldJsonPath) {
            relation.path = newJsonPath;
            hasChanges = true;
          }
        }
      }
      
      // Save if changes were made
      if (hasChanges) {
        await writeKnowledgeEntry(file, entry);
      }
      
    } catch (error) {
      // Continue processing other files even if one fails
      console.error(`Failed to update references in ${file}:`, error);
    }
  }
}

/**
 * Check if moving an entry would break any relationships
 */
export async function validateEntryMove(
  oldPath: string,
  newPath: string,
  context: ServerContext
): Promise<{ valid: boolean; warnings: string[] }> {
  const warnings: string[] = [];
  const oldJsonPath = ensureJsonExtension(oldPath);
  const newJsonPath = ensureJsonExtension(newPath);
  const oldFullPath = join(context.knowledgeRoot, oldJsonPath);
  const newFullPath = join(context.knowledgeRoot, newJsonPath);
  
  // Check if source exists
  if (!await fileExists(oldFullPath)) {
    return { valid: false, warnings: [`Source entry not found: ${oldJsonPath}`] };
  }
  
  // Check if target already exists
  if (await fileExists(newFullPath)) {
    warnings.push(`Target path already exists: ${newJsonPath} (will be renamed with timestamp)`);
  }
  
  // Check if the entry has incoming references
  try {
    const { glob } = await import('glob');
    const pattern = join(context.knowledgeRoot, '**/*.json');
    const files = await glob(pattern);
    let incomingRefs = 0;
    
    for (const file of files) {
      try {
        if (file === oldFullPath) continue;
        
        const entry = await readKnowledgeEntry(file);
        if (entry.related_to) {
          for (const relation of entry.related_to) {
            if (relation.path === oldJsonPath) {
              incomingRefs++;
              break;
            }
          }
        }
      } catch (error) {
        // Continue checking other files
      }
    }
    
    if (incomingRefs > 0) {
      warnings.push(`Entry has ${incomingRefs} incoming reference(s) that will be updated`);
    }
    
  } catch (error) {
    warnings.push('Could not check for incoming references');
  }
  
  return { valid: true, warnings };
}