/**
 * Parser/Serializer for consolidated task and meeting year-files.
 *
 * File formats:
 *   tasks-YYYY.md / archived-tasks-YYYY.md  — H2 per task with key: value metadata
 *   meetings-YYYY.md                         — H2 per meeting with ### sub-sections
 */

import { parseFrontmatter } from './frontmatterParser';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaskSection {
    title: string;
    id: string;
    status: string;
    priority?: string;
    tags?: string[];
    created?: string;
    due?: string;
    assignee?: string;
    description?: string;
    /** 0-based line number of the ## heading inside the file */
    headingLine?: number;
}

export interface MeetingSection {
    title: string;
    id: string;
    date: string;
    time?: string;
    duration?: string;
    participants?: string[];
    tags?: string[];
    meetingType?: string;
    /** Map of sub-section name → content, e.g. "Agenda" → "1. …" */
    sections: Record<string, string>;
    headingLine?: number;
}

export interface ParsedTasksFile {
    spaceId: string;
    year: number;
    tasks: TaskSection[];
}

export interface ParsedMeetingsFile {
    spaceId: string;
    year: number;
    meetings: MeetingSection[];
}

// ---------------------------------------------------------------------------
// Year-file naming helpers
// ---------------------------------------------------------------------------

export function getTasksFileName(year: number): string {
    return `tasks-${year}.md`;
}

export function getMeetingsFileName(year: number): string {
    return `meetings-${year}.md`;
}

export function getArchivedTasksFileName(year: number): string {
    return `archived-tasks-${year}.md`;
}

export function getDailyFileName(year: number): string {
    return `daily-${year}.md`;
}

export function getArchivedDailyFileName(year: number): string {
    return `archived-daily-${year}.md`;
}

const YEAR_FILE_RE = /^(.+)-(\d{4})\.md$/;

/** Extract years from filenames matching a given prefix, e.g. "tasks" → [2025, 2026]. */
export function findYearFiles(files: string[], prefix: string): number[] {
    const years: number[] = [];
    for (const f of files) {
        const m = YEAR_FILE_RE.exec(f);
        if (m && m[1] === prefix) {
            years.push(Number(m[2]));
        }
    }
    return years.sort((a, b) => a - b);
}

/** Check whether a filename is a Koban system file (tasks/meetings/archived/daily). */
export function isSystemFile(fileName: string): boolean {
    return /^(tasks|archived-tasks|meetings|daily|archived-daily)-\d{4}\.md$/.test(fileName);
}

// ---------------------------------------------------------------------------
// Parse tasks-YYYY.md
// ---------------------------------------------------------------------------

const METADATA_RE = /^([a-z_]+):\s*(.*)$/;

