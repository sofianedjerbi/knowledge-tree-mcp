/**
 * JSON export utilities for Knowledge Tree MCP
 * Handles conversion of knowledge entries to JSON format
 */

import type { KnowledgeEntry } from '../../types/index.js';
import type { ExportEntry } from './markdown.js';

/**
 * Export metadata structure
 */
export interface ExportMetadata {
  exported_at: string;
  total_entries: number;
  include_links: boolean;
  version?: string;
}

/**
 * Complete JSON export structure
 */
export interface JSONExport {
  metadata: ExportMetadata;
  entries: Array<{
    path: string;
    priority: KnowledgeEntry['priority'];
    problem: string;
    solution: string;
    code?: string;
    examples?: Record<string, any>;
    related_to?: KnowledgeEntry['related_to'];
  }>;
}

/**
 * Exports knowledge entries to JSON format
 * @param entries - Array of entries to export
 * @param includeLinks - Whether to include relationship links
 * @returns JSON formatted string
 */
export function exportToJSON(
  entries: ExportEntry[], 
  includeLinks: boolean
): string {
  const exportData: JSONExport = {
    metadata: {
      exported_at: new Date().toISOString(),
      total_entries: entries.length,
      include_links: includeLinks,
      version: '1.0.0'
    },
    entries: entries.map(({ path, entry }) => ({
      path,
      priority: entry.priority,
      problem: entry.problem,
      solution: entry.solution,
      code: entry.code,
      examples: entry.examples,
      related_to: includeLinks ? entry.related_to : undefined
    }))
  };
  
  return JSON.stringify(exportData, null, 2);
}

/**
 * Exports entries grouped by category
 * @param entries - Array of entries to export
 * @param includeLinks - Whether to include links
 * @returns JSON string with hierarchical structure
 */
export function exportToJSONByCategory(
  entries: ExportEntry[],
  includeLinks: boolean
): string {
  const byCategory: Record<string, any> = {};
  
  for (const { path, entry } of entries) {
    const parts = path.split('/');
    let current = byCategory;
    
    // Build nested structure
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!current[part]) {
        current[part] = {};
      }
      current = current[part];
    }
    
    // Add the entry
    const filename = parts[parts.length - 1];
    current[filename] = {
      priority: entry.priority,
      problem: entry.problem,
      solution: entry.solution,
      code: entry.code,
      examples: entry.examples,
      related_to: includeLinks ? entry.related_to : undefined
    };
  }
  
  return JSON.stringify({
    metadata: {
      exported_at: new Date().toISOString(),
      total_entries: entries.length,
      structure: 'hierarchical'
    },
    knowledge_tree: byCategory
  }, null, 2);
}

/**
 * Creates a minimal JSON export with just essential fields
 * @param entries - Array of entries
 * @returns Minimal JSON string
 */
export function exportToMinimalJSON(entries: ExportEntry[]): string {
  const minimal = entries.map(({ path, entry }) => ({
    path,
    priority: entry.priority,
    problem: entry.problem.substring(0, 100) + (entry.problem.length > 100 ? '...' : ''),
    has_code: !!entry.code,
    relationships: entry.related_to?.length || 0
  }));
  
  return JSON.stringify({
    summary: {
      total: entries.length,
      exported_at: new Date().toISOString()
    },
    entries: minimal
  }, null, 2);
}

/**
 * Creates a JSON export optimized for searching
 * @param entries - Array of entries
 * @returns Search-optimized JSON string
 */
export function exportToSearchJSON(entries: ExportEntry[]): string {
  const searchData = entries.map(({ path, entry }) => ({
    path,
    priority: entry.priority,
    content: [
      entry.problem,
      entry.solution,
      entry.code || ''
    ].join(' '),
    tags: [
      entry.priority,
      ...path.split('/').slice(0, -1),
      ...(entry.related_to?.map(r => r.relationship) || [])
    ]
  }));
  
  return JSON.stringify({
    version: '1.0.0',
    index_created: new Date().toISOString(),
    total_documents: entries.length,
    documents: searchData
  }, null, 2);
}