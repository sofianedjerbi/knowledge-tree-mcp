/**
 * Central export point for all utility modules
 */

// File system operations
export {
  scanKnowledgeTree,
  ensureDirectory,
  readKnowledgeEntry,
  writeKnowledgeEntry,
  fileExists,
  deleteFile,
  getFileStats,
  appendToFile,
  readFile,
  writeFile,
  getDescriptionFromPath,
  ensureJsonExtension,
  ensureKnowledgeExtension
} from './fileSystem.js';

// Markdown utilities
export {
  parseMarkdownToEntry,
  convertEntryToMarkdown,
  isMarkdownFile,
  getKnowledgeExtension
} from './markdown/index.js';

// Logging and analytics
export {
  logUsage,
  logAccess,
  logSearch,
  logToolCall,
  logWebView,
  ensureLogsDirectory,
  readUsageLogs,
  computeUsageStats
} from './logging.js';

// Validation utilities
export {
  VALID_PRIORITIES,
  VALID_RELATIONSHIPS,
  BIDIRECTIONAL_RELATIONSHIPS,
  isValidPriority,
  isValidRelationship,
  isBidirectionalRelationship,
  validatePath,
  validateFilenameMatchesPriority,
  validateRequiredFields,
  validateRelationships,
  validateKnowledgeEntry,
  validateJSON,
  escapeHtml
} from './validation.js';

// Export format handlers
export * from './export/index.js';

// Path generation utilities
export {
  generatePathFromTitle,
  suggestPaths,
  normalizeUserPath
} from './pathGeneration/index.js';

// Entry operations
export {
  moveEntryWithReferences,
  updateReferencesToEntry,
  validateEntryMove
} from './entryOperations.js';

// Project configuration
export {
  loadProjectConfig,
  saveProjectConfig,
  initializeProjectConfig,
  getProjectCategory,
  applyProjectContext,
  extractAutoTags
} from './projectConfig.js';