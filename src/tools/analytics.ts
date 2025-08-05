/**
 * Usage analytics tool implementation
 * Provides comprehensive usage analytics for the knowledge base
 */

import { join } from 'path';
import type { 
  ToolHandler, 
  AnalyticsArgs, 
  MCPResponse, 
  ServerContext,
  UsageLogEntry,
  KnowledgeEntry 
} from '../types/index.js';
import { 
  ANALYTICS_DEFAULTS,
  PRIORITY_LEVELS 
} from '../constants/index.js';
import { readUsageLogs, readFile } from '../utils/index.js';

/**
 * Handler for the usage_analytics tool
 */
export const usageAnalyticsHandler: ToolHandler = async (
  args: AnalyticsArgs,
  context: ServerContext
): Promise<MCPResponse> => {
  const { 
    days = ANALYTICS_DEFAULTS.DAYS, 
    include = ANALYTICS_DEFAULTS.INCLUDE 
  } = args;
  
  try {
    // Read usage logs
    const allLogs = await readUsageLogs(context.logsDir);
    
    // Filter by date range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const filteredLogs = allLogs.filter(log => 
      new Date(log.timestamp) >= cutoffDate
    );

    const result: any = {
      period: {
        start: cutoffDate.toISOString(),
        end: new Date().toISOString(),
        days: days
      }
    };

    // Access analytics (only actual knowledge entry access, not UI interactions)
    if (include.includes("access")) {
      const accessLogs = filteredLogs.filter(log => log.type === "access");
      const accessCounts: Record<string, number> = {};
      const lastAccess: Record<string, string> = {};
      
      for (const log of accessLogs) {
        if (log.path) {
          accessCounts[log.path] = (accessCounts[log.path] || 0) + 1;
          lastAccess[log.path] = log.timestamp;
        }
      }

      const mostAccessed = Object.entries(accessCounts)
        .map(([path, count]) => ({ path, count, last_access: lastAccess[path] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Access patterns by hour and day
      const byHour: Record<string, number> = {};
      const byDay: Record<string, number> = {};
      const byPriority: Record<string, number> = {};

      for (const log of accessLogs) {
        const date = new Date(log.timestamp);
        const hour = date.getUTCHours().toString();
        const day = date.toISOString().split('T')[0];
        
        byHour[hour] = (byHour[hour] || 0) + 1;
        byDay[day] = (byDay[day] || 0) + 1;

        // Extract priority from the actual entry
        if (log.path) {
          try {
            const fullPath = join(context.knowledgeRoot, log.path);
            const entryContent = await readFile(fullPath);
            const entry: KnowledgeEntry = JSON.parse(entryContent);
            if (entry.priority && PRIORITY_LEVELS.includes(entry.priority)) {
              byPriority[entry.priority] = (byPriority[entry.priority] || 0) + 1;
            }
          } catch (error) {
            // Entry might not exist anymore, skip
          }
        }
      }

      result.access = {
        total_accesses: accessLogs.length,
        unique_entries: Object.keys(accessCounts).length,
        most_accessed: mostAccessed,
        access_patterns: {
          by_hour: byHour,
          by_day: byDay,
          by_priority: byPriority
        }
      };
    }

    // Search analytics
    if (include.includes("searches")) {
      const searchLogs = filteredLogs.filter(log => log.type === "search");
      const queryCounts: Record<string, number> = {};
      const lastSearch: Record<string, string> = {};
      let wildcardCount = 0;

      for (const log of searchLogs) {
        if (log.query) {
          queryCounts[log.query] = (queryCounts[log.query] || 0) + 1;
          lastSearch[log.query] = log.timestamp;
          
          if (log.query.includes('*') || log.query.includes('?')) {
            wildcardCount++;
          }
        }
      }

      const popularQueries = Object.entries(queryCounts)
        .map(([query, count]) => ({ query, count, last_search: lastSearch[query] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      result.searches = {
        total_searches: searchLogs.length,
        unique_queries: Object.keys(queryCounts).length,
        popular_queries: popularQueries,
        wildcard_usage: wildcardCount
      };
    }

    // Tool usage analytics
    if (include.includes("tools")) {
      const toolLogs = filteredLogs.filter(log => log.type === "tool_call");
      const toolUsage: Record<string, number> = {};

      for (const log of toolLogs) {
        if (log.tool) {
          toolUsage[log.tool] = (toolUsage[log.tool] || 0) + 1;
        }
      }

      result.tools = {
        total_tool_calls: toolLogs.length,
        tool_usage: toolUsage
      };
    }

    // Web interface analytics
    if (include.includes("interface")) {
      const webLogs = filteredLogs.filter(log => log.type === "web_view");
      const actionCounts: Record<string, number> = {};
      
      for (const log of webLogs) {
        if (log.metadata && log.metadata.action) {
          actionCounts[log.metadata.action] = (actionCounts[log.metadata.action] || 0) + 1;
        }
      }
      
      result.interface = {
        total_web_interactions: webLogs.length,
        action_breakdown: actionCounts,
        avg_per_day: Math.round(webLogs.length / days * 10) / 10
      };
    }

    // Pattern analysis
    if (include.includes("patterns")) {
      // Most active time periods (excluding web_view)
      const hourlyActivity: Record<string, number> = {};
      const dailyActivity: Record<string, number> = {};
      
      // Filter out web_view logs for activity patterns
      const activityLogs = filteredLogs.filter(log => log.type !== "web_view");
      
      for (const log of activityLogs) {
        const date = new Date(log.timestamp);
        const hour = date.getUTCHours().toString();
        const day = date.toISOString().split('T')[0];
        
        hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
        dailyActivity[day] = (dailyActivity[day] || 0) + 1;
      }

      const peakHour = Object.entries(hourlyActivity)
        .sort((a, b) => b[1] - a[1])[0];
      
      const peakDay = Object.entries(dailyActivity)
        .sort((a, b) => b[1] - a[1])[0];

      // Group tool calls by CRUD operations
      const toolLogs = activityLogs.filter(l => l.type === "tool_call");
      const crudOperations = {
        create: 0,
        read: 0,
        update: 0,
        delete: 0
      };
      
      // Also count searches as read operations
      crudOperations.read += activityLogs.filter(l => l.type === "search").length;
      
      // Categorize tool calls by CRUD operation
      for (const log of toolLogs) {
        if (log.tool) {
          if (log.tool === 'add_knowledge') {
            crudOperations.create++;
          } else if (log.tool === 'search_knowledge' || log.tool === 'index_knowledge') {
            crudOperations.read++;
          } else if (log.tool === 'update_knowledge' || log.tool === 'link_knowledge') {
            crudOperations.update++;
          } else if (log.tool === 'delete_knowledge') {
            crudOperations.delete++;
          }
        }
      }
      
      result.patterns = {
        total_activity: activityLogs.length,  // Excluding web_view
        peak_hour: peakHour ? { hour: peakHour[0], activity: peakHour[1] } : null,
        peak_day: peakDay ? { day: peakDay[0], activity: peakDay[1] } : null,
        activity_by_type: {
          access: activityLogs.filter(l => l.type === "access").length,
          search: activityLogs.filter(l => l.type === "search").length,
          tool_call: activityLogs.filter(l => l.type === "tool_call").length
        },
        crud_operations: crudOperations,
        by_day: dailyActivity,
        by_hour: hourlyActivity
      };
    }

    const responseText = JSON.stringify(result, null, 2);
    
    // Add setup hint if this is the first analytics call
    const isFirstRun = filteredLogs.length === 0 && result.access;
    const hint = isFirstRun 
      ? "\n\n💡 SETUP HINT: Add 'docs/logs/' to your .gitignore file to prevent committing usage analytics data to version control."
      : "";

    return {
      content: [
        {
          type: "text",
          text: responseText + hint,
        },
      ],
    };
  } catch (error) {
    // No usage data available yet
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            message: "No usage data available yet. Start using the knowledge base to generate analytics.",
            period: {
              start: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
              end: new Date().toISOString(),
              days: days
            },
            setup_hint: "💡 TIP: Add 'docs/logs/' to your .gitignore file to keep analytics data private"
          }, null, 2),
        },
      ],
    };
  }
};