/**
 * Category management tool for easy CRUD operations
 */

import type { ToolHandler, MCPResponse, ServerContext } from '../types/index.js';
import { loadProjectConfig, saveProjectConfig } from '../utils/projectConfig.js';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface CategoryArgs {
  action: 'add' | 'update' | 'remove' | 'list' | 'merge';
  category?: string;
  keywords?: string[];
  subcategories?: string[];
  scope?: 'project' | 'system' | 'both';
  description?: string;
}

export const categoriesHandler: ToolHandler = async (
  args: CategoryArgs,
  context: ServerContext
): Promise<MCPResponse> => {
  const { action, category, keywords = [], subcategories = [], scope = 'project', description } = args;

  switch (action) {
    case 'list': {
      return listCategories(scope, context);
    }

    case 'add': {
      if (!category || keywords.length === 0) {
        return {
          content: [{
            type: "text",
            text: "❌ Category name and keywords are required for 'add' action"
          }]
        };
      }
      return addCategory(category, keywords, subcategories, scope, description, context);
    }

    case 'update': {
      if (!category) {
        return {
          content: [{
            type: "text",
            text: "❌ Category name is required for 'update' action"
          }]
        };
      }
      return updateCategory(category, keywords, subcategories, scope, description, context);
    }

    case 'remove': {
      if (!category) {
        return {
          content: [{
            type: "text",
            text: "❌ Category name is required for 'remove' action"
          }]
        };
      }
      return removeCategory(category, scope, context);
    }

    case 'merge': {
      if (!category || keywords.length === 0) {
        return {
          content: [{
            type: "text",
            text: "❌ Category name and keywords are required for 'merge' action"
          }]
        };
      }
      return mergeCategory(category, keywords, subcategories, scope, context);
    }

    default: {
      return {
        content: [{
          type: "text",
          text: "❌ Invalid action. Use 'add', 'update', 'remove', 'list', or 'merge'"
        }]
      };
    }
  }
};

async function listCategories(scope: string, context: ServerContext): Promise<MCPResponse> {
  let output = "";

  // List project categories
  if (scope === 'project' || scope === 'both') {
    const projectConfig = await loadProjectConfig(context.knowledgeRoot);
    output += "📦 **Project Categories**\n\n";
    
    if (projectConfig?.categories) {
      for (const [cat, data] of Object.entries(projectConfig.categories)) {
        output += `• **${cat}**\n`;
        output += `  Keywords: ${data.keywords.join(', ')}\n`;
        if (data.subcategories?.length) {
          output += `  Subcategories: ${data.subcategories.join(', ')}\n`;
        }
        output += "\n";
      }
    } else {
      output += "_No project categories defined_\n\n";
    }
  }

  // List system categories
  if (scope === 'system' || scope === 'both') {
    const systemCategories = loadSystemCategories();
    output += "🌐 **System Categories**\n\n";
    
    for (const [cat, keywords] of Object.entries(systemCategories)) {
      output += `• **${cat}**\n`;
      output += `  Keywords: ${keywords.slice(0, 5).join(', ')}`;
      if (keywords.length > 5) {
        output += ` ... (${keywords.length - 5} more)`;
      }
      output += "\n\n";
    }
  }

  return {
    content: [{
      type: "text",
      text: output.trim()
    }]
  };
}

async function addCategory(
  category: string,
  keywords: string[],
  subcategories: string[],
  scope: string,
  description: string | undefined,
  context: ServerContext
): Promise<MCPResponse> {
  const normalizedCategory = category.toLowerCase().replace(/\s+/g, '-');

  if (scope === 'project') {
    // Add to project config
    const config = await loadProjectConfig(context.knowledgeRoot) || {
      name: "Default Project",
      categories: {}
    };

    if (config.categories?.[normalizedCategory]) {
      return {
        content: [{
          type: "text",
          text: `❌ Category '${normalizedCategory}' already exists in project configuration`
        }]
      };
    }

    if (!config.categories) config.categories = {};
    config.categories[normalizedCategory] = {
      keywords,
      subcategories: subcategories.length > 0 ? subcategories : undefined
    };

    await saveProjectConfig(context.knowledgeRoot, config);

    return {
      content: [{
        type: "text",
        text: `✅ Added project category '${normalizedCategory}'${description ? `\n📝 ${description}` : ''}\n\nKeywords: ${keywords.join(', ')}${subcategories.length ? `\nSubcategories: ${subcategories.join(', ')}` : ''}`
      }]
    };
  } else {
    // Add to system categories
    const categories = loadSystemCategories();
    
    if (categories[normalizedCategory]) {
      return {
        content: [{
          type: "text",
          text: `❌ Category '${normalizedCategory}' already exists in system configuration`
        }]
      };
    }

    categories[normalizedCategory] = keywords;
    saveSystemCategories(categories);

    // Also update subcategories if provided
    if (subcategories.length > 0) {
      const systemSubcategories = loadSystemSubcategories();
      for (const subcat of subcategories) {
        const normalizedSubcat = subcat.toLowerCase().replace(/\s+/g, '-');
        if (!systemSubcategories[normalizedSubcat]) {
          systemSubcategories[normalizedSubcat] = [];
        }
        systemSubcategories[normalizedSubcat].push(normalizedSubcat);
      }
      saveSystemSubcategories(systemSubcategories);
    }

    return {
      content: [{
        type: "text",
        text: `✅ Added system category '${normalizedCategory}'${description ? `\n📝 ${description}` : ''}\n\nKeywords: ${keywords.join(', ')}${subcategories.length ? `\nSubcategories: ${subcategories.join(', ')}` : ''}`
      }]
    };
  }
}

