/**
 * Logging utilities for Knowledge Tree MCP
 * Handles usage tracking, analytics, and log management
 */

import { join } from 'path';
import { appendToFile, ensureDirectory, fileExists, readFile } from './fileSystem.js';
import type { UsageLogEntry, UsageStats, KnowledgeEntry } from '../types/index.js';
import { FILE_CONSTANTS } from '../constants/index.js';

/**
 * Logs a usage entry to the JSONL log file
 * @param logsDir - Directory for log files
 * @param entry - Usage log entry to write
 */
export async function logUsage(logsDir: string, entry: UsageLogEntry): Promise<void> {
  try {
    const logFile = join(logsDir, FILE_CONSTANTS.USAGE_LOG_FILE);
    const logLine = JSON.stringify({
      ...entry,
      timestamp: new Date().toISOString()
    }) + '\n';
    
    await appendToFile(logFile, logLine);
  } catch (error) {
    console.error('Failed to log usage:', error);
  }
}

/**
 * Logs an access event
 * @param logsDir - Directory for log files
 * @param path - Path that was accessed
 * @param metadata - Additional metadata
 */
export async function logAccess(
  logsDir: string, 
  path: string, 
  metadata?: Record<string, any>
): Promise<void> {
  await logUsage(logsDir, {
    timestamp: new Date().toISOString(),
    type: 'access',
    path,
    metadata
  });
}

/**
 * Logs a search event
 * @param logsDir - Directory for log files
 * @param query - Search query
 * @param metadata - Additional metadata
 */
export async function logSearch(
  logsDir: string,
  query: string, 
  metadata?: Record<string, any>
): Promise<void> {
  await logUsage(logsDir, {
    timestamp: new Date().toISOString(),
    type: 'search',
    query,
    metadata
  });
}

/**
 * Logs a tool call event
 * @param logsDir - Directory for log files
 * @param tool - Tool name
 * @param metadata - Additional metadata
 */
export async function logToolCall(
  logsDir: string,
  tool: string, 
  metadata?: Record<string, any>
): Promise<void> {
  await logUsage(logsDir, {
    timestamp: new Date().toISOString(),
    type: 'tool_call',
    tool,
    metadata
  });
}

/**
 * Logs a web view event
 * @param logsDir - Directory for log files
 * @param metadata - Event metadata
 */
export async function logWebView(
  logsDir: string,
  metadata: Record<string, any>
): Promise<void> {
  await logUsage(logsDir, {
    timestamp: new Date().toISOString(),
    type: 'web_view',
    metadata
  });
}

/**
 * Ensures the logs directory exists with proper setup
 * @param logsDir - Directory path for logs
 */
export async function ensureLogsDirectory(logsDir: string): Promise<boolean> {
  try {
    const wasCreated = await ensureDirectory(logsDir);
    
    // Log setup hint if directory was just created
    if (wasCreated) {
      console.log('📁 Created logs directory for usage analytics');
      console.log(`💡 TIP: Add '${FILE_CONSTANTS.DOCS_DIR}/${FILE_CONSTANTS.LOGS_DIR}/' to your .gitignore file to keep analytics private`);
    }
    return wasCreated;
  } catch (error) {
    console.error('Failed to create logs directory:', error);
    return false;
  }
}

/**
 * Reads and parses usage logs from the JSONL file
 * @param logsDir - Directory containing log files
 * @param days - Number of days to look back (optional)
 * @returns Array of filtered usage log entries
 */
export async function readUsageLogs(
  logsDir: string, 
  days?: number
): Promise<UsageLogEntry[]> {
  const logFile = join(logsDir, FILE_CONSTANTS.USAGE_LOG_FILE);
  
  // Check if log file exists
  if (!await fileExists(logFile)) {
    return [];
  }

  // Read and parse log entries
  const logContent = await readFile(logFile);
  const lines = logContent.trim().split('\n').filter(line => line.trim());
  const allLogs: UsageLogEntry[] = [];
  
  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      allLogs.push(entry);
    } catch (error) {
      // Skip invalid log lines
    }
  }

  // Filter by date range if specified
  if (days) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return allLogs.filter(log => 
      new Date(log.timestamp) >= cutoffDate
    );
  }

  return allLogs;
}

/**
 * Generates usage statistics from log entries
 * @param logs - Array of usage log entries
 * @param days - Number of days covered
 * @param knowledgeRoot - Root directory of knowledge entries
 * @returns Computed usage statistics
 */
export async function computeUsageStats(logs: UsageLogEntry[], days: number, knowledgeRoot: string): Promise<UsageStats> {
  const now = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Initialize counters
  const accessCounts: Record<string, number> = {};
  const lastAccess: Record<string, string> = {};
  const queryCounts: Record<string, number> = {};
  const lastSearch: Record<string, string> = {};
  const toolUsage: Record<string, number> = {};
  const byHour: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  
  let wildcardCount = 0;

  // Process logs
  for (const log of logs) {
    const date = new Date(log.timestamp);
    const hour = date.getHours().toString();
    const day = date.toISOString().split('T')[0];

    // Count by type
    switch (log.type) {
      case 'access':
        if (log.path) {
          accessCounts[log.path] = (accessCounts[log.path] || 0) + 1;
          lastAccess[log.path] = log.timestamp;
          
          // Extract priority from the actual entry
          try {
            const fullPath = join(knowledgeRoot, log.path);
            const entryContent = await readFile(fullPath);
            const entry: KnowledgeEntry = JSON.parse(entryContent);
            if (entry.priority && ['CRITICAL', 'REQUIRED', 'COMMON', 'EDGE-CASE'].includes(entry.priority)) {
              byPriority[entry.priority] = (byPriority[entry.priority] || 0) + 1;
            }
          } catch (error) {
            // Entry might not exist anymore, skip
          }
        }
        break;
        
      case 'search':
        if (log.query) {
          queryCounts[log.query] = (queryCounts[log.query] || 0) + 1;
          lastSearch[log.query] = log.timestamp;
          
          if (log.query.includes('*') || log.query.includes('?')) {
            wildcardCount++;
          }
        }
        break;
        
      case 'tool_call':
        if (log.tool) {
          toolUsage[log.tool] = (toolUsage[log.tool] || 0) + 1;
        }
        break;
    }

    // Time-based patterns
    byHour[hour] = (byHour[hour] || 0) + 1;
    byDay[day] = (byDay[day] || 0) + 1;
  }

  // Compute top entries
  const mostAccessed = Object.entries(accessCounts)
    .map(([path, count]) => ({ path, count, last_access: lastAccess[path] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const popularQueries = Object.entries(queryCounts)
    .map(([query, count]) => ({ query, count, last_search: lastSearch[query] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    period: {
      start: startDate.toISOString(),
      end: now.toISOString(),
      days
    },
    access: {
      total_accesses: logs.filter(l => l.type === 'access').length,
      unique_entries: Object.keys(accessCounts).length,
      most_accessed: mostAccessed,
      access_patterns: {
        by_hour: byHour,
        by_day: byDay,
        by_priority: byPriority
      }
    },
    searches: {
      total_searches: logs.filter(l => l.type === 'search').length,
      unique_queries: Object.keys(queryCounts).length,
      popular_queries: popularQueries,
      wildcard_usage: wildcardCount
    },
    tools: {
      total_tool_calls: logs.filter(l => l.type === 'tool_call').length,
      tool_usage: toolUsage
    }
  };
}