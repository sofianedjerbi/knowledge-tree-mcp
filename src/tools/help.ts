/**
 * Help tool implementation
 * Provides context-aware help for using the Knowledge MCP system
 * Optimized for AI/LLM consumption with structured markdown
 */

import type { ToolHandler, HelpArgs, MCPResponse } from '../types/index.js';
import { HELP_TOPICS } from '../constants/index.js';

/**
 * Help texts for different topics - AI-optimized markdown format
 */
const helpTexts: Record<string, string> = {
  overview: `# 📚 Knowledge MCP - AI-Optimized Guide

## 🎯 Purpose
A structured knowledge management system for AI assistants to maintain project-specific context, patterns, and decisions.

## 🏗️ Core Architecture

### Knowledge Entry Structure (v2.0)
\`\`\`typescript
{
  // REQUIRED FIELDS
  "title": "Clear, descriptive title for quick identification",
  "priority": "CRITICAL | REQUIRED | COMMON | EDGE-CASE",
  "problem": "What issue does this address?",
  "solution": "How to properly handle this",
  
  // CATEGORIZATION (Recommended)
  "slug": "url-friendly-identifier",
  "category": "main/subcategory",
  "tags": ["searchable", "keywords", "topics"],
  
  // DETAILED CONTEXT
  "context": "When/why this applies, background information",
  "examples": [
    {
      "title": "Example name",
      "description": "What this shows",
      "code": "actual code snippet",
      "language": "typescript"
    }
  ],
  
  // RELATIONSHIPS
  "related_to": [
    {
      "path": "other/entry.json",
      "relationship": "related|supersedes|conflicts_with|implements",
      "description": "How they relate"
    }
  ],
  
  // METADATA
  "author": "Who created this",
  "version": "1.0.0",
  "created_at": "ISO timestamp",
  "updated_at": "ISO timestamp"
}
\`\`\`

### Priority Selection Guide - USE ALL FOUR TYPES PROACTIVELY

**🔴 CRITICAL** - System-breaking issues that prevent functionality:
- Security vulnerabilities, data corruption risks
- Architecture violations that compromise system integrity
- Configuration errors that cause complete failure

**🟠 REQUIRED** - Essential operations needed for daily development:
- Setup procedures, core tool usage, team standards
- Primary workflows, fundamental patterns
- Key debugging techniques, essential troubleshooting

**🟡 COMMON** - Quality improvements and helpful patterns:
- Performance optimizations, code organization tips
- Useful shortcuts, development productivity enhancements  
- Best practices that improve maintainability

**🟢 EDGE-CASE** - Rare but important scenarios:
- Browser-specific quirks, platform compatibility issues
- Uncommon error conditions, specific workarounds
- Legacy system interactions, unusual configurations

**⚠️ PRIORITY SELECTION RULES**:
- Choose based on ACTUAL impact and frequency
- Don't artificially elevate priorities
- Use EDGE-CASE for genuinely rare scenarios
- Use COMMON for general improvements and tips

### Available Tools
| Tool | Purpose | Key Parameters |
|------|---------|----------------|
| \`index_knowledge\` | Get complete knowledge map | format: tree/list/summary |
| \`search_knowledge\` | Find specific entries | query, tags, priority, category |
| \`add_knowledge\` | Create new entries | content (path auto-generated from title) |
| \`update_knowledge\` | Modify existing entries | path, updates object |
| \`link_knowledge\` | Connect related entries | from, to, relationship |
| \`validate_knowledge\` | Check consistency | path (optional), fix: boolean |
| \`export_knowledge\` | Generate documentation | format: markdown/json/html |
| \`stats_knowledge\` | Analytics and insights | include: various metrics |
| \`manage_categories\` | CRUD operations on categories | action, category, keywords |`,

  creating: `# 📝 Creating Knowledge Entries - Best Practices

## 🚀 Simplified Creation (NEW!)

With auto-path generation, you no longer need to worry about file paths! Just provide the content:

\`\`\`bash
add_knowledge(
  content: """
---
title: How to find an element in Redis
priority: COMMON
tags: [redis, database, search]
---

# Problem
Need to search for specific elements in Redis data structures

# Solution
Use appropriate Redis commands based on data type...
"""
)
\`\`\`

**Auto-generates path**: \`database/redis/how-to/find-element.json\`

### Path Generation Examples:
- "How to find an element in Redis" → \`database/redis/how-to/find-element.json\`
- "JWT authentication best practices" → \`auth/jwt/best-practices.json\`
- "Fix MongoDB connection timeout" → \`database/mongodb/troubleshooting/connection-timeout.json\`
- "React hooks tutorial" → \`frontend/react/how-to/hooks.json\`

## 📁 Custom Path Override (Optional)

You can optionally specify a custom path or directory:

### Full Path
\`\`\`bash
add_knowledge(
  path: "security/auth/my-jwt-guide",  # .json auto-added
  content: "..."
)
\`\`\`

### Directory Only (Filename from Title)
\`\`\`bash
add_knowledge(
  path: "security/auth/",  # or just "security/auth"
  content: """
---
title: JWT Token Refresh Strategy
...
"""
)
# Creates: security/auth/jwt-token-refresh-strategy.json
\`\`\`

### When to Use Custom Paths:
- **Organization Override**: Force specific categorization
- **Project Structure**: Match existing folder conventions
- **Team Standards**: Follow agreed naming patterns
- **Migration**: Preserve paths from other systems

## 🎯 Entry Creation Strategy

### 1. Path Structure (Auto-Generated)

All knowledge entries are stored as JSON files internally for consistency and programmatic access.

\`\`\`
category/subcategory/descriptive-name.json
\`\`\`

**Examples:**
- \`testing/forbidden/no-mock-implementations.json\`
- \`auth/patterns/jwt-authentication.json\`
- \`performance/tips/lazy-loading.json\`

**Note**: Priority is stored as a JSON attribute, not in the filename.

### 2. Input/Output Format Policy

**IMPORTANT**: Knowledge MCP uses a strict format policy:

- **Storage**: Always JSON (for reliability and structure)
- **Input**: Always Markdown (AI-friendly)
- **Output**: Always Markdown (AI-friendly)
- **Exception**: HTML only for web UI

This ensures:
- ✅ Consistent storage (JSON files)
- ✅ AI-optimized I/O (Markdown only)
- ✅ No format confusion
- ✅ Clean separation of concerns

### 2. Writing Effective Entries

#### Title (NEW - Required)
- **Purpose**: Quick identification in search results
- **Format**: Action-oriented, specific
- **Examples**:
  - ✅ "Avoid TODO comments in production code"
  - ✅ "Use JWT tokens for stateless authentication"
  - ❌ "TODO issue" (too vague)
  - ❌ "Authentication" (not specific)

#### Problem Statement
- **Be Specific**: What exact issue does this address?
- **Add Context**: When does this problem occur?
- **Impact**: What happens if ignored?

#### Solution
- **Actionable**: Clear steps or patterns to follow
- **Complete**: No "implement later" placeholders
- **Verified**: Must be tested and working

#### Context (NEW - Recommended)
- **When**: Conditions that trigger this knowledge
- **Why**: Business or technical reasoning
- **Scope**: Where this applies (or doesn't)

### 3. Examples Structure (NEW)
\`\`\`json
"examples": [
  {
    "title": "Bad Example - What to avoid",
    "description": "Common mistake that causes issues",
    "code": "// Problematic code here",
    "language": "typescript"
  },
  {
    "title": "Good Example - Recommended approach",
    "description": "Proper implementation following best practices",
    "code": "// Correct code here",
    "language": "typescript"
  }
]
\`\`\`

### 4. Categorization Strategy

#### Categories
- Use forward slashes for hierarchy: \`auth/tokens/refresh\`
- Keep depth reasonable (2-3 levels max)
- Common categories:
  - \`architecture/\` - System design decisions
  - \`testing/\` - Test strategies and patterns
  - \`security/\` - Security policies and fixes
  - \`performance/\` - Optimization techniques
  - \`code-quality/\` - Style and standards

#### Tags (NEW)
- Add 3-5 relevant tags for better searchability
- Use consistent tag vocabulary:
  - Technical: \`async\`, \`validation\`, \`caching\`
  - Domain: \`authentication\`, \`payment\`, \`user-management\`
  - Quality: \`best-practice\`, \`anti-pattern\`, \`deprecated\`

### 5. Complete Example (Auto-Path)

\`\`\`bash
# No path needed - auto-generated from title!
add_knowledge(
  content: """
---
title: Prevent SQL injection with parameterized queries
priority: CRITICAL
category: security
tags: [sql, injection, validation, database]
author: Security Team
version: 1.0.0
---

# Problem

Direct string concatenation in SQL queries allows injection attacks

# Context

Applies to all database queries, especially those with user input. Critical for any endpoints that accept user data and interact with databases.

# Solution

Always use parameterized queries or prepared statements. Never concatenate user input directly into SQL strings.

# Examples

## Vulnerable Pattern
*Direct concatenation allows SQL injection*

\`\`\`javascript
const query = \`SELECT * FROM users WHERE id = \${userId}\`;
\`\`\`

## Secure Pattern
*Parameterized query prevents injection*

\`\`\`javascript
const query = 'SELECT * FROM users WHERE id = ?';
db.query(query, [userId]);
\`\`\`
"""
)
\`\`\``,

  linking: `# 🔗 Knowledge Relationships - Graph Structure

## 🎯 Relationship Types

### Bidirectional (Auto-reverse)
These create automatic reverse links:

| Type | Usage | Reverse Link |
|------|-------|--------------|
| \`related\` | General connection between topics | Same (\`related\`) |
| \`conflicts_with\` | Mutually exclusive approaches | Same (\`conflicts_with\`) |

### Directional (Manual reverse)
These require explicit reverse links if needed:

| Type | Usage | Common Reverse |
|------|-------|----------------|
| \`supersedes\` | This replaces the target | \`superseded_by\` |
| \`superseded_by\` | This is replaced by target | \`supersedes\` |
| \`implements\` | Concrete implementation of pattern | \`implemented_by\` |
| \`implemented_by\` | Has concrete implementations | \`implements\` |

## 🔄 Linking Strategies

### 1. During Creation
\`\`\`json
{
  "related_to": [
    {
      "path": "patterns/repository-pattern.json",
      "relationship": "implements",
      "description": "Implements repository pattern for user data"
    },
    {
      "path": "deprecated/direct-db-access.json",
      "relationship": "supersedes",
      "description": "Replaces direct database access anti-pattern"
    }
  ]
}
\`\`\`

### 2. After Creation
\`\`\`bash
link_knowledge(
  from: "auth/jwt-tokens",
  to: "auth/jwt-key-rotation",
  relationship: "related",
  description: "Key rotation is essential for JWT security"
)
\`\`\`

### 3. Knowledge Graph Patterns

#### Hub Pattern
One central entry linked to many related entries:
\`\`\`
[Authentication Hub]
    ├── implements → [JWT Pattern]
    ├── implements → [OAuth Pattern]
    ├── related → [Session Management]
    └── conflicts_with → [Basic Auth]
\`\`\`

#### Chain Pattern
Sequential knowledge building on each other:
\`\`\`
[Basic React] → superseded_by → [React Hooks] → superseded_by → [React Server Components]
\`\`\`

#### Network Pattern
Interconnected knowledge web:
\`\`\`
[Error Handling] ←→ [Logging]
        ↓               ↓
   [Retry Logic] ← [Monitoring]
\`\`\`

## 📊 Viewing Relationships

### Browse with Depth
Access linked entries recursively:
\`\`\`
knowledge://security/auth/jwt-validation.json?depth=2
\`\`\`
- depth=1: Direct links only
- depth=2: Links of links
- depth=3: Three levels deep`,

  searching: `# 🔍 Advanced Search - AI-Optimized Queries

## 🎯 Search Strategies

### 1. Field-Specific Search (NEW)
Target specific fields for precision:

\`\`\`bash
# Search in titles only
search_knowledge(
  query: "authentication",
  searchIn: ["title"]
)

# Search in tags
search_knowledge(
  query: "security",
  searchIn: ["tags"]
)

# Search everywhere
search_knowledge(
  query: "validation",
  searchIn: ["all"]  # title, problem, solution, context, code, tags
)
\`\`\`

### 2. Multi-Criteria Filtering
Combine filters for precise results:

\`\`\`bash
# Critical security issues
search_knowledge(
  priority: ["CRITICAL"],
  category: "security",
  tags: ["vulnerability"]
)

# Required patterns for authentication
search_knowledge(
  priority: ["REQUIRED"],
  category: "auth",
  query: "pattern"
)
\`\`\`

### 3. Search Scoring Weights
Results are scored by relevance:
- **Title matches**: 5x weight (NEW)
- **Problem matches**: 3x weight
- **Solution matches**: 2x weight
- **Tag matches**: 2x weight (NEW)
- **Other fields**: 1x weight

### 4. Wildcard Patterns
Flexible pattern matching:

| Pattern | Matches | Example |
|---------|---------|---------|
| \`auth*\` | Starts with "auth" | authentication, authorize |
| \`*test\` | Ends with "test" | unittest, integrationtest |
| \`*id*\` | Contains "id" | validation, identity |
| \`te?t\` | Single char wildcard | test, text |
| \`*\` | Everything | Returns all entries |

### 5. Regex Search
For complex patterns:

\`\`\`bash
search_knowledge(
  query: "use(State|Effect|Memo)",
  regex: true,
  searchIn: ["code"]
)
\`\`\`

### 6. Smart Queries

#### Find Recent Changes
\`\`\`bash
recent_knowledge(
  days: 7,
  type: "modified"
)
\`\`\`

#### Find Orphaned Entries
\`\`\`bash
stats_knowledge(
  include: ["orphaned"]
)
\`\`\`

#### Find by Relationship
\`\`\`bash
# Find all entries that supersede others
search_knowledge(
  query: '"relationship": "supersedes"',
  searchIn: ["code"]
)
\`\`\`

## 📊 Search Result Format

Results include:
- Total matches found
- Relevance scores
- Highlighted matches
- Related entry links
- Metadata (author, version, timestamps)`,

  validating: `# ✅ Validation System - Ensuring Knowledge Integrity

## 🎯 Validation Checks

### 1. Required Field Validation (Updated)
- ✓ \`title\` - Non-empty string (NEW)
- ✓ \`priority\` - Valid enum value
- ✓ \`problem\` - Non-empty string
- ✓ \`solution\` - Non-empty string

### 2. Structural Validation
- ✓ Valid JSON syntax
- ✓ Filename follows naming conventions
- ✓ Path follows naming conventions
- ✓ Maximum field lengths respected

### 3. Relationship Validation
- ✓ All linked entries exist
- ✓ Relationship types are valid
- ✓ No circular dependencies
- ✓ Bidirectional links are symmetric

### 4. Content Validation
- ✓ No TODO/placeholder content
- ✓ No empty code blocks
- ✓ Examples have required fields
- ✓ Tags follow conventions

## 🔧 Validation Commands

### Full Validation
\`\`\`bash
# Check everything
validate_knowledge()

# Auto-fix issues
validate_knowledge(fix: true)
\`\`\`

### Targeted Validation
\`\`\`bash
# Single entry
validate_knowledge(
  path: "auth/input-validation.json"
)

# Category validation
validate_knowledge(
  path: "security/"
)
\`\`\`

## 🚨 Common Issues & Fixes

### Issue: Missing Title
**Error**: "Missing or invalid title"
**Fix**: Add descriptive title to entry
\`\`\`json
{
  "title": "Validate user input to prevent XSS attacks",
  ...
}
\`\`\`

### Issue: Filename Mismatch
**Error**: "Priority mismatch"
**Fix**: Update the priority in the JSON content
\`\`\`bash
update_knowledge(
  path: "auth/input-validation.json",
  updates: { priority: "CRITICAL" }
)
\`\`\`

### Issue: Broken Links
**Error**: "Broken link to auth/old-pattern.json"
**Fix**: Update or remove the invalid reference
\`\`\`bash
update_knowledge(
  path: "current-entry.json",
  updates: {
    related_to: [] // Remove broken links
  }
)
\`\`\`

### Issue: Missing Bidirectional Link
**Error**: "Missing reverse link from target"
**Fix**: Run with auto-fix enabled
\`\`\`bash
validate_knowledge(fix: true)
\`\`\`

## 📊 Validation Reports

The validator returns:
- Total entries checked
- Issues found (grouped by type)
- Entries affected
- Auto-fixes applied
- Recommendations for manual fixes`,

  examples: `# 💡 Real-World Examples - Complete Workflows

## 🎯 Example 1: Document a Critical Security Issue

### Scenario
You discovered SQL injection vulnerability in user search.

\`\`\`bash
# 1. Create the knowledge entry (path auto-generated!)
add_knowledge(
  content: """
---
title: SQL injection vulnerability in user search endpoint
priority: CRITICAL
category: security
tags: [sql-injection, vulnerability, user-search, critical-fix]
author: Security Team
version: 1.0.0
---

# Problem
User search endpoint directly concatenates input into SQL query, allowing arbitrary SQL execution

# Context
Affects /api/users/search endpoint used by admin panel. Discovered during security audit. Can lead to full database compromise.

# Solution
Replace string concatenation with parameterized queries using prepared statements. Add input validation layer.

# Examples
## Vulnerable Code
*Direct concatenation allows SQL injection*

\`\`\`javascript
const query = \`SELECT * FROM users WHERE name LIKE '%\${searchTerm}%'\`;
const results = await db.raw(query);
\`\`\`

## Secure Implementation
*Parameterized query prevents injection*

\`\`\`javascript
const query = 'SELECT * FROM users WHERE name LIKE ?';
const results = await db.raw(query, [\`%\${searchTerm}%\`]);
\`\`\`
"""
)

# Output shows: "Location: security/vulnerabilities/sql-injection-vulnerability.json (auto-generated)"

# 2. Link to general SQL injection knowledge (using the auto-generated path)
link_knowledge(
  from: "security/vulnerabilities/sql-injection-vulnerability",
  to: "security/threats/sql-injection-overview",
  relationship: "related",
  description: "Specific instance of SQL injection vulnerability"
)

# 3. Validate the new entries
validate_knowledge(fix: true)
\`\`\`

## 🎯 Example 2: Deprecate an Old Pattern

### Scenario
Team decided to move from Redux to Zustand for state management.

\`\`\`bash
# 1. Create new pattern documentation (auto-path!)
add_knowledge(
  content: """
---
title: Use Zustand for client-side state management
priority: REQUIRED
category: state-management
tags: [zustand, state, react, pattern]
author: Frontend Team
version: 1.0.0
---

# Problem
Need simple, performant state management without boilerplate

# Context
Applies to all new React components requiring global state. Decision made in Q4 2024 architecture review.

# Solution
Use Zustand stores for global state management. Keep stores small and focused.

# Examples
## Basic Zustand Store
*Simple counter store example*

\`\`\`typescript
import { create } from 'zustand';

const useCounterStore = create((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
}));
\`\`\`
"""
)

# 2. Update old Redux pattern
update_knowledge(
  path: "state-management/patterns/redux-store",
  updates: {
    priority: "EDGE-CASE",
    context: "DEPRECATED: Only use for legacy components. New development should use Zustand.",
    related_to: [{
      path: "state-management/patterns/zustand-store",
      relationship: "superseded_by",
      description: "Replaced by simpler Zustand pattern"
    }]
  }
)

# 3. Search for Redux usage to identify migration targets
search_knowledge(
  query: "redux",
  searchIn: ["all"]
)
\`\`\`

## 🎯 Example 3: Create a Knowledge Network

### Scenario
Document authentication system with multiple related patterns.

\`\`\`bash
# 1. Create hub entry
add_knowledge(
  path: "auth/overview/authentication-architecture",
  title: "Authentication system architecture overview",
  priority: "REQUIRED",
  category: "auth",
  tags: ["authentication", "architecture", "overview"],
  problem: "Need consistent authentication across all services",
  solution: "Use JWT with refresh tokens, implement in API gateway",
  context: "Central authentication strategy for all microservices"
)

# 2. Create related entries and link them
const authEntries = [
  "auth/tokens/jwt-structure",
  "auth/tokens/jwt-validation", 
  "auth/refresh/refresh-token-rotation",
  "auth/security/token-storage"
];

authEntries.forEach(entry => {
  link_knowledge(
    from: "auth/overview/authentication-architecture",
    to: entry,
    relationship: "related",
    description: "Part of authentication system"
  )
});

# 3. Create implementation examples
add_knowledge(
  path: "auth/implementations/express-jwt-middleware",
  title: "Express.js JWT authentication middleware",
  priority: "COMMON",
  tags: ["express", "jwt", "middleware", "nodejs"],
  problem: "Need to validate JWT tokens in Express routes",
  solution: "Use express-jwt middleware with proper configuration",
  related_to: [{
    path: "auth/tokens/jwt-validation",
    relationship: "implements",
    description: "Implements JWT validation pattern for Express"
  }]
)
\`\`\`

## 🎯 Example 4: Knowledge Base Analytics

### Scenario
Monthly review of knowledge base health.

\`\`\`bash
# 1. Get overview statistics
stats_knowledge(
  include: ["summary", "priorities", "categories", "orphaned", "popular"]
)

# 2. Find recent additions
recent_knowledge(
  days: 30,
  type: "added"
)

# 3. Check for issues
validate_knowledge()

# 4. Analyze usage patterns
usage_analytics(
  days: 30,
  include: ["access", "searches", "tools", "patterns"]
)

# 5. Export critical knowledge for review
export_knowledge(
  format: "markdown",
  filter: {
    priority: ["CRITICAL", "REQUIRED"]
  },
  include_links: true
)
\`\`\`

## 🎯 Example 5: Search Workflows

### Scenario
Finding all test-related critical issues.

\`\`\`bash
# 1. Basic search
search_knowledge(
  priority: ["CRITICAL"],
  tags: ["testing"]
)

# 2. Advanced pattern search
search_knowledge(
  query: "(mock|stub|spy)",
  regex: true,
  searchIn: ["problem", "solution"],
  priority: ["CRITICAL", "REQUIRED"]
)

# 3. Find conflicting approaches
search_knowledge(
  query: "conflicts_with",
  searchIn: ["code"],
  category: "testing"
)

# 4. Export search results
const results = search_knowledge(
  category: "testing",
  priority: ["CRITICAL"]
);
// Process results for documentation
\`\`\``,

  categories: `# 🏷️ Category Management - AI-Optimized Guide

## 🎯 Purpose
Dynamically manage knowledge categories to improve organization and auto-categorization.

## 📌 Quick Usage

### List All Categories
\`\`\`javascript
manage_categories({
  action: "list",
  scope: "both"  // "project" | "system" | "both"
})
\`\`\`

### Add Category
\`\`\`javascript
manage_categories({
  action: "add",
  category: "certif-trainer",
  keywords: ["certification", "exam", "aws", "azure"],
  subcategories: ["aws", "azure", "gcp"],
  scope: "project"
})
\`\`\`

### Update Category
\`\`\`javascript
manage_categories({
  action: "update",
  category: "frontend",
  keywords: ["react", "vue", "svelte", "ui"],  // Replaces existing
  scope: "project"
})
\`\`\`

### Merge Keywords (Add without replacing)
\`\`\`javascript
manage_categories({
  action: "merge",
  category: "backend",
  keywords: ["fastapi", "django"],  // Adds to existing
  scope: "system"
})
\`\`\`

### Remove Category
\`\`\`javascript
manage_categories({
  action: "remove",
  category: "deprecated-category",
  scope: "project"
})
\`\`\`

## 🎨 Category Scopes

### Project Categories
- Stored in project's .knowledge-tree.json
- Project-specific domain concepts
- Overrides system categories
- Portable with your project

### System Categories  
- Built-in categories (api, database, testing, etc.)
- Shared across all projects
- Modify with caution
- Updates affect category detection globally

## 🤖 AI Best Practices

### 1. Let Auto-Detection Work
Don't manually specify categories when creating entries:
\`\`\`javascript
// ❌ AVOID
add_knowledge({
  content: "...",
  category: "frontend"  // Let system detect!
})

// ✅ BETTER
add_knowledge({
  content: "title: React Component State Management"
  // System detects: frontend/react/state-management.json
})
\`\`\`

### 2. Add Domain-Specific Categories
For your project's unique concepts:
\`\`\`javascript
manage_categories({
  action: "add",
  category: "payment-gateway",
  keywords: ["stripe", "paypal", "checkout", "payment"],
  subcategories: ["stripe", "paypal", "square"],
  scope: "project"
})
\`\`\`

### 3. Merge for Incremental Updates
Add keywords without losing existing ones:
\`\`\`javascript
// First check what exists
manage_categories({ action: "list", scope: "project" })

// Then merge new keywords
manage_categories({
  action: "merge",
  category: "testing",
  keywords: ["vitest", "playwright"],  // Adds to existing
  scope: "project"
})
\`\`\`

### 4. Use Descriptive Keywords
Keywords should be:
- Lowercase
- Hyphenated (not underscored)
- Specific to the domain
- Common in titles

## 📊 Category Impact

Categories affect:
1. **Path Generation**: \`database/redis/how-to/find-element.json\`
2. **Search Filtering**: \`search_knowledge({ category: "security" })\`
3. **Organization**: Hierarchical knowledge structure
4. **Analytics**: Category-based statistics

## 🔄 Category Priority Order

1. User-specified category (if provided)
2. Project-level categories (from setup_project)
3. System-level categories (built-in)
4. Technology detection (unknown tech)
5. Fallback to "general"

## 💡 Pro Tips

- **Start Simple**: Use built-in categories first
- **Add Gradually**: Create project categories as patterns emerge
- **Review Regularly**: \`stats_knowledge()\` shows category distribution
- **Clean Up**: Remove unused categories to improve detection

Remember: Good categories = Better organization = Easier knowledge retrieval`
};

