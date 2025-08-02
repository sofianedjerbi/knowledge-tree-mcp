# 🌳 Knowledge Tree MCP Server

> **Hierarchical knowledge management system for AI assistants**  
> Transform scattered project insights into an organized, searchable knowledge base with intelligent relationships and priority-based organization.

---

## ✨ Features

<table>
<tr>
<td width="33%">

### 🏗️ **Hierarchical Structure**
Organize knowledge in intuitive folder hierarchies with clear categorization

</td>
<td width="33%">

### 🎯 **Priority System**
Four-tier priority system: **CRITICAL** → **REQUIRED** → **COMMON** → **EDGE-CASE**

</td>
<td width="33%">

### 🔗 **Smart Relationships**
Link related knowledge with bidirectional relationships and validation

</td>
</tr>
<tr>
<td>

### 🔍 **Powerful Search**
Full-text search with wildcards, priority filtering, and category-based discovery

</td>
<td>

### 📊 **Usage Analytics**
Track access patterns, popular searches, and knowledge utilization over time

</td>
<td>

### 🌐 **Web Interface**
Visual knowledge graph browser with interactive exploration

</td>
</tr>
</table>

---

## 🚀 Quick Start

### Using with Claude (Recommended)

```bash
# 🎯 Simple installation
claude mcp add knowledge-tree npx -- -y @sofianedjerbi/knowledge-tree-mcp

# 🎨 With web interface
claude mcp add knowledge-tree npx -- -y @sofianedjerbi/knowledge-tree-mcp -- --port 3000

# 📁 Custom docs location + web UI
claude mcp add knowledge-tree npx -- -y @sofianedjerbi/knowledge-tree-mcp -- --docs /path/to/docs --port 3000
```

### Local Development

```bash
# 📦 Setup
git clone <repo>
cd knowledge-tree-mcp
npm install && npm run build

# 🏃‍♂️ Run
npm start                              # Default setup
npm start -- --port 3000             # With web interface  
npm start -- --docs /custom/path     # Custom docs directory
```

**CLI Options:**
- `--docs, -d <path>` → Documentation directory (default: `./docs`)
- `--port, -p <number>` → Web interface port (enables UI)
- `--help, -h` → Show help

---

## 🛠️ Available Tools

<details>
<summary><b>🆘 1. help</b> - Get comprehensive guidance</summary>

**Get contextual help for using the Knowledge Tree MCP system**

```typescript
help(topic?: string)
```

**Topics:**
- `overview` → General introduction and concepts
- `creating` → How to create knowledge entries  
- `linking` → Managing relationships between entries
- `searching` → Finding and filtering knowledge
- `validating` → Checking consistency and errors
- `examples` → Real-world usage examples

**Examples:**
```bash
"help"                           # General help
"help me create knowledge entries" # Specific guidance
```

</details>

<details>
<summary><b>🗺️ 2. index_knowledge</b> - Get complete knowledge overview</summary>

**Perfect for LLMs: Get instant overview of entire knowledge base**

```typescript
index_knowledge({
  format?: "tree" | "list" | "summary" | "categories",
  include_content?: boolean,
  max_entries?: number
})
```

**Formats:**
- 🌳 `tree` → Hierarchical folder structure (default)
- 📋 `list` → Flat list with metadata
- 📄 `summary` → Detailed entries with file stats  
- 📁 `categories` → Grouped by directory/category

**Examples:**
```bash
"Show me the knowledge index"       # Tree overview
"List all entries with content"     # Content preview
"Show knowledge by categories"      # Organized view
```

> **🧠 LLM Benefit:** Provides instant context about entire knowledge base without multiple queries!

</details>

<details>
<summary><b>🔍 3. search_knowledge</b> - Find specific knowledge</summary>

**Search through your knowledge base with powerful filters**

```typescript
search_knowledge({
  priority?: string[],
  category?: string,
  keyword?: string  // Supports wildcards: *, ?
})
```

**Search Types:**
- 🎯 **Priority:** `CRITICAL`, `REQUIRED`, `COMMON`, `EDGE-CASE`
- 📁 **Category:** Search within folders (`testing`, `architecture`)
- 🔎 **Keyword:** Full-text with wildcards (`auth*`, `test?ng`)

**Examples:**
```bash
"Search for all CRITICAL knowledge"
"Find knowledge about testing"  
"Search for auth* patterns"         # Wildcard search
"Find REQUIRED authentication entries"
```

</details>

<details>
<summary><b>➕ 4. add_knowledge</b> - Create new entries</summary>

**Create new knowledge entries with validation and auto-linking**

