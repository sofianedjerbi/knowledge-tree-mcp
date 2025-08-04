/**
 * Project configuration management
 */

import { join } from 'path';
import { readFile, writeFile, fileExists } from './fileSystem.js';
import type { ProjectConfig } from '../types/ProjectConfig.js';

const CONFIG_FILENAME = '.knowledge-tree.json';

/**
 * Load project configuration from the knowledge root
 */
export async function loadProjectConfig(knowledgeRoot: string): Promise<ProjectConfig | null> {
  const configPath = join(knowledgeRoot, CONFIG_FILENAME);
  
  try {
    if (await fileExists(configPath)) {
      const content = await readFile(configPath);
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn('Failed to load project config:', error);
  }
  
  return null;
}

/**
 * Save project configuration
 */
export async function saveProjectConfig(
  knowledgeRoot: string, 
  config: ProjectConfig
): Promise<void> {
  const configPath = join(knowledgeRoot, CONFIG_FILENAME);
  await writeFile(configPath, JSON.stringify(config, null, 2));
}

/**
 * Initialize project configuration with defaults
 */
export async function initializeProjectConfig(
  knowledgeRoot: string,
  projectName?: string
): Promise<ProjectConfig> {
  const existing = await loadProjectConfig(knowledgeRoot);
  if (existing) {
    return existing;
  }
  
  // Create default config
  const config: ProjectConfig = {
    name: projectName || 'My Project',
    pathPrefix: projectName ? slugify(projectName) : undefined,
    defaultPriority: 'COMMON',
    categories: {
      'architecture': {
        keywords: ['architecture', 'design', 'structure', 'pattern'],
        subcategories: ['overview', 'components', 'decisions']
      },
      'development': {
        keywords: ['develop', 'code', 'implement', 'build'],
        subcategories: ['setup', 'workflow', 'guidelines']
      },
      'testing': {
        keywords: ['test', 'testing', 'spec', 'mock', 'stub'],
        subcategories: ['unit', 'integration', 'e2e']
      },
      'deployment': {
        keywords: ['deploy', 'release', 'ci', 'cd', 'pipeline'],
        subcategories: ['environments', 'automation', 'monitoring']
      }
    }
  };
  
  await saveProjectConfig(knowledgeRoot, config);
  return config;
}

/**
 * Get project-aware category for a title
 */
export function getProjectCategory(
  title: string, 
  config: ProjectConfig
): string | null {
  const titleLower = title.toLowerCase();
  
  // Check custom categories first
  if (config.categories) {
    for (const [category, data] of Object.entries(config.categories)) {
      if (data.keywords.some(kw => titleLower.includes(kw))) {
        return category;
      }
    }
  }
  
  // Check project-specific keywords
  if (config.keywords) {
    for (const [category, keywords] of Object.entries(config.keywords)) {
      if (keywords.some(kw => titleLower.includes(kw.toLowerCase()))) {
        return category;
      }
    }
  }
  
  return null;
}

/**
 * Apply project context to path generation
 */
export function applyProjectContext(
  basePath: string,
  config: ProjectConfig
): string {
  // If project has a path prefix and the path doesn't start with it, prepend it
  if (config.pathPrefix && !basePath.startsWith(config.pathPrefix)) {
    return join(config.pathPrefix, basePath);
  }
  
  return basePath;
}

/**
 * Extract auto-tags based on project configuration
 */
export function extractAutoTags(
  content: string,
  config: ProjectConfig
): string[] {
  const tags = new Set<string>();
  const contentLower = content.toLowerCase();
  
  if (config.autoTags) {
    for (const [tag, keywords] of Object.entries(config.autoTags)) {
      if (keywords.some(kw => contentLower.includes(kw.toLowerCase()))) {
        tags.add(tag);
      }
    }
  }
  
  // Add technology tags
  if (config.technologies) {
    for (const tech of config.technologies) {
      if (contentLower.includes(tech.toLowerCase())) {
        tags.add(tech.toLowerCase());
      }
    }
  }
  
  return Array.from(tags);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}