/**
 * Handler for the help tool
 */
export const helpHandler: ToolHandler = async (args: HelpArgs): Promise<MCPResponse> => {
  const { topic } = args;
  
  const helpText = topic ? helpTexts[topic] : `# 📚 Knowledge MCP - Straightforward Usage Guide

## 🚀 Essential Workflows

### 1️⃣ Get Overview
\`\`\`bash
index_knowledge(format: "tree")  # See all knowledge
stats_knowledge()               # Get system stats
\`\`\`

### 2️⃣ Search First, Always
\`\`\`bash
search_knowledge(query: "your topic", searchIn: ["all"])
\`\`\`

### 3️⃣ Create Knowledge
\`\`\`bash
add_knowledge(content: "markdown with frontmatter")  # Auto-generates path
# OR with custom directory:
add_knowledge(path: "security/auth/", content: "...")  # Filename from title
\`\`\`

### 4️⃣ Link Related Entries
\`\`\`bash
link_knowledge(from: "path1", to: "path2", relationship: "related")
\`\`\`

### 5️⃣ Maintain Quality
\`\`\`bash
validate_knowledge(fix: true)  # Fix issues automatically
\`\`\`

## 🎯 Priority Selection - USE ALL FOUR TYPES

**🔴 CRITICAL** - System-breaking issues:
- Security vulnerabilities, data corruption risks
- Architecture violations, complete system failures

**🟠 REQUIRED** - Daily development essentials:
- Setup procedures, core workflows, debugging techniques
- Team standards, fundamental patterns

**🟡 COMMON** - Quality improvements:
- Performance tips, code organization patterns
- Productivity shortcuts, maintainability practices

**🟢 EDGE-CASE** - Rare but important scenarios:
- Browser quirks, platform compatibility issues
- Legacy workarounds, unusual configurations

**⚠️ SELECTION RULES**:
- Choose based on ACTUAL impact and frequency
- Don't default to high priorities - use appropriate level
- EDGE-CASE is for genuinely rare scenarios
- COMMON is for general improvements and tips

## 🏗️ Entry Structure
\`\`\`markdown
---
title: Clear, specific title
priority: CRITICAL|REQUIRED|COMMON|EDGE-CASE
tags: [searchable, keywords]
---

# Problem
What exact issue does this address?

# Context  
When/why does this apply?

# Solution
Complete, actionable solution with examples
\`\`\`

## ⚡ Quality Standards

- **Complete only**: No TODOs, placeholders, or "implement later"
- **Use all priorities**: Select based on actual impact, not habit
- **Working examples**: All code must be tested and functional
- **Provide context**: Explain when/why knowledge applies
- **Build connections**: Link related entries together

## 🔧 Available Tools
| Tool | Purpose |
|------|---------|
| \`index_knowledge\` | Get knowledge overview |
| \`search_knowledge\` | Find entries by query/filters |
| \`add_knowledge\` | Create new entry (auto-path) |
| \`update_knowledge\` | Modify existing entry |
| \`link_knowledge\` | Connect related entries |
| \`validate_knowledge\` | Check and fix issues |
| \`export_knowledge\` | Generate documentation |
| \`stats_knowledge\` | Analytics and metrics |
| \`manage_categories\` | Add/update/remove categories |

Start with \`index_knowledge()\` to see current knowledge base.`;
  
  return {
    content: [
      {
        type: "text",
        text: helpText,
      },
    ],
  };
};