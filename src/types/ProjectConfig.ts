/**
 * Project configuration types for knowledge base customization
 */

export interface ProjectConfig {
  /**
   * Project name for context
   */
  name: string;
  
  /**
   * Primary project prefix for paths (e.g., "knowledge-tree", "my-app")
   */
  pathPrefix?: string;
  
  /**
   * Project-specific keywords that indicate categories
   */
  keywords?: {
    [category: string]: string[];
  };
  
  /**
   * Technologies used in the project
   */
  technologies?: string[];
  
  /**
   * Custom category mappings
   */
  categories?: {
    [key: string]: {
      keywords: string[];
      subcategories?: string[];
    };
  };
  
  /**
   * Default priority for new entries
   */
  defaultPriority?: 'CRITICAL' | 'REQUIRED' | 'COMMON' | 'EDGE-CASE';
  
  /**
   * Auto-tag rules based on content
   */
  autoTags?: {
    [tag: string]: string[]; // tag -> keywords that trigger it
  };
}

export interface ProjectContext {
  config: ProjectConfig;
  configPath: string;
}