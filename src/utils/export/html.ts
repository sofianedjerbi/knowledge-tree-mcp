/**
 * HTML export utilities for Knowledge Tree MCP
 * Handles conversion of knowledge entries to HTML format
 */

import type { KnowledgeEntry, Priority } from '../../types/index.js';
import type { ExportEntry } from './markdown.js';
import { escapeHtml } from '../validation.js';
import { 
  PRIORITY_COLORS, 
  PRIORITY_BORDER_COLORS,
  PRIORITY_DISPLAY_NAMES 
} from '../../constants/index.js';

/**
 * Exports knowledge entries to HTML format
 * @param entries - Array of entries to export
 * @param includeLinks - Whether to include relationship links
 * @returns HTML formatted string
 */
export function exportToHTML(
  entries: ExportEntry[], 
  includeLinks: boolean
): string {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Knowledge Tree Export</title>
    ${getStyles()}
</head>
<body>
    <div class="container">
        <header>
            <h1>Knowledge Tree Export</h1>
            <p class="metadata">
                <em>Generated on ${new Date().toISOString()}</em><br>
                <strong>Total Entries</strong>: ${entries.length}
            </p>
        </header>
        
        <nav class="toc">
            ${generateHTMLTOC(entries)}
        </nav>
        
        <main class="entries">
`;
  
  for (const { path, entry } of entries) {
    const id = path.replace(/[^\w-]/g, '-');
    html += `
            <article class="entry priority-${entry.priority}" id="${id}">
                <h2>${entry.priority}</h2>
                <div class="path">${escapeHtml(path)}</div>
                <div class="content">
                    <div class="field">
                        <strong>Problem</strong>: ${escapeHtml(entry.problem)}
                    </div>
                    <div class="field">
                        <strong>Solution</strong>: ${escapeHtml(entry.solution)}
                    </div>`;
    
    if (entry.code) {
      html += `
                    <div class="field code-field">
                        <strong>Code</strong>:
                        <pre class="code">${escapeHtml(entry.code)}</pre>
                    </div>`;
    }
    
    if (includeLinks && entry.related_to && entry.related_to.length > 0) {
      html += `
                    <div class="field links-field">
                        <strong>Related</strong>:
                        <ul class="links">`;
      
      for (const link of entry.related_to) {
        const linkId = link.path.replace(/[^\w-]/g, '-');
        html += `
                            <li>
                                <span class="relationship">${link.relationship}</span>: 
                                <a href="#${linkId}" class="link">${escapeHtml(link.path)}</a>`;
        if (link.description) {
          html += ` - ${escapeHtml(link.description)}`;
        }
        html += `
                            </li>`;
      }
      
      html += `
                        </ul>
                    </div>`;
    }
    
    html += `
                </div>
            </article>`;
  }
  
  html += `
        </main>
        
        <footer>
            <p>Knowledge Tree MCP - <a href="https://github.com/cynthwave/knowledge-tree-mcp">GitHub</a></p>
        </footer>
    </div>
    ${getScripts()}
</body>
</html>`;
  
  return html;
}

/**
 * Generates HTML table of contents
 * @param entries - Array of entries
 * @returns HTML TOC string
 */
function generateHTMLTOC(entries: ExportEntry[]): string {
  let toc = '<h2>Table of Contents</h2>\n<ul class="toc-list">\n';
  
  // Group by category
  const byCategory = entries.reduce((acc, { path, entry }) => {
    const category = path.split('/').slice(0, -1).join('/') || 'root';
    if (!acc[category]) acc[category] = [];
    acc[category].push({ path, entry });
    return acc;
  }, {} as Record<string, ExportEntry[]>);
  
  for (const [category, categoryEntries] of Object.entries(byCategory)) {
    toc += `    <li class="category">
        <strong>${escapeHtml(category)}</strong>
        <ul>\n`;
    
    for (const { path, entry } of categoryEntries) {
      const id = path.replace(/[^\w-]/g, '-');
      const filename = path.split('/').pop();
      toc += `            <li>
                <a href="#${id}" class="priority-${entry.priority}">
                    ${escapeHtml(filename || path)}
                </a>
            </li>\n`;
    }
    
    toc += `        </ul>
    </li>\n`;
  }
  
  toc += '</ul>\n';
  return toc;
}

/**
 * Returns CSS styles for the HTML export
 * @returns CSS string
 */
function getStyles(): string {
  // Build CSS variables from constants
  const cssVariables = Object.entries(PRIORITY_COLORS)
    .map(([priority, color]) => `            --color-${priority.toLowerCase().replace('-', '')}: ${color};`)
    .join('\n');
  
  const cssBorderVariables = Object.entries(PRIORITY_BORDER_COLORS)
    .map(([priority, color]) => `            --border-${priority.toLowerCase().replace('-', '')}: ${color};`)
    .join('\n');

  return `
    <style>
        :root {
${cssVariables}
${cssBorderVariables}
            --color-bg: #f5f5f5;
            --color-text: #333;
            --color-border: #ddd;
            --color-link: #0066cc;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: var(--color-text);
            background: var(--color-bg);
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        
        header {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            margin-bottom: 2rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        h1 {
            color: var(--color-text);
            margin-bottom: 1rem;
        }
        
        .metadata {
            color: #666;
        }
        
        .toc {
            background: white;
            padding: 1.5rem;
            border-radius: 8px;
            margin-bottom: 2rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        
        .toc h2 {
            margin-bottom: 1rem;
            font-size: 1.25rem;
        }
        
        .toc-list {
            list-style: none;
        }
        
        .toc-list .category {
            margin-bottom: 1rem;
        }
        
        .toc-list ul {
            margin-left: 1.5rem;
            margin-top: 0.5rem;
        }
        
        .toc-list li {
            margin-bottom: 0.25rem;
        }
        
        .entry {
            background: white;
            border: 1px solid var(--color-border);
            border-radius: 8px;
            padding: 1.5rem;
            margin-bottom: 1.5rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .priority-CRITICAL {
            border-left: 4px solid var(--color-critical);
        }
        
        .priority-REQUIRED {
            border-left: 4px solid var(--color-required);
        }
        
        .priority-COMMON {
            border-left: 4px solid var(--color-common);
        }
        
        .priority-EDGE-CASE {
            border-left: 4px solid var(--color-edgecase);
        }
        
        .entry h2 {
            font-size: 1rem;
            text-transform: uppercase;
            margin-bottom: 0.5rem;
            opacity: 0.7;
        }
        
        .path {
            color: #666;
            font-size: 0.9rem;
            margin-bottom: 1rem;
            font-family: 'Courier New', monospace;
        }
        
        .field {
            margin-bottom: 1rem;
        }
        
        .field:last-child {
            margin-bottom: 0;
        }
        
        .code {
            background: #f8f8f8;
            padding: 1rem;
            border-radius: 4px;
            overflow-x: auto;
            font-family: 'Courier New', monospace;
            font-size: 0.9rem;
            border: 1px solid #e0e0e0;
            margin-top: 0.5rem;
        }
        
        .links {
            list-style: none;
            margin-top: 0.5rem;
        }
        
        .links li {
            margin-bottom: 0.25rem;
        }
        
        .relationship {
            display: inline-block;
            background: #e0e0e0;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 0.85rem;
            margin-right: 0.5rem;
        }
        
        .link {
            color: var(--color-link);
            text-decoration: none;
        }
        
        .link:hover {
            text-decoration: underline;
        }
        
        footer {
            text-align: center;
            padding: 2rem;
            color: #666;
            margin-top: 3rem;
        }
        
        footer a {
            color: var(--color-link);
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }
            
            header, .toc, .entry {
                padding: 1rem;
            }
        }
    </style>`;
}

/**
 * Returns JavaScript for interactive features
 * @returns JavaScript string
 */
function getScripts(): string {
  return `
    <script>
        // Smooth scrolling for TOC links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
        
        // Highlight current entry on scroll
        let observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    // Remove previous highlights
                    document.querySelectorAll('.entry.active').forEach(el => {
                        el.classList.remove('active');
                    });
                    // Add highlight to current
                    entry.target.classList.add('active');
                }
            });
        }, {
            rootMargin: '-10% 0px -70% 0px'
        });
        
        document.querySelectorAll('.entry').forEach(entry => {
            observer.observe(entry);
        });
        
        // Add active entry styling
        const style = document.createElement('style');
        style.textContent = '.entry.active { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }';
        document.head.appendChild(style);
    </script>`;
}