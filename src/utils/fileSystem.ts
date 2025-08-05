/**
 * File system utilities for Knowledge Tree MCP
 * Handles all file operations, directory management, and path utilities
 */

import { promises as fs } from 'fs';
import { join, dirname, relative } from 'path';
import type { KnowledgeEntry } from '../types/index.js';
import { parseMarkdownToEntry, convertEntryToMarkdown, isMarkdownFile } from './markdown/index.js';

/**
 * Scans the knowledge tree directory recursively for JSON files
 * @param knowledgeRoot - Root directory to scan
 * @returns Array of relative paths to JSON files
 */
export async function scanKnowledgeTree(knowledgeRoot: string): Promise<string[]> {
  const entries: string[] = [];

  async function scan(dir: string) {
    try {
      const items = await fs.readdir(dir, { withFileTypes: true });
      
      for (const item of items) {
        const fullPath = join(dir, item.name);
        
        if (item.isDirectory()) {
          await scan(fullPath);
        } else if (item.name.endsWith('.json') && item.name !== '.knowledge-tree.json') {
          // Normalize path separators to forward slashes for web compatibility
          const relativePath = relative(knowledgeRoot, fullPath).replace(/\\/g, '/');
          entries.push(relativePath);
        }
      }
    } catch (error) {
      // Directory might not exist yet, silently continue
    }
  }

  await scan(knowledgeRoot);
  return entries;
}

/**
 * Ensures a directory exists, creating it if necessary
 * @param dirPath - Directory path to ensure exists
 * @returns Whether the directory was newly created
 */
export async function ensureDirectory(dirPath: string): Promise<boolean> {
  try {
    const existed = await fs.access(dirPath).then(() => true).catch(() => false);
    await fs.mkdir(dirPath, { recursive: true });
    return !existed;
  } catch (error) {
    throw new Error(`Failed to create directory ${dirPath}: ${error}`);
  }
}

/**
 * Reads a knowledge entry from a JSON file
 * @param filePath - Path to the JSON file
 * @returns Parsed knowledge entry
 */
export async function readKnowledgeEntry(filePath: string): Promise<KnowledgeEntry> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to read knowledge entry at ${filePath}: ${error}`);
  }
}

/**
 * Writes a knowledge entry to a JSON file
 * @param filePath - Path to the JSON file
 * @param entry - Knowledge entry to write
 */
export async function writeKnowledgeEntry(filePath: string, entry: KnowledgeEntry): Promise<void> {
  const dir = dirname(filePath);
  await ensureDirectory(dir);
  await fs.writeFile(filePath, JSON.stringify(entry, null, 2));
}

/**
 * Checks if a file exists
 * @param filePath - Path to check
 * @returns Whether the file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Deletes a file
 * @param filePath - Path to the file to delete
 */
export async function deleteFile(filePath: string): Promise<void> {
  await fs.unlink(filePath);
}

/**
 * Gets file statistics
 * @param filePath - Path to the file
 * @returns File statistics
 */
export async function getFileStats(filePath: string) {
  return await fs.stat(filePath);
}

/**
 * Appends content to a file
 * @param filePath - Path to the file
 * @param content - Content to append
 */
export async function appendToFile(filePath: string, content: string): Promise<void> {
  await fs.appendFile(filePath, content);
}

/**
 * Reads file content as string
 * @param filePath - Path to the file
 * @returns File content
 */
export async function readFile(filePath: string): Promise<string> {
  return await fs.readFile(filePath, 'utf-8');
}

/**
 * Write content to a file
 * @param filePath - Path to write to
 * @param content - Content to write
 */
export async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Generates a description from a knowledge entry path
 * @param path - Relative path to the knowledge entry
 * @returns Human-readable description
 */
export function getDescriptionFromPath(path: string): string {
  const parts = path.split('/');
  const filename = parts[parts.length - 1];
  const category = parts.length > 1 ? parts.slice(0, -1).join(' > ') : 'root';
  
  return `Knowledge in ${category}`;
}

/**
 * Ensures a path ends with .json extension
 * @param path - Path to check
 * @returns Path with .json extension
 */
export function ensureJsonExtension(path: string): string {
  return path.endsWith('.json') ? path : `${path}.json`;
}

/**
 * Ensures a path ends with an appropriate knowledge extension
 * @param path - Path to check
 * @param preferMarkdown - Whether to prefer .md over .json
 * @returns Path with appropriate extension
 */
export function ensureKnowledgeExtension(path: string, preferMarkdown: boolean = false): string {
  // If already has a valid extension, return as is
  if (path.endsWith('.json') || path.endsWith('.md')) {
    return path;
  }
  
  // Add appropriate extension
  return preferMarkdown ? `${path}.md` : `${path}.json`;
}