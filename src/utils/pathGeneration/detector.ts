/**
 * Category and technology detection logic
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PathOptions, ConfigMaps, MatchScore, SKIP_WORDS } from './types.js';
import { 
  findTagMatches, 
  findTitleMatches, 
  aggregateScores, 
  getBestMatch,
  scoreMatch 
} from './scorer.js';

// Get the directory of this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load configuration files
let configs: ConfigMaps | null = null;

function loadConfigs(): ConfigMaps {
  if (!configs) {
    const configDir = join(__dirname, '../../config');
    
    configs = {
      technologies: JSON.parse(
        readFileSync(join(configDir, 'technologies.json'), 'utf-8')
      ),
      categories: JSON.parse(
        readFileSync(join(configDir, 'categories.json'), 'utf-8')
      ),
      subcategories: JSON.parse(
        readFileSync(join(configDir, 'subcategories.json'), 'utf-8')
      )
    };
  }
  return configs;
}

/**
 * Detects the category using scoring system
 */
export function detectCategory(
  title: string,
  options?: PathOptions
): string {
  const { category: userCategory, tags = [], projectConfig } = options || {};
  const { technologies, categories } = loadConfigs();
  
  // If user provided a category, use it
  if (userCategory) {
    return userCategory.toLowerCase().replace(/\s+/g, '-');
  }
  
  // Check project-specific configuration first
  if (projectConfig) {
    const titleLower = title.toLowerCase();
    
    // Check project categories
    if (projectConfig.categories) {
      for (const [category, data] of Object.entries(projectConfig.categories)) {
        if (data.keywords.some(kw => titleLower.includes(kw))) {
          return category;
        }
      }
    }
    
    // Check project keywords
    if (projectConfig.keywords) {
      for (const [category, keywords] of Object.entries(projectConfig.keywords)) {
        if (keywords.some(kw => titleLower.includes(kw.toLowerCase()))) {
          return category;
        }
      }
    }
  }
  
  const allMatches: MatchScore[] = [];
  
  // 1. Find matches in tags (highest priority)
  if (tags.length > 0) {
    allMatches.push(...findTagMatches(tags, technologies, categories));
  }
  
  // 2. Find matches in title
  allMatches.push(...findTitleMatches(title, technologies, categories));
  
  // 3. Aggregate and get best match
  const aggregated = aggregateScores(allMatches);
  const bestCategory = getBestMatch(aggregated);
  
  if (bestCategory) {
    return bestCategory;
  }
  
  // 4. Try to detect unknown technology
  const unknownTech = detectUnknownTechnology(title, tags);
  if (unknownTech) {
    // Check if we have context from category matches
    const categoryContext = aggregated.find(m => 
      Object.keys(categories).includes(m.category)
    );
    
    if (categoryContext) {
      // Place unknown tech under the detected category
      return `${categoryContext.category}/${unknownTech}`;
    }
    
    // Default to tools category for unknown tech
    return `tools/${unknownTech}`;
  }
  
  // 5. Default fallback
  return 'general';
}

/**
 * Detects potential unknown technology names
 */
export function detectUnknownTechnology(
  title: string,
  tags?: string[]
): string | null {
  const { technologies, categories } = loadConfigs();
  
  // First check tags for tech-like names
  if (tags && tags.length > 0) {
    for (const tag of tags) {
      const normalized = tag.toLowerCase();
      
      // Skip if it's a known technology
      if (technologies[normalized]) continue;
      
      // Skip if it's a category keyword
      const isKeyword = Object.values(categories)
        .flat()
        .includes(normalized);
      if (isKeyword) continue;
      
      // Check if it looks like a technology name
      if (normalized.length > 2 && /^[a-z][a-z0-9\-\.]*[a-z0-9]$/i.test(tag)) {
        return normalized;
      }
    }
  }
  
  // Then check title for capitalized words
  const words = title.split(/\s+/);
  for (const word of words) {
    // Look for capitalized words or tech patterns
    if (/^[A-Z][a-zA-Z0-9]+$/.test(word) || /^[a-z]+\.js$/i.test(word)) {
      const normalized = word.toLowerCase();
      
      // Skip common words
      if (SKIP_WORDS.includes(normalized)) continue;
      
      // Skip if it's a known technology
      if (technologies[normalized]) continue;
      
      // Skip if it's a category keyword
      const isKeyword = Object.values(categories)
        .flat()
        .includes(normalized);
      if (isKeyword) continue;
      
      if (normalized.length > 2) {
        return normalized;
      }
    }
  }
  
  return null;
}

/**
 * Detects the subcategory based on title content
 */
export function detectSubcategory(title: string): string | null {
  const { subcategories } = loadConfigs();
  const titleLower = title.toLowerCase();
  
  for (const [subcategory, patterns] of Object.entries(subcategories)) {
    for (const pattern of patterns) {
      // Create word boundary regex to avoid partial matches
      // This ensures "available" doesn't match "available" in "Available MCP Tools"
      // but "alternatives" or "alternative" as whole words will still match
      const regex = new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(title)) {
        return subcategory;
      }
    }
  }
  
  return null;
}