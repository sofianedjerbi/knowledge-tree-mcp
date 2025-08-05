/**
 * Search tool implementation
 * Provides advanced search functionality for knowledge entries
 */

import { join } from 'path';
import type { 
  ToolHandler, 
  SearchArgs, 
  MCPResponse, 
  ServerContext, 
  KnowledgeEntry,
  Priority 
} from '../types/index.js';
import { 
  PRIORITY_WEIGHTS, 
  SEARCH_DEFAULTS,
  FILE_CONSTANTS 
} from '../constants/index.js';
import { readFile, convertEntryToMarkdown } from '../utils/index.js';

interface SearchMatch {
  path: string;
  entry: KnowledgeEntry;
  score: number;
  highlights: Record<string, string[]>;
}

/**
 * Handler for the search_knowledge tool
 */
export const searchKnowledgeHandler: ToolHandler = async (
  args: SearchArgs, 
  context: ServerContext
): Promise<MCPResponse> => {
  const { 
    query, 
    priority = [], 
    category, 
    searchIn = SEARCH_DEFAULTS.SEARCH_IN,
    regex = SEARCH_DEFAULTS.REGEX,
    caseSensitive = SEARCH_DEFAULTS.CASE_SENSITIVE,
    limit = SEARCH_DEFAULTS.LIMIT,
    sortBy = SEARCH_DEFAULTS.SORT_BY
  } = args;
  
  // Log search activity
  if (query) {
    await context.logSearch(query, { priority, category, searchIn, sortBy });
  }
  
  const allEntries = await context.scanKnowledgeTree();
  let matches: SearchMatch[] = [];

  for (const path of allEntries) {
    const fullPath = join(context.knowledgeRoot, path);
    
    try {
      const content = await readFile(fullPath);
      const entry: KnowledgeEntry = JSON.parse(content);
      
      let match = true;
      let score = 0;
      const highlights: Record<string, string[]> = {};
      
      // Priority filter (now supports array)
      if (priority.length > 0 && !priority.includes(entry.priority)) {
        match = false;
        continue;
      }
      
      // Category filter
      if (category && !path.toLowerCase().includes(category.toLowerCase())) {
        match = false;
        continue;
      }
      
      // Search query matching
      if (query) {
        const queryMatch = await matchQuery(
          query, 
          entry, 
          path, 
          searchIn, 
          regex, 
          caseSensitive,
          highlights
        );
        
        if (!queryMatch.match) {
          match = false;
        } else {
          score = queryMatch.score;
        }
      }
      
      if (match) {
        // Add priority weight to score
        score += PRIORITY_WEIGHTS[entry.priority] || 0;
        matches.push({ path, entry, score, highlights });
      }
    } catch (error) {
      // Skip invalid entries
    }
  }

  // Sort results
  matches = sortResults(matches, sortBy);
  
  // Apply limit
  const limitedMatches = matches.slice(0, limit);
  
  // Enrich matches with linked knowledge
  const enrichedMatches = limitedMatches.map(match => {
    const enriched: any = { 
      path: match.path,
      entry: match.entry,
      score: match.score,
      highlights: match.highlights
    };
    
    if (match.entry.related_to && match.entry.related_to.length > 0) {
      enriched.links = match.entry.related_to;
    }
    
    return enriched;
  });

  // Always output in Markdown format for AI consumption
  let markdown = `# Search Results\n\n`;
  markdown += `**Total matches**: ${matches.length}\n`;
  markdown += `**Showing**: ${enrichedMatches.length}\n\n`;
  
  for (const match of enrichedMatches) {
    markdown += `---\n\n`;
    markdown += `## 📄 ${match.entry.title || match.path}\n\n`;
    markdown += `**Path**: \`${match.path}\`\n`;
    markdown += `**Priority**: ${match.entry.priority}\n`;
    markdown += `**Score**: ${match.score}\n\n`;
    
    // Add full entry in markdown format
    markdown += convertEntryToMarkdown(match.entry);
    markdown += `\n\n`;
  }
  
  
  return {
    content: [
      {
        type: "text",
        text: markdown,
      },
    ],
  };
};

/**
 * Match a query against an entry
 */
