/**
 * Validate knowledge tool implementation
 * Checks knowledge entries for errors and inconsistencies
 */

import { join } from 'path';
import type { 
  ToolHandler, 
  ValidateArgs, 
  MCPResponse, 
  ServerContext,
  KnowledgeEntry 
} from '../types/index.js';
import { 
  Constants,
  isBidirectionalRelationship,
  isValidPriority,
  isValidRelationshipType
} from '../constants/index.js';
import {
  ensureJsonExtension,
  fileExists,
  readFile,
  writeKnowledgeEntry,
  validateJSON,
  validateFilenameMatchesPriority
} from '../utils/index.js';

/**
 * Handler for the validate_knowledge tool
 */
export const validateKnowledgeHandler: ToolHandler = async (
  args: ValidateArgs,
  context: ServerContext
): Promise<MCPResponse> => {
  const { path, fix = false } = args;
  const issues: string[] = [];
  let fixed = 0;
  
  const entriesToValidate: string[] = path 
    ? [ensureJsonExtension(path)]
    : await context.scanKnowledgeTree();
  
  for (const entryPath of entriesToValidate) {
    const fullPath = join(context.knowledgeRoot, entryPath);
    
    try {
      const content = await readFile(fullPath);
      let entry: KnowledgeEntry;
      
      // Validate JSON format
      const jsonValidation = validateJSON(content);
      if (!jsonValidation.valid) {
        issues.push(`${entryPath}: Invalid JSON format - ${jsonValidation.error}`);
        continue;
      }
      
      entry = JSON.parse(content);
      
      // Validate required fields
      if (!entry.title || typeof entry.title !== 'string') {
        issues.push(`${entryPath}: Missing or invalid title`);
      }
      
      if (!entry.priority || !isValidPriority(entry.priority)) {
        issues.push(`${entryPath}: Invalid or missing priority`);
      }
      
      if (!entry.problem || typeof entry.problem !== 'string') {
        issues.push(`${entryPath}: Missing or invalid problem description`);
      }
      
      if (!entry.solution || typeof entry.solution !== 'string') {
        issues.push(`${entryPath}: Missing or invalid solution description`);
      }
      
      // Priority is no longer part of the filename - removed validation
      
      // Validate links
      if (entry.related_to) {
        for (const link of entry.related_to) {
          // Validate relationship type
          if (!isValidRelationshipType(link.relationship)) {
            issues.push(`${entryPath}: Invalid relationship type '${link.relationship}' for link to ${link.path}`);
            continue;
          }
          
          const linkFullPath = join(context.knowledgeRoot, link.path);
          
          if (!await fileExists(linkFullPath)) {
            issues.push(`${entryPath}: Broken link to ${link.path}`);
          } else if (fix && isBidirectionalRelationship(link.relationship)) {
            // Check for bidirectional links
            try {
              const targetContent = await readFile(linkFullPath);
              const targetEntry: KnowledgeEntry = JSON.parse(targetContent);
              
              const hasReverseLink = targetEntry.related_to?.some(
                reverseLink => reverseLink.path === entryPath
              );
              
              if (!hasReverseLink) {
                // Fix by adding reverse link
                if (!targetEntry.related_to) targetEntry.related_to = [];
                targetEntry.related_to.push({
                  path: entryPath,
                  relationship: link.relationship,
                  description: link.description
                });
                await writeKnowledgeEntry(linkFullPath, targetEntry);
                fixed++;
              }
            } catch (error) {
              issues.push(`${entryPath}: Cannot validate/fix bidirectional link to ${link.path}`);
            }
          }
        }
      }
    } catch (error) {
      issues.push(`${entryPath}: Cannot read file - ${error}`);
    }
  }
  
  let responseText = `Validation complete: checked ${entriesToValidate.length} entries\n`;
  
  if (issues.length === 0) {
    responseText += "✓ All entries are valid!";
  } else {
    responseText += `\nFound ${issues.length} issues:\n`;
    issues.forEach(issue => {
      responseText += `- ${issue}\n`;
    });
  }
  
  if (fix && fixed > 0) {
    responseText += `\n✓ Fixed ${fixed} missing bidirectional links`;
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