```typescript
add_knowledge({
  path: string,           // e.g., "testing/forbidden/CRITICAL-no-mocks"
  priority: string,       // CRITICAL | REQUIRED | COMMON | EDGE-CASE
  problem: string,        // What issue this solves
  solution: string,       // How to solve/avoid it
  code?: string,          // Optional code examples
  related_to?: Array<{    // Optional relationships
    path: string,
    relationship: string,
    description?: string
  }>
})
```

**Examples:**
```bash
"Add knowledge about avoiding test workarounds"
"Document a critical architecture decision"
"Record JWT authentication pattern that supersedes sessions"
```

</details>

<details>
<summary><b>🔗 5. link_knowledge</b> - Connect related entries</summary>

**Create relationships between knowledge entries**

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

**Examples:**
```bash
"Link JWT pattern to session auth as supersedes"
"Mark two auth approaches as conflicting"
"Connect related error handling strategies"
```

</details>

<details>
<summary><b>✅ 6. validate_knowledge</b> - Check consistency</summary>

**Validate your knowledge base for errors and inconsistencies**

```typescript
validate_knowledge({
  path?: string,    // Optional: specific entry or all
  fix?: boolean     // Optional: attempt fixes
})
```

**Validation Checks:**
- 🔗 Broken links between entries
- 📁 Missing referenced files  
- 🔄 Bidirectional relationship consistency
- 📝 JSON format validation
- 🏷️ Priority-filename matching

**Examples:**
```bash
"Validate all knowledge entries"
"Validate and fix any issues"
"Check if testing/CRITICAL-no-mocks.json is valid"
```

</details>

<details>
<summary><b>📊 7. usage_analytics</b> - Track usage patterns</summary>

**Get comprehensive usage analytics for your knowledge base**

```typescript
usage_analytics({
  days?: number,      // Analysis period (default: 30)
  include?: string[]  // Analytics types
})
```

**Analytics Types:**
- 👀 `access` → Entry access patterns and most viewed
- 🔎 `searches` → Popular queries and search patterns  
- 🛠️ `tools` → Tool usage statistics
- ⏰ `patterns` → Activity patterns by time and type

**Examples:**
```bash
"Show usage analytics for last 7 days"
"Get search analytics only"
"Show access patterns for last month"
```

> **🔒 Privacy:** Add `docs/logs/` to `.gitignore` to keep analytics private

</details>

---

## 🌐 Resources & Depth Traversal

The server exposes all JSON files as browsable resources with intelligent depth traversal:

```bash
# Basic entry
knowledge://testing/CRITICAL-no-mocks.json

# With linked entries  
knowledge://auth/patterns/REQUIRED-jwt.json?depth=2

# Deep exploration
knowledge://architecture/csr/patterns.json?depth=3
```

**Depth Levels:**
- `depth=1` → Just the entry itself
- `depth=2` → Entry + directly linked entries  
- `depth=3` → Entry + linked entries + their links
- `depth=N` → Continue traversal N levels deep

> **🕸️ Knowledge Graph:** Explore related concepts without multiple queries!

---

## 💡 Example Usage Patterns

<table>
<tr>
<td width="50%">

### 🎯 **For New Projects**
```bash
# Get oriented
"Show me the knowledge index"

# Understand critical issues  
"Search for all CRITICAL knowledge"

# Learn about specific area
"Find knowledge about testing"
```

</td>
<td width="50%">

### 🔄 **For Ongoing Work**
```bash
# Quick context refresh
"Get tree view of authentication knowledge"

# Find solutions
"Search for error handling patterns"

# Add new insights
"Add knowledge about API rate limiting"
```

</td>
</tr>
</table>

---

## 📋 Knowledge Entry Format

### Basic Structure
```json
{
  "priority": "CRITICAL",
  "problem": "AI creates TODO comments instead of implementing",
  "solution": "Complete the implementation immediately",
  "code": "// Example demonstrating the complete pattern",
  "related_to": [
    {
      "path": "code-quality/REQUIRED-complete-implementations.json",
      "relationship": "related",
      "description": "General principle about complete implementations"
    }
  ]
}
```

### With Depth Traversal
```json
{
  "path": "code-quality/forbidden/CRITICAL-no-todo.json",
  "priority": "CRITICAL", 
  "problem": "AI creates TODO comments instead of implementing",
  "solution": "Complete the implementation immediately",
  "linked_entries": {
    "code-quality/REQUIRED-complete-implementations.json": {
      "relationship": "related",
      "content": {
        "priority": "REQUIRED",
        "problem": "Incomplete implementations break production",
        "solution": "Always write complete, working code"
      }
    }
  }
}
```

---

## 👨‍💻 Author

**Created by [sofianedjerbi](https://github.com/sofianedjerbi)**

---

<div align="center">

**🌟 Star this project if it helps organize your knowledge!**

</div>