/**
 * Validation utilities for Knowledge Tree MCP
 * Handles all validation logic for knowledge entries, paths, and relationships
 */

import type { KnowledgeEntry, Priority, RelationshipType } from '../types/index.js';
import { 
  PRIORITY_LEVELS,
  RELATIONSHIP_TYPES,
  BIDIRECTIONAL_RELATIONSHIPS,
  isValidPriority as isValidPriorityConst,
  isValidRelationshipType,
  isBidirectionalRelationship as isBidirectionalRelationshipConst,
  VALIDATION_CONSTANTS,
  FILE_CONSTANTS,
  Constants
} from '../constants/index.js';

// Re-export validation functions from constants for backward compatibility
export const isValidPriority = isValidPriorityConst;
export const isValidRelationship = isValidRelationshipType;
export const isBidirectionalRelationship = isBidirectionalRelationshipConst;

// Re-export constants for backward compatibility (will be deprecated)
export const VALID_PRIORITIES = PRIORITY_LEVELS;
export const VALID_RELATIONSHIPS = RELATIONSHIP_TYPES;
export { BIDIRECTIONAL_RELATIONSHIPS };

/**
 * Validates a path format
 * @param path - Path to validate
 * @returns Validation result with error message if invalid
 */
export function validatePath(path: string): { valid: boolean; error?: string } {
  if (!path || typeof path !== 'string' || path.trim() === '') {
    return { valid: false, error: 'Path is required and must be non-empty' };
  }

  // Ensure valid path characters using constant regex
  if (!VALIDATION_CONSTANTS.PATH_REGEX.test(path)) {
    return { 
      valid: false, 
      error: Constants.ERRORS.INVALID_PATH
    };
  }

  return { valid: true };
}

/**
 * Validates that a filename matches the priority prefix
 * @param filename - Filename to check
 * @param priority - Expected priority
 * @returns Validation result with error message if invalid
 * @deprecated Priority is no longer part of the filename, only a JSON attribute
 */
export function validateFilenameMatchesPriority(
  filename: string, 
  priority: Priority
): { valid: boolean; error?: string } {
  // Priority is no longer part of the filename
  return { valid: true };
}

/**
 * Validates required fields for a knowledge entry
 * @param entry - Partial knowledge entry to validate
 * @returns Array of validation errors
 */
export function validateRequiredFields(entry: Partial<KnowledgeEntry>): string[] {
  const errors: string[] = [];

  if (!entry.title || typeof entry.title !== 'string' || entry.title.trim() === '') {
    errors.push('Title is required and must be non-empty');
  }

  if (!entry.priority || !isValidPriority(entry.priority)) {
    errors.push(Constants.ERRORS.INVALID_PRIORITY);
  }

  if (!entry.problem || typeof entry.problem !== 'string' || entry.problem.trim() === '') {
    errors.push('Problem description is required and must be non-empty');
  }

  if (!entry.solution || typeof entry.solution !== 'string' || entry.solution.trim() === '') {
    errors.push('Solution description is required and must be non-empty');
  }

  return errors;
}

/**
 * Validates relationships in a knowledge entry
 * @param relationships - Array of relationships to validate
 * @returns Array of validation errors
 */
export function validateRelationships(
  relationships?: KnowledgeEntry['related_to']
): string[] {
  const errors: string[] = [];

  if (!relationships || !Array.isArray(relationships)) {
    return errors;
  }

  for (let i = 0; i < relationships.length; i++) {
    const link = relationships[i];
    
    if (!link.path || typeof link.path !== 'string') {
      errors.push(`Related entry ${i + 1}: path is required`);
    } else {
      const pathValidation = validatePath(link.path);
      if (!pathValidation.valid) {
        errors.push(`Related entry ${i + 1}: ${pathValidation.error}`);
      }
    }
    
    if (!link.relationship || !isValidRelationship(link.relationship)) {
      errors.push(`Related entry ${i + 1}: invalid relationship type`);
    }
  }

  return errors;
}

/**
 * Validates a complete knowledge entry
 * @param entry - Knowledge entry to validate
 * @param path - Path where the entry will be stored
 * @returns Object with validation result and errors
 */
export function validateKnowledgeEntry(
  entry: Partial<KnowledgeEntry>,
  path: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate path
  const pathValidation = validatePath(path);
  if (!pathValidation.valid && pathValidation.error) {
    errors.push(pathValidation.error);
  }

  // Validate required fields
  errors.push(...validateRequiredFields(entry));

  // Priority is no longer part of the filename - removed validation

  // Validate relationships
  if (entry.related_to) {
    errors.push(...validateRelationships(entry.related_to));
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates JSON format
 * @param content - String content to validate as JSON
 * @returns Validation result with parsed data or error
 */
export function validateJSON<T = any>(
  content: string
): { valid: boolean; data?: T; error?: string } {
  try {
    const data = JSON.parse(content);
    return { valid: true, data };
  } catch (error) {
    return { 
      valid: false, 
      error: 'Invalid JSON format' 
    };
  }
}

/**
 * Escapes HTML special characters
 * @param text - Text to escape
 * @returns Escaped HTML string
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}