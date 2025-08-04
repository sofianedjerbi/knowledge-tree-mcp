/**
 * Web-specific types for the Knowledge Tree MCP web interface
 */

import type { 
  KnowledgeEntry, 
  Priority, 
  SearchScope, 
  SortOption,
  StatsInclude,
  RecentChangeType,
  AnalyticsInclude
} from '../types/index.js';

/**
 * WebSocket message types
 */
export type WebSocketMessageType = 
  | 'getAll'
  | 'search' 
  | 'stats'
  | 'recent'
  | 'entryAdded'
  | 'entryUpdated'
  | 'entryDeleted'
  | 'allEntries'
  | 'searchResults'
  | 'statsResults'
  | 'recentResults';

/**
 * Base WebSocket message structure
 */
export interface WebSocketMessage {
  type: WebSocketMessageType;
  [key: string]: any;
}

/**
 * Client request messages
 */
export interface GetAllMessage extends WebSocketMessage {
  type: 'getAll';
}

export interface SearchMessage extends WebSocketMessage {
  type: 'search';
  query?: string;
  priority?: Priority[];
  category?: string;
  searchIn?: SearchScope[];
  regex?: boolean;
  caseSensitive?: boolean;
  limit?: number;
  sortBy?: SortOption;
}

export interface StatsMessage extends WebSocketMessage {
  type: 'stats';
  include?: StatsInclude[];
}

export interface RecentMessage extends WebSocketMessage {
  type: 'recent';
  days?: number;
  limit?: number;
  changeType?: RecentChangeType;
}

/**
 * Server response messages
 */
export interface AllEntriesMessage extends WebSocketMessage {
  type: 'allEntries';
  entries: Array<{
    path: string;
    data: KnowledgeEntry;
  }>;
}

export interface SearchResultsMessage extends WebSocketMessage {
  type: 'searchResults';
  total: number;
  showing: number;
  results: any[];
}

export interface StatsResultsMessage extends WebSocketMessage {
  type: 'statsResults';
  [key: string]: any;
}

export interface RecentResultsMessage extends WebSocketMessage {
  type: 'recentResults';
  period: any;
  summary: any;
  entries: any[];
}

/**
 * Server broadcast messages for real-time updates
 */
export interface EntryAddedMessage extends WebSocketMessage {
  type: 'entryAdded';
  path: string;
  data: KnowledgeEntry;
}

export interface EntryUpdatedMessage extends WebSocketMessage {
  type: 'entryUpdated';
  path: string;
  data: KnowledgeEntry;
}

export interface EntryDeletedMessage extends WebSocketMessage {
  type: 'entryDeleted';
  path: string;
}

/**
 * WebSocket connection interface
 */
export interface WebSocketConnection {
  socket: any; // WebSocket instance
  send: (message: string) => Promise<void>;
  close: () => void;
}

/**
 * Web server configuration
 */
export interface WebServerConfig {
  port: number;
  host?: string;
  publicDir?: string;
}

/**
 * Web server context for handlers
 */
export interface WebContext {
  knowledgeRoot: string;
  wsClients: Set<any>;
  serverContext: any; // Reference to original ServerContext
  scanKnowledgeTree: () => Promise<string[]>;
  searchKnowledge: (args: any) => Promise<any>;
  getKnowledgeStats: (args: any) => Promise<any>;
  getRecentKnowledge: (args: any) => Promise<any>;
  logWebView: (metadata: any) => Promise<void>;
}