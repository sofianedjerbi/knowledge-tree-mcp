/**
 * Path building logic
 * Assembles the final path from components
 */

import { PathComponents } from './types.js';
import { slugify } from './extractor.js';

/**
 * Builds the final path from components
 */
export function buildPath(components: PathComponents): string {
  const parts: string[] = [components.category];
  
  if (components.subcategory) {
    parts.push(components.subcategory);
  }
  
  parts.push(components.filename);
  
  // Join with forward slashes and add .json extension
  return parts.join('/') + '.json';
}

/**
 * Normalizes a user-provided path
 */
export function normalizeUserPath(userPath: string): string {
  let normalized = userPath.trim().toLowerCase();
  
  // Remove leading/trailing slashes
  normalized = normalized.replace(/^\/+|\/+$/g, '');
  
  // Ensure .json extension
  if (!normalized.endsWith('.json')) {
    normalized += '.json';
  }
  
  // Split and normalize each part
  const parts = normalized.split('/');
  const normalizedParts = parts.map(part => {
    // Keep the .json extension intact for the last part
    if (part.endsWith('.json')) {
      const name = part.slice(0, -5);
      return slugify(name) + '.json';
    }
    return slugify(part);
  });
  
  return normalizedParts.join('/');
}

/**
 * Suggests alternative paths based on the title
 */
export function suggestAlternativePaths(
  primaryPath: string,
  alternativeCategories: string[]
): string[] {
  const suggestions: string[] = [primaryPath];
  
  // Extract the filename from the primary path
  const parts = primaryPath.split('/');
  const filename = parts[parts.length - 1];
  
  // Create alternatives with different categories
  for (const category of alternativeCategories) {
    const altPath = `${category}/${filename}`;
    if (altPath !== primaryPath) {
      suggestions.push(altPath);
    }
  }
  
  return suggestions;
}