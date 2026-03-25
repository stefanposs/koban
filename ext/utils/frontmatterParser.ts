/**
 * Frontmatter Parser Utility
 */

import { ParsedFrontmatter } from '../types';

export function parseFrontmatter(content: string): ParsedFrontmatter {
    const result: ParsedFrontmatter = {};
    
    // Check if content starts with frontmatter delimiter
    if (!content.trim().startsWith('---')) {
        return result;
    }

    // Find the end of frontmatter
    const lines = content.split('\n');
    let inFrontmatter = false;
    let frontmatterEnd = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line === '---') {
            if (!inFrontmatter) {
                inFrontmatter = true;
            } else {
                frontmatterEnd = i;
                break;
            }
        }
    }

    if (!inFrontmatter || frontmatterEnd === -1) {
        return result;
    }

    // Parse frontmatter lines
    const frontmatterLines = lines.slice(1, frontmatterEnd);
    
    for (const line of frontmatterLines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.substring(0, colonIndex).trim();
            let value: any = line.substring(colonIndex + 1).trim();
            
            // Skip lines that look like continuation/nested YAML
            if (key.startsWith(' ') || key.startsWith('-')) { continue; }
            
            // Try to parse as different types
            if (value === 'true') {
                value = true;
            } else if (value === 'false') {
                value = false;
            } else if (!isNaN(Number(value)) && value !== '') {
                value = Number(value);
            } else if (value.startsWith('[') && value.endsWith(']')) {
                // Parse array — strip quotes from individual items
                try {
                    value = value
                        .slice(1, -1)
                        .split(',')
                        .map((v: string) => v.trim().replace(/^["']|["']$/g, ''))
                        .filter((v: string) => v.length > 0);
                } catch {
                    // Keep as string if parsing fails
                }
            } else if (value.startsWith('"') && value.endsWith('"')) {
                // Remove quotes from string
                value = value.slice(1, -1);
            } else if (value.startsWith("'") && value.endsWith("'")) {
                // Remove single quotes
                value = value.slice(1, -1);
            }
            
            result[key] = value;
        }
    }

    return result;
}

export function stringifyFrontmatter(data: ParsedFrontmatter): string {
    const lines: string[] = [];
    
    for (const [key, value] of Object.entries(data)) {
        if (value === undefined || value === null) {
            continue;
        }
        
        if (Array.isArray(value)) {
            lines.push(`${key}: [${value.map(v => `"${String(v).replace(/"/g, '\\"')}"`).join(', ')}]`);
        } else if (typeof value === 'string') {
            // Quote strings that could be misinterpreted as YAML
            const needsQuotes = value.includes(':') || value.includes('#') || value.includes('"') ||
                value === 'true' || value === 'false' || value === 'null' || value === '' ||
                (!isNaN(Number(value)) && value.trim() !== '');
            if (needsQuotes) {
                lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
            } else {
                lines.push(`${key}: ${value}`);
            }
        } else if (typeof value === 'boolean') {
            lines.push(`${key}: ${value}`);
        } else if (typeof value === 'number') {
            lines.push(`${key}: ${value}`);
        } else if (value instanceof Date) {
            lines.push(`${key}: ${value.toISOString().split('T')[0]}`);
        } else {
            lines.push(`${key}: ${String(value)}`);
        }
    }
    
    return lines.join('\n') + '\n';
}

export function updateFrontmatter(content: string, updates: ParsedFrontmatter): string {
    const existing = parseFrontmatter(content);
    const merged = { ...existing, ...updates };
    
    // Find the content after frontmatter
    const lines = content.split('\n');
    let frontmatterEnd = -1;
    let inFrontmatter = false;
    
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '---') {
            if (!inFrontmatter) {
                inFrontmatter = true;
            } else {
                frontmatterEnd = i;
                break;
            }
        }
    }
    
    const bodyContent = frontmatterEnd > 0 
        ? lines.slice(frontmatterEnd + 1).join('\n')
        : content;
    
    return `---\n${stringifyFrontmatter(merged)}---\n${bodyContent}`;
}
