/**
 * Default values and configuration constants
 */

import type { 
  SearchScope, 
  SortOption, 
  IndexFormat, 
  ExportFormat,
  StatsInclude,
  AnalyticsInclude,
  RecentChangeType 
} from '../types/ServerTypes.js';

/**
 * Search defaults
 */
export const SEARCH_DEFAULTS = {
  LIMIT: 50,
  SORT_BY: 'relevance' as SortOption,
  SEARCH_IN: ['all'] as SearchScope[],
  REGEX: false,
  CASE_SENSITIVE: false
} as const;

/**
 * Index/listing defaults
 */
export const INDEX_DEFAULTS = {
  FORMAT: 'tree' as IndexFormat,
  INCLUDE_CONTENT: false,
  MAX_ENTRIES: 100
} as const;

/**
 * Export defaults
 */
export const EXPORT_DEFAULTS = {
  FORMAT: 'markdown' as ExportFormat,
  INCLUDE_LINKS: true
} as const;

/**
 * Statistics defaults
 */
export const STATS_DEFAULTS = {
  INCLUDE: ['summary', 'priorities', 'categories', 'orphaned', 'popular'] as StatsInclude[]
} as const;

/**
 * Recent changes defaults
 */
export const RECENT_DEFAULTS = {
  DAYS: 7,
  LIMIT: 20,
  TYPE: 'all' as RecentChangeType
} as const;

/**
 * Analytics defaults
 */
export const ANALYTICS_DEFAULTS = {
  DAYS: 30,
  INCLUDE: ['access', 'searches', 'tools', 'interface', 'patterns'] as AnalyticsInclude[]
} as const;

/**
 * File system constants
 */
export const FILE_CONSTANTS = {
  EXTENSION: '.json',
  LOGS_DIR: 'logs',
  USAGE_LOG_FILE: 'usage.jsonl',
  PUBLIC_DIR: 'public',
  DOCS_DIR: 'docs'
} as const;

/**
 * Server configuration defaults
 */
export const SERVER_DEFAULTS = {
  NAME: 'knowledge',
  VERSION: '1.0.0',
  DEFAULT_PORT: 3000,
  WEBSOCKET_PATH: '/ws',
  HOST: '0.0.0.0',
  DOCS_DIR: 'docs',
  LOGS_SUBDIR: 'logs'
} as const;

/**
 * Validation constants
 */
export const VALIDATION_CONSTANTS = {
  PATH_REGEX: /^[a-zA-Z0-9\-_\/]+(\.[a-zA-Z0-9]+)?$/,
  MAX_PATH_LENGTH: 255,
  MAX_TITLE_LENGTH: 200,
  MAX_SLUG_LENGTH: 100,
  MAX_PROBLEM_LENGTH: 1000,
  MAX_SOLUTION_LENGTH: 5000,
  MAX_CONTEXT_LENGTH: 2000,
  MAX_CODE_LENGTH: 10000,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_TAG_LENGTH: 50,
  MAX_TAGS_COUNT: 20,
  MAX_EXAMPLES_COUNT: 10,
  FILENAME_PREFIX_SEPARATOR: '-'
} as const;

/**
 * Display/UI constants
 */
export const DISPLAY_CONSTANTS = {
  TRUNCATE_LENGTH: 50,
  PREVIEW_LENGTH: 100,
  MAX_SEARCH_RESULTS: 1000,
  MAX_EXPORT_ENTRIES: 10000,
  STALE_ENTRY_DAYS: 30
} as const;

/**
 * Help topics
 */
export const HELP_TOPICS = [
  'overview',
  'creating',
  'linking',
  'searching',
  'validating',
  'examples',
  'categories'
] as const;

/**
 * Time constants (in milliseconds)
 */
export const TIME_CONSTANTS = {
  DAY_MS: 24 * 60 * 60 * 1000,
  HOUR_MS: 60 * 60 * 1000,
  MINUTE_MS: 60 * 1000
} as const;

/**
 * Get default value for a specific configuration
 */
export function getDefaultValue<T extends keyof typeof SEARCH_DEFAULTS>(
  category: 'search',
  key: T
): typeof SEARCH_DEFAULTS[T];
export function getDefaultValue<T extends keyof typeof INDEX_DEFAULTS>(
  category: 'index',
  key: T
): typeof INDEX_DEFAULTS[T];
export function getDefaultValue<T extends keyof typeof EXPORT_DEFAULTS>(
  category: 'export',
  key: T
): typeof EXPORT_DEFAULTS[T];
export function getDefaultValue(category: string, key: string): any {
  const defaults: Record<string, any> = {
    search: SEARCH_DEFAULTS,
    index: INDEX_DEFAULTS,
    export: EXPORT_DEFAULTS,
    stats: STATS_DEFAULTS,
    recent: RECENT_DEFAULTS,
    analytics: ANALYTICS_DEFAULTS
  };
  
  return defaults[category]?.[key];
}