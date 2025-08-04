/**
 * Recent knowledge tool implementation
 * Shows recently added or modified knowledge entries
 */

import { join } from 'path';
import type { 
  ToolHandler, 
  RecentArgs, 
  MCPResponse, 
  ServerContext,
  KnowledgeEntry 
} from '../types/index.js';
import { RECENT_DEFAULTS } from '../constants/index.js';
import { readFile, getFileStats } from '../utils/index.js';

interface RecentEntry {
  path: string;
  entry: KnowledgeEntry;
  stats: any;
  changeType: string;
}

/**
 * Handler for the recent_knowledge tool
 */
export const recentKnowledgeHandler: ToolHandler = async (
  args: RecentArgs,
  context: ServerContext
): Promise<MCPResponse> => {
  const { 
    days = RECENT_DEFAULTS.DAYS, 
    limit = RECENT_DEFAULTS.LIMIT, 
    type = RECENT_DEFAULTS.TYPE 
  } = args;
  
  const allEntries = await context.scanKnowledgeTree();
  const entries: RecentEntry[] = [];
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  // Load entries with file stats
  for (const path of allEntries) {
    const fullPath = join(context.knowledgeRoot, path);
    
    try {
      const content = await readFile(fullPath);
      const entry: KnowledgeEntry = JSON.parse(content);
      const stats = await getFileStats(fullPath);
      
      // Determine if entry is recent
      const created = stats.birthtime;
      const modified = stats.mtime;
      
      let changeType = "";
      let isRecent = false;
      
      // Check if recently created
      if (created >= cutoffDate) {
        changeType = "added";
        isRecent = true;
      }
      // Check if recently modified (but not newly created)
      else if (modified >= cutoffDate && modified.getTime() !== created.getTime()) {
        changeType = "modified";
        isRecent = true;
      }
      
      // Filter by type
      if (isRecent && (type === "all" || type === changeType)) {
        entries.push({ path, entry, stats, changeType });
      }
    } catch (error) {
      // Skip invalid entries
    }
  }
  
  // Sort by modification time (newest first)
  entries.sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());
  
  // Apply limit
  const limitedEntries = entries.slice(0, limit);
  
  const result = {
    period: {
      days: days,
      from: cutoffDate.toISOString(),
      to: new Date().toISOString()
    },
    summary: {
      total_changes: entries.length,
      showing: limitedEntries.length,
      added: entries.filter(e => e.changeType === "added").length,
      modified: entries.filter(e => e.changeType === "modified").length
    },
    entries: limitedEntries.map(e => ({
      path: e.path,
      priority: e.entry.priority,
      problem: e.entry.problem,
      solution: e.entry.solution.substring(0, 100) + (e.entry.solution.length > 100 ? '...' : ''),
      change_type: e.changeType,
      modified_at: e.stats.mtime.toISOString(),
      created_at: e.stats.birthtime.toISOString(),
      relationships: e.entry.related_to?.length || 0
    }))
  };
  
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
};