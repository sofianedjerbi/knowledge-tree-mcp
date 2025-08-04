/**
 * Find related knowledge entries based on content similarity
 */

import type { KnowledgeEntry, ServerContext } from '../types/index.js';
import { join } from 'path';
import { readKnowledgeEntry } from './fileSystem.js';

interface RelatedEntry {
  path: string;
  title: string;
  score: number;
  reason: string;
}

/**
 * Find entries related to the newly created entry
 */
export async function findRelatedEntries(
  newEntry: KnowledgeEntry,
  newPath: string,
  context: ServerContext,
  limit: number = 5
): Promise<RelatedEntry[]> {
  const allEntries = await context.scanKnowledgeTree();
  const related: RelatedEntry[] = [];
  
  // Extract keywords from the new entry
  const keywords = extractKeywords(newEntry);
  
  for (const entryPath of allEntries) {
    // Skip the newly created entry itself
    if (entryPath === newPath) continue;
    
    try {
      const fullPath = join(context.knowledgeRoot, entryPath);
      const entry = await readKnowledgeEntry(fullPath);
      
      // Calculate similarity score
      const score = calculateSimilarity(newEntry, entry, keywords);
      
      if (score > 0) {
        related.push({
          path: entryPath.replace(/\.json$/, ''), // Remove extension
          title: entry.title || 'Untitled',
          score,
          reason: getSimilarityReason(newEntry, entry, keywords)
        });
      }
    } catch (error) {
      // Skip entries that can't be read
      continue;
    }
  }
  
  // Sort by score and return top entries
  return related
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Extract keywords from an entry for matching
 */
function extractKeywords(entry: KnowledgeEntry): Set<string> {
  const keywords = new Set<string>();
  
  // Add words from title
  if (entry.title) {
    entry.title.toLowerCase().split(/\s+/).forEach(word => {
      if (word.length > 2) keywords.add(word);
    });
  }
  
  // Add tags
  if (entry.tags) {
    entry.tags.forEach(tag => keywords.add(tag.toLowerCase()));
  }
  
  // Add category parts
  if (entry.category) {
    entry.category.split('/').forEach(part => keywords.add(part.toLowerCase()));
  }
  
  // Extract key technical terms from problem/solution
  const technicalTerms = extractTechnicalTerms(entry.problem + ' ' + entry.solution);
  technicalTerms.forEach(term => keywords.add(term));
  
  return keywords;
}

/**
 * Extract technical terms (capitalized words, acronyms, etc.)
 */
function extractTechnicalTerms(text: string): string[] {
  const terms: string[] = [];
  
  // Match capitalized words (likely technical terms)
  const capitalizedWords = text.match(/\b[A-Z][a-z]+\b/g) || [];
  terms.push(...capitalizedWords.map(w => w.toLowerCase()));
  
  // Match acronyms
  const acronyms = text.match(/\b[A-Z]{2,}\b/g) || [];
  terms.push(...acronyms.map(a => a.toLowerCase()));
  
  // Common technical patterns
  const techPatterns = text.match(/\b(error|exception|bug|issue|problem|fix|solution|handle|process|method|function|api|database|server|client)\b/gi) || [];
  terms.push(...techPatterns.map(p => p.toLowerCase()));
  
  return [...new Set(terms)]; // Remove duplicates
}

/**
 * Calculate similarity score between two entries
 */
function calculateSimilarity(entry1: KnowledgeEntry, entry2: KnowledgeEntry, keywords: Set<string>): number {
  let score = 0;
  
  // Same priority adds points
  if (entry1.priority === entry2.priority) score += 2;
  
  // Same category is highly relevant
  if (entry1.category && entry2.category && entry1.category === entry2.category) {
    score += 5;
  } else if (entry1.category && entry2.category) {
    // Partial category match
    const cat1Parts = entry1.category.split('/');
    const cat2Parts = entry2.category.split('/');
    const commonParts = cat1Parts.filter(p => cat2Parts.includes(p)).length;
    score += commonParts * 2;
  }
  
  // Tag overlap
  if (entry1.tags && entry2.tags) {
    const commonTags = entry1.tags.filter(t => entry2.tags!.includes(t)).length;
    score += commonTags * 3;
  }
  
  // Keyword matches in title
  if (entry2.title) {
    const titleWords = entry2.title.toLowerCase().split(/\s+/);
    const matchingKeywords = titleWords.filter(w => keywords.has(w)).length;
    score += matchingKeywords * 2;
  }
  
  // Content similarity (simple keyword matching)
  const entry2Text = `${entry2.title} ${entry2.problem} ${entry2.solution}`.toLowerCase();
  keywords.forEach(keyword => {
    if (entry2Text.includes(keyword)) score += 1;
  });
  
  return score;
}

/**
 * Get human-readable reason for similarity
 */
function getSimilarityReason(entry1: KnowledgeEntry, entry2: KnowledgeEntry, keywords: Set<string>): string {
  const reasons: string[] = [];
  
  // Same category
  if (entry1.category && entry2.category && entry1.category === entry2.category) {
    reasons.push(`same category (${entry1.category})`);
  }
  
  // Common tags
  if (entry1.tags && entry2.tags) {
    const commonTags = entry1.tags.filter(t => entry2.tags!.includes(t));
    if (commonTags.length > 0) {
      reasons.push(`tags: ${commonTags.join(', ')}`);
    }
  }
  
  // Keywords in title
  if (entry2.title) {
    const titleWords = entry2.title.toLowerCase().split(/\s+/);
    const matchingKeywords = titleWords.filter(w => keywords.has(w));
    if (matchingKeywords.length > 0) {
      reasons.push(`keywords: ${matchingKeywords.slice(0, 3).join(', ')}`);
    }
  }
  
  return reasons.length > 0 ? reasons.join('; ') : 'content similarity';
}