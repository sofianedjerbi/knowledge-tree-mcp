/**
 * Core knowledge entry types and interfaces
 */

export type Priority = "CRITICAL" | "REQUIRED" | "COMMON" | "EDGE-CASE";

export type RelationshipType = 
  | "related" 
  | "supersedes" 
  | "superseded_by" 
  | "conflicts_with" 
  | "implements" 
  | "implemented_by";

export interface KnowledgeRelation {
  path: string;
  relationship: RelationshipType;
  description?: string;
}

/**
 * Example structure for code samples and scenarios
 */
export interface KnowledgeExample {
  /**
   * Title of the example (e.g., "Bad Example", "Good Example")
   */
  title?: string;
  
  /**
   * Short explanation of what this example demonstrates
   */
  description?: string;
  
  /**
   * Code snippet (optional)
   */
  code?: string;
  
  /**
   * Programming language for syntax highlighting
   * Examples: "ts", "js", "py", "java", "go"
   */
  language?: string;
}

/**
 * Core knowledge entry structure
 */
export interface KnowledgeEntry {
  /**
   * Short descriptive title for indexing and display
   * Example: "Avoid TODO comments in production code"
   */
  title: string;

  /**
   * Optional unique identifier for URLs or references
   * Example: "avoid-todo-comments"
   */
  slug?: string;

  /**
   * Priority level of the knowledge entry
   */
  priority: Priority;

  /**
   * Main category for organization
   * Example: "code-quality", "testing", "architecture"
   */
  category?: string;

  /**
   * Tags for better search and filtering
   * Example: ["linting", "review", "patterns"]
   */
  tags?: string[];

  /**
   * The core issue this knowledge entry addresses
   */
  problem: string;

  /**
   * Optional context explaining when/why this is relevant
   */
  context?: string;

  /**
   * Recommended solution or best practice
   */
  solution: string;

  /**
   * One or more examples to illustrate the solution or anti-pattern
   */
  examples?: KnowledgeExample[];

  /**
   * Optional code example (deprecated - use examples instead)
   * @deprecated Use the examples array for code samples
   */
  code?: string;

  /**
   * Explicit relationships to other entries in the knowledge base
   */
  related_to?: KnowledgeRelation[];

  /**
   * Metadata for versioning and authorship
   */
  author?: string;
  created_at?: string; // ISO 8601 timestamp
  updated_at?: string; // ISO 8601 timestamp
  version?: string;
}