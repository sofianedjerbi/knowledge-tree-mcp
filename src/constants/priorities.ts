/**
 * Priority-related constants for the Knowledge Tree system
 */

import type { Priority } from '../types/KnowledgeEntry.js';

/**
 * Priority levels in order of importance
 */
export const PRIORITY_LEVELS = [
  'CRITICAL',
  'REQUIRED', 
  'COMMON',
  'EDGE-CASE'
] as const;

/**
 * Priority weights for scoring and sorting
 * Higher values indicate higher priority
 */
export const PRIORITY_WEIGHTS: Record<Priority, number> = {
  'CRITICAL': 4,
  'REQUIRED': 3,
  'COMMON': 2,
  'EDGE-CASE': 1
} as const;

/**
 * Priority sort order (ascending)
 * Lower values appear first when sorting
 */
export const PRIORITY_ORDER: Record<Priority, number> = {
  'CRITICAL': 0,
  'REQUIRED': 1,
  'COMMON': 2,
  'EDGE-CASE': 3
} as const;

/**
 * Priority display names for UI/documentation
 */
export const PRIORITY_DISPLAY_NAMES: Record<Priority, string> = {
  'CRITICAL': 'Critical',
  'REQUIRED': 'Required',
  'COMMON': 'Common',
  'EDGE-CASE': 'Edge Case'
} as const;

/**
 * Priority descriptions for help text
 */
export const PRIORITY_DESCRIPTIONS: Record<Priority, string> = {
  'CRITICAL': 'Architecture violations, security issues, breaking changes',
  'REQUIRED': 'Must-follow patterns, best practices, team standards',
  'COMMON': 'Frequent issues and their solutions',
  'EDGE-CASE': 'Rare but documented scenarios'
} as const;

/**
 * Priority colors for UI/visualization (CSS color values)
 */
export const PRIORITY_COLORS: Record<Priority, string> = {
  'CRITICAL': '#ff4444',
  'REQUIRED': '#ff9944',
  'COMMON': '#44ff44',
  'EDGE-CASE': '#4444ff'
} as const;

/**
 * Priority border colors for UI elements
 */
export const PRIORITY_BORDER_COLORS: Record<Priority, string> = {
  'CRITICAL': '#cc0000',
  'REQUIRED': '#ff6600',
  'COMMON': '#00cc00',
  'EDGE-CASE': '#0000cc'
} as const;

/**
 * Check if a value is a valid priority
 */
export function isValidPriority(value: unknown): value is Priority {
  return typeof value === 'string' && PRIORITY_LEVELS.includes(value as Priority);
}

/**
 * Get priority weight for sorting
 */
export function getPriorityWeight(priority: Priority): number {
  return PRIORITY_WEIGHTS[priority] ?? 0;
}

/**
 * Compare two priorities for sorting (returns -1, 0, or 1)
 */
export function comparePriorities(a: Priority, b: Priority): number {
  return PRIORITY_ORDER[a] - PRIORITY_ORDER[b];
}