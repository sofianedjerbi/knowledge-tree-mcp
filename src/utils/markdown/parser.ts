/**
 * Markdown parser for Knowledge Tree MCP
 * Converts between Markdown and KnowledgeEntry format
 */

import type { KnowledgeEntry, KnowledgeExample, KnowledgeRelation, Priority } from '../../types/index.js';
import { isValidPriority, isValidRelationshipType } from '../../constants/index.js';

/**
 * Markdown knowledge entry format:
 * 
 * ---
 * title: Entry title
 * priority: CRITICAL|REQUIRED|COMMON|EDGE-CASE
 * slug: optional-url-friendly-id
 * category: main/subcategory
 * tags: [tag1, tag2, tag3]
 * author: Author Name
 * version: 1.0.0
 * created_at: ISO timestamp
 * updated_at: ISO timestamp
 * ---
 * 
 * # Problem
 * 
 * Description of the problem...
 * 
 * # Context
 * 
 * When/why this applies...
 * 
 * # Solution
 * 
 * How to solve it...
 * 
 * # Examples
 * 
 * ## Example Title
 * *Description of what this example shows*
 * 
 * ```language
 * code here
 * ```
 * 
 * # Related
 * 
 * - relationship: path/to/entry.md - Description
 * - related: another/entry.json
 */

interface ParsedFrontMatter {
  title?: string;
  priority?: string;
  slug?: string;
  category?: string;
  tags?: string | string[];
  author?: string;
  version?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ParseError {
  errors: string[];
  entry?: KnowledgeEntry;
}

/**
 * Parses a Markdown file into a KnowledgeEntry
 */
export function parseMarkdownToEntry(content: string): KnowledgeEntry | ParseError | null {
  const errors: string[] = [];
  
  try {
    // Extract front matter
    const frontMatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!frontMatterMatch) {
      errors.push('Missing front matter. Add --- at start and end');
      return { errors };
    }

    const frontMatterText = frontMatterMatch[1];
    const bodyText = frontMatterMatch[2];

    // Parse front matter
    const frontMatter = parseFrontMatter(frontMatterText);

    // Validate required fields
    if (!frontMatter.title) {
      errors.push('Missing: title: Your Entry Title');
    }
    if (!frontMatter.priority) {
      errors.push('Missing: priority: CRITICAL|REQUIRED|COMMON|EDGE-CASE');
    } else if (!isValidPriority(frontMatter.priority as Priority)) {
      errors.push(`Invalid priority: "${frontMatter.priority}". Use: CRITICAL|REQUIRED|COMMON|EDGE-CASE`);
    }

    // Parse body sections
    const sections = parseBodySections(bodyText);
    
    // Validate required sections
    if (!sections.problem || sections.problem.trim() === '') {
      errors.push('Missing # Problem section with content');
    }
    if (!sections.solution || sections.solution.trim() === '') {
      errors.push('Missing # Solution section with content');
    }

    // Validate related entries format
    if (sections.related) {
      for (const rel of sections.related) {
        if (!rel.path.match(/^[\w\-\/]+(\.\w+)?$/)) {
          errors.push(`Invalid path format: "${rel.path}". Use: folder/subfolder/name.json`);
        }
      }
    }

    // Validate tags format
    if (frontMatter.tags && !Array.isArray(frontMatter.tags)) {
      if (!frontMatter.tags.match(/^\[.*\]$/)) {
        errors.push(`Invalid tags format. Use: tags: [tag1, tag2] or tags: tag1, tag2`);
      }
    }

    if (errors.length > 0) {
      return { errors };
    }

    // Build entry
    const entry: KnowledgeEntry = {
      title: frontMatter.title!,
      priority: frontMatter.priority as Priority,
      problem: sections.problem || '',
      solution: sections.solution || ''
    };

    // Add optional fields
    if (frontMatter.slug) entry.slug = frontMatter.slug;
    if (frontMatter.category) entry.category = frontMatter.category;
    if (frontMatter.tags) {
      entry.tags = Array.isArray(frontMatter.tags) 
        ? frontMatter.tags 
        : frontMatter.tags.split(',').map(t => t.trim());
    }
    if (sections.context) entry.context = sections.context;
    if (sections.examples && sections.examples.length > 0) {
      entry.examples = sections.examples;
    }
    if (frontMatter.author) entry.author = frontMatter.author;
    if (frontMatter.version) entry.version = frontMatter.version;
    if (frontMatter.created_at) entry.created_at = frontMatter.created_at;
    if (frontMatter.updated_at) entry.updated_at = frontMatter.updated_at;
    if (sections.related && sections.related.length > 0) {
      entry.related_to = sections.related;
    }

    return entry;
  } catch (error) {
    console.error('Failed to parse Markdown:', error);
    errors.push(`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return { errors };
  }
}

/**
 * Converts a KnowledgeEntry to Markdown format
 */
export function convertEntryToMarkdown(entry: KnowledgeEntry): string {
  const lines: string[] = [];

  // Front matter
  lines.push('---');
  lines.push(`title: ${entry.title}`);
  lines.push(`priority: ${entry.priority}`);
  if (entry.slug) lines.push(`slug: ${entry.slug}`);
  if (entry.category) lines.push(`category: ${entry.category}`);
  if (entry.tags && entry.tags.length > 0) {
    lines.push(`tags: [${entry.tags.join(', ')}]`);
  }
  if (entry.author) lines.push(`author: ${entry.author}`);
  if (entry.version) lines.push(`version: ${entry.version}`);
  if (entry.created_at) lines.push(`created_at: ${entry.created_at}`);
  if (entry.updated_at) lines.push(`updated_at: ${entry.updated_at}`);
  lines.push('---');
  lines.push('');

  // Problem section
  lines.push('# Problem');
  lines.push('');
  lines.push(entry.problem);
  lines.push('');

  // Context section (if present)
  if (entry.context) {
    lines.push('# Context');
    lines.push('');
    lines.push(entry.context);
    lines.push('');
  }

  // Solution section
  lines.push('# Solution');
  lines.push('');
  lines.push(entry.solution);
  lines.push('');

  // Examples section (if present)
  if (entry.examples && entry.examples.length > 0) {
    lines.push('# Examples');
    lines.push('');
    for (const example of entry.examples) {
      if (example.title) {
        lines.push(`## ${example.title}`);
      }
      if (example.description) {
        lines.push(`*${example.description}*`);
        lines.push('');
      }
      if (example.code) {
        const lang = example.language || '';
        lines.push(`\`\`\`${lang}`);
        lines.push(example.code);
        lines.push('```');
        lines.push('');
      }
    }
  }

  // Related section (if present)
  if (entry.related_to && entry.related_to.length > 0) {
    lines.push('# Related');
    lines.push('');
    for (const link of entry.related_to) {
      let line = `- ${link.relationship}: ${link.path}`;
      if (link.description) {
        line += ` - ${link.description}`;
      }
      lines.push(line);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Parse front matter YAML-like format
 */
function parseFrontMatter(text: string): ParsedFrontMatter {
  const frontMatter: ParsedFrontMatter = {};
  const lines = text.split('\n');

  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      const [, key, value] = match;
      
      // Handle array values
      if (value.startsWith('[') && value.endsWith(']')) {
        const items = value.slice(1, -1).split(',').map(s => s.trim());
        (frontMatter as any)[key] = items;
      } else {
        (frontMatter as any)[key] = value.trim();
      }
    }
  }

  return frontMatter;
}

