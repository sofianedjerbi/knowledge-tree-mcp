/**
 * Central export point for all application constants
 * 
 * This module follows the principle of centralized configuration,
 * making it easy to maintain and update constants across the application.
 */

// Priority-related constants
export {
  PRIORITY_LEVELS,
  PRIORITY_WEIGHTS,
  PRIORITY_ORDER,
  PRIORITY_DISPLAY_NAMES,
  PRIORITY_DESCRIPTIONS,
  PRIORITY_COLORS,
  PRIORITY_BORDER_COLORS,
  isValidPriority,
  getPriorityWeight,
  comparePriorities
} from './priorities.js';

// Relationship-related constants
export {
  RELATIONSHIP_TYPES,
  BIDIRECTIONAL_RELATIONSHIPS,
  INVERSE_RELATIONSHIPS,
  RELATIONSHIP_DISPLAY_NAMES,
  RELATIONSHIP_DESCRIPTIONS,
  RELATIONSHIP_ICONS,
  isValidRelationshipType,
  isBidirectionalRelationship,
  getInverseRelationship,
  areInverseRelationships
} from './relationships.js';

// Default values and configuration
export {
  SEARCH_DEFAULTS,
  INDEX_DEFAULTS,
  EXPORT_DEFAULTS,
  STATS_DEFAULTS,
  RECENT_DEFAULTS,
  ANALYTICS_DEFAULTS,
  FILE_CONSTANTS,
  SERVER_DEFAULTS,
  VALIDATION_CONSTANTS,
  DISPLAY_CONSTANTS,
  HELP_TOPICS,
  TIME_CONSTANTS,
  getDefaultValue
} from './defaults.js';

// Import validation functions for the Constants object
import { isValidPriority } from './priorities.js';
import { isValidRelationshipType, isBidirectionalRelationship } from './relationships.js';

// Re-export commonly used type guards as a convenience
export const Constants = {
  // Quick access to validation functions
  isValidPriority,
  isValidRelationshipType,
  isBidirectionalRelationship,
  
  // Quick access to commonly used values
  DEFAULT_SEARCH_LIMIT: 50,
  DEFAULT_EXPORT_FORMAT: 'markdown' as const,
  DEFAULT_INDEX_FORMAT: 'tree' as const,
  
  // File extensions
  JSON_EXTENSION: '.json',
  JSONL_EXTENSION: '.jsonl',
  
  // Common regex patterns
  VALID_PATH_PATTERN: /^[a-zA-Z0-9\-_\/]+(\.[a-zA-Z0-9]+)?$/,
  PRIORITY_PREFIX_PATTERN: /^(CRITICAL|REQUIRED|COMMON|EDGE-CASE)-/,
  
  // Error messages
  ERRORS: {
    INVALID_PRIORITY: 'Priority must be one of: CRITICAL, REQUIRED, COMMON, EDGE-CASE',
    INVALID_RELATIONSHIP: 'Invalid relationship type',
    INVALID_PATH: 'Path contains invalid characters',
    ENTRY_NOT_FOUND: 'Knowledge entry not found',
    ENTRY_ALREADY_EXISTS: 'Knowledge entry already exists'
  }
} as const;