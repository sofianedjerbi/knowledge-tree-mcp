/**
 * Central registry and export point for all MCP tool implementations
 * 
 * This module follows the Single Responsibility Principle by handling
 * tool registration and exports only. Each tool implementation is
 * isolated in its own module.
 */

import type { ToolHandler } from '../types/index.js';

// Import all tool handlers
import { helpHandler } from './help.js';
import { indexKnowledgeHandler } from './indexKnowledge.js';
import { searchKnowledgeHandler } from './search.js';
import { addKnowledgeHandler } from './add.js';
import { updateKnowledgeHandler } from './update.js';
import { deleteKnowledgeHandler } from './delete.js';
import { linkKnowledgeHandler } from './link.js';
import { validateKnowledgeHandler } from './validate.js';
import { exportKnowledgeHandler } from './export.js';
import { statsKnowledgeHandler } from './stats.js';
import { recentKnowledgeHandler } from './recent.js';
import { usageAnalyticsHandler } from './analytics.js';
import { setupProjectHandler } from './setup.js';
import { categoriesHandler } from './categories.js';

/**
 * Map of tool names to their handlers
 * This provides a clean interface for the server to look up tools
 */
export const toolHandlers: Record<string, ToolHandler> = {
  help: helpHandler,
  setup_project: setupProjectHandler,
  manage_categories: categoriesHandler,
  index_knowledge: indexKnowledgeHandler,
  search_knowledge: searchKnowledgeHandler,
  add_knowledge: addKnowledgeHandler,
  update_knowledge: updateKnowledgeHandler,
  delete_knowledge: deleteKnowledgeHandler,
  link_knowledge: linkKnowledgeHandler,
  validate_knowledge: validateKnowledgeHandler,
  export_knowledge: exportKnowledgeHandler,
  stats_knowledge: statsKnowledgeHandler,
  recent_knowledge: recentKnowledgeHandler,
  usage_analytics: usageAnalyticsHandler
};

/**
 * Tool definitions for MCP registration
 * These match the structure expected by the MCP SDK
 */
export const toolDefinitions = [
  // 0. PROJECT SETUP - Configure your project
  {
    name: "setup_project",
    description: "Initialize or update project configuration for better path generation and categorization",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["init", "update", "show"],
          description: "Action to perform (default: show)",
          default: "show",
        },
        name: {
          type: "string",
          description: "Project name (for init/update)",
        },
        pathPrefix: {
          type: "string",
          description: "Path prefix for all entries (e.g., 'my-project')",
        },
        technologies: {
          type: "array",
          items: { type: "string" },
          description: "Technologies used in the project",
        },
        categories: {
          type: "object",
          description: "Custom category mappings",
          additionalProperties: {
            type: "object",
            properties: {
              keywords: {
                type: "array",
                items: { type: "string" },
              },
              subcategories: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
        autoTags: {
          type: "object",
          description: "Auto-tagging rules (tag -> keywords)",
          additionalProperties: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
  },
  
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
  {
    name: "index_knowledge",
    description: "Get a comprehensive index/map of all knowledge entries for LLM memory overview",
    inputSchema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["tree", "list", "summary", "categories"],
          description: "Output format (default: tree)",
          default: "tree",
        },
        include_content: {
          type: "boolean",
          description: "Include brief content preview (default: false)",
          default: false,
        },
        max_entries: {
          type: "number",
          description: "Maximum entries to return (default: 100)",
          default: 100,
        },
      },
    },
  },

  // 2. CORE OPERATIONS - Basic CRUD for knowledge management
  {
    name: "add_knowledge",
    description: "Create a new knowledge entry from Markdown content with auto-generated path",
    inputSchema: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Optional: Custom path/category for the entry. Can be a full path with filename or just a directory (e.g., 'security/auth/jwt-guide' or 'security/auth/'). Extension .json is auto-added. If not provided, path is auto-generated from title.",
        },
        content: {
          type: "string",
          description: "Markdown content with front matter and sections (see help for format)",
        },
      },
      required: ["content"],
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
            enum: ["title", "problem", "solution", "context", "code", "path", "tags", "all"],
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
        new_path: {
          type: "string",
          description: "New path for the entry (optional, will be normalized to .json)",
        },
        updates: {
          type: "object",
          properties: {
            title: {
              type: "string",
              description: "Updated title",
            },
            slug: {
              type: "string",
              description: "Updated URL-friendly identifier",
            },
            priority: {
              type: "string",
              enum: ["CRITICAL", "REQUIRED", "COMMON", "EDGE-CASE"],
              description: "New priority level",
            },
            category: {
              type: "string",
              description: "Updated category",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Updated tags",
            },
            problem: {
              type: "string",
              description: "Updated problem description",
            },
            context: {
              type: "string",
              description: "Updated context",
            },
            solution: {
              type: "string",
              description: "Updated solution",
            },
            examples: {
              type: "array",
              description: "Updated code examples",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  description: { type: "string" },
                  code: { type: "string" },
                  language: { type: "string" }
                }
              }
            },
            code: {
              type: "string",
              description: "Updated code example (deprecated - use examples instead)",
            },
            author: {
              type: "string",
              description: "Updated author",
            },
            version: {
              type: "string",
              description: "Updated version",
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
        regenerate_path: {
          type: "boolean",
          description: "Automatically generate new path from title (default: false)",
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
          description: "Source knowledge path (e.g., 'testing/no-mocks.json')",
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
          enum: ["markdown", "html"],
          description: "Export format (markdown for AI, html for UI)",
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
    name: "manage_categories",
    description: "Manage knowledge categories (add, update, remove, list, merge)",
    inputSchema: {
      type: "object",
      required: ["action"],
      properties: {
        action: {
          type: "string",
          enum: ["add", "update", "remove", "list", "merge"],
          description: "Action to perform on categories",
        },
        category: {
          type: "string",
          description: "Category name (required for add/update/remove/merge)",
        },
        keywords: {
          type: "array",
          items: { type: "string" },
          description: "Keywords that trigger this category",
        },
        subcategories: {
          type: "array",
          items: { type: "string" },
          description: "Subcategories under this category",
        },
        scope: {
          type: "string",
          enum: ["project", "system", "both"],
          default: "project",
          description: "Scope of operation (default: project)",
        },
        description: {
          type: "string",
          description: "Optional description of the category",
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
];

// Export individual handlers for direct use if needed
export {
  helpHandler,
  setupProjectHandler,
  indexKnowledgeHandler,
  searchKnowledgeHandler,
  addKnowledgeHandler,
  updateKnowledgeHandler,
  deleteKnowledgeHandler,
  linkKnowledgeHandler,
  validateKnowledgeHandler,
  exportKnowledgeHandler,
  statsKnowledgeHandler,
  recentKnowledgeHandler,
  usageAnalyticsHandler
};