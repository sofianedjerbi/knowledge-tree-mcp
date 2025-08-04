/**
 * Markdown export utilities for Knowledge Tree MCP
 * Handles conversion of knowledge entries to Markdown format
 */

import type { KnowledgeEntry, Priority } from '../../types/index.js';
import { PRIORITY_LEVELS, PRIORITY_ORDER } from '../../constants/index.js';

/**
 * Entry with path information for export
 */
export interface ExportEntry {
  path: string;
  entry: KnowledgeEntry;
}

/**
 * Exports knowledge entries to Markdown format
 * @param entries - Array of entries to export
 * @param includeLinks - Whether to include relationship links
 * @returns Markdown formatted string
 */
export function exportToMarkdown(
  entries: ExportEntry[], 
  includeLinks: boolean
): string {
  let md = '# Knowledge Tree Export\n\n';
  md += `_Generated on ${new Date().toISOString()}_\n\n`;
  md += `**Total Entries**: ${entries.length}\n\n`;
  
  // Group by priority
  const byPriority = entries.reduce((acc, { path, entry }) => {
    if (!acc[entry.priority]) acc[entry.priority] = [];
    acc[entry.priority].push({ path, entry });
    return acc;
  }, {} as Record<string, ExportEntry[]>);
  
  // Export each priority group in order
  for (const priority of PRIORITY_LEVELS) {
    const group = byPriority[priority];
    if (!group || group.length === 0) continue;
    
    md += `## ${priority} (${group.length})\n\n`;
    
    for (const { path, entry } of group) {
      md += `### 📄 ${entry.title || path}\n\n`;
      
      if (entry.category || entry.tags) {
        if (entry.category) md += `**Category**: ${entry.category} `;
        if (entry.tags && entry.tags.length > 0) md += `**Tags**: ${entry.tags.join(', ')}`;
        md += '\n\n';
      }
      
      md += `**Problem**: ${entry.problem}\n\n`;
      
      if (entry.context) {
        md += `**Context**: ${entry.context}\n\n`;
      }
      
      md += `**Solution**: ${entry.solution}\n\n`;
      
      if (entry.examples && entry.examples.length > 0) {
        md += '**Examples**:\n\n';
        for (const example of entry.examples) {
          if (example.title) md += `_${example.title}_\n`;
          if (example.description) md += `${example.description}\n`;
          if (example.code) {
            const lang = example.language || '';
            md += `\`\`\`${lang}\n${example.code}\n\`\`\`\n`;
          }
          md += '\n';
        }
      } else if (entry.code) {
        md += '**Code**:\n```\n' + entry.code + '\n```\n\n';
      }
      
      if (includeLinks && entry.related_to && entry.related_to.length > 0) {
        md += '**Related**:\n';
        for (const link of entry.related_to) {
          md += `- ${link.relationship}: [${link.path}](#${link.path.replace(/[^\w-]/g, '-')})\n`;
          if (link.description) {
            md += `  - ${link.description}\n`;
          }
        }
        md += '\n';
      }
      
      if (entry.author || entry.version || entry.created_at || entry.updated_at) {
        md += '**Metadata**:\n';
        if (entry.author) md += `- Author: ${entry.author}\n`;
        if (entry.version) md += `- Version: ${entry.version}\n`;
        if (entry.created_at) md += `- Created: ${new Date(entry.created_at).toLocaleDateString()}\n`;
        if (entry.updated_at) md += `- Updated: ${new Date(entry.updated_at).toLocaleDateString()}\n`;
        md += '\n';
      }
      
      md += `**Path**: \`${path}\`\n\n`;
      md += '---\n\n';
    }
  }
  
  return md;
}

/**
 * Creates a markdown table of contents from entries
 * @param entries - Array of entries
 * @returns Markdown TOC string
 */
export function createMarkdownTOC(entries: ExportEntry[]): string {
  let toc = '## Table of Contents\n\n';
  
  // Group by category
  const byCategory = entries.reduce((acc, { path, entry }) => {
    const category = path.split('/').slice(0, -1).join('/') || 'root';
    if (!acc[category]) acc[category] = [];
    acc[category].push({ path, entry });
    return acc;
  }, {} as Record<string, ExportEntry[]>);
  
  // Sort categories
  const sortedCategories = Object.keys(byCategory).sort();
  
  for (const category of sortedCategories) {
    toc += `### ${category}\n`;
    const categoryEntries = byCategory[category];
    
    // Sort by priority then filename
    categoryEntries.sort((a, b) => {
      const priorityDiff = PRIORITY_ORDER[a.entry.priority] - PRIORITY_ORDER[b.entry.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.path.localeCompare(b.path);
    });
    
    for (const { path, entry } of categoryEntries) {
      const filename = path.split('/').pop();
      const title = entry.title || filename;
      const anchor = path.replace(/[^\w-]/g, '-');
      toc += `- [${title}](#${anchor}) - ${entry.priority}\n`;
    }
    
    toc += '\n';
  }
  
  return toc;
}

/**
 * Formats a single knowledge entry as markdown
 * @param entry - Knowledge entry
 * @param path - Entry path
 * @param includeLinks - Whether to include links
 * @returns Markdown formatted entry
 */
export function formatEntryAsMarkdown(
  entry: KnowledgeEntry,
  path: string,
  includeLinks: boolean = true
): string {
  let md = `## ${entry.title || path}\n\n`;
  md += `**Priority**: ${entry.priority}\n\n`;
  
  if (entry.category || entry.tags) {
    if (entry.category) md += `**Category**: ${entry.category}\n`;
    if (entry.tags && entry.tags.length > 0) md += `**Tags**: ${entry.tags.join(', ')}\n`;
    md += '\n';
  }
  
  md += `**Problem**: ${entry.problem}\n\n`;
  
  if (entry.context) {
    md += `**Context**: ${entry.context}\n\n`;
  }
  
  md += `**Solution**: ${entry.solution}\n\n`;
  
  if (entry.examples && entry.examples.length > 0) {
    md += '**Examples**:\n\n';
    for (const example of entry.examples) {
      if (example.title) md += `### ${example.title}\n`;
      if (example.description) md += `${example.description}\n\n`;
      if (example.code) {
        const lang = example.language || '';
        md += `\`\`\`${lang}\n${example.code}\n\`\`\`\n\n`;
      }
    }
  } else if (entry.code) {
    md += '**Code Example**:\n```\n' + entry.code + '\n```\n\n';
  }
  
  if (includeLinks && entry.related_to && entry.related_to.length > 0) {
    md += '**Related Entries**:\n';
    for (const link of entry.related_to) {
      md += `- **${link.relationship}**: ${link.path}`;
      if (link.description) {
        md += ` - ${link.description}`;
      }
      md += '\n';
    }
    md += '\n';
  }
  
  if (entry.author || entry.version || entry.created_at || entry.updated_at) {
    md += '**Metadata**:\n';
    if (entry.author) md += `- Author: ${entry.author}\n`;
    if (entry.version) md += `- Version: ${entry.version}\n`;
    if (entry.created_at) md += `- Created: ${new Date(entry.created_at).toLocaleDateString()}\n`;
    if (entry.updated_at) md += `- Updated: ${new Date(entry.updated_at).toLocaleDateString()}\n`;
  }
  
  return md;
}