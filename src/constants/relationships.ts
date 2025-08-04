/**
 * Relationship-related constants for the Knowledge Tree system
 */

import type { RelationshipType } from '../types/KnowledgeEntry.js';

/**
 * All available relationship types
 */
export const RELATIONSHIP_TYPES = [
  'related',
  'supersedes',
  'superseded_by',
  'conflicts_with',
  'implements',
  'implemented_by'
] as const;

/**
 * Bidirectional relationship types
 * These automatically create reverse links when applied
 */
export const BIDIRECTIONAL_RELATIONSHIPS: RelationshipType[] = [
  'related',
  'conflicts_with'
] as const;

/**
 * Inverse relationship mappings
 * Used to determine the reverse relationship when creating links
 */
export const INVERSE_RELATIONSHIPS: Partial<Record<RelationshipType, RelationshipType>> = {
  'supersedes': 'superseded_by',
  'superseded_by': 'supersedes',
  'implements': 'implemented_by',
  'implemented_by': 'implements',
  'related': 'related',
  'conflicts_with': 'conflicts_with'
} as const;

/**
 * Relationship display names for UI
 */
export const RELATIONSHIP_DISPLAY_NAMES: Record<RelationshipType, string> = {
  'related': 'Related To',
  'supersedes': 'Supersedes',
  'superseded_by': 'Superseded By',
  'conflicts_with': 'Conflicts With',
  'implements': 'Implements',
  'implemented_by': 'Implemented By'
} as const;

/**
 * Relationship descriptions for help text
 */
export const RELATIONSHIP_DESCRIPTIONS: Record<RelationshipType, string> = {
  'related': 'General connection between entries (bidirectional)',
  'supersedes': 'This entry replaces the target entry',
  'superseded_by': 'This entry is replaced by the target entry',
  'conflicts_with': 'Conflicting approaches or patterns (bidirectional)',
  'implements': 'This entry implements a pattern defined in the target',
  'implemented_by': 'This entry has implementations in the target'
} as const;

/**
 * Relationship icons/emojis for display
 */
export const RELATIONSHIP_ICONS: Record<RelationshipType, string> = {
  'related': '↔️',
  'supersedes': '→',
  'superseded_by': '←',
  'conflicts_with': '⚡',
  'implements': '📝',
  'implemented_by': '🔧'
} as const;

/**
 * Check if a value is a valid relationship type
 */
export function isValidRelationshipType(value: unknown): value is RelationshipType {
  return typeof value === 'string' && RELATIONSHIP_TYPES.includes(value as RelationshipType);
}

/**
 * Check if a relationship type is bidirectional
 */
export function isBidirectionalRelationship(type: RelationshipType): boolean {
  return BIDIRECTIONAL_RELATIONSHIPS.includes(type);
}

/**
 * Get the inverse of a relationship type
 */
export function getInverseRelationship(type: RelationshipType): RelationshipType | undefined {
  return INVERSE_RELATIONSHIPS[type];
}

/**
 * Check if two relationship types are inverses of each other
 */
export function areInverseRelationships(type1: RelationshipType, type2: RelationshipType): boolean {
  return INVERSE_RELATIONSHIPS[type1] === type2 || INVERSE_RELATIONSHIPS[type2] === type1;
}