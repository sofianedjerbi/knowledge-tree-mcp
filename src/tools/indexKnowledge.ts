/**
 * Index knowledge tool implementation
 * Provides a comprehensive overview/map of all knowledge entries
 */

import { join } from 'path';
import type { 
  ToolHandler, 
  IndexArgs, 
  MCPResponse, 
  ServerContext,
  KnowledgeEntry 
} from '../types/index.js';
import { 
  INDEX_DEFAULTS,
  PRIORITY_LEVELS
} from '../constants/index.js';
import { readFile, getFileStats } from '../utils/index.js';

interface EntryWithStats {
  path: string;
  entry: KnowledgeEntry;
  stats?: any;
}

/**
 * Handler for the index_knowledge tool
 */
export const indexKnowledgeHandler: ToolHandler = async (
  args: IndexArgs,
  context: ServerContext
): Promise<MCPResponse> => {
  const { 
    format = INDEX_DEFAULTS.FORMAT, 
    include_content = INDEX_DEFAULTS.INCLUDE_CONTENT, 
    max_entries = INDEX_DEFAULTS.MAX_ENTRIES 
  } = args;
  
  const allEntries = await context.scanKnowledgeTree();
  const entries: EntryWithStats[] = [];
  
  // Load all entries with basic stats
  for (const path of allEntries.slice(0, max_entries)) {
    const fullPath = join(context.knowledgeRoot, path);
    
    try {
      const content = await readFile(fullPath);
      const entry: KnowledgeEntry = JSON.parse(content);
      
      let stats;
      if (format === "summary") {
        const fileStat = await getFileStats(fullPath);
        stats = {
          created: fileStat.birthtime.toISOString(),
          modified: fileStat.mtime.toISOString(),
          size: fileStat.size
        };
      }
      
      entries.push({ path, entry, stats });
    } catch (error) {
      // Skip invalid entries
    }
  }

  let result: any = {
    total_entries: allEntries.length,
    showing: entries.length,
    format: format,
    timestamp: new Date().toISOString()
  };

  switch (format) {
    case "tree":
      result.index = buildTreeIndex(entries, include_content);
      break;
    case "list":
      result.index = buildListIndex(entries, include_content);
      break;
    case "summary":
      result.index = buildSummaryIndex(entries);
      break;
    case "categories":
      result.index = buildCategoriesIndex(entries);
      break;
  }
  
  // Add quick stats
  result.statistics = {
    by_priority: countByPriority(entries),
    by_category: countByCategory(entries),
    with_relationships: entries.filter(e => e.entry.related_to?.length).length,
    with_code: entries.filter(e => e.entry.code).length
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

/**
 * Build tree-structured index
 */
function buildTreeIndex(entries: EntryWithStats[], includeContent: boolean) {
  const tree: any = {};
  
  for (const { path, entry } of entries) {
    const parts = path.split('/');
    let current = tree;
    
    // Build nested structure
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }
    
    // Add the file
    const filename = parts[parts.length - 1].replace('.json', '');
    current[filename] = {
      priority: entry.priority,
      problem: includeContent ? entry.problem : entry.problem.substring(0, 50) + "...",
      links: entry.related_to?.length || 0
    };
    
    if (includeContent && entry.solution) {
      current[filename].solution = entry.solution.substring(0, 100) + "...";
    }
  }
  
  return tree;
}

/**
 * Build list-structured index
 */
function buildListIndex(entries: EntryWithStats[], includeContent: boolean) {
  return entries.map(({ path, entry }) => ({
    path,
    priority: entry.priority,
    problem: includeContent ? entry.problem : entry.problem.substring(0, 60) + "...",
    solution: includeContent ? entry.solution.substring(0, 100) + "..." : undefined,
    relationships: entry.related_to?.length || 0,
    has_code: !!entry.code
  }));
}

/**
 * Build summary index with file stats
 */
function buildSummaryIndex(entries: EntryWithStats[]) {
  return entries.map(({ path, entry, stats }) => ({
    path,
    priority: entry.priority,
    title: entry.problem.substring(0, 40) + "...",
    relationships: entry.related_to?.length || 0,
    features: {
      has_code: !!entry.code,
      has_examples: !!entry.examples,
      has_links: !!(entry.related_to?.length)
    },
    file_info: stats
  }));
}

/**
 * Build category-grouped index
 */
function buildCategoriesIndex(entries: EntryWithStats[]) {
  const categories: Record<string, any> = {};
  
  for (const { path, entry } of entries) {
    const pathParts = path.split('/');
    const category = pathParts.slice(0, -1).join('/') || 'root';
    
    if (!categories[category]) {
      categories[category] = {
        count: 0,
        priorities: {} as Record<string, number>,
        entries: []
      };
    }
    
    categories[category].count++;
    categories[category].priorities[entry.priority] = 
      (categories[category].priorities[entry.priority] || 0) + 1;
    categories[category].entries.push({
      filename: pathParts[pathParts.length - 1],
      priority: entry.priority,
      problem: entry.problem.substring(0, 50) + "..."
    });
  }
  
  return categories;
}

/**
 * Count entries by priority
 */
function countByPriority(entries: EntryWithStats[]) {
  const counts: Record<string, number> = {};
  
  // Initialize with all priority levels
  for (const priority of PRIORITY_LEVELS) {
    counts[priority] = 0;
  }
  
  for (const { entry } of entries) {
    counts[entry.priority]++;
  }
  
  return counts;
}

/**
 * Count entries by category
 */
function countByCategory(entries: EntryWithStats[]) {
  const counts: Record<string, number> = {};
  
  for (const { path } of entries) {
    const category = path.split('/').slice(0, -1).join('/') || 'root';
    counts[category] = (counts[category] || 0) + 1;
  }
  
  return counts;
}