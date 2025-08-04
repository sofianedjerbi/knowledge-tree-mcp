# 🌳 Knowledge Tree MCP Server

> **Hierarchical knowledge management system for AI assistants**  
> Transform scattered project insights into an organized, searchable knowledge base with intelligent relationships and priority-based organization.

[![npm version](https://img.shields.io/npm/v/@sofianedjerbi/knowledge-tree-mcp)](https://www.npmjs.com/package/@sofianedjerbi/knowledge-tree-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## ✨ Features

<table>
<tr>
<td width="33%">

### 🏗️ **Smart Organization**
Auto-categorized paths with custom overrides and project-specific categories

</td>
<td width="33%">

### 🎯 **Priority System**
Four-tier priority system: **CRITICAL** → **REQUIRED** → **COMMON** → **EDGE-CASE**

</td>
<td width="33%">

### 🔗 **Relationship Mapping**
Six relationship types with bidirectional validation and automatic linking

</td>
</tr>
<tr>
<td>

### 🔍 **Advanced Search**
Full-text search with regex, field-specific targeting, and multi-criteria filtering

</td>
<td>

### 📊 **Usage Analytics**
Track access patterns, search trends, and tool usage with privacy-first design

</td>
<td>

### 🌐 **Interactive Dashboard**
Real-time web UI with graph visualization, tree explorer, and analytics

</td>
</tr>
</table>

---

## 🚀 Quick Start

### Using with Claude Desktop (Recommended)

```bash
# 🎯 Simple installation
claude mcp add knowledge-tree npx -- -y @sofianedjerbi/knowledge-tree-mcp

# 🎨 With web interface on port 3000
claude mcp add knowledge-tree npx -- -y @sofianedjerbi/knowledge-tree-mcp -- --port 3000

# 📁 Custom docs location + web UI
claude mcp add knowledge-tree npx -- -y @sofianedjerbi/knowledge-tree-mcp -- --docs /path/to/docs --port 3000
```

### Local Development

```bash
# 📦 Setup
git clone https://github.com/sofianedjerbi/knowledge-tree-mcp
cd knowledge-tree-mcp
npm install && npm run build

# 🏃 Run with web interface
npm start -- --port 3000

# 🧪 Run tests
npm test
```

**CLI Options:**
- `--docs, -d <path>` → Documentation directory (default: `./docs`)
- `--port, -p <number>` → Web interface port (enables UI at http://localhost:PORT)
- `--help, -h` → Show help

---

## 🛠️ Core Tools

<details>
<summary><b>📝 add_knowledge</b> - Create entries with auto-generated paths</summary>

**Create knowledge entries from Markdown with automatic categorization**

```typescript
add_knowledge({
  content: string,     // Markdown with frontmatter
  path?: string        // Optional: override auto-generated path
})
```

**Auto-Path Generation Examples:**
- "How to implement JWT authentication" → `security/authentication/jwt-implementation.json`
- "Fix Redis connection timeout" → `database/redis/troubleshooting/connection-timeout.json`
- "React hooks best practices" → `frontend/react/best-practices/hooks.json`

**Markdown Format:**
```markdown
---
title: Implement JWT refresh token rotation
priority: REQUIRED
tags: [jwt, authentication, security]
---

# Problem
JWT tokens expire but users need seamless authentication

# Context
Mobile apps and SPAs need to maintain auth state without frequent logins

# Solution
Implement refresh token rotation with secure storage...

# Examples
```typescript
// Token rotation implementation
const refreshToken = async () => {
  // Implementation here
}
```
```

**Path Override Options:**
```bash
# Full custom path
add_knowledge(path: "security/auth/my-jwt-guide", content: "...")

# Directory only (filename from title)
add_knowledge(path: "security/auth/", content: "...")
```

</details>

<details>
<summary><b>🔍 search_knowledge</b> - Find entries with advanced filtering</summary>

**Search with field-specific targeting and multi-criteria filtering**

```typescript
search_knowledge({
  query?: string,              // Search text (supports regex)
  searchIn?: string[],         // Fields to search
  priority?: string[],         // Filter by priorities
  category?: string,           // Filter by category
  sortBy?: string,            // Sort results
  limit?: number,             // Max results
  regex?: boolean,            // Enable regex mode
  caseSensitive?: boolean     // Case sensitivity
})
```

**Search Fields:**
- `title`, `problem`, `solution`, `context`, `code`, `tags`, `path`, `all`

**Examples:**
```bash
# Simple search
search_knowledge(query: "authentication")

# Field-specific search
search_knowledge(query: "JWT", searchIn: ["title", "tags"])

# Multi-criteria filtering
search_knowledge(
  priority: ["CRITICAL", "REQUIRED"],
  category: "security",
  query: "vulnerability"
)

# Regex search
search_knowledge(
  query: "use(State|Effect|Memo)",
  regex: true,
  searchIn: ["code"]
)

# Find all entries (wildcard)
search_knowledge(query: "*")
```

</details>

<details>
<summary><b>🏷️ manage_categories</b> - Dynamic category management</summary>

**Add, update, remove, and merge categories for better organization**

```typescript
manage_categories({
  action: "add" | "update" | "remove" | "list" | "merge",
  category?: string,
  keywords?: string[],
  subcategories?: string[],
  scope?: "project" | "system" | "both",
  description?: string
})
```

**Examples:**
```bash
# List all categories
manage_categories(action: "list", scope: "both")

# Add project-specific category
manage_categories(
  action: "add",
  category: "payment-gateway",
  keywords: ["stripe", "paypal", "payment", "checkout"],
  subcategories: ["stripe", "paypal", "square"],
  scope: "project"
)

# Merge keywords without replacing
manage_categories(
  action: "merge",
  category: "frontend",
  keywords: ["svelte", "sveltekit"],
  scope: "system"
)
```

</details>

<details>
<summary><b>🔗 link_knowledge</b> - Connect related entries</summary>

**Create typed relationships between knowledge entries**

```typescript
link_knowledge({
  from: string,
  to: string,
  relationship: string,
  description?: string
})
```

**Relationship Types:**
- 🤝 `related` → General connection (bidirectional)
- ⬆️ `supersedes` → This replaces the target
- ⬇️ `superseded_by` → This is replaced by target
- ⚡ `conflicts_with` → Conflicting approaches (bidirectional)
- 🔧 `implements` → Implementation of a pattern
- 📋 `implemented_by` → Has implementations

</details>

<details>
<summary><b>🗺️ index_knowledge</b> - Browse knowledge structure</summary>

**Get comprehensive overview of your knowledge base**

```typescript
index_knowledge({
  format?: "tree" | "list" | "summary" | "categories",
  include_content?: boolean,
  max_entries?: number
})
```

**Formats:**
- 🌳 `tree` → Hierarchical folder structure
- 📋 `list` → Flat list with metadata
- 📊 `summary` → Statistics and overview
- 📁 `categories` → Grouped by category

</details>

<details>
<summary><b>📊 usage_analytics</b> - Track usage patterns</summary>

**Analyze how your knowledge base is being used**

```typescript
usage_analytics({
  days?: number,
  include?: string[]
})
```

**Analytics Types:**
- 👁️ `access` → Entry access patterns
- 🔍 `searches` → Search query analysis
- 🛠️ `tools` → Tool usage statistics
- 🌐 `interface` → Web UI interactions
- 📈 `patterns` → Usage trends over time

</details>

<details>
<summary><b>✅ More Tools</b> - Additional capabilities</summary>

- **update_knowledge** → Modify existing entries
- **delete_knowledge** → Remove entries with cleanup
- **validate_knowledge** → Check consistency and fix issues
- **export_knowledge** → Generate documentation (MD/HTML/JSON)
- **stats_knowledge** → Get detailed statistics
- **recent_knowledge** → View recent changes
- **setup_project** → Configure project settings
- **help** → Get contextual guidance

</details>

---

## 🌐 Web Dashboard

Access the interactive dashboard at `http://localhost:3000` (when using `--port 3000`)

### Features:
- 📊 **Overview Dashboard** → KPIs, activity metrics, tag cloud
- 🕸️ **Knowledge Graph** → Interactive network visualization with physics simulation
- 🌲 **Knowledge Explorer** → Hierarchical tree view with expand/collapse
- 🔍 **Search Interface** → Real-time search with filters
- 📈 **Analytics View** → Usage patterns and trends
- 🔄 **Recent Activity** → Latest additions and modifications

### Graph Visualization:
- **Continuous Physics** → Nodes auto-arrange to prevent overlaps
- **Priority Colors** → Visual distinction by importance
- **Relationship Lines** → See connections between entries
- **Fullscreen Mode** → Maximize for large knowledge bases
- **Search & Filter** → Find specific nodes with dimming highlight

---

## 🏗️ Project Configuration

Create project-specific settings with `setup_project`:

```javascript
setup_project({
  action: "init",
  name: "My Project",
  pathPrefix: "my-project",
  technologies: ["nodejs", "react", "postgres"],
  categories: {
    "payments": {
      keywords: ["stripe", "billing", "subscription"],
      subcategories: ["webhooks", "invoices"]
    }
  }
})
```

This creates `.knowledge-tree.json` in your docs directory for:
- Custom categories and keywords
- Auto-tagging rules
- Path prefix for all entries
- Technology stack awareness

---

## 📂 Directory Structure

```
docs/
├── .knowledge-tree.json      # Project configuration
├── logs/
│   └── usage.jsonl          # Usage analytics (gitignored)
├── frontend/
│   ├── react/
│   │   └── hooks/
│   └── performance/
├── backend/
│   ├── api/
│   ├── database/
│   └── security/
├── testing/
│   ├── unit/
│   └── integration/
└── architecture/
    ├── patterns/
    └── decisions/
```

---

## 🔐 Privacy & Security

- **Local First**: All data stored locally in your project
- **No Telemetry**: Zero external data collection
- **Git Friendly**: JSON format for version control
- **Private Analytics**: Usage logs in `.gitignore` by default

---

## 🧪 Development

```bash
# Run tests
npm test

# Run with file watching
npm run dev

# Build TypeScript
npm run build

# Lint & format
npm run lint
npm run format

# Type checking
npm run typecheck
```

### Architecture:
- **TypeScript** with strict mode
- **Modular design** with clear separation of concerns
- **MCP SDK** for Claude integration
- **Fastify** for web server
- **Vis.js** for graph visualization
- **WebSockets** for real-time updates

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file

---

## 👨‍💻 Author

**Created by [sofianedjerbi](https://github.com/sofianedjerbi)**

---

<div align="center">

**🌟 Star this project if it helps organize your AI assistant's knowledge!**

</div>