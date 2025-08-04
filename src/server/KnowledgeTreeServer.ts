/**
 * Main Knowledge Tree MCP Server class
 * Coordinates all server components and manages lifecycle
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { join, resolve } from "path";
import { dirname } from "path";
import { fileURLToPath } from "url";
import type { ServerConfig, ServerOptions, ServerState, WSClient } from './types.js';
import { MCPHandlers } from './MCPHandlers.js';
import { ServerContextImpl } from './ServerContext.js';
import { ensureLogsDirectory } from '../utils/index.js';
import { SERVER_DEFAULTS } from '../constants/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Main server class for Knowledge Tree MCP
 * Implements the facade pattern to coordinate all server components
 */
export class KnowledgeTreeServer {
  private state: ServerState;
  private options: ServerOptions;
  private context: ServerContextImpl;
  private handlers: MCPHandlers;

  constructor(config: ServerConfig) {
    // Process and validate configuration
    this.options = this.processConfig(config);
    
    // Initialize server state
    this.state = {
      mcpServer: new Server(
        MCPHandlers.getServerInfo(),
        MCPHandlers.getCapabilities()
      ),
      wsClients: new Set<WSClient>(),
    };

    // Create server context for tool handlers
    this.context = new ServerContextImpl(
      this.options, 
      this.state.wsClients as any
    );

    // Set up MCP protocol handlers
    this.handlers = new MCPHandlers(
      this.state.mcpServer, 
      this.context
    );

    // Ensure logs directory exists
    this.initializeLogsDirectory();
  }

  /**
   * Process and validate server configuration
   */
  private processConfig(config: ServerConfig): ServerOptions {
    // Use default docs directory if not provided
    const knowledgeRoot = config.knowledgeRoot || 
      join(__dirname, "..", "..", SERVER_DEFAULTS.DOCS_DIR);
    
    // Resolve to absolute path
    const resolvedRoot = resolve(knowledgeRoot);
    
    return {
      knowledgeRoot: resolvedRoot,
      logsDir: join(resolvedRoot, SERVER_DEFAULTS.LOGS_SUBDIR),
      webPort: config.webPort,
      debug: config.debug || false
    };
  }

  /**
   * Initialize logs directory
   */
  private async initializeLogsDirectory(): Promise<void> {
    try {
      const created = await ensureLogsDirectory(this.options.logsDir);
      
      if (created && this.options.debug) {
        console.error("📁 Created logs directory for usage analytics");
        console.error("💡 TIP: Add 'docs/logs/' to your .gitignore file to keep analytics private");
      }
    } catch (error) {
      console.error("Failed to create logs directory:", error);
    }
  }

  /**
   * Start the MCP server
   */
  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.state.mcpServer.connect(transport);
    
    this.state.startedAt = new Date();
    
    console.error(`Knowledge Tree MCP server started`);
    console.error(`📁 Docs directory: ${this.options.knowledgeRoot}`);
    
    if (this.options.webPort) {
      await this.startWebServer();
    } else {
      console.error(`💡 Tip: Use --port <number> to enable web interface`);
    }
  }

  /**
   * Start the web interface server
   */
  private async startWebServer(): Promise<void> {
    try {
      // Dynamically import web server module to avoid loading unnecessary dependencies
      const { WebServer } = await import('../web/server.js');
      
      const webServer = new WebServer({
        port: this.options.webPort!,
        knowledgeRoot: this.options.knowledgeRoot,
        wsClients: this.state.wsClients,
        context: this.context
      });

      await webServer.start();
      this.state.webServer = webServer;
      
      console.error(`🌐 Web interface available at: http://localhost:${this.options.webPort}`);
    } catch (error) {
      console.error(`Failed to start web server: ${error}`);
      console.error(`Continuing without web interface...`);
    }
  }

  /**
   * Stop the server gracefully
   */
  async stop(): Promise<void> {
    // Close web server if running
    if (this.state.webServer) {
      await this.state.webServer.stop();
    }

    // Close all WebSocket connections
    for (const client of this.state.wsClients) {
      try {
        client.socket.close();
      } catch (error) {
        // Ignore errors during shutdown
      }
    }
    this.state.wsClients.clear();

    // Note: MCP server doesn't have a stop method
    console.error("Knowledge Tree MCP server stopped");
  }

  /**
   * Get server statistics
   */
  getStats() {
    return {
      uptime: this.state.startedAt ? 
        Date.now() - this.state.startedAt.getTime() : 0,
      wsClients: this.state.wsClients.size,
      knowledgeRoot: this.options.knowledgeRoot,
      webPort: this.options.webPort
    };
  }

  /**
   * Create server from command line arguments
   */
  static fromArgs(args: string[]): KnowledgeTreeServer {
    let docsPath: string | undefined;
    let webPort: number | undefined;
    let debug = false;

    // Simple argument parsing
    for (let i = 0; i < args.length; i++) {
      if ((args[i] === "--docs" || args[i] === "-d") && args[i + 1]) {
        docsPath = args[i + 1];
        i++; // Skip next arg
      } else if ((args[i] === "--port" || args[i] === "-p") && args[i + 1]) {
        const portValue = parseInt(args[i + 1], 10);
        if (!isNaN(portValue) && portValue > 0 && portValue < 65536) {
          webPort = portValue;
        } else {
          console.error(`Invalid port number: ${args[i + 1]}. Port must be between 1 and 65535.`);
        }
        i++; // Skip next arg
      } else if (args[i] === "--debug") {
        debug = true;
      } else if (args[i] === "--help" || args[i] === "-h") {
        console.log(`
Knowledge Tree MCP Server

Usage: knowledge-tree-mcp [options]

Options:
  --docs, -d <path>    Path to documentation directory (default: ./docs)
  --port, -p <number>  Port for web interface (optional)
  --debug              Enable debug logging
  --help, -h           Show this help message

Examples:
  knowledge-tree-mcp
  knowledge-tree-mcp --docs /path/to/docs
  knowledge-tree-mcp --port 3000
  knowledge-tree-mcp --docs ./my-docs --port 8080 --debug
`);
        process.exit(0);
      }
    }

    return new KnowledgeTreeServer({
      knowledgeRoot: docsPath,
      webPort,
      debug
    });
  }
}