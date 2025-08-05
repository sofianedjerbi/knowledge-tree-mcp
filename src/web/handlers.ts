/**
 * WebSocket message handlers for the Knowledge Tree web interface
 */

import { join } from 'path';
import type {
  WebSocketMessage,
  GetAllMessage,
  SearchMessage,
  StatsMessage,
  RecentMessage,
  WebContext
} from './types.js';
import { readFile } from '../utils/index.js';
import type { KnowledgeEntry } from '../types/index.js';

/**
 * Handle incoming WebSocket messages
 */
export async function handleWebSocketMessage(
  message: string,
  ws: any,
  context: WebContext
): Promise<void> {
  try {
    const data: WebSocketMessage = JSON.parse(message);
    
    // Web interface activity logging disabled - we don't track UI interactions
    
    switch (data.type) {
      case 'getAll':
        await handleGetAll(data as GetAllMessage, ws, context);
        break;
      case 'search':
        await handleSearch(data as SearchMessage, ws, context);
        break;
      case 'stats':
        await handleStats(data as StatsMessage, ws, context);
        break;
      case 'recent':
        await handleRecent(data as RecentMessage, ws, context);
        break;
      default:
        console.error('Unknown WebSocket message type:', data.type);
    }
  } catch (error) {
    console.error('WebSocket message error:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to process message',
      error: error instanceof Error ? error.message : 'Unknown error'
    }));
  }
}

/**
 * Handle getAll request - send all knowledge entries
 */
async function handleGetAll(
  data: GetAllMessage,
  ws: any,
  context: WebContext
): Promise<void> {
  const allEntries = await context.scanKnowledgeTree();
  const entries = [];
  
  for (const path of allEntries) {
    const fullPath = join(context.knowledgeRoot, path);
    try {
      const content = await readFile(fullPath);
      const entry: KnowledgeEntry = JSON.parse(content);
      
      // Normalize path for web compatibility (always use forward slashes)
      const normalizedPath = path.replace(/\\/g, '/');
      
      // Also normalize paths in related_to links
      if (entry.related_to) {
        entry.related_to = entry.related_to.map(link => ({
          ...link,
          path: link.path.replace(/\\/g, '/')
        }));
      }
      
      entries.push({ path: normalizedPath, data: entry });
    } catch (error) {
      // Skip invalid entries
    }
  }
  
  ws.send(JSON.stringify({
    type: 'allEntries',
    entries
  }));
}

/**
 * Handle search request
 */
async function handleSearch(
  data: SearchMessage,
  ws: any,
  context: WebContext
): Promise<void> {
  let query = data.query;
  let searchIn = data.searchIn || ["all"];
  
  // Handle special tag: prefix
  if (query && query.startsWith('tag:')) {
    const tagName = query.substring(4).trim();
    query = tagName;
    searchIn = ["tags"];
  }
  
  const searchArgs = {
    query: query,
    priority: data.priority || [],
    category: data.category,
    searchIn: searchIn,
    regex: data.regex || false,
    caseSensitive: data.caseSensitive || false,
    limit: data.limit || 50,
    sortBy: data.sortBy || "relevance"
  };
  
  const result = await context.searchKnowledge(searchArgs);
  const markdownText = result.content[0].text;
  
  // Parse markdown results into structured format
  const results = [];
  
  // Extract entries from markdown
  // Format from search output:
  // ## 📄 Title
  // **Path**: `path.json`
  // **Priority**: CRITICAL
  // **Score**: 23
  const sections = markdownText.split('\n---\n');
  
  for (const section of sections) {
    if (!section.trim() || section.includes('Total matches:')) continue;
    
    // Extract title from ## 📄 Title line
    const titleMatch = section.match(/## 📄 (.+)/);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();
    
    // Extract path from **Path**: `path.json` line
    const pathMatch = section.match(/\*\*Path\*\*:\s*`([^`]+)`/);
    if (!pathMatch) continue;
    const path = pathMatch[1];
    
    // Extract priority from **Priority**: CRITICAL line
    const priorityMatch = section.match(/\*\*Priority\*\*:\s*(\w+)/);
    const priority = priorityMatch ? priorityMatch[1] : 'COMMON';
    
    // Try to load the full entry
    try {
      const fullPath = join(context.knowledgeRoot, path);
      const entryContent = await readFile(fullPath);
      const entry = JSON.parse(entryContent);
      
      results.push({
        path: path,
        entry: entry,
        priority: entry.priority || priority,
        title: entry.title || title,
        problem: entry.problem || ''
      });
    } catch (error) {
      // If we can't load the entry, use what we have from markdown
      // Extract problem from the markdown content
      const problemMatch = section.match(/# Problem\s*\n\n([^\n]+)/);
      const problem = problemMatch ? problemMatch[1] : '';
      
      results.push({
        path: path,
        entry: {
          priority: priority,
          title: title,
          problem: problem
        },
        priority: priority,
        title: title,
        problem: problem
      });
    }
  }
  
  ws.send(JSON.stringify({
    type: 'searchResults',
    results: results,
    total: results.length
  }));
}

/**
 * Handle stats request
 */
async function handleStats(
  data: StatsMessage,
  ws: any,
  context: WebContext
): Promise<void> {
  const statsArgs = {
    include: data.include || ["summary", "priorities", "orphaned", "popular"]
  };
  
  // Call stats tool directly with server context instead of going through web context
  const { statsKnowledgeHandler } = await import('../tools/stats.js');
  const result = await statsKnowledgeHandler(statsArgs, context.serverContext);
  const statsData = JSON.parse(result.content[0].text);
  
  ws.send(JSON.stringify({
    type: 'statsResults',
    ...statsData
  }));
}

/**
 * Handle recent changes request
 */
async function handleRecent(
  data: RecentMessage,
  ws: any,
  context: WebContext
): Promise<void> {
  const recentArgs = {
    days: data.days || 7,
    limit: data.limit || 20,
    type: data.changeType || "all"
  };
  
  const result = await context.getRecentKnowledge(recentArgs);
  const recentData = JSON.parse(result.content[0].text);
  
  ws.send(JSON.stringify({
    type: 'recentResults',
    days: data.days || 7,  // Include the days parameter from the request
    ...recentData
  }));
}

/**
 * Broadcast an update to all connected WebSocket clients
 */
export async function broadcastUpdate(
  type: 'entryAdded' | 'entryUpdated' | 'entryDeleted',
  data: any,
  wsClients: Set<any>
): Promise<void> {
  if (wsClients.size === 0) return;
  
  const message = JSON.stringify({ type, ...data });
  
  for (const client of wsClients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        await client.send(message);
      } catch (error) {
        // Remove dead clients
        wsClients.delete(client);
      }
    }
  }
}