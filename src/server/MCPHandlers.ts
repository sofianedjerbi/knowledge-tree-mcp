/**
 * MCP Protocol handlers
 * Manages the Model Context Protocol request/response cycle
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { join } from 'path';
import type { ServerContext } from '../types/index.js';
import { toolHandlers, toolDefinitions } from '../tools/index.js';
import { getDescriptionFromPath } from '../utils/index.js';

/**
 * MCP Protocol handler class
 * Implements all MCP protocol methods for the Knowledge Tree server
 */
export class MCPHandlers {
  constructor(
    private server: Server,
    private context: ServerContext
  ) {
    this.setupHandlers();
  }

  /**
   * Set up all MCP protocol handlers
   */
  private setupHandlers(): void {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = await this.context.scanKnowledgeTree();
      return {
        resources: resources.map((path) => ({
          uri: `knowledge://${path}`,
          name: path,
          description: getDescriptionFromPath(path),
          mimeType: "application/json",
        })),
      };
    });

    // Read a specific resource
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;
      
      // Parse depth from URI query params (e.g., knowledge://path/file.json?depth=2)
      const urlParts = uri.split('?');
      const path = urlParts[0].replace("knowledge://", "");
      const params = new URLSearchParams(urlParts[1] || '');
      const depth = parseInt(params.get('depth') || '1', 10);
      
      const fullPath = join(this.context.knowledgeRoot, path);
      
      try {
        const result = await this.context.readWithDepth(
          fullPath, 
          path, 
          depth, 
          new Set()
        );
        
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        throw new Error(`Failed to read knowledge entry: ${error}`);
      }
    });

    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: toolDefinitions,
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Log tool call
      await this.context.logToolCall(name, args);

      // Get the tool handler
      const handler = toolHandlers[name];
      if (!handler) {
        throw new Error(`Unknown tool: ${name}`);
      }

      // Execute the tool handler with context
      const response = await handler(args, this.context);
      
      // Return the response as expected by MCP SDK
      return response as any;
    });
  }

  /**
   * Get server capabilities for MCP
   */
  static getCapabilities() {
    return {
      capabilities: {
        resources: {},
        tools: {},
      },
    };
  }

  /**
   * Get server info for MCP
   */
  static getServerInfo() {
    return {
      name: "knowledge",
      version: "1.0.0",
    };
  }
}