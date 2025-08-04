/**
 * Types for the path generation system
 */

import type { ProjectConfig } from '../../types/ProjectConfig.js';

export interface MatchScore {
  category: string;
  score: number;
  source: 'tag' | 'tech-exact' | 'title-early' | 'title-late' | 'fuzzy';
  matchedKeyword?: string;
}

export interface PathOptions {
  category?: string;
  tags?: string[];
  priority?: string;
  projectConfig?: ProjectConfig;
}

export interface PathComponents {
  category: string;
  subcategory?: string;
  filename: string;
}

export interface ConfigMaps {
  technologies: Record<string, string>;
  categories: Record<string, string[]>;
  subcategories: Record<string, string[]>;
}

// Scoring weights based on where the match is found
export const SCORING_WEIGHTS = {
  TAG_MATCH: 3.0,           // Exact match in tags
  TECH_EXACT: 2.5,         // Exact technology match
  TITLE_EARLY: 2.0,        // Found in first 3 words of title
  TITLE_LATE: 1.5,         // Found later in title
  FUZZY_MATCH: 0.5         // Fuzzy/partial match
} as const;

// Common words to skip when detecting technologies
export const SKIP_WORDS = [
  'how', 'to', 'the', 'and', 'or', 'for', 'with', 'using',
  'new', 'get', 'set', 'add', 'use', 'create', 'make',
  'in', 'on', 'at', 'by', 'from', 'into', 'through',
  'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'must',
  'can', 'need', 'want', 'like', 'help', 'learn'
];