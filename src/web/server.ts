/**
 * Web server setup for the Knowledge Tree MCP
 * Provides a web interface with real-time updates via WebSocket
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import type { WebServerConfig, WebContext } from './types.js';
import { handleWebSocketMessage } from './handlers.js';
import type { ServerContext } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Create and configure the web server
 */
export async function createWebServer(
  config: WebServerConfig,
  context: WebContext
): Promise<any> {
  const webServer = fastify();
  
  // Register WebSocket plugin
  await webServer.register(fastifyWebsocket);
  
  // Serve static files from public directory
  const publicDir = config.publicDir || join(__dirname, '..', '..', 'public');
  await webServer.register(fastifyStatic, {
    root: publicDir,
    prefix: '/'
  });
  
  // WebSocket endpoint
  webServer.register(async (fastify: any) => {
    fastify.get('/ws', { websocket: true }, (connection: any) => {
      const ws = connection.socket;
      
      // Add to clients set (use the original server context's wsClients)
      context.serverContext.wsClients.add(ws);
      
      // Handle incoming messages
      ws.on('message', async (message: string) => {
        await handleWebSocketMessage(message, ws, context);
      });
      
      // Handle disconnection
      ws.on('close', () => {
        context.serverContext.wsClients.delete(ws);
      });
      
      // Handle errors
      ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error);
        context.serverContext.wsClients.delete(ws);
      });
    });
  });
  
  // Health check endpoint
  webServer.get('/health', async (request, reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      clients: context.wsClients.size
    };
  });
  
  // API endpoint for knowledge base info
  webServer.get('/api/info', async (request, reply) => {
    const entries = await context.scanKnowledgeTree();
    return {
      total_entries: entries.length,
      knowledge_root: context.knowledgeRoot,
      connected_clients: context.wsClients.size,
      server_time: new Date().toISOString()
    };
  });

  // API endpoint for knowledge stats
  webServer.get('/api/stats', async (request, reply) => {
    try {
      const { statsKnowledgeHandler } = await import('../tools/stats.js');
      const result = await statsKnowledgeHandler(
        { include: ['summary', 'priorities', 'categories', 'orphaned'] },
        context.serverContext
      );
      
      // Extract the stats data from MCP response
      if (result.content && result.content[0] && result.content[0].text) {
        const statsText = result.content[0].text;
        const statsMatch = statsText.match(/```json\n([\s\S]*?)\n```/);
        if (statsMatch) {
          return JSON.parse(statsMatch[1]);
        }
      }
      
      throw new Error('Failed to parse stats data');
    } catch (error: any) {
      reply.code(500);
      return { error: 'Failed to fetch stats', details: error?.message || 'Unknown error' };
    }
  });

  // API endpoint for usage analytics
  webServer.get('/api/analytics', async (request, reply) => {
    try {
      const { usageAnalyticsHandler } = await import('../tools/analytics.js');
      const result = await usageAnalyticsHandler(
        { 
          days: parseInt((request.query as any)?.days) || 30,
          include: ['access', 'searches', 'tools', 'interface', 'patterns']
        },
        context.serverContext
      );
      
      // Extract the analytics data from MCP response
      if (result.content && result.content[0] && result.content[0].text) {
        const analyticsText = result.content[0].text;
        
        // Try to parse as direct JSON first (no markdown wrapping)
        try {
          return JSON.parse(analyticsText);
        } catch (directParseError) {
          // If direct parsing fails, try markdown code block format
          const analyticsMatch = analyticsText.match(/```json\n([\s\S]*?)\n```/);
          if (analyticsMatch) {
            return JSON.parse(analyticsMatch[1]);
          }
          throw directParseError;
        }
      }
      
      throw new Error('Failed to parse analytics data');
    } catch (error: any) {
      reply.code(500);
      return { error: 'Failed to fetch analytics', details: error?.message || 'Unknown error' };
    }
  });
  
  return webServer;
}

/**
 * Start the web server
 */
export async function startWebServer(
  webServer: any,
  config: WebServerConfig
): Promise<void> {
  try {
    const host = config.host || '0.0.0.0';
    await webServer.listen({ port: config.port, host });
    console.error(`🌐 Web interface available at: http://localhost:${config.port}`);
  } catch (error) {
    console.error(`Failed to start web server: ${error}`);
    throw error;
  }
}

/**
 * Stop the web server gracefully
 */
export async function stopWebServer(webServer: any): Promise<void> {
  if (webServer) {
    await webServer.close();
  }
}

/**
 * WebServer class wrapper for easier integration
 */
export class WebServer {
  private server: any;
  private config: WebServerConfig;
  private context: WebContext;

  constructor(config: {
    port: number;
    knowledgeRoot: string;
    wsClients: Set<any>;
    context: ServerContext;
  }) {
    this.config = {
      port: config.port,
      host: '0.0.0.0',
      publicDir: join(__dirname, '..', '..', 'public')
    };
    
    this.context = {
      knowledgeRoot: config.knowledgeRoot,
      wsClients: config.wsClients,
      serverContext: config.context, // Keep reference to original context
      scanKnowledgeTree: config.context.scanKnowledgeTree.bind(config.context),
      searchKnowledge: async (args: any) => {
        // Import dynamically to avoid circular dependencies
        const { searchKnowledgeHandler } = await import('../tools/search.js');
        return searchKnowledgeHandler(args, config.context);
      },
      getKnowledgeStats: async (args: any) => {
        const { statsKnowledgeHandler } = await import('../tools/stats.js');
        // Use the server context directly instead of config.context to ensure proper scanKnowledgeTree binding
        return statsKnowledgeHandler(args, {
          ...config.context,
          scanKnowledgeTree: config.context.scanKnowledgeTree.bind(config.context)
        });
      },
      getRecentKnowledge: async (args: any) => {
        const { recentKnowledgeHandler } = await import('../tools/recent.js');
        return recentKnowledgeHandler(args, config.context);
      },
      logWebView: async (metadata: any) => {
        await config.context.logUsage({
          timestamp: new Date().toISOString(),
          type: "web_view",
          metadata
        });
      }
    };
  }

  async start(): Promise<void> {
    this.server = await createWebServer(this.config, this.context);
    await startWebServer(this.server, this.config);
  }

  async stop(): Promise<void> {
    await stopWebServer(this.server);
  }
}