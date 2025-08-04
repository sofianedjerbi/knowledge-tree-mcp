/**
 * Setup tool for project configuration
 */

import type { ToolHandler, MCPResponse, ServerContext } from '../types/index.js';
import { loadProjectConfig, saveProjectConfig, initializeProjectConfig } from '../utils/projectConfig.js';
import type { ProjectConfig } from '../types/ProjectConfig.js';

interface SetupArgs {
  action?: 'init' | 'update' | 'show';
  name?: string;
  pathPrefix?: string;
  technologies?: string[];
  categories?: Record<string, { keywords: string[]; subcategories?: string[] }>;
  autoTags?: Record<string, string[]>;
}

export const setupProjectHandler: ToolHandler = async (
  args: SetupArgs,
  context: ServerContext
): Promise<MCPResponse> => {
  const { action = 'show' } = args;
  
  switch (action) {
    case 'init': {
      // Initialize new project configuration
      const config = await initializeProjectConfig(
        context.knowledgeRoot,
        args.name
      );
      
      // Apply any provided overrides
      if (args.pathPrefix) config.pathPrefix = args.pathPrefix;
      if (args.technologies) config.technologies = args.technologies;
      if (args.categories) config.categories = args.categories;
      if (args.autoTags) config.autoTags = args.autoTags;
      
      await saveProjectConfig(context.knowledgeRoot, config);
      
      return {
        content: [{
          type: "text",
          text: `✅ Project configuration initialized!\n\n${formatConfig(config)}`
        }]
      };
    }
    
    case 'update': {
      // Update existing configuration
      const existing = await loadProjectConfig(context.knowledgeRoot);
      if (!existing) {
        return {
          content: [{
            type: "text",
            text: `❌ No project configuration found. Run with action: "init" first.`
          }]
        };
      }
      
      // Merge updates
      const updated: ProjectConfig = { ...existing };
      if (args.name) updated.name = args.name;
      if (args.pathPrefix) updated.pathPrefix = args.pathPrefix;
      if (args.technologies) updated.technologies = args.technologies;
      if (args.categories) updated.categories = { ...existing.categories, ...args.categories };
      if (args.autoTags) updated.autoTags = { ...existing.autoTags, ...args.autoTags };
      
      await saveProjectConfig(context.knowledgeRoot, updated);
      
      return {
        content: [{
          type: "text",
          text: `✅ Project configuration updated!\n\n${formatConfig(updated)}`
        }]
      };
    }
    
    case 'show':
    default: {
      // Show current configuration
      const config = await loadProjectConfig(context.knowledgeRoot);
      
      if (!config) {
        return {
          content: [{
            type: "text",
            text: `📋 No project configuration found.\n\nTo initialize, use:\n{\n  "action": "init",\n  "name": "Your Project Name",\n  "pathPrefix": "your-project",\n  "technologies": ["nodejs", "typescript", "react"]\n}`
          }]
        };
      }
      
      return {
        content: [{
          type: "text",
          text: `📋 Current project configuration:\n\n${formatConfig(config)}`
        }]
      };
    }
  }
};

function formatConfig(config: ProjectConfig): string {
  let output = `📦 Project: ${config.name}\n`;
  
  if (config.pathPrefix) {
    output += `📁 Path prefix: ${config.pathPrefix}/\n`;
  }
  
  if (config.technologies && config.technologies.length > 0) {
    output += `🔧 Technologies: ${config.technologies.join(', ')}\n`;
  }
  
  if (config.categories) {
    output += `\n📂 Custom categories:\n`;
    for (const [cat, data] of Object.entries(config.categories)) {
      output += `  • ${cat}: ${data.keywords.join(', ')}\n`;
      if (data.subcategories) {
        output += `    Subcategories: ${data.subcategories.join(', ')}\n`;
      }
    }
  }
  
  if (config.autoTags) {
    output += `\n🏷️  Auto-tagging rules:\n`;
    for (const [tag, keywords] of Object.entries(config.autoTags)) {
      output += `  • ${tag}: ${keywords.join(', ')}\n`;
    }
  }
  
  output += `\n💡 Tip: Update configuration with action: "update"`;
  
  return output;
}