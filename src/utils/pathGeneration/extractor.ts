/**
 * Topic extraction logic
 * Extracts meaningful topics from titles while preserving context
 */

import { SKIP_WORDS } from './types.js';

/**
 * Removes common prefixes from title
 */
function removeCommonPrefixes(title: string): string {
  const prefixPatterns = [
    /^(how to|how do i|how can i|how should i)\s+/i,
    /^(guide to|tutorial on|introduction to)\s+/i,
    /^(implement|create|build|setup|configure|install)\s+/i,
    /^(fix|solve|resolve|debug|troubleshoot)\s+/i,
    /^(best practices for|patterns for)\s+/i,
    /^(understanding|learn|learning)\s+/i,
    /^(getting started with)\s+/i,
    /^(a |an |the )\s+/i,
  ];
  
  let cleaned = title;
  for (const pattern of prefixPatterns) {
    cleaned = cleaned.replace(pattern, '');
  }
  
  return cleaned;
}

/**
 * Extracts key phrases that should be preserved
 */
function extractKeyPhrases(text: string): string[] {
  const phrases: string[] = [];
  
  // Common multi-word technical terms
  const multiWordPatterns = [
    /\b(machine learning|deep learning|artificial intelligence)\b/gi,
    /\b(continuous integration|continuous deployment|continuous delivery)\b/gi,
    /\b(load balancer|reverse proxy|api gateway)\b/gi,
    /\b(message queue|event bus|pub sub)\b/gi,
    /\b(unit test|integration test|end to end)\b/gi,
    /\b(best practice|design pattern|anti pattern)\b/gi,
    /\b(code review|pull request|merge request)\b/gi,
    /\b(version control|source control)\b/gi,
    /\b(infrastructure as code)\b/gi,
    /\b(server side|client side)\b/gi,
    /\b(front end|back end)\b/gi,
  ];
  
  for (const pattern of multiWordPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      phrases.push(...matches.map(m => m.toLowerCase()));
    }
  }
  
  return phrases;
}

/**
 * Slugifies text to create URL-friendly strings
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/-+/g, '-')       // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, '');  // Remove leading/trailing hyphens
}

/**
 * Extracts the main topic from the title
 * Preserves context instead of just returning the technology name
 */
export function extractTopic(title: string): string {
  // First, remove common prefixes
  let cleanTitle = removeCommonPrefixes(title);
  
  // Extract and preserve key phrases
  const keyPhrases = extractKeyPhrases(cleanTitle);
  
  // If we have key phrases, use the first one
  if (keyPhrases.length > 0) {
    // Check if the title has more context after the key phrase
    const phraseIndex = cleanTitle.toLowerCase().indexOf(keyPhrases[0]);
    const afterPhrase = cleanTitle.substring(phraseIndex + keyPhrases[0].length).trim();
    
    if (afterPhrase && afterPhrase.split(' ').length <= 3) {
      // Include the context after the key phrase
      return slugify(`${keyPhrases[0]} ${afterPhrase}`);
    }
    
    return slugify(keyPhrases[0]);
  }
  
  // Split into words and filter
  const words = cleanTitle.split(/\s+/).filter(word => {
    const lower = word.toLowerCase();
    return lower.length > 2 && !SKIP_WORDS.includes(lower);
  });
  
  // Look for important technical terms
  const importantTerms = words.filter(word => {
    const lower = word.toLowerCase();
    return (
      // Technology patterns
      /^[a-z]+\.?js$/i.test(word) ||
      // Capitalized words (likely proper nouns/tech names)
      /^[A-Z][a-zA-Z0-9]+$/.test(word) ||
      // Common tech suffixes
      /(?:db|api|sql|css|xml|json|yaml|auth|cache|queue|sync)$/i.test(word) ||
      // Version patterns
      /^v?\d+(\.\d+)*$/i.test(word)
    );
  });
  
  // Construct the topic
  if (importantTerms.length > 0) {
    // Include some context words around the important terms
    const contextWords = words.slice(0, 5); // Take up to 5 meaningful words
    return slugify(contextWords.join(' '));
  }
  
  // Fallback: use first 3-5 meaningful words
  const topicWords = words.slice(0, Math.min(5, words.length));
  return slugify(topicWords.join(' '));
}

/**
 * Extracts a filename that includes context
 * This is different from extractTopic as it focuses on the specific action/concept
 */
export function extractFilename(title: string, detectedTech?: string): string {
  const topic = extractTopic(title);
  
  // If the topic is just the technology name, try to add more context
  if (detectedTech && topic === slugify(detectedTech)) {
    // Look for action words or concepts in the original title
    const cleanTitle = removeCommonPrefixes(title).toLowerCase();
    const words = cleanTitle.split(/\s+/);
    
    // Find action or concept words
    const contextWords = words.filter(word => {
      const lower = word.toLowerCase();
      return (
        !SKIP_WORDS.includes(lower) &&
        lower !== detectedTech.toLowerCase() &&
        lower.length > 2
      );
    });
    
    if (contextWords.length > 0) {
      // Take up to 3 context words
      const context = contextWords.slice(0, 3).join('-');
      return `${topic}-${context}`;
    }
  }
  
  return topic;
}