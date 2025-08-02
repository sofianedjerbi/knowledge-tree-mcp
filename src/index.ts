#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { promises as fs } from "fs";
import { join, relative, resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface KnowledgeEntry {
  priority: "CRITICAL" | "REQUIRED" | "COMMON" | "EDGE-CASE";
  problem: string;
  solution: string;
  code?: string;
  examples?: Record<string, any>;
  related_to?: Array<{
    path: string;
    relationship: "related" | "supersedes" | "superseded_by" | "conflicts_with" | "implements" | "implemented_by";
    description?: string;
  }>;
}

interface UsageLogEntry {
  timestamp: string;
  type: "access" | "search" | "web_view" | "tool_call";
  path?: string;
  query?: string;
  tool?: string;
  user_agent?: string;
  ip?: string;
  metadata?: Record<string, any>;
}

interface UsageStats {
  period: {
    start: string;
    end: string;
    days: number;
  };
  access: {
    total_accesses: number;
    unique_entries: number;
    most_accessed: Array<{ path: string; count: number; last_access: string }>;
    access_patterns: {
      by_hour: Record<string, number>;
      by_day: Record<string, number>;
      by_priority: Record<string, number>;
    };
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

class KnowledgeTreeServer {
  private server: Server;
  private knowledgeRoot: string;
  private webPort?: number;
  private webServer?: any;
  private wsClients: Set<any> = new Set();
  private logsDir: string;

  constructor(knowledgeRoot?: string, webPort?: number) {
    // If no path provided, use the default docs directory inside the package
    if (!knowledgeRoot) {
      knowledgeRoot = join(__dirname, "..", "docs");
    }
    
    // Resolve to absolute path
    this.knowledgeRoot = resolve(knowledgeRoot);
    this.logsDir = join(this.knowledgeRoot, "logs");
    this.webPort = webPort;
    
    // Ensure logs directory exists
    this.ensureLogsDirectory();
    
    this.server = new Server(
      {
        name: "knowledge-tree-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = await this.scanKnowledgeTree();
      return {
        resources: resources.map((path) => ({
          uri: `knowledge://${path}`,
          name: path,
          description: this.getDescriptionFromPath(path),
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
      
      const fullPath = join(this.knowledgeRoot, path);
      
      try {
        const result = await this.readWithDepth(fullPath, path, depth, new Set());
        
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
        tools: [
          // 1. ESSENTIAL - Get help and understand the system
          {
            name: "help",
            description: "Get comprehensive help on using the Knowledge Tree MCP system",
            inputSchema: {
              type: "object",
              properties: {
                topic: {
                  type: "string",
                  enum: ["overview", "creating", "linking", "searching", "validating", "examples"],
                  description: "Specific help topic (optional)",
                },
              },
            },
          },

          // 2. CORE OPERATIONS - Basic CRUD for knowledge management
          {
            name: "add_knowledge",
            description: "Create a new knowledge entry with validation and auto-linking",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Path relative to docs (e.g., 'testing/forbidden/CRITICAL-no-mocks.json')",
                },
                priority: {
                  type: "string",
                  enum: ["CRITICAL", "REQUIRED", "COMMON", "EDGE-CASE"],
                  description: "Priority level",
                },
                problem: {
                  type: "string",
                  description: "Description of the problem",
                },
                solution: {
                  type: "string",
                  description: "How to solve the problem",
                },
                code: {
                  type: "string",
                  description: "Optional code example",
                },
                related_to: {
                  type: "array",
                  description: "Optional links to related knowledge entries",
                  items: {
                    type: "object",
                    properties: {
                      path: {
                        type: "string",
                        description: "Path to related entry",
                      },
                      relationship: {
                        type: "string",
                        enum: ["related", "supersedes", "superseded_by", "conflicts_with", "implements", "implemented_by"],
                        description: "Type of relationship",
                      },
                      description: {
                        type: "string",
                        description: "Optional description of the relationship",
                      },
                    },
                    required: ["path", "relationship"],
                  },
                },
              },
              required: ["path", "priority", "problem", "solution"],
            },
          },
          {
            name: "search_knowledge",
            description: "Find knowledge entries with advanced filtering and scoring",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query (searches in all text fields)",
                },
                priority: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: ["CRITICAL", "REQUIRED", "COMMON", "EDGE-CASE"],
                  },
                  description: "Filter by priority levels (multiple allowed)",
                },
                category: {
                  type: "string",
                  description: "Filter by category path (e.g., 'testing', 'architecture')",
                },
                searchIn: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: ["problem", "solution", "code", "path", "all"],
                  },
                  description: "Fields to search in (default: all)",
                  default: ["all"],
                },
                regex: {
                  type: "boolean",
                  description: "Use regex for search query",
                  default: false,
                },
                caseSensitive: {
                  type: "boolean",
                  description: "Case sensitive search",
                  default: false,
                },
                limit: {
                  type: "number",
                  description: "Maximum number of results",
                  default: 50,
                },
                sortBy: {
                  type: "string",
                  enum: ["relevance", "priority", "path", "recent"],
                  description: "Sort results by",
                  default: "relevance",
                },
              },
            },
          },
          {
            name: "update_knowledge",
            description: "Modify an existing knowledge entry with validation",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Path to the knowledge entry to update",
                },
                updates: {
                  type: "object",
                  properties: {
                    priority: {
                      type: "string",
                      enum: ["CRITICAL", "REQUIRED", "COMMON", "EDGE-CASE"],
                      description: "New priority level",
                    },
                    problem: {
                      type: "string",
                      description: "Updated problem description",
                    },
                    solution: {
                      type: "string",
                      description: "Updated solution",
                    },
                    code: {
                      type: "string",
                      description: "Updated code example",
                    },
                    related_to: {
                      type: "array",
                      description: "Updated relationships",
                      items: {
                        type: "object",
                        properties: {
                          path: {
                            type: "string",
                          },
                          relationship: {
                            type: "string",
                            enum: ["related", "supersedes", "superseded_by", "conflicts_with", "implements", "implemented_by"],
                          },
                          description: {
                            type: "string",
                          },
                        },
                        required: ["path", "relationship"],
                      },
                    },
                  },
                  description: "Fields to update",
                },
              },
              required: ["path", "updates"],
            },
          },
          {
            name: "delete_knowledge",
            description: "Remove a knowledge entry and clean up all references",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Path to the knowledge entry to delete",
                },
                cleanup_links: {
                  type: "boolean",
                  description: "Remove references from other entries (default: true)",
                  default: true,
                },
              },
              required: ["path"],
            },
          },

          // 3. RELATIONSHIP MANAGEMENT - Connect knowledge entries
          {
            name: "link_knowledge",
            description: "Create relationships between existing knowledge entries",
            inputSchema: {
              type: "object",
              properties: {
                from: {
                  type: "string",
                  description: "Source knowledge path (e.g., 'testing/CRITICAL-no-mocks.json')",
                },
                to: {
                  type: "string",
                  description: "Target knowledge path to link to",
                },
                relationship: {
                  type: "string",
                  enum: ["related", "supersedes", "superseded_by", "conflicts_with", "implements", "implemented_by"],
                  description: "Type of relationship",
                },
                description: {
                  type: "string",
                  description: "Optional description of the relationship",
                },
              },
              required: ["from", "to", "relationship"],
            },
          },

          // 4. QUALITY ASSURANCE - Validate and maintain knowledge integrity
          {
            name: "validate_knowledge",
            description: "Check knowledge entries for errors and inconsistencies",
            inputSchema: {
              type: "object",
              properties: {
                path: {
                  type: "string",
                  description: "Optional: validate specific entry. If omitted, validates all entries",
                },
                fix: {
                  type: "boolean",
                  description: "Attempt to fix issues (like missing bidirectional links)",
                  default: false,
                },
              },
            },
          },

          // 5. EXPORT & SHARING - Generate documentation from knowledge
          {
            name: "export_knowledge",
            description: "Export knowledge base to various formats for documentation",
            inputSchema: {
              type: "object",
              properties: {
                format: {
                  type: "string",
                  enum: ["markdown", "json", "html"],
                  description: "Export format",
                  default: "markdown",
                },
                filter: {
                  type: "object",
                  properties: {
                    priority: {
                      type: "array",
                      items: {
                        type: "string",
                        enum: ["CRITICAL", "REQUIRED", "COMMON", "EDGE-CASE"],
                      },
                      description: "Filter by priorities",
                    },
                    category: {
                      type: "string",
                      description: "Filter by category",
                    },
                  },
                  description: "Optional filters",
                },
                include_links: {
                  type: "boolean",
                  description: "Include linked entries in export",
                  default: true,
                },
              },
            },
          },

          // 6. ANALYTICS & INSIGHTS - Understand your knowledge base
          {
            name: "stats_knowledge",
            description: "Get comprehensive statistics about your knowledge base",
            inputSchema: {
              type: "object",
              properties: {
                include: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: ["summary", "priorities", "categories", "orphaned", "popular", "coverage"],
                  },
                  description: "Which statistics to include (default: all)",
                  default: ["summary", "priorities", "categories", "orphaned", "popular"],
                },
              },
            },
          },
          {
            name: "recent_knowledge",
            description: "Get recently added or modified knowledge entries",
            inputSchema: {
              type: "object",
              properties: {
                days: {
                  type: "number",
                  description: "Number of days to look back (default: 7)",
                  default: 7,
                },
                limit: {
                  type: "number",
                  description: "Maximum number of entries to return (default: 20)",
                  default: 20,
                },
                type: {
                  type: "string",
                  enum: ["all", "added", "modified"],
                  description: "Type of changes to show (default: all)",
                  default: "all",
                },
              },
            },
          },
          {
            name: "usage_analytics",
            description: "Get comprehensive usage analytics for the knowledge base",
            inputSchema: {
              type: "object",
              properties: {
                days: {
                  type: "number",
                  description: "Number of days to analyze (default: 30)",
                  default: 30,
                },
                include: {
                  type: "array",
                  items: {
                    type: "string",
                    enum: ["access", "searches", "tools", "patterns"],
                  },
                  description: "Which analytics to include (default: all)",
                  default: ["access", "searches", "tools", "patterns"],
                },
              },
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      // Log tool call
      await this.logToolCall(name, args);

      switch (name) {
        case "search_knowledge":
          return await this.searchKnowledge(args);
        case "add_knowledge":
          return await this.addKnowledge(args);
        case "link_knowledge":
          return await this.linkKnowledge(args);
        case "validate_knowledge":
          return await this.validateKnowledge(args);
        case "help":
          return await this.getHelp(args);
        case "delete_knowledge":
          return await this.deleteKnowledge(args);
        case "update_knowledge":
          return await this.updateKnowledge(args);
        case "export_knowledge":
          return await this.exportKnowledge(args);
        case "stats_knowledge":
          return await this.getKnowledgeStats(args);
        case "recent_knowledge":
          return await this.getRecentKnowledge(args);
        case "usage_analytics":
          return await this.getUsageAnalytics(args);
        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });
  }

  private async ensureLogsDirectory() {
    try {
      const existed = await fs.access(this.logsDir).then(() => true).catch(() => false);
      await fs.mkdir(this.logsDir, { recursive: true });
      
      // Log setup hint if directory was just created
      if (!existed) {
        console.log("📁 Created logs directory for usage analytics");
        console.log("💡 TIP: Add 'docs/logs/' to your .gitignore file to keep analytics private");
      }
    } catch (error) {
      console.error("Failed to create logs directory:", error);
    }
  }

  private async logUsage(entry: UsageLogEntry) {
    try {
      const logFile = join(this.logsDir, "usage.jsonl");
      const logLine = JSON.stringify({
        ...entry,
        timestamp: new Date().toISOString()
      }) + "\n";
      
      await fs.appendFile(logFile, logLine);
    } catch (error) {
      console.error("Failed to log usage:", error);
    }
  }

  private async logAccess(path: string, metadata?: Record<string, any>) {
    await this.logUsage({
      timestamp: new Date().toISOString(),
      type: "access",
      path,
      metadata
    });
  }

  private async logSearch(query: string, metadata?: Record<string, any>) {
    await this.logUsage({
      timestamp: new Date().toISOString(),
      type: "search",
      query,
      metadata
    });
  }

  private async logToolCall(tool: string, metadata?: Record<string, any>) {
    await this.logUsage({
      timestamp: new Date().toISOString(),
      type: "tool_call",
      tool,
      metadata
    });
  }

  private async readWithDepth(
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
      const content = await fs.readFile(fullPath, "utf-8");
      const knowledge: KnowledgeEntry = JSON.parse(content);
      
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

  private async scanKnowledgeTree(): Promise<string[]> {
    const entries: string[] = [];
    const knowledgeRoot = this.knowledgeRoot;

    async function scan(dir: string) {
      try {
        const items = await fs.readdir(dir, { withFileTypes: true });
        
        for (const item of items) {
          const fullPath = join(dir, item.name);
          
          if (item.isDirectory()) {
            await scan(fullPath);
          } else if (item.name.endsWith(".json")) {
            entries.push(relative(knowledgeRoot, fullPath));
          }
        }
      } catch (error) {
        // Directory might not exist yet
      }
    }

    await scan(this.knowledgeRoot);
    return entries;
  }

  private getDescriptionFromPath(path: string): string {
    const parts = path.split("/");
    const filename = parts[parts.length - 1];
    const priority = filename.split("-")[0];
    const category = parts.slice(0, -1).join(" > ");
    
    return `${priority} knowledge in ${category}`;
  }

  private async searchKnowledge(args: any) {
    const { 
      query, 
      priority = [], 
      category, 
      searchIn = ["all"],
      regex = false,
      caseSensitive = false,
      limit = 50,
      sortBy = "relevance"
    } = args;
    
    // Log search activity
    if (query) {
      await this.logSearch(query, { priority, category, searchIn, sortBy });
    }
    
    const allEntries = await this.scanKnowledgeTree();
    let matches: Array<{ 
      path: string; 
      entry: KnowledgeEntry; 
      score: number;
      highlights: Record<string, string[]>;
    }> = [];

    // Priority mapping for sorting
    const priorityWeight = {
      "CRITICAL": 4,
      "REQUIRED": 3,
      "COMMON": 2,
      "EDGE-CASE": 1
    };

    for (const path of allEntries) {
      const fullPath = join(this.knowledgeRoot, path);
      
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        const entry: KnowledgeEntry = JSON.parse(content);
        
        let match = true;
        let score = 0;
        const highlights: Record<string, string[]> = {};
        
        // Priority filter (now supports array)
        if (priority.length > 0 && !priority.includes(entry.priority)) {
          match = false;
          continue;
        }
        
        // Category filter
        if (category && !path.toLowerCase().includes(category.toLowerCase())) {
          match = false;
          continue;
        }
        
        // Search query matching
        if (query) {
          // Check if query contains wildcards (* or ?)
          const hasWildcards = query.includes('*') || query.includes('?');
          
          let searchPattern;
          if (hasWildcards) {
            // Special case: single * means match everything
            if (query.trim() === '*') {
              searchPattern = /.*/i; // Match everything (case insensitive)
            } else {
              // Convert wildcards to regex: * = .*, ? = .
              const regexQuery = query
                .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex chars except * and ?
                .replace(/\\\*/g, '.*') // Convert \* back to .*
                .replace(/\\\?/g, '.'); // Convert \? back to .
              searchPattern = new RegExp(regexQuery, caseSensitive ? 'g' : 'gi');
            }
          } else {
            searchPattern = regex 
              ? new RegExp(query, caseSensitive ? 'g' : 'gi')
              : caseSensitive 
                ? query 
                : query.toLowerCase();
          }
          
          const fieldsToSearch = searchIn.includes("all") 
            ? ["problem", "solution", "code", "path"]
            : searchIn;
          
          let queryMatch = false;
          
          for (const field of fieldsToSearch) {
            let fieldValue = "";
            
            switch (field) {
              case "problem":
                fieldValue = entry.problem || "";
                break;
              case "solution":
                fieldValue = entry.solution || "";
                break;
              case "code":
                fieldValue = entry.code || "";
                break;
              case "path":
                fieldValue = path;
                break;
            }
            
            if (!fieldValue) continue;
            
            const testValue = caseSensitive ? fieldValue : fieldValue.toLowerCase();
            
            if (regex || hasWildcards) {
              const matches = (caseSensitive ? fieldValue : fieldValue.toLowerCase()).match(searchPattern);
              if (matches) {
                queryMatch = true;
                highlights[field] = matches;
                score += matches.length * (field === "problem" ? 3 : field === "solution" ? 2 : 1);
              }
            } else {
              if (testValue.includes(searchPattern)) {
                queryMatch = true;
                // Calculate score based on match position and frequency
                const matchCount = (testValue.match(new RegExp(searchPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
                score += matchCount * (field === "problem" ? 3 : field === "solution" ? 2 : 1);
                
                // Bonus for matches at the beginning
                if (testValue.startsWith(searchPattern)) {
                  score += 5;
                }
              }
            }
          }
          
          if (!queryMatch) {
            match = false;
          }
        }
        
        if (match) {
          // Add priority weight to score
          score += priorityWeight[entry.priority] || 0;
          
          matches.push({ path, entry, score, highlights });
        }
      } catch (error) {
        // Skip invalid entries
      }
    }

    // Sort results
    switch (sortBy) {
      case "relevance":
        matches.sort((a, b) => b.score - a.score);
        break;
      case "priority":
        matches.sort((a, b) => 
          (priorityWeight[b.entry.priority] || 0) - (priorityWeight[a.entry.priority] || 0)
        );
        break;
      case "path":
        matches.sort((a, b) => a.path.localeCompare(b.path));
        break;
      case "recent":
        // Would need file stats for this, using path as fallback
        matches.sort((a, b) => b.path.localeCompare(a.path));
        break;
    }
    
    // Apply limit
    const limitedMatches = matches.slice(0, limit);
    
    // Enrich matches with linked knowledge
    const enrichedMatches = limitedMatches.map(match => {
      const enriched: any = { 
        path: match.path,
        entry: match.entry,
        score: match.score,
        highlights: match.highlights
      };
      
      if (match.entry.related_to && match.entry.related_to.length > 0) {
        enriched.links = match.entry.related_to;
      }
      
      return enriched;
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            total: matches.length,
            showing: enrichedMatches.length,
            results: enrichedMatches
          }, null, 2),
        },
      ],
    };
  }


  private async addKnowledge(args: any) {
    const { path, priority, problem, solution, code, related_to } = args;
    
    // Validation: Required fields
    const validationErrors: string[] = [];
    
    if (!path || typeof path !== 'string' || path.trim() === '') {
      validationErrors.push("Path is required and must be non-empty");
    }
    
    if (!priority || !["CRITICAL", "REQUIRED", "COMMON", "EDGE-CASE"].includes(priority)) {
      validationErrors.push("Priority must be one of: CRITICAL, REQUIRED, COMMON, EDGE-CASE");
    }
    
    if (!problem || typeof problem !== 'string' || problem.trim() === '') {
      validationErrors.push("Problem description is required and must be non-empty");
    }
    
    if (!solution || typeof solution !== 'string' || solution.trim() === '') {
      validationErrors.push("Solution description is required and must be non-empty");
    }
    
    // Validate path format
    if (path) {
      const pathParts = path.split('/');
      const fileName = pathParts[pathParts.length - 1];
      
      // Check if filename starts with priority prefix
      const fileNameWithoutExt = fileName.replace('.json', '');
      if (!fileNameWithoutExt.startsWith(priority + '-')) {
        validationErrors.push(`Filename should start with priority prefix: ${priority}-`);
      }
      
      // Ensure valid path characters
      if (!/^[a-zA-Z0-9\-_\/]+(\.[a-zA-Z0-9]+)?$/.test(path)) {
        validationErrors.push("Path contains invalid characters. Use only letters, numbers, hyphens, underscores, and forward slashes");
      }
    }
    
    // Validate related_to entries
    if (related_to && Array.isArray(related_to)) {
      for (let i = 0; i < related_to.length; i++) {
        const link = related_to[i];
        if (!link.path || typeof link.path !== 'string') {
          validationErrors.push(`Related entry ${i + 1}: path is required`);
        }
        if (!link.relationship || !["related", "supersedes", "superseded_by", "conflicts_with", "implements"].includes(link.relationship)) {
          validationErrors.push(`Related entry ${i + 1}: invalid relationship type`);
        }
      }
    }
    
    if (validationErrors.length > 0) {
      return {
        content: [
          {
            type: "text",
            text: `Validation failed:\n${validationErrors.map(e => `- ${e}`).join('\n')}`,
          },
        ],
      };
    }
    
    // Ensure the path ends with .json
    const jsonPath = path.endsWith('.json') ? path : `${path}.json`;
    const fullPath = join(this.knowledgeRoot, jsonPath);
    
    // Check if file already exists
    try {
      await fs.access(fullPath);
      validationErrors.push(`Entry already exists at ${jsonPath}. Use link_knowledge to add relationships to existing entries.`);
    } catch (error) {
      // File doesn't exist, which is what we want
    }
    
    // Return early if we have validation errors at this point
    if (validationErrors.length > 0) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Validation failed - entry NOT created:\n\n${validationErrors.map(e => `• ${e}`).join('\n\n')}\n\n💡 Fix these issues and try again.`,
          },
        ],
      };
    }
    
    // Create the directory structure if it doesn't exist
    const dir = dirname(fullPath);
    await fs.mkdir(dir, { recursive: true });
    
    // Create the knowledge entry
    const entry: KnowledgeEntry = {
      priority,
      problem,
      solution,
    };
    
    if (code) {
      entry.code = code;
    }
    
    // Validate all linked entries exist BEFORE creating the entry
    if (related_to && Array.isArray(related_to)) {
      const validatedLinks = [];
      const missingLinks: string[] = [];
      
      for (const link of related_to) {
        const linkPath = link.path.endsWith('.json') ? link.path : `${link.path}.json`;
        const linkFullPath = join(this.knowledgeRoot, linkPath);
        
        // Check if target exists
        try {
          await fs.access(linkFullPath);
          
          // Also validate that the linked entry is properly formatted
          try {
            const linkedContent = await fs.readFile(linkFullPath, "utf-8");
            const linkedEntry = JSON.parse(linkedContent);
            
            // Basic validation of linked entry
            if (!linkedEntry.priority || !linkedEntry.problem || !linkedEntry.solution) {
              validationErrors.push(`Linked entry ${linkPath} is invalid: missing required fields`);
            }
            
            validatedLinks.push({
              ...link,
              path: linkPath
            });
          } catch (parseError) {
            validationErrors.push(`Linked entry ${linkPath} has invalid JSON format`);
          }
        } catch (error) {
          missingLinks.push(linkPath);
        }
      }
      
      // Fail if any linked entries are missing
      if (missingLinks.length > 0) {
        validationErrors.push(`The following linked entries do not exist:\n${missingLinks.map(l => `  - ${l}`).join('\n')}\nCreate these entries first before linking to them.`);
      }
      
      if (validationErrors.length === 0 && validatedLinks.length > 0) {
        entry.related_to = validatedLinks;
      }
    }
    
    // Final validation check - don't create the file if there are errors
    if (validationErrors.length > 0) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Validation failed - entry NOT created:\n\n${validationErrors.map(e => `• ${e}`).join('\n\n')}\n\n💡 Fix these issues and try again.`,
          },
        ],
      };
    }
    
    // Write the file
    await fs.writeFile(fullPath, JSON.stringify(entry, null, 2));
    
    // Create bidirectional links only for symmetric relationships
    if (entry.related_to) {
      for (const link of entry.related_to) {
        if (link.relationship === "related" || link.relationship === "conflicts_with") {
          try {
            const targetPath = join(this.knowledgeRoot, link.path);
            const targetContent = await fs.readFile(targetPath, "utf-8");
            const targetEntry: KnowledgeEntry = JSON.parse(targetContent);
            
            if (!targetEntry.related_to) {
              targetEntry.related_to = [];
            }
            
            // Check if reverse link already exists
            const reverseExists = targetEntry.related_to.some(
              reverseLink => reverseLink.path === jsonPath
            );
            
            if (!reverseExists) {
              const reverseLink: any = {
                path: jsonPath,
                relationship: link.relationship,
                description: link.description
              };
              targetEntry.related_to.push(reverseLink);
              await fs.writeFile(targetPath, JSON.stringify(targetEntry, null, 2));
            }
          } catch (error) {
            // Continue if we can't create reverse link
          }
        }
      }
    }
    
    // Success response
    let responseText = `✅ Knowledge entry created successfully!\n\n📍 Location: ${jsonPath}`;
    
    if (entry.related_to && entry.related_to.length > 0) {
      responseText += `\n🔗 Links: ${entry.related_to.length} connection(s) established`;
      
      // Count bidirectional links created
      const bidirectionalCount = entry.related_to.filter(
        link => link.relationship === "related" || link.relationship === "conflicts_with"
      ).length;
      
      if (bidirectionalCount > 0) {
        responseText += `\n↔️  Bidirectional: ${bidirectionalCount} reverse link(s) created automatically`;
      }
    }
    
    responseText += `\n\n📊 Entry details:\n   Priority: ${priority}\n   Problem: ${problem.substring(0, 50)}${problem.length > 50 ? '...' : ''}`;
    
    // Broadcast the new entry to all WebSocket clients
    await this.broadcastUpdate('entryAdded', {
      path: jsonPath,
      data: entry
    });
    
    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
    };
  }

  private async linkKnowledge(args: any) {
    const { from, to, relationship, description } = args;
    
    // Ensure paths end with .json
    const fromPath = from.endsWith('.json') ? from : `${from}.json`;
    const toPath = to.endsWith('.json') ? to : `${to}.json`;
    
    const fromFullPath = join(this.knowledgeRoot, fromPath);
    const toFullPath = join(this.knowledgeRoot, toPath);
    
    // Read the source entry
    let fromEntry: KnowledgeEntry;
    try {
      const content = await fs.readFile(fromFullPath, "utf-8");
      fromEntry = JSON.parse(content);
    } catch (error) {
      throw new Error(`Cannot read source entry: ${fromPath}`);
    }
    
    // Verify target exists
    try {
      await fs.access(toFullPath);
    } catch (error) {
      throw new Error(`Target entry does not exist: ${toPath}`);
    }
    
    // Initialize related_to array if it doesn't exist
    if (!fromEntry.related_to) {
      fromEntry.related_to = [];
    }
    
    // Check if link already exists
    const existingLink = fromEntry.related_to.find(link => link.path === toPath);
    if (existingLink) {
      existingLink.relationship = relationship;
      if (description) existingLink.description = description;
    } else {
      // Add new link
      const newLink: any = { path: toPath, relationship };
      if (description) newLink.description = description;
      fromEntry.related_to.push(newLink);
    }
    
    // Save updated entry
    await fs.writeFile(fromFullPath, JSON.stringify(fromEntry, null, 2));
    
    // Create bidirectional links only for symmetric relationships
    if (relationship === "related" || relationship === "conflicts_with") {
      try {
        const targetContent = await fs.readFile(toFullPath, "utf-8");
        const targetEntry: KnowledgeEntry = JSON.parse(targetContent);
        
        if (!targetEntry.related_to) {
          targetEntry.related_to = [];
        }
        
        const reverseLink = targetEntry.related_to.find(link => link.path === fromPath);
        if (!reverseLink) {
          const newReverseLink: any = { 
            path: fromPath, 
            relationship: relationship
          };
          if (description) newReverseLink.description = description;
          targetEntry.related_to.push(newReverseLink);
          await fs.writeFile(toFullPath, JSON.stringify(targetEntry, null, 2));
        }
      } catch (error) {
        // Silently continue if we can't update the reverse link
      }
    }
    
    // Broadcast the updated entry
    await this.broadcastUpdate('entryUpdated', {
      path: fromPath,
      data: fromEntry
    });
    
    return {
      content: [
        {
          type: "text",
          text: `Link created: ${fromPath} ${relationship} ${toPath}`,
        },
      ],
    };
  }

  private async validateKnowledge(args: any) {
    const { path, fix } = args;
    const issues: string[] = [];
    let fixed = 0;
    
    const entriesToValidate: string[] = path 
      ? [path.endsWith('.json') ? path : `${path}.json`]
      : await this.scanKnowledgeTree();
    
    for (const entryPath of entriesToValidate) {
      const fullPath = join(this.knowledgeRoot, entryPath);
      
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        let entry: KnowledgeEntry;
        
        // Validate JSON format
        try {
          entry = JSON.parse(content);
        } catch (e) {
          issues.push(`${entryPath}: Invalid JSON format`);
          continue;
        }
        
        // Validate required fields
        if (!entry.priority || !["CRITICAL", "REQUIRED", "COMMON", "EDGE-CASE"].includes(entry.priority)) {
          issues.push(`${entryPath}: Invalid or missing priority`);
        }
        
        if (!entry.problem || typeof entry.problem !== 'string') {
          issues.push(`${entryPath}: Missing or invalid problem description`);
        }
        
        if (!entry.solution || typeof entry.solution !== 'string') {
          issues.push(`${entryPath}: Missing or invalid solution description`);
        }
        
        // Check filename matches priority
        const fileName = entryPath.split('/').pop()!.replace('.json', '');
        if (!fileName.startsWith(entry.priority + '-')) {
          issues.push(`${entryPath}: Filename should start with ${entry.priority}-`);
        }
        
        // Validate links
        if (entry.related_to) {
          for (const link of entry.related_to) {
            const linkFullPath = join(this.knowledgeRoot, link.path);
            
            try {
              await fs.access(linkFullPath);
              
              // Check for bidirectional links
              if (fix && (link.relationship === "related" || link.relationship === "conflicts_with")) {
                const targetContent = await fs.readFile(linkFullPath, "utf-8");
                const targetEntry: KnowledgeEntry = JSON.parse(targetContent);
                
                const hasReverseLink = targetEntry.related_to?.some(
                  reverseLink => reverseLink.path === entryPath
                );
                
                if (!hasReverseLink) {
                  // Fix by adding reverse link
                  if (!targetEntry.related_to) targetEntry.related_to = [];
                  targetEntry.related_to.push({
                    path: entryPath,
                    relationship: link.relationship,
                    description: link.description
                  });
                  await fs.writeFile(linkFullPath, JSON.stringify(targetEntry, null, 2));
                  fixed++;
                }
              }
            } catch (error) {
              issues.push(`${entryPath}: Broken link to ${link.path}`);
            }
          }
        }
      } catch (error) {
        issues.push(`${entryPath}: Cannot read file`);
      }
    }
    
    let responseText = `Validation complete: checked ${entriesToValidate.length} entries\n`;
    
    if (issues.length === 0) {
      responseText += "✓ All entries are valid!";
    } else {
      responseText += `\nFound ${issues.length} issues:\n`;
      issues.forEach(issue => {
        responseText += `- ${issue}\n`;
      });
    }
    
    if (fix && fixed > 0) {
      responseText += `\n✓ Fixed ${fixed} missing bidirectional links`;
    }
    
    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
    };
  }

  private async deleteKnowledge(args: any) {
    const { path, cleanup_links = true } = args;
    
    // Ensure path ends with .json
    const jsonPath = path.endsWith('.json') ? path : `${path}.json`;
    const fullPath = join(this.knowledgeRoot, jsonPath);
    
    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Entry not found: ${jsonPath}`,
          },
        ],
      };
    }
    
    // Read the entry before deletion for cleanup
    let entryData: KnowledgeEntry | null = null;
    if (cleanup_links) {
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        entryData = JSON.parse(content);
      } catch (error) {
        // Continue with deletion even if we can't parse
      }
    }
    
    // Delete the file
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Failed to delete entry: ${error}`,
          },
        ],
      };
    }
    
    // Clean up references in other entries
    let cleanedCount = 0;
    if (cleanup_links) {
      const allEntries = await this.scanKnowledgeTree();
      
      for (const entryPath of allEntries) {
        const entryFullPath = join(this.knowledgeRoot, entryPath);
        
        try {
          const content = await fs.readFile(entryFullPath, "utf-8");
          const entry: KnowledgeEntry = JSON.parse(content);
          
          if (entry.related_to && entry.related_to.length > 0) {
            const originalLength = entry.related_to.length;
            entry.related_to = entry.related_to.filter(
              link => link.path !== jsonPath
            );
            
            if (entry.related_to.length < originalLength) {
              await fs.writeFile(entryFullPath, JSON.stringify(entry, null, 2));
              cleanedCount++;
            }
          }
        } catch (error) {
          // Skip entries we can't process
        }
      }
    }
    
    // Broadcast deletion
    await this.broadcastUpdate('entryDeleted', {
      path: jsonPath
    });
    
    let responseText = `✅ Successfully deleted: ${jsonPath}`;
    if (cleanup_links && cleanedCount > 0) {
      responseText += `\n🧹 Cleaned up references in ${cleanedCount} other entries`;
    }
    
    return {
      content: [
        {
          type: "text",
          text: responseText,
        },
      ],
    };
  }

  private async updateKnowledge(args: any) {
    const { path, updates } = args;
    
    // Ensure path ends with .json
    const jsonPath = path.endsWith('.json') ? path : `${path}.json`;
    const fullPath = join(this.knowledgeRoot, jsonPath);
    
    // Read existing entry
    let entry: KnowledgeEntry;
    try {
      const content = await fs.readFile(fullPath, "utf-8");
      entry = JSON.parse(content);
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Entry not found: ${jsonPath}`,
          },
        ],
      };
    }
    
    // Validate updates
    const validationErrors: string[] = [];
    
    if (updates.priority && !["CRITICAL", "REQUIRED", "COMMON", "EDGE-CASE"].includes(updates.priority)) {
      validationErrors.push("Invalid priority value");
    }
    
    if (updates.problem !== undefined && (!updates.problem || typeof updates.problem !== 'string')) {
      validationErrors.push("Problem must be a non-empty string");
    }
    
    if (updates.solution !== undefined && (!updates.solution || typeof updates.solution !== 'string')) {
      validationErrors.push("Solution must be a non-empty string");
    }
    
    // If changing priority, check if filename needs to change
    if (updates.priority && updates.priority !== entry.priority) {
      const fileName = jsonPath.split('/').pop()!;
      const expectedPrefix = updates.priority + '-';
      if (!fileName.startsWith(expectedPrefix)) {
        validationErrors.push(
          `Changing priority to ${updates.priority} requires renaming the file to start with ${expectedPrefix}`
        );
      }
    }
    
    if (validationErrors.length > 0) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Validation failed:\n${validationErrors.map(e => `• ${e}`).join('\n')}`,
          },
        ],
      };
    }
    
    // Apply updates
    const oldEntry = { ...entry };
    
    if (updates.priority !== undefined) entry.priority = updates.priority;
    if (updates.problem !== undefined) entry.problem = updates.problem;
    if (updates.solution !== undefined) entry.solution = updates.solution;
    if (updates.code !== undefined) entry.code = updates.code;
    if (updates.related_to !== undefined) {
      // Validate new relationships
      for (const link of updates.related_to) {
        const linkPath = link.path.endsWith('.json') ? link.path : `${link.path}.json`;
        const linkFullPath = join(this.knowledgeRoot, linkPath);
        try {
          await fs.access(linkFullPath);
        } catch (error) {
          validationErrors.push(`Linked entry does not exist: ${linkPath}`);
        }
      }
      
      if (validationErrors.length > 0) {
        return {
          content: [
            {
              type: "text",
              text: `❌ Validation failed:\n${validationErrors.map(e => `• ${e}`).join('\n')}`,
            },
          ],
        };
      }
      
      // Remove old bidirectional links
      if (oldEntry.related_to) {
        for (const oldLink of oldEntry.related_to) {
          if (oldLink.relationship === "related" || oldLink.relationship === "conflicts_with") {
            // Remove reverse link
            try {
              const targetPath = join(this.knowledgeRoot, oldLink.path);
              const targetContent = await fs.readFile(targetPath, "utf-8");
              const targetEntry: KnowledgeEntry = JSON.parse(targetContent);
              
              if (targetEntry.related_to) {
                targetEntry.related_to = targetEntry.related_to.filter(
                  link => link.path !== jsonPath
                );
                await fs.writeFile(targetPath, JSON.stringify(targetEntry, null, 2));
              }
            } catch (error) {
              // Continue if we can't update
            }
          }
        }
      }
      
      entry.related_to = updates.related_to;
      
      // Create new bidirectional links
      if (entry.related_to) {
        for (const link of entry.related_to) {
          if (link.relationship === "related" || link.relationship === "conflicts_with") {
            try {
              const targetPath = join(this.knowledgeRoot, link.path);
              const targetContent = await fs.readFile(targetPath, "utf-8");
              const targetEntry: KnowledgeEntry = JSON.parse(targetContent);
              
              if (!targetEntry.related_to) {
                targetEntry.related_to = [];
              }
              
              const reverseExists = targetEntry.related_to.some(
                reverseLink => reverseLink.path === jsonPath
              );
              
              if (!reverseExists) {
                targetEntry.related_to.push({
                  path: jsonPath,
                  relationship: link.relationship,
                  description: link.description
                });
                await fs.writeFile(targetPath, JSON.stringify(targetEntry, null, 2));
              }
            } catch (error) {
              // Continue if we can't create reverse link
            }
          }
        }
      }
    }
    
    // Save updated entry
    await fs.writeFile(fullPath, JSON.stringify(entry, null, 2));
    
    // Broadcast update
    await this.broadcastUpdate('entryUpdated', {
      path: jsonPath,
      data: entry
    });
    
    // Report what was updated
    const updatedFields = Object.keys(updates).filter(key => updates[key] !== undefined);
    
    return {
      content: [
        {
          type: "text",
          text: `✅ Successfully updated ${jsonPath}\n📝 Updated fields: ${updatedFields.join(', ')}`,
        },
      ],
    };
  }

  private async exportKnowledge(args: any) {
    const { format = "markdown", filter = {}, include_links = true } = args;
    
    // Get all entries
    const allEntries = await this.scanKnowledgeTree();
    let entries: Array<{ path: string; entry: KnowledgeEntry }> = [];
    
    // Load and filter entries
    for (const path of allEntries) {
      const fullPath = join(this.knowledgeRoot, path);
      
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        const entry: KnowledgeEntry = JSON.parse(content);
        
        // Apply filters
        if (filter.priority && filter.priority.length > 0) {
          if (!filter.priority.includes(entry.priority)) continue;
        }
        
        if (filter.category) {
          if (!path.toLowerCase().includes(filter.category.toLowerCase())) continue;
        }
        
        entries.push({ path, entry });
      } catch (error) {
        // Skip invalid entries
      }
    }
    
    // Sort by priority and path
    const priorityOrder = { "CRITICAL": 0, "REQUIRED": 1, "COMMON": 2, "EDGE-CASE": 3 };
    entries.sort((a, b) => {
      const priorityDiff = priorityOrder[a.entry.priority] - priorityOrder[b.entry.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.path.localeCompare(b.path);
    });
    
    let output = "";
    
    switch (format) {
      case "markdown":
        output = this.exportToMarkdown(entries, include_links);
        break;
      case "json":
        output = this.exportToJSON(entries, include_links);
        break;
      case "html":
        output = this.exportToHTML(entries, include_links);
        break;
    }
    
    return {
      content: [
        {
          type: "text",
          text: output,
        },
      ],
    };
  }

  private exportToMarkdown(entries: Array<{ path: string; entry: KnowledgeEntry }>, includeLinks: boolean): string {
    let md = "# Knowledge Tree Export\n\n";
    md += `_Generated on ${new Date().toISOString()}_\n\n`;
    md += `**Total Entries**: ${entries.length}\n\n`;
    
    // Group by priority
    const byPriority = entries.reduce((acc, { path, entry }) => {
      if (!acc[entry.priority]) acc[entry.priority] = [];
      acc[entry.priority].push({ path, entry });
      return acc;
    }, {} as Record<string, typeof entries>);
    
    // Export each priority group
    for (const priority of ["CRITICAL", "REQUIRED", "COMMON", "EDGE-CASE"]) {
      const group = byPriority[priority];
      if (!group || group.length === 0) continue;
      
      md += `## ${priority} (${group.length})\n\n`;
      
      for (const { path, entry } of group) {
        md += `### 📄 ${path}\n\n`;
        md += `**Problem**: ${entry.problem}\n\n`;
        md += `**Solution**: ${entry.solution}\n\n`;
        
        if (entry.code) {
          md += "**Code**:\n```\n" + entry.code + "\n```\n\n";
        }
        
        if (includeLinks && entry.related_to && entry.related_to.length > 0) {
          md += "**Related**:\n";
          for (const link of entry.related_to) {
            md += `- ${link.relationship}: [${link.path}](#${link.path.replace(/[^\w-]/g, '-')})\n`;
            if (link.description) {
              md += `  - ${link.description}\n`;
            }
          }
          md += "\n";
        }
        
        md += "---\n\n";
      }
    }
    
    return md;
  }

  private exportToJSON(entries: Array<{ path: string; entry: KnowledgeEntry }>, includeLinks: boolean): string {
    const exportData = {
      metadata: {
        exported_at: new Date().toISOString(),
        total_entries: entries.length,
        include_links: includeLinks
      },
      entries: entries.map(({ path, entry }) => ({
        path,
        ...entry,
        related_to: includeLinks ? entry.related_to : undefined
      }))
    };
    
    return JSON.stringify(exportData, null, 2);
  }

  private exportToHTML(entries: Array<{ path: string; entry: KnowledgeEntry }>, includeLinks: boolean): string {
    let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Knowledge Tree Export</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .entry { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin: 16px 0; }
        .priority-CRITICAL { border-left: 4px solid #ff4444; }
        .priority-REQUIRED { border-left: 4px solid #ff9944; }
        .priority-COMMON { border-left: 4px solid #44ff44; }
        .priority-EDGE-CASE { border-left: 4px solid #4444ff; }
        h1, h2, h3 { color: #333; }
        .path { color: #666; font-size: 0.9em; }
        .code { background: #f5f5f5; padding: 12px; border-radius: 4px; overflow-x: auto; }
        .links { margin-top: 12px; }
        .link { color: #0066cc; text-decoration: none; }
    </style>
</head>
<body>
    <h1>Knowledge Tree Export</h1>
    <p><em>Generated on ${new Date().toISOString()}</em></p>
    <p><strong>Total Entries</strong>: ${entries.length}</p>
`;
    
    for (const { path, entry } of entries) {
      const id = path.replace(/[^\w-]/g, '-');
      html += `
    <div class="entry priority-${entry.priority}" id="${id}">
        <h3>${entry.priority}</h3>
        <div class="path">${path}</div>
        <p><strong>Problem</strong>: ${this.escapeHtml(entry.problem)}</p>
        <p><strong>Solution</strong>: ${this.escapeHtml(entry.solution)}</p>`;
      
      if (entry.code) {
        html += `
        <div class="code">
            <pre>${this.escapeHtml(entry.code)}</pre>
        </div>`;
      }
      
      if (includeLinks && entry.related_to && entry.related_to.length > 0) {
        html += `
        <div class="links">
            <strong>Related</strong>:
            <ul>`;
        for (const link of entry.related_to) {
          const linkId = link.path.replace(/[^\w-]/g, '-');
          html += `
                <li>${link.relationship}: <a href="#${linkId}" class="link">${link.path}</a>`;
          if (link.description) {
            html += ` - ${this.escapeHtml(link.description)}`;
          }
          html += `</li>`;
        }
        html += `
            </ul>
        </div>`;
      }
      
      html += `
    </div>`;
    }
    
    html += `
</body>
</html>`;
    
    return html;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private async getKnowledgeStats(args: any) {
    const { include = ["summary", "priorities", "categories", "orphaned", "popular"] } = args;
    
    const allEntries = await this.scanKnowledgeTree();
    const entries: Array<{ path: string; entry: KnowledgeEntry; stats: any }> = [];
    
    // Load all entries with file stats
    for (const path of allEntries) {
      const fullPath = join(this.knowledgeRoot, path);
      
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        const entry: KnowledgeEntry = JSON.parse(content);
        const stats = await fs.stat(fullPath);
        
        entries.push({ path, entry, stats });
      } catch (error) {
        // Skip invalid entries
      }
    }
    
    const result: any = {
      generated_at: new Date().toISOString(),
      total_entries: entries.length
    };
    
    // Summary statistics
    if (include.includes("summary")) {
      result.summary = {
        total_entries: entries.length,
        total_size_bytes: entries.reduce((sum, e) => sum + e.stats.size, 0),
        with_code_examples: entries.filter(e => e.entry.code).length,
        with_relationships: entries.filter(e => e.entry.related_to && e.entry.related_to.length > 0).length,
        total_relationships: entries.reduce((sum, e) => sum + (e.entry.related_to?.length || 0), 0)
      };
    }
    
    // Priority breakdown
    if (include.includes("priorities")) {
      const priorityCounts = entries.reduce((acc, e) => {
        acc[e.entry.priority] = (acc[e.entry.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      result.priorities = {
        counts: priorityCounts,
        percentages: Object.entries(priorityCounts).reduce((acc, [priority, count]) => {
          acc[priority] = Math.round((count / entries.length) * 100);
          return acc;
        }, {} as Record<string, number>)
      };
    }
    
    // Category breakdown
    if (include.includes("categories")) {
      const categoryStats = entries.reduce((acc, e) => {
        const parts = e.path.split('/');
        const category = parts.length > 1 ? parts[0] : 'root';
        
        if (!acc[category]) {
          acc[category] = {
            count: 0,
            priorities: {},
            subcategories: new Set()
          };
        }
        
        acc[category].count++;
        acc[category].priorities[e.entry.priority] = (acc[category].priorities[e.entry.priority] || 0) + 1;
        
        if (parts.length > 2) {
          acc[category].subcategories.add(parts[1]);
        }
        
        return acc;
      }, {} as Record<string, any>);
      
      // Convert Sets to arrays for JSON serialization
      Object.values(categoryStats).forEach((cat: any) => {
        cat.subcategories = Array.from(cat.subcategories);
      });
      
      result.categories = categoryStats;
    }
    
    // Orphaned entries (no relationships)
    if (include.includes("orphaned")) {
      const orphaned = entries.filter(e => !e.entry.related_to || e.entry.related_to.length === 0);
      result.orphaned = {
        count: orphaned.length,
        percentage: Math.round((orphaned.length / entries.length) * 100),
        entries: orphaned.slice(0, 10).map(e => ({
          path: e.path,
          priority: e.entry.priority,
          problem: e.entry.problem.substring(0, 60) + (e.entry.problem.length > 60 ? '...' : '')
        }))
      };
    }
    
    // Popular entries (most linked to)
    if (include.includes("popular")) {
      const linkCounts = new Map<string, number>();
      
      entries.forEach(e => {
        if (e.entry.related_to) {
          e.entry.related_to.forEach(link => {
            const count = linkCounts.get(link.path) || 0;
            linkCounts.set(link.path, count + 1);
          });
        }
      });
      
      const popular = Array.from(linkCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([path, count]) => {
          const entry = entries.find(e => e.path === path);
          return {
            path,
            incoming_links: count,
            priority: entry?.entry.priority || 'Unknown',
            problem: entry ? entry.entry.problem.substring(0, 60) + (entry.entry.problem.length > 60 ? '...' : '') : 'Entry not found'
          };
        });
      
      result.popular = {
        most_linked: popular,
        average_links: entries.length > 0 ? Math.round(Array.from(linkCounts.values()).reduce((a, b) => a + b, 0) / entries.length * 10) / 10 : 0
      };
    }
    
    // Coverage analysis
    if (include.includes("coverage")) {
      const now = new Date();
      const oldEntries = entries.filter(e => {
        const daysSinceModified = (now.getTime() - e.stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
        return daysSinceModified > 30;
      });
      
      result.coverage = {
        stale_entries: {
          count: oldEntries.length,
          percentage: Math.round((oldEntries.length / entries.length) * 100),
          threshold_days: 30
        },
        recent_activity: {
          last_7_days: entries.filter(e => {
            const daysSinceModified = (now.getTime() - e.stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
            return daysSinceModified <= 7;
          }).length,
          last_30_days: entries.filter(e => {
            const daysSinceModified = (now.getTime() - e.stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
            return daysSinceModified <= 30;
          }).length
        }
      };
    }
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async getRecentKnowledge(args: any) {
    const { days = 7, limit = 20, type = "all" } = args;
    
    const allEntries = await this.scanKnowledgeTree();
    const entries: Array<{ path: string; entry: KnowledgeEntry; stats: any; changeType: string }> = [];
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    // Load entries with file stats
    for (const path of allEntries) {
      const fullPath = join(this.knowledgeRoot, path);
      
      try {
        const content = await fs.readFile(fullPath, "utf-8");
        const entry: KnowledgeEntry = JSON.parse(content);
        const stats = await fs.stat(fullPath);
        
        // Determine if entry is recent
        const created = stats.birthtime;
        const modified = stats.mtime;
        
        let changeType = "";
        let isRecent = false;
        
        // Check if recently created
        if (created >= cutoffDate) {
          changeType = "added";
          isRecent = true;
        }
        // Check if recently modified (but not newly created)
        else if (modified >= cutoffDate && modified.getTime() !== created.getTime()) {
          changeType = "modified";
          isRecent = true;
        }
        
        // Filter by type
        if (isRecent && (type === "all" || type === changeType)) {
          entries.push({ path, entry, stats, changeType });
        }
      } catch (error) {
        // Skip invalid entries
      }
    }
    
    // Sort by modification time (newest first)
    entries.sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());
    
    // Apply limit
    const limitedEntries = entries.slice(0, limit);
    
    const result = {
      period: {
        days: days,
        from: cutoffDate.toISOString(),
        to: new Date().toISOString()
      },
      summary: {
        total_changes: entries.length,
        showing: limitedEntries.length,
        added: entries.filter(e => e.changeType === "added").length,
        modified: entries.filter(e => e.changeType === "modified").length
      },
      entries: limitedEntries.map(e => ({
        path: e.path,
        priority: e.entry.priority,
        problem: e.entry.problem,
        solution: e.entry.solution.substring(0, 100) + (e.entry.solution.length > 100 ? '...' : ''),
        change_type: e.changeType,
        modified_at: e.stats.mtime.toISOString(),
        created_at: e.stats.birthtime.toISOString(),
        relationships: e.entry.related_to?.length || 0
      }))
    };
    
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  private async getUsageAnalytics(args: any) {
    const { days = 30, include = ["access", "searches", "tools", "patterns"] } = args;
    
    const logFile = join(this.logsDir, "usage.jsonl");
    
    // Check if log file exists
    try {
      await fs.access(logFile);
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              message: "No usage data available yet. Start using the knowledge base to generate analytics.",
              period: {
                start: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
                end: new Date().toISOString(),
                days: days
              },
              setup_hint: "💡 TIP: Add 'docs/logs/' to your .gitignore file to keep analytics data private"
            }, null, 2),
          },
        ],
      };
    }

    // Read and parse log entries
    const logContent = await fs.readFile(logFile, "utf-8");
    const lines = logContent.trim().split("\n").filter(line => line.trim());
    const allLogs: UsageLogEntry[] = [];
    
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        allLogs.push(entry);
      } catch (error) {
        // Skip invalid log lines
      }
    }

    // Filter by date range
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    const filteredLogs = allLogs.filter(log => 
      new Date(log.timestamp) >= cutoffDate
    );

    const result: any = {
      period: {
        start: cutoffDate.toISOString(),
        end: new Date().toISOString(),
        days: days
      }
    };

    // Access analytics
    if (include.includes("access")) {
      const accessLogs = filteredLogs.filter(log => log.type === "access");
      const accessCounts: Record<string, number> = {};
      const lastAccess: Record<string, string> = {};
      
      for (const log of accessLogs) {
        if (log.path) {
          accessCounts[log.path] = (accessCounts[log.path] || 0) + 1;
          lastAccess[log.path] = log.timestamp;
        }
      }

      const mostAccessed = Object.entries(accessCounts)
        .map(([path, count]) => ({ path, count, last_access: lastAccess[path] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Access patterns by hour and day
      const byHour: Record<string, number> = {};
      const byDay: Record<string, number> = {};
      const byPriority: Record<string, number> = {};

      for (const log of accessLogs) {
        const date = new Date(log.timestamp);
        const hour = date.getHours().toString();
        const day = date.toISOString().split('T')[0];
        
        byHour[hour] = (byHour[hour] || 0) + 1;
        byDay[day] = (byDay[day] || 0) + 1;

        // Extract priority from path if possible
        if (log.path) {
          const filename = log.path.split('/').pop() || '';
          const priority = filename.split('-')[0];
          if (['CRITICAL', 'REQUIRED', 'COMMON', 'EDGE-CASE'].includes(priority)) {
            byPriority[priority] = (byPriority[priority] || 0) + 1;
          }
        }
      }

      result.access = {
        total_accesses: accessLogs.length,
        unique_entries: Object.keys(accessCounts).length,
        most_accessed: mostAccessed,
        access_patterns: {
          by_hour: byHour,
          by_day: byDay,
          by_priority: byPriority
        }
      };
    }

    // Search analytics
    if (include.includes("searches")) {
      const searchLogs = filteredLogs.filter(log => log.type === "search");
      const queryCounts: Record<string, number> = {};
      const lastSearch: Record<string, string> = {};
      let wildcardCount = 0;

      for (const log of searchLogs) {
        if (log.query) {
          queryCounts[log.query] = (queryCounts[log.query] || 0) + 1;
          lastSearch[log.query] = log.timestamp;
          
          if (log.query.includes('*') || log.query.includes('?')) {
            wildcardCount++;
          }
        }
      }

      const popularQueries = Object.entries(queryCounts)
        .map(([query, count]) => ({ query, count, last_search: lastSearch[query] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      result.searches = {
        total_searches: searchLogs.length,
        unique_queries: Object.keys(queryCounts).length,
        popular_queries: popularQueries,
        wildcard_usage: wildcardCount
      };
    }

    // Tool usage analytics
    if (include.includes("tools")) {
      const toolLogs = filteredLogs.filter(log => log.type === "tool_call");
      const toolUsage: Record<string, number> = {};

      for (const log of toolLogs) {
        if (log.tool) {
          toolUsage[log.tool] = (toolUsage[log.tool] || 0) + 1;
        }
      }

      result.tools = {
        total_tool_calls: toolLogs.length,
        tool_usage: toolUsage
      };
    }

    // Pattern analysis
    if (include.includes("patterns")) {
      // Most active time periods
      const hourlyActivity: Record<string, number> = {};
      const dailyActivity: Record<string, number> = {};
      
      for (const log of filteredLogs) {
        const date = new Date(log.timestamp);
        const hour = date.getHours().toString();
        const day = date.toISOString().split('T')[0];
        
        hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
        dailyActivity[day] = (dailyActivity[day] || 0) + 1;
      }

      const peakHour = Object.entries(hourlyActivity)
        .sort((a, b) => b[1] - a[1])[0];
      
      const peakDay = Object.entries(dailyActivity)
        .sort((a, b) => b[1] - a[1])[0];

      result.patterns = {
        total_activity: filteredLogs.length,
        peak_hour: peakHour ? { hour: peakHour[0], activity: peakHour[1] } : null,
        peak_day: peakDay ? { day: peakDay[0], activity: peakDay[1] } : null,
        activity_by_type: {
          access: filteredLogs.filter(l => l.type === "access").length,
          search: filteredLogs.filter(l => l.type === "search").length,
          tool_call: filteredLogs.filter(l => l.type === "tool_call").length,
          web_view: filteredLogs.filter(l => l.type === "web_view").length
        }
      };
    }

    const responseText = JSON.stringify(result, null, 2);
    
    // Add setup hint if this is the first analytics call
    const isFirstRun = filteredLogs.length === 0 && result.access;
    const hint = isFirstRun 
      ? "\n\n💡 SETUP HINT: Add 'docs/logs/' to your .gitignore file to prevent committing usage analytics data to version control."
      : "";

    return {
      content: [
        {
          type: "text",
          text: responseText + hint,
        },
      ],
    };
  }

  private async broadcastUpdate(type: string, data: any) {
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

  private async getHelp(args: any) {
    const { topic } = args;
    
    const helpTexts: Record<string, string> = {
      overview: `📚 Knowledge Tree MCP - Overview
      
The Knowledge Tree MCP helps you build a structured knowledge base for your project.
It organizes knowledge in a hierarchical tree with priority levels and relationships.

Key Concepts:
• Priority Levels: CRITICAL > REQUIRED > COMMON > EDGE-CASE
• Relationships: Link related knowledge entries together
• Validation: Ensures consistency and correctness

Available Tools:
• search_knowledge - Find entries by priority, category, or keyword
• add_knowledge - Create new knowledge entries
• link_knowledge - Connect related entries
• validate_knowledge - Check for errors and inconsistencies
• help - This help system`,

      creating: `📝 Creating Knowledge Entries

1. STRUCTURE YOUR PATH:
   category/subcategory/PRIORITY-description.json
   
   Examples:
   • testing/forbidden/CRITICAL-no-mocks.json
   • auth/patterns/REQUIRED-jwt-authentication.json
   • errors/handling/COMMON-network-timeouts.json

2. PRIORITY LEVELS:
   • CRITICAL - Architecture violations, security issues
   • REQUIRED - Must-follow patterns, best practices
   • COMMON - Frequent issues and solutions
   • EDGE-CASE - Rare but documented scenarios

3. REQUIRED FIELDS:
   • priority: Must match filename prefix
   • problem: Clear description of the issue
   • solution: How to solve or avoid it
   • code: (optional) Example code
   • related_to: (optional) Links to other entries

4. VALIDATION RULES:
   • Filename must start with priority (e.g., CRITICAL-)
   • All linked entries must exist
   • No duplicate entries
   • Valid JSON format`,

      linking: `🔗 Linking Knowledge Entries

1. RELATIONSHIP TYPES:
   • related - General connection (bidirectional)
   • supersedes - This replaces the target
   • superseded_by - This is replaced by target
   • conflicts_with - Conflicting approaches (bidirectional)
   • implements - Implementation of a pattern
   • implemented_by - Has implementations

2. ADDING LINKS:
   When creating: Include related_to array
   After creation: Use link_knowledge tool

3. AUTOMATIC BIDIRECTIONAL:
   Only 'related' and 'conflicts_with' create reverse links

Example:
{
  "related_to": [{
    "path": "auth/patterns/COMMON-session-auth.json",
    "relationship": "supersedes",
    "description": "JWT replaces session-based auth"
  }]
}`,

      searching: `🔍 Searching Knowledge

1. SEARCH BY PRIORITY:
   search_knowledge(priority: "CRITICAL")

2. SEARCH BY CATEGORY:
   search_knowledge(category: "testing")

3. SEARCH BY KEYWORD:
   search_knowledge(keyword: "authentication")

4. COMBINE FILTERS:
   search_knowledge(priority: "REQUIRED", category: "auth")

5. BROWSE RESOURCES:
   Access entries directly via:
   knowledge://path/to/entry.json
   
   With depth for linked entries:
   knowledge://path/to/entry.json?depth=2`,

      validating: `✅ Validating Knowledge

1. VALIDATE ALL ENTRIES:
   validate_knowledge()

2. VALIDATE SPECIFIC ENTRY:
   validate_knowledge(path: "testing/CRITICAL-no-mocks.json")

3. AUTO-FIX ISSUES:
   validate_knowledge(fix: true)
   
   Fixes:
   • Missing bidirectional links
   • (More auto-fixes coming soon)

4. VALIDATION CHECKS:
   • JSON format validity
   • Required fields present
   • Priority matches filename
   • Linked entries exist
   • No broken references`,

      examples: `💡 Examples

1. CREATE ERROR HANDLING KNOWLEDGE:
   add_knowledge(
     path: "errors/handling/COMMON-async-rejections",
     priority: "COMMON",
     problem: "Unhandled promise rejections crash the app",
     solution: "Always use try/catch or .catch() for promises",
     code: "async function safe() { try { await risky(); } catch (e) { handle(e); } }"
   )

2. DOCUMENT ARCHITECTURE DECISION:
   add_knowledge(
     path: "architecture/decisions/CRITICAL-no-ssr",
     priority: "CRITICAL",
     problem: "SSR files break static deployment",
     solution: "Use client-side only rendering with onMount",
     related_to: [{
       path: "architecture/csr/REQUIRED-onmount-pattern.json",
       relationship: "implements"
     }]
   )

3. SUPERSEDE OLD PATTERN:
   link_knowledge(
     from: "auth/REQUIRED-jwt-tokens",
     to: "auth/COMMON-session-cookies",
     relationship: "supersedes",
     description: "JWT provides stateless auth"
   )

4. SEARCH AND VALIDATE:
   search_knowledge(priority: "CRITICAL", category: "security")
   validate_knowledge(fix: true)`
    };
    
    const helpText = topic ? helpTexts[topic] : `📚 Knowledge Tree MCP - Help System

Choose a topic for detailed help:

• help(topic: "overview") - General introduction
• help(topic: "creating") - How to create entries
• help(topic: "linking") - Managing relationships
• help(topic: "searching") - Finding knowledge
• help(topic: "validating") - Checking consistency
• help(topic: "examples") - Real-world examples

Quick Start:
1. Create an entry: add_knowledge(path, priority, problem, solution)
2. Search entries: search_knowledge(keyword: "term")
3. Validate all: validate_knowledge()

For full documentation, see the README.md file.`;
    
    return {
      content: [
        {
          type: "text",
          text: helpText,
        },
      ],
    };
  }

  private async startWebServer() {
    if (!this.webPort) return;
    
    this.webServer = fastify();
    
    // Register WebSocket plugin
    await this.webServer.register(fastifyWebsocket);
    
    // Serve static files from public directory
    await this.webServer.register(fastifyStatic, {
      root: join(__dirname, '..', 'public'),
      prefix: '/'
    });
    
    // WebSocket endpoint
    this.webServer.register(async (fastify: any) => {
      fastify.get('/ws', { websocket: true }, (connection: any) => {
        const ws = connection.socket;
        
        // Add to clients set
        this.wsClients.add(ws);
        
        // Handle incoming messages
        ws.on('message', async (message: string) => {
          try {
            const data = JSON.parse(message);
            
            // Log web interface activity
            await this.logUsage({
              timestamp: new Date().toISOString(),
              type: "web_view",
              metadata: { action: data.type, ...data }
            });
            
            if (data.type === 'getAll') {
              // Send all knowledge entries
              const allEntries = await this.scanKnowledgeTree();
              const entries = [];
              
              for (const path of allEntries) {
                const fullPath = join(this.knowledgeRoot, path);
                try {
                  const content = await fs.readFile(fullPath, "utf-8");
                  const entry = JSON.parse(content);
                  entries.push({ path, data: entry });
                } catch (error) {
                  // Skip invalid entries
                }
              }
              
              ws.send(JSON.stringify({
                type: 'allEntries',
                entries
              }));
            } else if (data.type === 'search') {
              // Handle search request
              const searchArgs = {
                query: data.query,
                priority: data.priority || [],
                category: data.category,
                searchIn: data.searchIn || ["all"],
                regex: data.regex || false,
                caseSensitive: data.caseSensitive || false,
                limit: data.limit || 50,
                sortBy: data.sortBy || "relevance"
              };
              
              const result = await this.searchKnowledge(searchArgs);
              const searchResults = JSON.parse(result.content[0].text);
              
              ws.send(JSON.stringify({
                type: 'searchResults',
                ...searchResults
              }));
            } else if (data.type === 'stats') {
              // Handle stats request
              const statsArgs = {
                include: data.include || ["summary", "priorities", "categories", "orphaned", "popular"]
              };
              
              const result = await this.getKnowledgeStats(statsArgs);
              const statsData = JSON.parse(result.content[0].text);
              
              ws.send(JSON.stringify({
                type: 'statsResults',
                ...statsData
              }));
            } else if (data.type === 'recent') {
              // Handle recent changes request
              const recentArgs = {
                days: data.days || 7,
                limit: data.limit || 20,
                type: data.changeType || "all"
              };
              
              const result = await this.getRecentKnowledge(recentArgs);
              const recentData = JSON.parse(result.content[0].text);
              
              ws.send(JSON.stringify({
                type: 'recentResults',
                ...recentData
              }));
            }
          } catch (error) {
            console.error('WebSocket message error:', error);
          }
        });
        
        // Handle disconnection
        ws.on('close', () => {
          this.wsClients.delete(ws);
        });
      });
    });
    
    // Start the server
    try {
      await this.webServer.listen({ port: this.webPort, host: '0.0.0.0' });
      console.error(`🌐 Web interface available at: http://localhost:${this.webPort}`);
    } catch (error) {
      console.error(`Failed to start web server: ${error}`);
    }
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    console.error(`Knowledge Tree MCP server started`);
    console.error(`📁 Docs directory: ${this.knowledgeRoot}`);
    
    if (this.webPort) {
      await this.startWebServer();
    } else {
      console.error(`💡 Tip: Use --port <number> to enable web interface`);
    }
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
let docsPath: string | undefined;
let webPort: number | undefined;

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
  } else if (args[i] === "--help" || args[i] === "-h") {
    console.log(`
Knowledge Tree MCP Server

Usage: knowledge-tree-mcp [options]

Options:
  --docs, -d <path>    Path to documentation directory (default: ./docs)
  --port, -p <number>  Port for web interface (optional)
  --help, -h           Show this help message

Examples:
  knowledge-tree-mcp
  knowledge-tree-mcp --docs /path/to/docs
  knowledge-tree-mcp --port 3000
  knowledge-tree-mcp --docs ./my-docs --port 8080
`);
    process.exit(0);
  }
}

// Start the server with the specified options
const server = new KnowledgeTreeServer(docsPath, webPort);
server.start().catch(console.error);