/** Escape lines starting with (optional backslashes +) ## in description text. */
function escapeDescription(desc: string): string {
    return desc.replace(/^(\\*#{2,} )/gm, '\\$1');
}

/** Unescape: strip one leading backslash from escaped heading lines. */
function unescapeDescription(desc: string): string {
    return desc.replace(/^\\(\\*#{2,} )/gm, '$1');
}

function parseMetadataLines(lines: string[]): Record<string, string> {
    const meta: Record<string, string> = {};
    for (const line of lines) {
        const m = METADATA_RE.exec(line);
        if (m) {
            meta[m[1]] = m[2].trim();
        } else if (line.trim() !== '') {
            break; // first non-metadata, non-blank line ends the block
        }
        // blank lines between metadata fields are tolerated
    }
    return meta;
}

function metadataLineCount(lines: string[]): number {
    let count = 0;
    for (const line of lines) {
        if (METADATA_RE.test(line)) { count++; }
        else if (line.trim() !== '') { break; }
        else { count++; } // count blank lines between metadata as part of the block
    }
    return count;
}

/**
 * Split file content after frontmatter into H2-delimited sections.
 * Returns tuples of [headingTitle, bodyLines[], headingLineNumber].
 */
function splitH2Sections(content: string): Array<{ title: string; bodyLines: string[]; headingLine: number }> {
    const lines = content.split('\n');
    const sections: Array<{ title: string; bodyLines: string[]; headingLine: number }> = [];

    // Skip frontmatter
    let i = 0;
    if (lines[i]?.trim() === '---') {
        i++;
        while (i < lines.length && lines[i]?.trim() !== '---') { i++; }
        i++; // skip closing ---
    }

    let current: { title: string; bodyLines: string[]; headingLine: number } | null = null;

    for (; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('## ') && !line.startsWith('### ')) {
            if (current) { sections.push(current); }
            current = { title: line.slice(3).trim(), bodyLines: [], headingLine: i };
        } else if (current) {
            current.bodyLines.push(line);
        }
    }
    if (current) { sections.push(current); }

    return sections;
}

export function parseTasksFile(content: string): ParsedTasksFile {
    const fm = parseFrontmatter(content);
    const sections = splitH2Sections(content);

    const tasks: TaskSection[] = [];
    for (const sec of sections) {
        const meta = parseMetadataLines(sec.bodyLines);
        if (!meta.id) { continue; } // skip sections without id

        const metaCount = metadataLineCount(sec.bodyLines);
        // Description = everything after metadata + blank line
        let descLines = sec.bodyLines.slice(metaCount);
        // Strip leading blank lines
        while (descLines.length > 0 && descLines[0].trim() === '') { descLines.shift(); }
        // Strip trailing blank lines
        while (descLines.length > 0 && descLines[descLines.length - 1].trim() === '') { descLines.pop(); }

        tasks.push({
            title: sec.title,
            id: meta.id,
            status: meta.status || 'todo',
            priority: meta.priority,
            tags: meta.tags ? meta.tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
            created: meta.created,
            due: meta.due,
            assignee: meta.assignee,
            description: descLines.length > 0 ? unescapeDescription(descLines.join('\n')) : undefined,
            headingLine: sec.headingLine,
        });
    }

    return {
        spaceId: fm.spaceId || '',
        year: fm.year || new Date().getFullYear(),
        tasks,
    };
}

// ---------------------------------------------------------------------------
// Parse meetings-YYYY.md
// ---------------------------------------------------------------------------

export function parseMeetingsFile(content: string): ParsedMeetingsFile {
    const fm = parseFrontmatter(content);
    const h2Sections = splitH2Sections(content);

    const meetings: MeetingSection[] = [];
    for (const sec of h2Sections) {
        const meta = parseMetadataLines(sec.bodyLines);
        if (!meta.id) { continue; }

        const metaCount = metadataLineCount(sec.bodyLines);
        const bodyAfterMeta = sec.bodyLines.slice(metaCount);

        // Parse ### sub-sections
        const subSections: Record<string, string> = {};
        let currentSubName: string | null = null;
        let currentSubLines: string[] = [];

        for (const line of bodyAfterMeta) {
            if (line.startsWith('### ')) {
                if (currentSubName !== null) {
                    subSections[currentSubName] = trimContent(currentSubLines);
                }
                currentSubName = line.slice(4).trim();
                currentSubLines = [];
            } else if (currentSubName !== null) {
                currentSubLines.push(line);
            }
        }
        if (currentSubName !== null) {
            subSections[currentSubName] = trimContent(currentSubLines);
        }

        meetings.push({
            title: sec.title,
            id: meta.id,
            date: meta.date || '',
            time: meta.time ? meta.time.replace(/^["']|["']$/g, '') : undefined,
            duration: meta.duration ? meta.duration.replace(/^["']|["']$/g, '') : undefined,
            participants: meta.participants ? meta.participants.split(',').map(p => p.trim()).filter(Boolean) : undefined,
            tags: meta.tags ? meta.tags.replace(/^\[|\]$/g, '').split(',').map((t: string) => t.trim().replace(/^["']|["']$/g, '')).filter(Boolean) : undefined,
            meetingType: meta.meeting_type,
            sections: subSections,
            headingLine: sec.headingLine,
        });
    }

    return {
        spaceId: fm.spaceId || '',
        year: fm.year || new Date().getFullYear(),
        meetings,
    };
}

function trimContent(lines: string[]): string {
    const copy = [...lines];
    while (copy.length > 0 && copy[0].trim() === '') { copy.shift(); }
    while (copy.length > 0 && copy[copy.length - 1].trim() === '') { copy.pop(); }
    return copy.join('\n');
}

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

export function serializeTasksFile(spaceId: string, year: number, tasks: TaskSection[]): string {
    let out = `---\ntype: tasks\nspaceId: ${spaceId}\nyear: ${year}\n---\n`;

    for (const t of tasks) {
        out += `\n## ${t.title}\n`;
        out += `id: ${t.id}\n`;
        out += `status: ${t.status}\n`;
        if (t.priority) { out += `priority: ${t.priority}\n`; }
        if (t.tags && t.tags.length > 0) { out += `tags: ${t.tags.join(', ')}\n`; }
        if (t.created) { out += `created: ${t.created}\n`; }
        if (t.due) { out += `due: ${t.due}\n`; }
        if (t.assignee) { out += `assignee: ${t.assignee}\n`; }
        if (t.description) { out += `\n${escapeDescription(t.description)}\n`; }
    }

    return out;
}

export function serializeMeetingsFile(spaceId: string, year: number, meetings: MeetingSection[]): string {
    let out = `---\ntype: meetings\nspaceId: ${spaceId}\nyear: ${year}\n---\n`;

    for (const m of meetings) {
        out += `\n## ${m.title}\n`;
        out += `id: ${m.id}\n`;
        out += `date: ${m.date}\n`;
        if (m.time) { out += `time: "${m.time}"\n`; }
        if (m.duration) { out += `duration: "${m.duration}"\n`; }
        if (m.participants && m.participants.length > 0) { out += `participants: ${m.participants.join(', ')}\n`; }
        if (m.tags && m.tags.length > 0) { out += `tags: [${m.tags.join(', ')}]\n`; }
        if (m.meetingType) { out += `meeting_type: ${m.meetingType}\n`; }

        for (const [name, body] of Object.entries(m.sections)) {
            out += `\n### ${name}\n`;
            if (body) { out += `${body}\n`; }
        }
    }

    return out;
}

// ---------------------------------------------------------------------------
// Section manipulation helpers
// ---------------------------------------------------------------------------

export function serializeTaskSection(task: TaskSection): string {
    let out = `## ${task.title}\n`;
    out += `id: ${task.id}\n`;
    out += `status: ${task.status}\n`;
    if (task.priority) { out += `priority: ${task.priority}\n`; }
    if (task.tags && task.tags.length > 0) { out += `tags: ${task.tags.join(', ')}\n`; }
    if (task.created) { out += `created: ${task.created}\n`; }
    if (task.due) { out += `due: ${task.due}\n`; }
    if (task.assignee) { out += `assignee: ${task.assignee}\n`; }
    if (task.description) { out += `\n${escapeDescription(task.description)}\n`; }
    return out;
}

export function serializeMeetingSection(meeting: MeetingSection): string {
    let out = `## ${meeting.title}\n`;
    out += `id: ${meeting.id}\n`;
    out += `date: ${meeting.date}\n`;
    if (meeting.time) { out += `time: "${meeting.time}"\n`; }
    if (meeting.duration) { out += `duration: "${meeting.duration}"\n`; }
    if (meeting.participants && meeting.participants.length > 0) { out += `participants: ${meeting.participants.join(', ')}\n`; }
    if (meeting.tags && meeting.tags.length > 0) { out += `tags: [${meeting.tags.join(', ')}]\n`; }
    if (meeting.meetingType) { out += `meeting_type: ${meeting.meetingType}\n`; }

    for (const [name, body] of Object.entries(meeting.sections)) {
        out += `\n### ${name}\n`;
        if (body) { out += `${body}\n`; }
    }
    return out;
}

/** Append a task section to the end of an existing tasks file content. */
export function addTaskSection(content: string, task: TaskSection): string {
    return content.trimEnd() + '\n\n' + serializeTaskSection(task);
}

/** Append a meeting section to the end of an existing meetings file content. */
export function addMeetingSection(content: string, meeting: MeetingSection): string {
    return content.trimEnd() + '\n\n' + serializeMeetingSection(meeting);
}

/**
 * Remove a section (task or meeting) identified by its `id:` metadata line.
 * Returns the updated file content and the raw text of the removed section.
 */
export function removeSection(content: string, itemId: string): { updatedContent: string; removedSection: string } {
    const lines = content.split('\n');
    let sectionStart = -1;
    let sectionEnd = lines.length;
    let foundId = false;

    // Find the H2 section that contains `id: <itemId>`
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('## ') && !line.startsWith('### ')) {
            if (foundId) {
                // We've found the start of the next section — previous one ends here
                sectionEnd = i;
                break;
            }
            sectionStart = i;
            foundId = false;
        }
        if (sectionStart >= 0 && line.trim() === `id: ${itemId}`) {
            foundId = true;
        }
    }

    if (!foundId || sectionStart < 0) {
        return { updatedContent: content, removedSection: '' };
    }

    // Trim trailing blank lines before section, but preserve at least one blank line after frontmatter
    let trimStart = sectionStart;
    while (trimStart > 0 && lines[trimStart - 1].trim() === '') {
        // Don't eat the blank line right after frontmatter closing ---
        if (trimStart - 2 >= 0 && lines[trimStart - 2].trim() === '---') { break; }
        trimStart--;
    }

    const removedLines = lines.slice(sectionStart, sectionEnd);
    // Trim trailing blank lines from removed section
    while (removedLines.length > 0 && removedLines[removedLines.length - 1].trim() === '') { removedLines.pop(); }

    const before = lines.slice(0, trimStart);
    const after = lines.slice(sectionEnd);

    let updatedContent = before.join('\n');
    if (after.length > 0) {
        // Ensure blank line separator before next section heading
        if (after[0]?.startsWith('## ')) {
            updatedContent += '\n\n' + after.join('\n');
        } else {
            updatedContent += '\n' + after.join('\n');
        }
    }

    return { updatedContent, removedSection: removedLines.join('\n') };
}

/**
 * Update metadata key-value lines within a section identified by `id:`.
 * Only changes lines that already exist or appends new ones in the metadata block.
 */
export function updateSectionMetadata(content: string, itemId: string, updates: Record<string, string>): string {
    const lines = content.split('\n');
    let inTargetSection = false;
    let foundId = false;
    let metaBlockEnd = -1;

    // First pass: find the section and its metadata block
    let metaBlockSealed = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.startsWith('## ') && !line.startsWith('### ')) {
            if (foundId) { break; } // reached next section
            inTargetSection = true;
            foundId = false;
            metaBlockSealed = false;
            metaBlockEnd = i + 1;
            continue;
        }

        if (inTargetSection) {
            if (line.trim() === `id: ${itemId}`) {
                foundId = true;
            }
            if (!metaBlockSealed) {
                if (METADATA_RE.test(line)) {
                    metaBlockEnd = i + 1;
                } else if (line.trim() !== '') {
                    metaBlockSealed = true;
                }
            }
        }
    }

    if (!foundId) { return content; }

    const updatesRemaining = { ...updates };

    // Second pass: update existing metadata lines (bounded to metadata block only)
    const result = [...lines];
    inTargetSection = false;
    foundId = false;
    let metaBlockSealed2 = false;
    let sectionHeadingLine = -1;
    for (let i = 0; i < result.length; i++) {
        const line = result[i];

        if (line.startsWith('## ') && !line.startsWith('### ')) {
            if (foundId) { break; }
            inTargetSection = true;
            foundId = false;
            metaBlockSealed2 = false;
            sectionHeadingLine = i;
            continue;
        }

        if (inTargetSection) {
            if (line.trim() === `id: ${itemId}`) { foundId = true; }
            if (!metaBlockSealed2) {
                const m = METADATA_RE.exec(line);
                if (m && m[1] in updatesRemaining) {
                    // Only replace if this is confirmed as the target section
                    if (foundId) {
                        result[i] = `${m[1]}: ${updatesRemaining[m[1]]}`;
                        delete updatesRemaining[m[1]];
                    }
                } else if (!m && line.trim() !== '') {
                    metaBlockSealed2 = true;
                }
            }
        }
    }

    // If id was found but some metadata keys before the id: line were not updated
    // in the forward pass, do a targeted backward scan from id: line to heading
    if (foundId && Object.keys(updatesRemaining).length > 0 && sectionHeadingLine >= 0) {
        for (let i = sectionHeadingLine + 1; i < metaBlockEnd; i++) {
            const m = METADATA_RE.exec(result[i]);
            if (m && m[1] in updatesRemaining) {
                result[i] = `${m[1]}: ${updatesRemaining[m[1]]}`;
                delete updatesRemaining[m[1]];
            }
        }
    }

    // Insert any remaining new keys at metaBlockEnd
    const newLines: string[] = [];
    for (const [key, val] of Object.entries(updatesRemaining)) {
        newLines.push(`${key}: ${val}`);
    }
    if (newLines.length > 0) {
        result.splice(metaBlockEnd, 0, ...newLines);
    }

    return result.join('\n');
}

/** Create empty tasks file content with only frontmatter. */
export function emptyTasksFile(spaceId: string, year: number): string {
    return `---\ntype: tasks\nspaceId: ${spaceId}\nyear: ${year}\n---\n`;
}

/**
 * Update the H2 title of a section identified by its `id:` metadata line.
 */
export function updateSectionTitle(content: string, itemId: string, newTitle: string): string {
    const lines = content.split('\n');
    let lastH2Line = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('## ') && !line.startsWith('### ')) {
            lastH2Line = i;
        }
        if (lastH2Line >= 0 && line.trim() === `id: ${itemId}`) {
            lines[lastH2Line] = `## ${newTitle}`;
            return lines.join('\n');
        }
    }
    return content;
}

/** Create empty archived-tasks file content with only frontmatter. */
export function emptyArchivedTasksFile(spaceId: string, year: number): string {
    return `---\ntype: archived-tasks\nspaceId: ${spaceId}\nyear: ${year}\n---\n`;
}

/**
 * Update (or set) the free-text description of a section identified by its `id:` metadata line.
 * The description is the content after the metadata block within the H2 section.
 */
export function updateSectionDescription(content: string, itemId: string, newDescription: string): string {
    const lines = content.split('\n');
    let sectionStart = -1;
    let foundId = false;
    let metaBlockEnd = -1;
    let metaBlockSealed = false;
    let nextSectionStart = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('## ') && !line.startsWith('### ')) {
            if (foundId) {
                nextSectionStart = i;
                break;
            }
            sectionStart = i;
            foundId = false;
            metaBlockEnd = i + 1;
            metaBlockSealed = false;
        }
        if (sectionStart >= 0 && line.trim() === `id: ${itemId}`) {
            foundId = true;
        }
        if (foundId && sectionStart >= 0 && !metaBlockSealed) {
            if (METADATA_RE.test(line)) {
                metaBlockEnd = i + 1;
            } else if (line.trim() !== '') {
                metaBlockSealed = true;
            }
        }
    }

    if (!foundId || sectionStart < 0) { return content; }

    const endIdx = nextSectionStart >= 0 ? nextSectionStart : lines.length;
    const before = lines.slice(0, metaBlockEnd);
    const after = lines.slice(endIdx);
    const descBlock = newDescription.trim()
        ? ['', ...escapeDescription(newDescription.trim()).split('\n'), '']
        : [''];

    return [...before, ...descBlock, ...after].join('\n');
}

/** Create empty meetings file content with only frontmatter. */
export function emptyMeetingsFile(spaceId: string, year: number): string {
    return `---\ntype: meetings\nspaceId: ${spaceId}\nyear: ${year}\n---\n`;
}

/**
 * Find the 0-based line number of a section heading for a given id.
 * Returns -1 if not found.
 */
export function findSectionLine(content: string, itemId: string): number {
    const lines = content.split('\n');
    let lastH2Line = -1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.startsWith('## ') && !line.startsWith('### ')) {
            lastH2Line = i;
        }
        if (lastH2Line >= 0 && line.trim() === `id: ${itemId}`) {
            return lastH2Line;
        }
    }
    return -1;
}
