/**
 * Server-specific type definitions
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

/**
 * Configuration options for the Knowledge Tree server
 */
export interface ServerConfig {
  /** Root directory for knowledge entries */
  knowledgeRoot?: string;
  /** Optional port for web interface */
  webPort?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Internal server options after processing
 */
export interface ServerOptions extends ServerConfig {
  /** Root directory for knowledge entries (resolved to absolute path) */
  knowledgeRoot: string;
  /** Logs directory path (computed from knowledgeRoot) */
  logsDir: string;
}

/**
 * WebSocket client tracking
 */
export interface WSClient {
  socket: any;
  connectedAt: Date;
  lastActivity: Date;
}

/**
 * Server state interface
 */
export interface ServerState {
  /** MCP server instance */
  mcpServer: Server;
  /** Web server instance (if enabled) */
  webServer?: any;
  /** Active WebSocket clients */
  wsClients: Set<WSClient>;
  /** Server start time */
  startedAt?: Date;
}