/**
 * Scoring logic for category detection
 * Assigns scores based on where matches are found
 */

import { MatchScore, SCORING_WEIGHTS } from './types.js';

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Scores a potential category match based on where it was found
 */
export function scoreMatch(
  category: string,
  source: MatchScore['source'],
  matchedKeyword?: string
): MatchScore {
  let score = 0;
  
  switch (source) {
    case 'tag':
      score = SCORING_WEIGHTS.TAG_MATCH;
      break;
    case 'tech-exact':
      score = SCORING_WEIGHTS.TECH_EXACT;
      break;
    case 'title-early':
      score = SCORING_WEIGHTS.TITLE_EARLY;
      break;
    case 'title-late':
      score = SCORING_WEIGHTS.TITLE_LATE;
      break;
    case 'fuzzy':
      score = SCORING_WEIGHTS.FUZZY_MATCH;
      break;
  }
  
  return {
    category,
    score,
    source,
    matchedKeyword
  };
}

/**
 * Finds matches in tags and scores them highly
 */
export function findTagMatches(
  tags: string[],
  technologies: Record<string, string>,
  categories: Record<string, string[]>
): MatchScore[] {
  const matches: MatchScore[] = [];
  const tagLower = tags.map(t => t.toLowerCase());
  
  // Check for exact technology matches in tags
  for (const tag of tagLower) {
    if (technologies[tag]) {
      matches.push(scoreMatch(technologies[tag], 'tag', tag));
    }
  }
  
  // Check for category keyword matches in tags
  for (const [category, keywords] of Object.entries(categories)) {
    for (const tag of tagLower) {
      if (keywords.includes(tag)) {
        matches.push(scoreMatch(category, 'tag', tag));
        break; // Only score once per category
      }
    }
  }
  
  return matches;
}

/**
 * Finds matches in title with position-based scoring
 */
export function findTitleMatches(
  title: string,
  technologies: Record<string, string>,
  categories: Record<string, string[]>
): MatchScore[] {
  const matches: MatchScore[] = [];
  const titleLower = title.toLowerCase();
  const words = titleLower.split(/\s+/);
  const firstThreeWords = words.slice(0, 3).join(' ');
  
  // Check for exact technology matches
  for (const [tech, category] of Object.entries(technologies)) {
    // Escape regex special characters
    const escapedTech = escapeRegex(tech);
    // Use word boundary matching for all tech names to avoid partial matches
    const pattern = new RegExp(`\\b${escapedTech}\\b`, 'i');
    
    if (pattern.test(titleLower)) {
      const isEarly = firstThreeWords.includes(tech);
      matches.push(scoreMatch(category, isEarly ? 'title-early' : 'title-late', tech));
    }
  }
  
  // Check for category keyword matches
  for (const [category, keywords] of Object.entries(categories)) {
    for (const keyword of keywords) {
      if (titleLower.includes(keyword)) {
        const isEarly = firstThreeWords.includes(keyword);
        matches.push(scoreMatch(category, isEarly ? 'title-early' : 'title-late', keyword));
        break; // Only score once per category
      }
    }
  }
  
  return matches;
}

/**
 * Aggregates scores for categories that appear multiple times
 */
export function aggregateScores(matches: MatchScore[]): MatchScore[] {
  const scoreMap = new Map<string, MatchScore>();
  
  for (const match of matches) {
    const existing = scoreMap.get(match.category);
    if (existing) {
      // Keep the highest scoring match for each category
      if (match.score > existing.score) {
        scoreMap.set(match.category, match);
      }
    } else {
      scoreMap.set(match.category, match);
    }
  }
  
  // Sort by score descending
  return Array.from(scoreMap.values()).sort((a, b) => b.score - a.score);
}

/**
 * Gets the best category match based on scores
 */
export function getBestMatch(matches: MatchScore[]): string | null {
  if (matches.length === 0) return null;
  return matches[0].category;
}