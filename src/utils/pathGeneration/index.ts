/**
 * Main entry point for path generation utilities
 */

import { PathOptions } from './types.js';
import { detectCategory, detectSubcategory } from './detector.js';
import { extractFilename } from './extractor.js';
import { buildPath, normalizeUserPath, suggestAlternativePaths } from './builder.js';

/**
 * Generates a smart path from a title and optional metadata
 * 
 * Examples:
 * - "How to find an element in Redis" -> "database/redis/how-to/find-element-redis.json"
 * - "JWT authentication best practices" -> "auth/best-practices/jwt-authentication.json"
 * - "Fix MongoDB connection timeout" -> "database/mongodb/troubleshooting/mongodb-connection-timeout.json"
 * - "Terraspace module development guide" -> "iac/terraspace/guides/module-development.json"
 */
export function generatePathFromTitle(
  title: string,
  options?: PathOptions
): string {
  // 1. Detect the category using scoring system
  const category = detectCategory(title, options);
  
  // 2. Detect subcategory based on title patterns
  // First check if project config has subcategories for this category
  let subcategory = null;
  if (options?.projectConfig?.categories?.[category]?.subcategories) {
    // For project-specific categories, don't auto-detect subcategory
    // unless it's explicitly in the title
    const projectSubcats = options.projectConfig.categories[category].subcategories;
    for (const subcat of projectSubcats) {
      const regex = new RegExp(`\\b${subcat}\\b`, 'i');
      if (regex.test(title)) {
        subcategory = subcat;
        break;
      }
    }
  } else {
    // Fall back to default subcategory detection for non-project categories
    subcategory = detectSubcategory(title);
  }
  
  // 3. Extract a meaningful filename from the title
  const filename = extractFilename(title);
  
  // 4. Build the final path
  let path = buildPath({
    category,
    subcategory: subcategory || undefined,
    filename
  });
  
  // 5. Apply project prefix if configured
  if (options?.projectConfig?.pathPrefix) {
    // Only prepend if path doesn't already start with the prefix
    if (!path.startsWith(options.projectConfig.pathPrefix + '/')) {
      path = `${options.projectConfig.pathPrefix}/${path}`;
    }
  }
  
  return path;
}

/**
 * Suggests multiple path options for a title
 * Useful for giving users alternatives
 */
export function suggestPaths(
  title: string,
  options?: PathOptions
): string[] {
  // Generate the primary path
  const primaryPath = generatePathFromTitle(title, options);
  
  // TODO: Implement logic to find alternative categories
  // For now, just return the primary path
  return [primaryPath];
}

// Re-export utility functions
export { normalizeUserPath } from './builder.js';
export { detectCategory, detectSubcategory, detectUnknownTechnology } from './detector.js';
export { extractTopic, extractFilename, slugify } from './extractor.js';