async function matchQuery(
  query: string,
  entry: KnowledgeEntry,
  path: string,
  searchIn: string[],
  regex: boolean,
  caseSensitive: boolean,
  highlights: Record<string, string[]>
): Promise<{ match: boolean; score: number }> {
  // Check if query contains wildcards (* or ?)
  const hasWildcards = query.includes('*') || query.includes('?');
  
  // Check if query is quoted for exact phrase matching
  const isQuotedPhrase = (query.startsWith('"') && query.endsWith('"')) || 
                        (query.startsWith("'") && query.endsWith("'"));
  
  let searchTerms: string[] = [];
  let isExactPhrase = false;
  
  if (isQuotedPhrase) {
    // Exact phrase search - remove quotes and treat as single term
    const cleanQuery = query.slice(1, -1);
    searchTerms = [cleanQuery];
    isExactPhrase = true;
  } else if (hasWildcards) {
    // Special case: single * means match everything
    if (query.trim() === '*') {
      return { match: true, score: 1 };
    }
    // Wildcards - treat as single pattern
    searchTerms = [query];
  } else if (regex) {
    // Regex mode - treat as single pattern
    searchTerms = [query];
  } else {
    // Multi-word search - split into individual words
    searchTerms = query.trim().split(/\s+/).filter(term => term.length > 0);
  }
  
  const fieldsToSearch = searchIn.includes("all") 
    ? ["title", "problem", "solution", "code", "path", "context", "tags"]
    : searchIn;
  
  let queryMatch = false;
  let totalScore = 0;
  
  // For multi-word queries, we need ALL words to match (AND logic)
  // But they can match in different fields
  let termMatches = new Map<string, boolean>();
  
  for (const field of fieldsToSearch) {
    let fieldValue = "";
    
    switch (field) {
      case "title":
        fieldValue = entry.title || "";
        break;
      case "problem":
        fieldValue = entry.problem || "";
        break;
      case "solution":
        fieldValue = entry.solution || "";
        break;
      case "context":
        fieldValue = entry.context || "";
        break;
      case "code":
        fieldValue = entry.code || "";
        break;
      case "path":
        fieldValue = path;
        break;
      case "tags":
        fieldValue = entry.tags ? entry.tags.join(" ") : "";
        break;
    }
    
    if (!fieldValue) continue;
    
    const testValue = caseSensitive ? fieldValue : fieldValue.toLowerCase();
    
    // Test each search term against this field
    for (const term of searchTerms) {
      let searchPattern: RegExp | string;
      let termFound = false;
      
      if (hasWildcards && !isExactPhrase) {
        // Convert wildcards to regex: * = .*, ? = .
        const regexQuery = term
          .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape regex chars except * and ?
          .replace(/\\\*/g, '.*') // Convert \* back to .*
          .replace(/\\\?/g, '.'); // Convert \? back to .
        searchPattern = new RegExp(regexQuery, caseSensitive ? 'g' : 'gi');
        
        const matches = testValue.match(searchPattern);
        if (matches) {
          termFound = true;
          termMatches.set(term, true);
          if (!highlights[field]) highlights[field] = [];
          highlights[field].push(...matches);
          
          // Score based on field importance and match count
          const fieldWeight = field === "title" ? 5 : field === "problem" ? 3 : field === "solution" ? 2 : field === "tags" ? 2 : 1;
          totalScore += matches.length * fieldWeight;
        }
      } else if (regex && !isExactPhrase) {
        searchPattern = new RegExp(term, caseSensitive ? 'g' : 'gi');
        const matches = testValue.match(searchPattern);
        if (matches) {
          termFound = true;
          termMatches.set(term, true);
          if (!highlights[field]) highlights[field] = [];
          highlights[field].push(...matches);
          
          // Score based on field importance and match count
          const fieldWeight = field === "title" ? 5 : field === "problem" ? 3 : field === "solution" ? 2 : field === "tags" ? 2 : 1;
          totalScore += matches.length * fieldWeight;
        }
      } else {
        // Simple string matching
        const searchStr = caseSensitive ? term : term.toLowerCase();
        if (testValue.includes(searchStr)) {
          termFound = true;
          termMatches.set(term, true);
          
          // Calculate score based on match position and frequency
          const matchCount = (testValue.match(
            new RegExp(searchStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
          ) || []).length;
          
          const fieldWeight = field === "title" ? 5 : field === "problem" ? 3 : field === "solution" ? 2 : field === "tags" ? 2 : 1;
          totalScore += matchCount * fieldWeight;
          
          // Bonus for matches at the beginning
          if (testValue.startsWith(searchStr)) {
            totalScore += 5;
          }
          
          // Store simple highlight
          if (!highlights[field]) highlights[field] = [];
          highlights[field].push(searchStr);
        }
      }
    }
  }
  
  // For multi-word queries, ALL terms must match somewhere
  if (searchTerms.length > 1 && !isExactPhrase) {
    queryMatch = termMatches.size === searchTerms.length;
  } else {
    // For single terms, exact phrases, wildcards, or regex
    queryMatch = termMatches.size > 0;
  }
  
  return { match: queryMatch, score: totalScore };
}

/**
 * Sort search results based on the specified criteria
 */
function sortResults(matches: SearchMatch[], sortBy: string): SearchMatch[] {
  const sorted = [...matches];
  
  switch (sortBy) {
    case "relevance":
      sorted.sort((a, b) => b.score - a.score);
      break;
    case "priority":
      sorted.sort((a, b) => {
        const aWeight = PRIORITY_WEIGHTS[a.entry.priority] || 0;
        const bWeight = PRIORITY_WEIGHTS[b.entry.priority] || 0;
        return bWeight - aWeight;
      });
      break;
    case "path":
      sorted.sort((a, b) => a.path.localeCompare(b.path));
      break;
    case "recent":
      // Would need file stats for this, using path as fallback
      sorted.sort((a, b) => b.path.localeCompare(a.path));
      break;
  }
  
  return sorted;
}