/**
 * Central export point for web interface functionality
 * 
 * This module provides all the necessary components for running
 * the optional web interface for the Knowledge Tree MCP server.
 */

import type { WebContext, WebServerConfig } from './types.js';
import { createWebServer, startWebServer, stopWebServer } from './server.js';

// Export types
export type {
  WebSocketMessageType,
  WebSocketMessage,
  GetAllMessage,
  SearchMessage,
  StatsMessage,
  RecentMessage,
  AllEntriesMessage,
  SearchResultsMessage,
  StatsResultsMessage,
  RecentResultsMessage,
  EntryAddedMessage,
  EntryUpdatedMessage,
  EntryDeletedMessage,
  WebSocketConnection,
  WebServerConfig,
  WebContext
} from './types.js';

// Export handlers
export {
  handleWebSocketMessage,
  broadcastUpdate
} from './handlers.js';

// Export server functions
export {
  createWebServer,
  startWebServer,
  stopWebServer,
  WebServer
} from './server.js';

/**
 * Factory function to create a complete web interface setup
 */
export async function setupWebInterface(
  port: number,
  context: WebContext,
  publicDir?: string
): Promise<{ server: any; start: () => Promise<void>; stop: () => Promise<void> }> {
  const config: WebServerConfig = {
    port,
    publicDir,
    host: '0.0.0.0'
  };
  
  const server = await createWebServer(config, context);
  
  return {
    server,
    start: async () => startWebServer(server, config),
    stop: async () => stopWebServer(server)
  };
}