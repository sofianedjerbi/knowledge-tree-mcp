# Knowledge Tree MCP Server

An MCP server that creates and manages a hierarchical knowledge system for AI assistants.

## Features

- **Hierarchical Knowledge Storage**: Organizes knowledge in a tree structure
- **Priority-based System**: CRITICAL, REQUIRED, COMMON, or EDGE-CASE
- **Code Validation**: Checks code against known anti-patterns
- **Knowledge Management**: Add, search, and browse knowledge entries
- **Self-contained**: Stores docs inside the package by default
- **Web Interface** (optional): Visual knowledge graph browser when using --port

## Installation

### Using with Claude (recommended)

```bash
# Install globally with npx
claude mcp add knowledge-tree npx -- -y @sofianedjerbi/knowledge-tree-mcp

# With custom docs directory
claude mcp add knowledge-tree npx -- -y @sofianedjerbi/knowledge-tree-mcp -- --docs /path/to/your/docs

# With web interface on port 3000
claude mcp add knowledge-tree npx -- -y @sofianedjerbi/knowledge-tree-mcp -- --port 3000

# With both custom docs and web interface
claude mcp add knowledge-tree npx -- -y @sofianedjerbi/knowledge-tree-mcp -- --docs /path/to/docs --port 3000
```

### Local Development

```bash
# Clone and install
git clone <repo>
cd knowledge-tree-mcp
npm install
npm run build

# Run with default docs directory (./docs)
npm start

# Run with custom docs directory
npm start -- --docs /path/to/docs

# Run with web interface
npm start -- --port 3000

# Run with all options
npm start -- --docs /path/to/docs --port 8080

# Show help
npm start -- --help
```

### Command Line Options

- `--docs, -d <path>` - Path to documentation directory (default: ./docs)
- `--port, -p <number>` - Port for web interface (optional, enables web UI)
- `--help, -h` - Show help message

## Available Tools

### 1. help
Get comprehensive help on using the Knowledge Tree MCP:
- `topic`: Optional - Choose specific help topic
  - `overview`: General introduction
  - `creating`: How to create entries  
  - `linking`: Managing relationships
  - `searching`: Finding knowledge
  - `validating`: Checking consistency
  - `examples`: Real-world examples

Example: "help" or "help me create knowledge entries"

### 2. search_knowledge
Search through your knowledge base with powerful filters:
- `priority`: Filter by CRITICAL, REQUIRED, COMMON, or EDGE-CASE
- `category`: Search within specific folders (e.g., "testing", "architecture")
- `keyword`: Full-text search in problem and solution descriptions (supports wildcards: * = any text, ? = any single character)

Examples:
- "Search for all CRITICAL knowledge"
- "Find knowledge about testing"
- "Search for authentication issues"
- "Search for auth* to find anything starting with 'auth'"
- "Search for test?ng to find 'testing', 'testang', etc."

### 3. add_knowledge
Create new knowledge entries to build your knowledge base:
- `path`: Where to store (e.g., "testing/forbidden/CRITICAL-no-mocks")
- `priority`: Set as CRITICAL, REQUIRED, COMMON, or EDGE-CASE
- `problem`: Describe what issue this solves
- `solution`: Document the solution or best practice
- `code`: Add optional code examples
- `related_to`: Optional array of linked entries
  - `path`: Path to related entry
  - `relationship`: Type (related, supersedes, etc.)
  - `description`: Optional context

Examples:
- "Add knowledge about avoiding test workarounds"
- "Document a critical architecture decision"
- "Record a common error and its solution"
- "Add new auth pattern that supersedes the old one"

### 4. link_knowledge
Create relationships between knowledge entries:
- `from`: Source knowledge path
- `to`: Target knowledge path to link to
- `relationship`: Type of link
  - `related`: General relationship (creates bidirectional link)
  - `supersedes`: This entry replaces the target
  - `superseded_by`: This entry is replaced by target
  - `conflicts_with`: Conflicting approaches (creates bidirectional link)
  - `implements`: This implements the target pattern
  - `implemented_by`: This is an implementation of target
- `description`: Optional context about the relationship

Note: Only `related` and `conflicts_with` automatically create reverse links.

Examples:
- "Link the new auth pattern to the old one it supersedes"
- "Mark two approaches as conflicting" (creates bidirectional)
- "Connect related error handling strategies" (creates bidirectional)

### 5. validate_knowledge
Check your knowledge base for consistency and errors:
- `path`: Optional - validate specific entry or all if omitted
- `fix`: Optional - attempt to fix issues (like missing bidirectional links)

Examples:
- "Validate all knowledge entries"
- "Validate and fix any issues"
- "Check if testing/CRITICAL-no-mocks.json is valid"

### 6. usage_analytics
Get comprehensive usage analytics for your knowledge base:
- `days`: Number of days to analyze (default: 30)
- `include`: Array of analytics types to include (default: all)
  - `access`: Entry access patterns and most viewed entries
  - `searches`: Search queries and popular patterns
  - `tools`: Tool usage statistics
  - `patterns`: Activity patterns by time and type

Examples:
- "Show me usage analytics for the last 7 days"
- "Get search analytics only"
- "Show access patterns for the last month"

**Setup Tip:** Add `docs/logs/` to your `.gitignore` file to keep usage analytics data private and out of version control.

## Resources

The server exposes all JSON files as browsable resources with depth traversal:
- `knowledge://testing/workarounds/forbidden/CRITICAL-no-test-hacks.json` - Default depth=1
- `knowledge://architecture/csr/forbidden/CRITICAL-never-create-page-server-ts.json?depth=2` - Include linked entries
- `knowledge://path/to/entry.json?depth=3` - Traverse up to 3 levels deep

### Depth Parameter
When retrieving resources, you can specify how deep to follow links:
- `?depth=1` (default): Just the entry itself
- `?depth=2`: Entry + directly linked entries
- `?depth=3`: Entry + linked entries + their linked entries
- etc.

This creates a knowledge graph where you can explore related concepts without multiple queries!

## Example Usage in Claude

```
"Search for all CRITICAL knowledge"
"Find all knowledge about testing workarounds"
"Add knowledge about a new authentication pattern we discovered"
"Show me what we've learned about CSR architecture"
"Search for solutions to error handling"
```

## Knowledge Entry Format

Basic entry:
```json
{
  "priority": "CRITICAL",
  "problem": "AI creates TODO comments instead of implementing",
  "solution": "Complete the implementation immediately",
  "code": "// Example code demonstrating the issue",
  "related_to": [
    {
      "path": "code-quality/REQUIRED-complete-implementations.json",
      "relationship": "related",
      "description": "General principle about complete implementations"
    }
  ]
}
```

With depth=2 retrieval:
```json
{
  "path": "code-quality/forbidden/CRITICAL-no-todo.json",
  "priority": "CRITICAL",
  "problem": "AI creates TODO comments instead of implementing",
  "solution": "Complete the implementation immediately",
  "code": "// Example code demonstrating the issue",
  "related_to": [...],
  "linked_entries": {
    "code-quality/REQUIRED-complete-implementations.json": {
      "relationship": "related",
      "description": "General principle about complete implementations",
      "content": {
        "path": "code-quality/REQUIRED-complete-implementations.json",
        "priority": "REQUIRED",
        "problem": "Incomplete implementations break production",
        "solution": "Always write complete, working code"
      }
    }
  }
}
```

## Author

Created by [sofianedjerbi](https://github.com/sofianedjerbi)