/**
 * Parse body sections from Markdown
 */
function parseBodySections(text: string): {
  problem?: string;
  context?: string;
  solution?: string;
  examples?: KnowledgeExample[];
  related?: KnowledgeRelation[];
} {
  const sections: any = {};
  
  // Split by level 1 headers
  const parts = text.split(/^# /m).filter(Boolean);
  
  for (const part of parts) {
    const lines = part.trim().split('\n');
    const header = lines[0].toLowerCase();
    const content = lines.slice(1).join('\n').trim();

    switch (header) {
      case 'problem':
        sections.problem = content;
        break;
      case 'context':
        sections.context = content;
        break;
      case 'solution':
        sections.solution = content;
        break;
      case 'examples':
        sections.examples = parseExamples(content);
        break;
      case 'related':
        sections.related = parseRelated(content);
        break;
    }
  }

  return sections;
}

/**
 * Parse examples section
 */
function parseExamples(content: string): KnowledgeExample[] {
  const examples: KnowledgeExample[] = [];
  
  // Split by level 2 headers
  const parts = content.split(/^## /m).filter(Boolean);
  
  for (const part of parts) {
    const lines = part.trim().split('\n');
    const title = lines[0].trim();
    
    let description = '';
    let code = '';
    let language = '';
    
    // Parse content
    let inCode = false;
    let codeLines: string[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.startsWith('```')) {
        if (!inCode) {
          inCode = true;
          language = line.slice(3).trim();
        } else {
          code = codeLines.join('\n');
          codeLines = [];
          inCode = false;
        }
      } else if (inCode) {
        codeLines.push(line);
      } else if (line.startsWith('*') && line.endsWith('*')) {
        description = line.slice(1, -1).trim();
      }
    }
    
    const example: KnowledgeExample = {};
    if (title) example.title = title;
    if (description) example.description = description;
    if (code) example.code = code;
    if (language) example.language = language;
    
    if (Object.keys(example).length > 0) {
      examples.push(example);
    }
  }
  
  return examples;
}

/**
 * Parse related section
 */
function parseRelated(content: string): KnowledgeRelation[] {
  const related: KnowledgeRelation[] = [];
  const lines = content.split('\n').filter(line => line.trim().startsWith('-'));
  
  for (const line of lines) {
    // Format: - relationship: path - description
    // Need to handle paths that may contain special chars
    const match = line.match(/^-\s*(\w+):\s*([^\s]+)(?:\s*-\s*(.+))?$/);
    if (match) {
      const [, relationship, path, description] = match;
      
      if (isValidRelationshipType(relationship as any)) {
        const relation: KnowledgeRelation = {
          path: path.trim(),
          relationship: relationship as any
        };
        
        if (description) {
          relation.description = description.trim();
        }
        
        related.push(relation);
      }
    }
  }
  
  return related;
}

/**
 * Check if a file path is markdown
 */
export function isMarkdownFile(path: string): boolean {
  return path.endsWith('.md') || path.endsWith('.markdown');
}

/**
 * Get the appropriate extension based on format preference
 */
export function getKnowledgeExtension(preferMarkdown: boolean = false): string {
  return preferMarkdown ? '.md' : '.json';
}