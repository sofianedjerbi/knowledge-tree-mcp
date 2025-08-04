/**
 * Export knowledge tool implementation
 * Exports knowledge base to various formats for documentation
 */

import { join } from 'path';
import type { 
  ToolHandler, 
  ExportArgs, 
  MCPResponse, 
  ServerContext,
  KnowledgeEntry 
} from '../types/index.js';
import { EXPORT_DEFAULTS } from '../constants/index.js';
import { 
  readFile,
  exportToMarkdown,
  exportToJSON,
  exportToHTML
} from '../utils/index.js';

interface EntryWithPath {
  path: string;
  entry: KnowledgeEntry;
}

/**
 * Handler for the export_knowledge tool
 */
export const exportKnowledgeHandler: ToolHandler = async (
  args: ExportArgs,
  context: ServerContext
): Promise<MCPResponse> => {
  const { 
    format = EXPORT_DEFAULTS.FORMAT, 
    filter = {}, 
    include_links = EXPORT_DEFAULTS.INCLUDE_LINKS 
  } = args;
  
  // Get all entries
  const allEntries = await context.scanKnowledgeTree();
  let entries: EntryWithPath[] = [];
  
  // Load and filter entries
  for (const path of allEntries) {
    const fullPath = join(context.knowledgeRoot, path);
    
    try {
      const content = await readFile(fullPath);
      const entry: KnowledgeEntry = JSON.parse(content);
      
      // Apply filters
      if (filter.priority && filter.priority.length > 0) {
        if (!filter.priority.includes(entry.priority)) continue;
      }
      
      if (filter.category) {
        if (!path.toLowerCase().includes(filter.category.toLowerCase())) continue;
      }
      
      entries.push({ path, entry });
    } catch (error) {
      // Skip invalid entries
    }
  }
  
  // Sort by priority and path
  const priorityOrder = { "CRITICAL": 0, "REQUIRED": 1, "COMMON": 2, "EDGE-CASE": 3 };
  entries.sort((a, b) => {
    const priorityDiff = priorityOrder[a.entry.priority] - priorityOrder[b.entry.priority];
    if (priorityDiff !== 0) return priorityDiff;
    return a.path.localeCompare(b.path);
  });
  
  let output = "";
  
  switch (format) {
    case "html":
      output = exportToHTML(entries, include_links);
      break;
    case "markdown":
    default:
      output = exportToMarkdown(entries, include_links);
      break;
  }
  
  return {
    content: [
      {
        type: "text",
        text: output,
      },
    ],
  };
};