/**
 * Stats knowledge tool implementation
 * Provides comprehensive statistics about the knowledge base
 */

import { join } from 'path';
import type { 
  ToolHandler, 
  StatsArgs, 
  MCPResponse, 
  ServerContext,
  KnowledgeEntry 
} from '../types/index.js';
import { 
  STATS_DEFAULTS,
  PRIORITY_WEIGHTS,
  PRIORITY_LEVELS
} from '../constants/index.js';
import { readFile, getFileStats } from '../utils/index.js';

interface EntryWithStats {
  path: string;
  entry: KnowledgeEntry;
  stats: any;
}

/**
 * Handler for the stats_knowledge tool
 */
export const statsKnowledgeHandler: ToolHandler = async (
  args: StatsArgs,
  context: ServerContext
): Promise<MCPResponse> => {
  const { include = STATS_DEFAULTS.INCLUDE } = args;
  
  const allEntries = await context.scanKnowledgeTree();
  const entries: EntryWithStats[] = [];
  
  // Load all entries with file stats
  for (const path of allEntries) {
    const fullPath = join(context.knowledgeRoot, path);
    
    try {
      const content = await readFile(fullPath);
      const entry: KnowledgeEntry = JSON.parse(content);
      const stats = await getFileStats(fullPath);
      
      entries.push({ path, entry, stats });
    } catch (error) {
      // Skip invalid entries
    }
  }
  
  const result: any = {
    generated_at: new Date().toISOString(),
    total_entries: entries.length
  };
  
  // Summary statistics
  if (include.includes("summary")) {
    result.summary = {
      total_entries: entries.length,
      total_size_bytes: entries.reduce((sum, e) => sum + e.stats.size, 0),
      with_code_examples: entries.filter(e => 
        (e.entry.code && e.entry.code.trim()) || 
        (e.entry.examples && e.entry.examples.length > 0)
      ).length,
      with_relationships: entries.filter(e => e.entry.related_to && e.entry.related_to.length > 0).length,
      total_relationships: entries.reduce((sum, e) => sum + (e.entry.related_to?.length || 0), 0)
    };
  }
  
  // Priority breakdown
  if (include.includes("priorities")) {
    const priorityCounts = entries.reduce((acc, e) => {
      acc[e.entry.priority] = (acc[e.entry.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Ensure all priorities are represented
    for (const priority of PRIORITY_LEVELS) {
      if (!priorityCounts[priority]) {
        priorityCounts[priority] = 0;
      }
    }
    
    result.priorities = {
      counts: priorityCounts,
      percentages: Object.entries(priorityCounts).reduce((acc, [priority, count]) => {
        acc[priority] = Math.round((count / entries.length) * 100);
        return acc;
      }, {} as Record<string, number>)
    };
  }
  
  // Category breakdown
  if (include.includes("categories")) {
    const categoryStats = entries.reduce((acc, e) => {
      const parts = e.path.split('/');
      const category = parts.length > 1 ? parts[0] : 'root';
      
      if (!acc[category]) {
        acc[category] = {
          count: 0,
          priorities: {},
          subcategories: new Set()
        };
      }
      
      acc[category].count++;
      acc[category].priorities[e.entry.priority] = 
        (acc[category].priorities[e.entry.priority] || 0) + 1;
      
      if (parts.length > 2) {
        acc[category].subcategories.add(parts[1]);
      }
      
      return acc;
    }, {} as Record<string, any>);
    
    // Convert Sets to arrays for JSON serialization
    Object.values(categoryStats).forEach((cat: any) => {
      cat.subcategories = Array.from(cat.subcategories);
    });
    
    result.categories = categoryStats;
  }
  
  // Orphaned entries (no relationships)
  if (include.includes("orphaned")) {
    const orphaned = entries.filter(e => !e.entry.related_to || e.entry.related_to.length === 0);
    result.orphaned = {
      count: orphaned.length,
      percentage: Math.round((orphaned.length / entries.length) * 100),
      entries: orphaned.slice(0, 10).map(e => ({
        path: e.path,
        priority: e.entry.priority,
        problem: e.entry.problem.substring(0, 60) + (e.entry.problem.length > 60 ? '...' : '')
      }))
    };
  }
  
  // Popular entries (most linked to)
  if (include.includes("popular")) {
    const linkCounts = new Map<string, number>();
    
    entries.forEach(e => {
      if (e.entry.related_to) {
        e.entry.related_to.forEach(link => {
          const count = linkCounts.get(link.path) || 0;
          linkCounts.set(link.path, count + 1);
        });
      }
    });
    
    const popular = Array.from(linkCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([path, count]) => {
        const entry = entries.find(e => e.path === path);
        return {
          path,
          incoming_links: count,
          priority: entry?.entry.priority || 'Unknown',
          problem: entry ? 
            entry.entry.problem.substring(0, 60) + (entry.entry.problem.length > 60 ? '...' : '') : 
            'Entry not found'
        };
      });
    
    result.popular = {
      most_linked: popular,
      average_links: entries.length > 0 ? 
        Math.round(Array.from(linkCounts.values()).reduce((a, b) => a + b, 0) / entries.length * 10) / 10 : 
        0
    };
  }
  
  // Coverage analysis
  if (include.includes("coverage")) {
    const now = new Date();
    const oldEntries = entries.filter(e => {
      const daysSinceModified = (now.getTime() - e.stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceModified > 30;
    });
    
    result.coverage = {
      stale_entries: {
        count: oldEntries.length,
        percentage: Math.round((oldEntries.length / entries.length) * 100),
        threshold_days: 30
      },
      recent_activity: {
        last_7_days: entries.filter(e => {
          const daysSinceModified = (now.getTime() - e.stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceModified <= 7;
        }).length,
        last_30_days: entries.filter(e => {
          const daysSinceModified = (now.getTime() - e.stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
          return daysSinceModified <= 30;
        }).length
      }
    };
  }
  
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
};