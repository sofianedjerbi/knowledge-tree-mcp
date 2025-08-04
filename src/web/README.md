# Web Interface Module

This module provides an optional web interface for the Knowledge Tree MCP server, enabling real-time visualization and interaction with the knowledge base.

## Architecture

### Components

1. **types.ts** - TypeScript type definitions for:
   - WebSocket message types and structures
   - Server configuration
   - Web context interfaces

2. **handlers.ts** - WebSocket message handlers for:
   - Getting all knowledge entries
   - Searching the knowledge base
   - Retrieving statistics
   - Getting recent changes
   - Broadcasting real-time updates

3. **server.ts** - Web server setup including:
   - Fastify server configuration
   - WebSocket endpoint setup
   - Static file serving
   - Health check and API endpoints

4. **index.ts** - Central exports and factory functions

## Features

### Real-time Updates
- Broadcasts changes to all connected clients
- Supports entry added/updated/deleted events
- Maintains WebSocket connection pool

### API Endpoints
- `/ws` - WebSocket endpoint for real-time communication
- `/health` - Server health check
- `/api/info` - Knowledge base information

### Static File Serving
- Serves the web UI from the `public` directory
- Supports custom public directory configuration

## Usage

### Starting the Web Server

```typescript
import { setupWebInterface } from './web/index.js';

const webInterface = await setupWebInterface(
  3000, // port
  {
    knowledgeRoot: '/path/to/docs',
    wsClients: new Set(),
    scanKnowledgeTree: async () => [...],
    searchKnowledge: async (args) => {...},
    getKnowledgeStats: async (args) => {...},
    getRecentKnowledge: async (args) => {...},
    logWebView: async (metadata) => {...}
  },
  '/custom/public/dir' // optional
);

await webInterface.start();
```

### WebSocket Message Protocol

#### Client → Server Messages

1. **Get All Entries**
```json
{ "type": "getAll" }
```

2. **Search**
```json
{
  "type": "search",
  "query": "authentication",
  "priority": ["CRITICAL", "REQUIRED"],
  "limit": 50
}
```

3. **Get Statistics**
```json
{
  "type": "stats",
  "include": ["summary", "priorities", "categories"]
}
```

4. **Get Recent Changes**
```json
{
  "type": "recent",
  "days": 7,
  "limit": 20
}
```

#### Server → Client Messages

1. **All Entries Response**
```json
{
  "type": "allEntries",
  "entries": [
    {
      "path": "auth/no-plaintext.json",
      "data": { "priority": "CRITICAL", "problem": "...", "solution": "..." }
    }
  ]
}
```

2. **Real-time Updates**
```json
{
  "type": "entryAdded",
  "path": "new/entry.json",
  "data": { ... }
}
```

## Integration with Main Server

The web module is designed to be optional and loosely coupled:

1. The main server creates a WebContext with necessary dependencies
2. The web server is started only if a port is provided
3. All web-specific logic is isolated in this module
4. Communication happens through well-defined interfaces

## Security Considerations

- WebSocket connections are not authenticated by default
- Consider adding authentication middleware for production use
- The server binds to 0.0.0.0 by default (all interfaces)
- Implement rate limiting for production deployments