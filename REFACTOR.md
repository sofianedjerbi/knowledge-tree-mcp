# Modular Architecture Plan for Knowledge Tree MCP

## Current State Analysis
The current `index.ts` file is 2857 lines long and contains everything in a single file, violating SOLID principles and making maintenance difficult.

## Proposed File Structure

```
src/
├── index.ts                     # Main entry point (CLI args, server instantiation)
├── server/                      # Server-related code
│   ├── KnowledgeTreeServer.ts   # Main server class
│   └── MCPHandlers.ts           # MCP protocol handlers
├── types/                       # Type definitions
│   ├── index.ts                 # Export all types
│   ├── KnowledgeEntry.ts        # Core knowledge types
│   ├── UsageTypes.ts            # Usage analytics types
│   └── ServerTypes.ts           # Server configuration types
├── tools/                       # MCP tool implementations
│   ├── index.ts                 # Tool registration and exports
│   ├── help.ts                  # Help system
│   ├── indexKnowledge.ts        # Knowledge indexing
│   ├── search.ts                # Search functionality
│   ├── add.ts                   # Add knowledge entries
│   ├── update.ts                # Update knowledge entries
│   ├── delete.ts                # Delete knowledge entries
│   ├── link.ts                  # Link management
│   ├── validate.ts              # Validation logic
│   ├── export.ts                # Export functionality
│   ├── stats.ts                 # Statistics
│   ├── recent.ts                # Recent changes
│   └── analytics.ts             # Usage analytics
├── utils/                       # Utility functions
│   ├── fileSystem.ts            # File operations
│   ├── logging.ts               # Usage logging
│   ├── validation.ts            # Common validation logic
│   └── export/                  # Export format handlers
│       ├── markdown.ts
│       ├── json.ts
│       └── html.ts
├── web/                         # Web interface
│   ├── server.ts                # Web server setup
│   ├── handlers.ts              # WebSocket handlers
│   └── types.ts                 # Web-specific types
└── constants/                   # Application constants
    └── index.ts                 # Priority levels, relationships, etc.
```

## Architecture Principles Applied

### SOLID Principles:
- **Single Responsibility**: Each file has one clear purpose
- **Open/Closed**: Tools are extensible without modifying core server
- **Liskov Substitution**: Tool handlers follow consistent interfaces
- **Interface Segregation**: Separate interfaces for different concerns
- **Dependency Inversion**: Core logic depends on abstractions, not implementations

### DRY (Don't Repeat Yourself):
- Common validation logic extracted to `utils/validation.ts`
- Export formats separated into individual handlers
- Shared types defined once in `types/`

### KISS (Keep It Simple, Stupid):
- Clear, descriptive file names
- Logical grouping of related functionality
- Simple import/export structure

## Key Benefits:
1. **Maintainability**: Easier to find and modify specific functionality
2. **Testability**: Each module can be tested independently
3. **Scalability**: New tools can be added without touching existing code
4. **Readability**: Smaller, focused files are easier to understand
5. **Reusability**: Utils and types can be shared across modules

## Implementation Steps:

### Phase 1: Foundation
1. Create the new directory structure
2. Extract types and interfaces first
3. Extract constants and enums
4. Extract utility functions

### Phase 2: Core Logic
5. Extract tool implementations into separate files
6. Extract web server functionality
7. Refactor main server class
8. Create new modular index.ts

### Phase 3: Validation
9. Test the modular implementation
10. Ensure all existing functionality works
11. Update documentation and examples

## Detailed Module Responsibilities:

### Types (`src/types/`)
- `KnowledgeEntry.ts`: Core knowledge entry structure, relationship types
- `UsageTypes.ts`: Usage logging and analytics types
- `ServerTypes.ts`: Server configuration and context types
- `index.ts`: Central export point for all types

### Tools (`src/tools/`)
Each tool file exports a single handler function with signature:
```typescript
export function toolHandler(args: any, context: ServerContext): Promise<MCPResponse>
```

### Utils (`src/utils/`)
- `fileSystem.ts`: File operations, path handling, directory scanning
- `logging.ts`: Usage tracking, analytics data collection
- `validation.ts`: Common validation rules, error checking
- `export/`: Format-specific export handlers

### Web (`src/web/`)
- `server.ts`: Fastify server setup, static file serving
- `handlers.ts`: WebSocket message handling, real-time updates
- `types.ts`: Web-specific interfaces and types

### Server (`src/server/`)
- `KnowledgeTreeServer.ts`: Main server class, reduced to coordination
- `MCPHandlers.ts`: MCP protocol request/response handling

### Constants (`src/constants/`)
- Priority levels: `CRITICAL`, `REQUIRED`, `COMMON`, `EDGE-CASE`
- Relationship types: `related`, `supersedes`, `conflicts_with`, etc.
- Default configurations and settings

## Migration Strategy:
1. **Preserve existing API**: All public interfaces remain unchanged
2. **Incremental extraction**: Extract one module at a time
3. **Test-driven**: Run tests after each extraction
4. **Backward compatibility**: Keep original index.ts until fully migrated

This modular structure will make the codebase much more maintainable while preserving all existing functionality.