async function updateCategory(
  category: string,
  keywords: string[],
  subcategories: string[],
  scope: string,
  description: string | undefined,
  context: ServerContext
): Promise<MCPResponse> {
  const normalizedCategory = category.toLowerCase().replace(/\s+/g, '-');

  if (scope === 'project') {
    const config = await loadProjectConfig(context.knowledgeRoot);
    if (!config?.categories?.[normalizedCategory]) {
      return {
        content: [{
          type: "text",
          text: `❌ Category '${normalizedCategory}' not found in project configuration`
        }]
      };
    }

    // Update with new values or keep existing
    if (keywords.length > 0) {
      config.categories[normalizedCategory].keywords = keywords;
    }
    if (subcategories.length > 0) {
      config.categories[normalizedCategory].subcategories = subcategories;
    }

    await saveProjectConfig(context.knowledgeRoot, config);

    return {
      content: [{
        type: "text",
        text: `✅ Updated project category '${normalizedCategory}'${description ? `\n📝 ${description}` : ''}\n\nKeywords: ${config.categories[normalizedCategory].keywords.join(', ')}${config.categories[normalizedCategory].subcategories ? `\nSubcategories: ${config.categories[normalizedCategory].subcategories.join(', ')}` : ''}`
      }]
    };
  } else {
    const categories = loadSystemCategories();
    
    if (!categories[normalizedCategory]) {
      return {
        content: [{
          type: "text",
          text: `❌ Category '${normalizedCategory}' not found in system configuration`
        }]
      };
    }

    if (keywords.length > 0) {
      categories[normalizedCategory] = keywords;
      saveSystemCategories(categories);
    }

    return {
      content: [{
        type: "text",
        text: `✅ Updated system category '${normalizedCategory}'${description ? `\n📝 ${description}` : ''}\n\nKeywords: ${categories[normalizedCategory].join(', ')}`
      }]
    };
  }
}

async function removeCategory(
  category: string,
  scope: string,
  context: ServerContext
): Promise<MCPResponse> {
  const normalizedCategory = category.toLowerCase().replace(/\s+/g, '-');

  if (scope === 'project') {
    const config = await loadProjectConfig(context.knowledgeRoot);
    if (!config?.categories?.[normalizedCategory]) {
      return {
        content: [{
          type: "text",
          text: `❌ Category '${normalizedCategory}' not found in project configuration`
        }]
      };
    }

    delete config.categories[normalizedCategory];
    await saveProjectConfig(context.knowledgeRoot, config);

    return {
      content: [{
        type: "text",
        text: `✅ Removed category '${normalizedCategory}' from project configuration`
      }]
    };
  } else {
    const categories = loadSystemCategories();
    
    if (!categories[normalizedCategory]) {
      return {
        content: [{
          type: "text",
          text: `❌ Category '${normalizedCategory}' not found in system configuration`
        }]
      };
    }

    delete categories[normalizedCategory];
    saveSystemCategories(categories);

    return {
      content: [{
        type: "text",
        text: `✅ Removed category '${normalizedCategory}' from system configuration\n\n⚠️ Warning: Existing entries using this category may need to be recategorized`
      }]
    };
  }
}

async function mergeCategory(
  category: string,
  keywords: string[],
  subcategories: string[],
  scope: string,
  context: ServerContext
): Promise<MCPResponse> {
  const normalizedCategory = category.toLowerCase().replace(/\s+/g, '-');

  if (scope === 'project') {
    const config = await loadProjectConfig(context.knowledgeRoot) || {
      name: "Default Project",
      categories: {}
    };

    if (!config.categories) config.categories = {};
    
    const existing = config.categories[normalizedCategory] || { keywords: [], subcategories: [] };
    
    // Merge keywords (unique)
    const mergedKeywords = [...new Set([...existing.keywords, ...keywords])];
    
    // Merge subcategories (unique)
    const existingSubcats = existing.subcategories || [];
    const mergedSubcategories = [...new Set([...existingSubcats, ...subcategories])];

    config.categories[normalizedCategory] = {
      keywords: mergedKeywords,
      subcategories: mergedSubcategories.length > 0 ? mergedSubcategories : undefined
    };

    await saveProjectConfig(context.knowledgeRoot, config);

    return {
      content: [{
        type: "text",
        text: `✅ Merged into project category '${normalizedCategory}'\n\nKeywords: ${mergedKeywords.join(', ')}${mergedSubcategories.length ? `\nSubcategories: ${mergedSubcategories.join(', ')}` : ''}`
      }]
    };
  } else {
    const categories = loadSystemCategories();
    
    const existing = categories[normalizedCategory] || [];
    const mergedKeywords = [...new Set([...existing, ...keywords])];
    
    categories[normalizedCategory] = mergedKeywords;
    saveSystemCategories(categories);

    return {
      content: [{
        type: "text",
        text: `✅ Merged into system category '${normalizedCategory}'\n\nKeywords: ${mergedKeywords.join(', ')}`
      }]
    };
  }
}

// Helper functions
function loadSystemCategories(): Record<string, string[]> {
  const categoriesPath = join(__dirname, '../config/categories.json');
  return JSON.parse(readFileSync(categoriesPath, 'utf-8'));
}

function saveSystemCategories(categories: Record<string, string[]>): void {
  const categoriesPath = join(__dirname, '../config/categories.json');
  writeFileSync(categoriesPath, JSON.stringify(categories, null, 2));
}

function loadSystemSubcategories(): Record<string, string[]> {
  const subcategoriesPath = join(__dirname, '../config/subcategories.json');
  return JSON.parse(readFileSync(subcategoriesPath, 'utf-8'));
}

function saveSystemSubcategories(subcategories: Record<string, string[]>): void {
  const subcategoriesPath = join(__dirname, '../config/subcategories.json');
  writeFileSync(subcategoriesPath, JSON.stringify(subcategories, null, 2));
}