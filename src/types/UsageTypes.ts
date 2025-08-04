/**
 * Usage analytics and logging types
 */

export type UsageType = "access" | "search" | "web_view" | "tool_call";

export interface UsageLogEntry {
  timestamp: string;
  type: UsageType;
  path?: string;
  query?: string;
  tool?: string;
  user_agent?: string;
  ip?: string;
  metadata?: Record<string, any>;
}

export interface AccessPatterns {
  by_hour: Record<string, number>;
  by_day: Record<string, number>;
  by_priority: Record<string, number>;
}

export interface UsageStats {
  period: {
    start: string;
    end: string;
    days: number;
  };
  access: {
    total_accesses: number;
    unique_entries: number;
    most_accessed: Array<{ path: string; count: number; last_access: string }>;
    access_patterns: AccessPatterns;
  };
  searches: {
    total_searches: number;
    unique_queries: number;
    popular_queries: Array<{ query: string; count: number; last_search: string }>;
    wildcard_usage: number;
  };
  tools: {
    total_tool_calls: number;
    tool_usage: Record<string, number>;
  };
}