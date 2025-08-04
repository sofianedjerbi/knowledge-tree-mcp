/**
 * Server, tool, and MCP-related types
 */

import type { Priority, RelationshipType, KnowledgeRelation } from './KnowledgeEntry.js';

export interface ServerContext {
  knowledgeRoot: string;
  logsDir: string;
  wsClients: Set<any>;
  logUsage: (entry: any) => Promise<void>;
  logAccess: (path: string, metadata?: Record<string, any>) => Promise<void>;
  logSearch: (query: string, metadata?: Record<string, any>) => Promise<void>;
  logToolCall: (tool: string, metadata?: Record<string, any>) => Promise<void>;
  broadcastUpdate: (type: string, data: any) => Promise<void>;
  scanKnowledgeTree: () => Promise<string[]>;
  readWithDepth: (fullPath: string, relativePath: string, depth: number, visited: Set<string>) => Promise<any>;
}

export interface MCPResponse {
  content: Array<{
    type: "text";
    text: string;
  }>;
}

export type ToolHandler = (args: any, context: ServerContext) => Promise<MCPResponse>;

// Export and format types
export type ExportFormat = "markdown" | "html";
export type SearchScope = "problem" | "solution" | "code" | "path" | "tags" | "all";
export type SortOption = "relevance" | "priority" | "path" | "recent";
export type IndexFormat = "tree" | "list" | "summary" | "categories";
export type StatsInclude = "summary" | "priorities" | "categories" | "orphaned" | "popular" | "coverage";
export type AnalyticsInclude = "access" | "searches" | "tools" | "interface" | "patterns";
export type RecentChangeType = "all" | "added" | "modified";

// Tool argument interfaces
export interface SearchArgs {
  query?: string;
  priority?: Priority[];
  category?: string;
  searchIn?: SearchScope[];
  regex?: boolean;
  caseSensitive?: boolean;
  limit?: number;
  sortBy?: SortOption;
}

export interface AddArgs {
  path: string;
  content: string;
}

export interface UpdateArgs {
  path: string;
  new_path?: string;          // Explicit new path for the entry
  regenerate_path?: boolean;  // New flag to enable path regeneration
  updates: {
    title?: string;
    slug?: string;
    priority?: Priority;
    category?: string;
    tags?: string[];
    problem?: string;
    context?: string;
    solution?: string;
    examples?: Array<{
      title?: string;
      description?: string;
      code?: string;
      language?: string;
    }>;
    code?: string;
    related_to?: KnowledgeRelation[];
    author?: string;
    version?: string;
  };
}

export interface DeleteArgs {
  path: string;
  cleanup_links?: boolean;
}

export interface LinkArgs {
  from: string;
  to: string;
  relationship: RelationshipType;
  description?: string;
}

export interface ValidateArgs {
  path?: string;
  fix?: boolean;
}

export interface ExportArgs {
  format?: ExportFormat;
  filter?: {
    priority?: Priority[];
    category?: string;
  };
  include_links?: boolean;
}

export interface IndexArgs {
  format?: IndexFormat;
  include_content?: boolean;
  max_entries?: number;
}

export interface StatsArgs {
  include?: StatsInclude[];
}

export interface RecentArgs {
  days?: number;
  limit?: number;
  type?: RecentChangeType;
}

export interface AnalyticsArgs {
  days?: number;
  include?: AnalyticsInclude[];
}

export interface HelpArgs {
  topic?: "overview" | "creating" | "linking" | "searching" | "validating" | "examples";
}