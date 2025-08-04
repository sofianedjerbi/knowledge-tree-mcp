/**
 * Server context implementation
 * Provides shared functionality for tool handlers
 */

import { join } from 'path';
import type { ServerContext, UsageLogEntry } from '../types/index.js';
import type { ServerOptions, WSClient } from './types.js';
import {
  scanKnowledgeTree as scanTree,
  logUsage,
  logAccess,
  logSearch,
  logToolCall,
  readFile
} from '../utils/index.js';

/**
 * Implementation of the ServerContext interface
 * This class encapsulates shared server functionality that tools need
 */
export class ServerContextImpl implements ServerContext {
  public readonly knowledgeRoot: string;
  public readonly logsDir: string;
  public readonly wsClients: Set<any>;
  
  constructor(private options: ServerOptions, wsClients: Set<any>) {
    this.knowledgeRoot = options.knowledgeRoot;
    this.logsDir = options.logsDir;
    this.wsClients = wsClients;
  }

  /**
   * Log general usage activity
   */
  async logUsage(entry: UsageLogEntry): Promise<void> {
    await logUsage(this.logsDir, entry);
  }

  /**
   * Log knowledge entry access
   */
  async logAccess(path: string, metadata?: Record<string, any>): Promise<void> {
    await logAccess(this.logsDir, path, metadata);
  }

  /**
   * Log search activity
   */
  async logSearch(query: string, metadata?: Record<string, any>): Promise<void> {
    await logSearch(this.logsDir, query, metadata);
  }

  /**
   * Log tool usage
   */
  async logToolCall(tool: string, metadata?: Record<string, any>): Promise<void> {
    await logToolCall(this.logsDir, tool, metadata);
  }

  /**
   * Scan the knowledge tree for all entries
   */
  async scanKnowledgeTree(): Promise<string[]> {
    return scanTree(this.knowledgeRoot);
  }

  /**
   * Read knowledge entry with depth traversal
   */
  async readWithDepth(
    fullPath: string, 
    relativePath: string, 
    depth: number, 
    visited: Set<string>
  ): Promise<any> {
    // Log knowledge access
    await this.logAccess(relativePath, { depth, visited_count: visited.size });
    
    // Prevent circular references
    if (visited.has(relativePath)) {
      return { circular_reference: relativePath };
    }
    
    visited.add(relativePath);
    
    try {
      const content = await readFile(fullPath);
      const knowledge = JSON.parse(content);
      
      // Base result
      const result: any = {
        path: relativePath,
        ...knowledge
      };
      
      // If depth > 1 and has links, recursively fetch linked entries
      if (depth > 1 && knowledge.related_to && knowledge.related_to.length > 0) {
        result.linked_entries = {};
        
        for (const link of knowledge.related_to) {
          const linkedFullPath = join(this.knowledgeRoot, link.path);
          
          try {
            result.linked_entries[link.path] = {
              relationship: link.relationship,
              description: link.description,
              content: await this.readWithDepth(
                linkedFullPath, 
                link.path, 
                depth - 1, 
                new Set(visited)
              )
            };
          } catch (error) {
            result.linked_entries[link.path] = {
              relationship: link.relationship,
              description: link.description,
              error: "Failed to load linked entry"
            };
          }
        }
      }
      
      return result;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Broadcast updates to all connected WebSocket clients
   */
  async broadcastUpdate(type: string, data: any): Promise<void> {
    if (this.wsClients.size === 0) return;
    
    const message = JSON.stringify({ type, ...data });
    
    for (const client of this.wsClients) {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          await client.send(message);
        } catch (error) {
          // Remove dead clients
          this.wsClients.delete(client);
        }
      }
    }
  }
}