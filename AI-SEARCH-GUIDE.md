# 🔍 AI Memory Search Guide - Knowledge Tree MCP

As an AI assistant, here are all the tools you can use to search and access your knowledge/memory:

## 🎯 Primary Search Tools

### 1. `search_knowledge` - Advanced Search
Your main tool for finding specific information.

**Capabilities:**
- **Query Search**: Find entries containing specific text
- **Priority Filtering**: Focus on CRITICAL, REQUIRED, COMMON, or EDGE-CASE entries
- **Category Filtering**: Search within specific categories
- **Field-Specific Search**: Target specific fields (title, problem, solution, context, code, tags)
- **Regex Support**: Use regular expressions for complex patterns
- **Wildcard Support**: Use `*` and `?` for flexible matching
- **Relevance Scoring**: Results sorted by relevance with weighted scoring

**Example Uses:**
```bash
# Find all authentication-related critical issues
search_knowledge(
  query: "authentication",
  priority: ["CRITICAL"]
)

# Search for JWT patterns in code
search_knowledge(
  query: "jwt|token",
  regex: true,
  searchIn: ["code", "solution"]
)

# Find entries with specific tags
search_knowledge(
  query: "security",
  searchIn: ["tags"]
)

# Wildcard search
search_knowledge(
  query: "test*",  # Matches: test, testing, tests, etc.
)
```

### 2. `index_knowledge` - Browse All Memories
Get a complete overview of your knowledge base.

**Formats:**
- `tree`: Hierarchical view of categories
- `list`: Flat list of all entries
- `summary`: Statistics and overview
- `categories`: Grouped by category

**Example:**
```bash
index_knowledge(
  format: "tree",
  include_content: true,  # Include preview of content
  max_entries: 100
)
```

### 3. `recent_knowledge` - Find Recent Changes
Track what's new or modified.

**Options:**
- `days`: How far back to look (default: 7)
- `type`: "all", "added", or "modified"
- `limit`: Maximum results

**Example:**
```bash
recent_knowledge(
  days: 30,
  type: "added"
)
```

## 🔗 Relationship Navigation

### 4. Browse via Resources
Access entries directly with depth traversal:
```
knowledge://path/to/entry.json?depth=2
```
- `depth=1`: Entry + direct links
- `depth=2`: Entry + links + links of links
- `depth=3`: Three levels deep

### 5. `stats_knowledge` - Analyze Your Memory
Get insights about your knowledge base:

**Includes:**
- Summary statistics
- Priority distribution
- Category breakdown
- Orphaned entries (no links)
- Popular entries (most linked)
- Coverage analysis

**Example:**
```bash
stats_knowledge(
  include: ["summary", "priorities", "orphaned", "popular"]
)
```

## 📊 Usage Analytics

### 6. `usage_analytics` - Track Access Patterns
Understand how knowledge is being used:

**Tracks:**
- Most accessed entries
- Common search queries
- Tool usage patterns
- Access trends over time

**Example:**
```bash
usage_analytics(
  days: 30,
  include: ["access", "searches", "patterns"]
)
```

## 🎯 Search Strategies for AI

### Strategy 1: Broad to Specific
1. Start with `index_knowledge()` to understand structure
2. Use category search to narrow down
3. Apply specific query filters

### Strategy 2: Priority-Based
1. Search CRITICAL entries first for must-know information
2. Then REQUIRED for standard practices
3. COMMON for typical scenarios
4. EDGE-CASE only when needed

### Strategy 3: Relationship Exploration
1. Find a relevant entry
2. Use resource browsing with depth to explore related knowledge
3. Build context from linked entries

### Strategy 4: Tag-Based Discovery
```bash
# Find all entries with specific tags
search_knowledge(
  searchIn: ["tags"],
  query: "security"
)
```

### Strategy 5: Context-Aware Search
```bash
# Search in context fields for background info
search_knowledge(
  searchIn: ["context"],
  query: "production environment"
)
```

## 💡 Pro Tips for AI Memory Search

1. **Use Wildcards for Flexibility**
   - `auth*` finds: auth, authentication, authorize, etc.
   - `*test*` finds: test, testing, unittest, etc.

2. **Combine Filters for Precision**
   ```bash
   search_knowledge(
     priority: ["CRITICAL", "REQUIRED"],
     category: "security",
     query: "validation"
   )
   ```

3. **Search Examples for Patterns**
   ```bash
   search_knowledge(
     searchIn: ["code"],
     query: "async.*await",
     regex: true
   )
   ```

4. **Track Your Searches**
   - The system logs all searches
   - Use `usage_analytics` to see common queries
   - Helps identify knowledge gaps

5. **Use Scoring Weights**
   - Title matches: 5x weight
   - Problem matches: 3x weight
   - Solution matches: 2x weight
   - Tag matches: 2x weight

## 📋 Quick Reference

| Need | Tool | Example |
|------|------|---------|
| Find specific info | `search_knowledge` | `query: "error handling"` |
| Browse everything | `index_knowledge` | `format: "tree"` |
| Recent updates | `recent_knowledge` | `days: 7` |
| Statistics | `stats_knowledge` | `include: ["summary"]` |
| Usage patterns | `usage_analytics` | `days: 30` |
| Direct access | Resource URI | `knowledge://path.json?depth=2` |

## 🚀 Memory Search Workflow

1. **When you need to recall something:**
   ```bash
   search_knowledge(query: "topic or keyword")
   ```

2. **When exploring a domain:**
   ```bash
   search_knowledge(category: "domain-name")
   ```

3. **When checking critical info:**
   ```bash
   search_knowledge(priority: ["CRITICAL"])
   ```

4. **When building context:**
   - Find an entry
   - Access it with `?depth=2` to get related knowledge
   - Build complete understanding from linked entries

Remember: All results are returned in Markdown format for optimal AI processing!