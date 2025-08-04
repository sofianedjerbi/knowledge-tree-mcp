# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Knowledge Tree MCP is a Model Context Protocol (MCP) server that provides hierarchical knowledge management for AI assistants. It's a TypeScript/Node.js project built with the MCP SDK, offering tools for organizing, searching, and managing project knowledge.

## 📚 Knowledge Base Documentation

The knowledge base is currently empty and ready to be populated with project-specific documentation. As an AI assistant, you should help create comprehensive, well-structured documentation using the MCP tools.

### 🎯 Documentation Guidelines for AI Assistants

When creating knowledge entries, follow these best practices:

#### 1. **Title Best Practices**
- Be specific and descriptive without redundancy
- Don't include the project name in titles (the path provides context)
- Use action-oriented titles: "Configure Redis Cache" not "How to Configure Redis Cache in MyApp"
- Keep titles concise: 3-7 words ideal

#### 2. **Path Generation**
- The system auto-generates paths from titles
- Project prefix "knowledge-tree/" is automatically added
- Categories are detected from keywords (mcp, web, testing, etc.)
- Subcategories only added when explicitly mentioned in title

#### 3. **Priority Guidelines**
- **CRITICAL**: Core functionality, security issues, data loss prevention
- **REQUIRED**: Common operations, important features, frequent tasks
- **COMMON**: Regular tasks, useful patterns, good-to-know info
- **EDGE-CASE**: Rare scenarios, specific workarounds, corner cases

#### 4. **Content Structure**
```markdown
---
title: Concise Descriptive Title
priority: REQUIRED
tags: [specific, relevant, searchable]
---

# Problem
Clear, one-sentence description of the issue or need.

# Context
Brief background (2-3 sentences) explaining why this matters.

# Solution
Step-by-step solution with:
- Bullet points for clarity
- Code examples with language specified
- Commands with explanations
- Expected outcomes
```

#### 5. **Tag Strategy**
- Use 3-5 specific tags
- Include technology names (nodejs, typescript, mcp)
- Add concept tags (authentication, caching, performance)
- Include action tags (debugging, configuration, optimization)

#### 6. **Linking Entries**
After creating entries, establish relationships:
- `related`: General connection between topics
- `implements`: Concrete implementation of abstract concept
- `supersedes`: Newer approach replacing older one
- `conflicts_with`: Incompatible approaches

### 🚀 Quick Start for Documentation

1. **Initialize project context** (if not done):
   ```json
   {
     "tool": "setup_project",
     "action": "init",
     "name": "Your Project",
     "pathPrefix": "your-project",
     "technologies": ["tech1", "tech2"]
   }
   ```

2. **Create your first entry**:
   ```json
   {
     "tool": "add_knowledge",
     "content": "markdown content here"
   }
   ```

3. **Search and link related entries**:
   ```json
   {
     "tool": "search_knowledge",
     "query": "related topic"
   }
   ```

### 📋 Suggested Documentation Topics

Consider documenting these areas:
- Architecture overview and design decisions
- Setup and installation procedures
- Core features and their usage
- API/Tool reference with examples
- Common workflows and use cases
- Troubleshooting guide
- Performance optimization tips
- Security considerations
- Testing strategies
- Deployment procedures

### 🎨 Writing Style for AI

- **Be concise**: Get to the point quickly
- **Use examples**: Show, don't just tell
- **Structure content**: Use headers, lists, code blocks
- **Think reusability**: Write for future AI assistants
- **Focus on clarity**: Avoid jargon without explanation
- **Include context**: Why, not just how

## Common Development Commands

```bash
# Install dependencies
npm install

# Build the project (TypeScript -> JavaScript)
npm run build

# Development mode (watch mode with tsx)
npm run dev

# Run the compiled server
npm start
# With options:
npm start -- --port 3000              # With web interface
npm start -- --docs /custom/path      # Custom docs directory
npm start -- --port 3000 --docs ./my-docs  # Both options

# Testing commands
npm test                    # Run all tests
npm run test:ui            # Run tests with UI
npm run test:coverage      # Run tests with coverage report

# Run a specific test file
npx vitest run test/operations/add.test.ts
npx vitest run test/operations/search.test.ts
```

## Architecture & Key Components

### MCP Server Structure

The project implements an MCP server with the following key architectural patterns:

1. **Main Entry Point** (`src/index.ts`):
   - Sets up MCP server using `@modelcontextprotocol/sdk`
   - Handles tool registration and execution
   - Manages resource exposure for knowledge entries
   - Optional web interface using Fastify

2. **Tool System** (`src/tools/`):
   - Each tool is a separate module exporting a handler function
   - Tools follow a consistent pattern: `(args, context) => result`
   - All tools are exported through `src/tools/index.ts`
   - Available tools:
     - `help` - Context-aware help system
     - `index_knowledge` - Knowledge base overview
     - `search_knowledge` - Search with filters
     - `add_knowledge` - Create new entries
     - `link_knowledge` - Connect related entries
     - `validate_knowledge` - Check consistency
     - `usage_analytics` - Track usage patterns
     - And more...

3. **Type System** (`src/types/`):
   - Core types: `KnowledgeEntry`, `UsageLogEntry`, `UsageStats`
   - Priority levels: `CRITICAL`, `REQUIRED`, `COMMON`, `EDGE-CASE`
   - Relationship types for linking knowledge

4. **Utilities** (`src/utils/`):
   - `fileSystem.ts` - File operations and path handling
   - `logging.ts` - Usage tracking and analytics

### Knowledge Storage Format

Knowledge entries are stored as JSON files with this structure:
```json
{
  "priority": "CRITICAL|REQUIRED|COMMON|EDGE-CASE",
  "problem": "Description of the issue",
  "solution": "How to solve it",
  "code": "Optional code example",
  "related_to": [
    {
      "path": "relative/path/to/other.json",
      "relationship": "related|supersedes|superseded_by|conflicts_with|implements|implemented_by",
      "description": "Optional description"
    }
  ]
}
```

### Resource System

- All JSON files in the docs directory are exposed as MCP resources
- Resources support depth traversal for exploring linked entries
- URI format: `knowledge://path/to/entry.json?depth=N`

### Web Interface

When started with `--port`, the server provides:
- Interactive knowledge graph visualization
- Real-time updates via WebSocket
- Static file serving from `public/` directory

## Testing Patterns

Tests use Vitest with:
- Mocked file system operations
- Sequential test execution to avoid conflicts
- Coverage reporting excluding config files and entry points
- Test setup file for common configuration

## Key Development Notes

1. **File System Operations**: All file operations go through utility functions in `src/utils/fileSystem.ts`

2. **Logging**: Usage analytics are tracked in `docs/logs/usage.jsonl` (JSONL format)

3. **Path Handling**: Always use proper path joining with Node.js `path` module

4. **Error Handling**: Tools should return user-friendly error messages in the MCP response format

5. **Type Safety**: Project uses strict TypeScript settings - maintain type safety

6. **Module System**: Uses ES modules (type: "module" in package.json) with `.js` extensions in imports

7. **Build Output**: TypeScript compiles to `dist/` directory maintaining source structure