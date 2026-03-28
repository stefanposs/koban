/**
 * Task Service - Manages task and meeting operations
 *
 * Storage: year-based consolidated markdown files in each space root.
 *   tasks-YYYY.md          — active tasks
 *   archived-tasks-YYYY.md — archived tasks
 *   meetings-YYYY.md       — meetings
 */

import * as path from 'path';
import * as crypto from 'crypto';
import { Task, Meeting, TaskStatus, TaskPriority, MeetingType, IFileService, IConfigService, ISpaceService, ITaskService } from '../types';
import { TASKS_DIR, MEETINGS_DIR } from '../constants';
import {
    parseTasksFile,
    parseMeetingsFile,
    addTaskSection,
    addMeetingSection,
    removeSection,
    updateSectionMetadata,
    updateSectionTitle,
    updateSectionDescription,
    getTasksFileName,
    getMeetingsFileName,
    getArchivedTasksFileName,
    findYearFiles,
    emptyTasksFile,
    emptyArchivedTasksFile,
    emptyMeetingsFile,
    findSectionLine,
    TaskSection,
    MeetingSection,
} from '../utils/taskFileParser';

export class TaskService implements ITaskService {
    private tasks: Map<string, Task> = new Map();
    private meetings: Map<string, Meeting> = new Map();
    private fileService: IFileService;
    private configService: IConfigService;
    private spaceService: ISpaceService;
    private writeLock: Promise<void> = Promise.resolve();
    /** Timestamp of the last self-write completion, used for watcher suppression. */
    public lastSelfWriteAt = 0;

    constructor(fileService: IFileService, configService: IConfigService, spaceService: ISpaceService) {
        this.fileService = fileService;
        this.configService = configService;
        this.spaceService = spaceService;
    }

    /** Serialize operations to prevent concurrent read-modify-write corruption. */
    private async withLock<T>(fn: () => Promise<T>): Promise<T> {
        let release!: () => void;
        const prev = this.writeLock;
        this.writeLock = new Promise<void>(r => { release = r; });
        await prev;
        try {
            return await fn();
        } finally {
            release();
        }
    }

    /** Like withLock, but also records lastSelfWriteAt to suppress file-watcher refreshes. */
    private async withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
        return this.withLock(async () => {
            try {
                return await fn();
            } finally {
                this.lastSelfWriteAt = Date.now();
            }
        });
    }

    // -----------------------------------------------------------------------
    // Tasks
    // -----------------------------------------------------------------------

    async createTask(spaceId: string, title: string, options?: {
        status?: TaskStatus;
        priority?: TaskPriority;
        assignee?: string;
        dueDate?: string;
        tags?: string[];
    }): Promise<Task> {
        return this.withWriteLock(async () => {
        const spaceRoot = this.findSpaceRoot(spaceId);
        if (!spaceRoot) {
            throw new Error(`Space ${spaceId} not found`);
        }

        const taskId = `task-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
        const today = new Date().toISOString().split('T')[0];
        const year = new Date().getFullYear();
        const fileName = getTasksFileName(year);
        const tasksDir = path.join(spaceRoot, TASKS_DIR);
        const filePath = path.join(tasksDir, fileName);

        const section: TaskSection = {
            title,
            id: taskId,
            status: options?.status || 'todo',
            priority: options?.priority || 'medium',
            assignee: options?.assignee,
            due: options?.dueDate,
            tags: options?.tags || [],
            created: today,
        };

        // Read or create year-file
        let content: string;
        try {
            content = await this.fileService.readFile(filePath);
        } catch {
            await this.fileService.createDirectory(tasksDir);
            content = emptyTasksFile(spaceId, year);
        }

        const updatedContent = addTaskSection(content, section);
        await this.fileService.writeFile(filePath, updatedContent);

        // Re-read to get accurate line number
        const written = await this.fileService.readFile(filePath);
        const lineNumber = findSectionLine(written, taskId);

        const task: Task = {
            id: taskId,
            spaceId,
            title,
            status: options?.status || 'todo',
            priority: options?.priority || 'medium',
            assignee: options?.assignee,
            dueDate: options?.dueDate ? new Date(options.dueDate + 'T00:00:00') : undefined,
            tags: options?.tags || [],
            filePath,
            createdAt: new Date(),
            updatedAt: new Date(),
            description: '',
            lineNumber,
        };

        this.tasks.set(taskId, task);
        return task;
        });
    }

    async getTasksForSpace(spaceId: string, includeArchived = false): Promise<Task[]> {
        return this.withLock(async () => {
        const spaceRoot = this.findSpaceRoot(spaceId);
        if (!spaceRoot) { return []; }

        const tasks: Task[] = [];
        const tasksDir = path.join(spaceRoot, TASKS_DIR);

        try {
            const files = await this.fileService.listFiles(tasksDir);
            const years = findYearFiles(files, 'tasks');

            for (const year of years) {
                const filePath = path.join(tasksDir, getTasksFileName(year));
                await this._loadTasksFromFile(filePath, spaceId, tasks);
            }

            if (includeArchived) {
                const archiveYears = findYearFiles(files, 'archived-tasks');
                for (const year of archiveYears) {
                    const filePath = path.join(tasksDir, getArchivedTasksFileName(year));
                    await this._loadTasksFromFile(filePath, spaceId, tasks);
                }
            }
        } catch {
            // .tasks/ dir doesn't exist yet — not an error
        }

        // Atomic cache swap (safe: we're inside withLock)
        for (const [id, t] of this.tasks) {
            if (t.spaceId === spaceId) { this.tasks.delete(id); }
        }
        for (const t of tasks) { this.tasks.set(t.id, t); }

        return tasks;
        });
    }

    private async _loadTasksFromFile(filePath: string, spaceId: string, out: Task[]): Promise<void> {
        try {
            const content = await this.fileService.readFile(filePath);
            const parsed = parseTasksFile(content);

            for (const sec of parsed.tasks) {
                const createdDate = sec.created ? new Date(sec.created) : new Date();
                const dueDate = sec.due ? new Date(sec.due + 'T00:00:00') : undefined;
                const task: Task = {
                    id: sec.id,
                    spaceId,
                    title: sec.title,
                    status: (sec.status as TaskStatus) || 'todo',
                    priority: (sec.priority as TaskPriority) || 'medium',
                    assignee: sec.assignee,
                    dueDate: dueDate && !isNaN(dueDate.getTime()) ? dueDate : undefined,
                    tags: sec.tags || [],
                    filePath,
                    createdAt: isNaN(createdDate.getTime()) ? new Date() : createdDate,
                    updatedAt: new Date(),
                    description: sec.description || '',
                    lineNumber: sec.headingLine,
                };
                out.push(task);
            }
        } catch (error) {
            console.warn(`Koban: failed to parse tasks from ${filePath}:`, error);
        }
    }

    async updateTaskStatus(taskId: string, newStatus: TaskStatus): Promise<void> {
        return this.withWriteLock(async () => {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        try {
            const content = await this.fileService.readFile(task.filePath);
            const updatedContent = updateSectionMetadata(content, taskId, { status: newStatus });
            await this.fileService.writeFile(task.filePath, updatedContent);
            task.status = newStatus;
            task.updatedAt = new Date();
        } catch (error) {
            throw new Error(`Failed to update task status: ${error instanceof Error ? error.message : String(error)}`);
        }
        });
    }

    async updateTask(taskId: string, updates: { title?: string; priority?: string; due?: string; status?: string; description?: string }): Promise<void> {
        return this.withWriteLock(async () => {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        try {
            let content = await this.fileService.readFile(task.filePath);

            // Update title (H2 heading) if changed
            if (updates.title && updates.title !== task.title) {
                content = updateSectionTitle(content, taskId, updates.title);
                task.title = updates.title;
            }

            // Update metadata fields
            const metaUpdates: Record<string, string> = {};
            if (updates.priority) { metaUpdates.priority = updates.priority; }
            if (updates.due !== undefined) { metaUpdates.due = updates.due; }
            if (updates.status) { metaUpdates.status = updates.status; }

            if (Object.keys(metaUpdates).length > 0) {
                content = updateSectionMetadata(content, taskId, metaUpdates);
                if (updates.priority) { task.priority = updates.priority as TaskPriority; }
                if (updates.due !== undefined) { task.dueDate = updates.due ? new Date(updates.due) : undefined; }
                if (updates.status) { task.status = updates.status as TaskStatus; }
            }

            // Update description (free-text after metadata)
            if (updates.description !== undefined) {
                content = updateSectionDescription(content, taskId, updates.description);
                task.description = updates.description || undefined;
            }

            await this.fileService.writeFile(task.filePath, content);
            task.updatedAt = new Date();
        } catch (error) {
            throw new Error(`Failed to update task: ${error instanceof Error ? error.message : String(error)}`);
        }
        });
    }

    async updateMeeting(meetingId: string, updates: { title?: string; date?: string; time?: string }): Promise<void> {
        return this.withWriteLock(async () => {
        const meeting = this.meetings.get(meetingId);
        if (!meeting) {
            throw new Error(`Meeting ${meetingId} not found`);
        }

        try {
            let content = await this.fileService.readFile(meeting.filePath);

            // Update title (H2 heading) if changed
            if (updates.title && updates.title !== meeting.title) {
                content = updateSectionTitle(content, meetingId, updates.title);
                meeting.title = updates.title;
            }

            // Update metadata fields
            const metaUpdates: Record<string, string> = {};
            if (updates.date) { metaUpdates.date = updates.date; }
            if (updates.time !== undefined) { metaUpdates.time = updates.time ? `"${updates.time}"` : ''; }

            if (Object.keys(metaUpdates).length > 0) {
                content = updateSectionMetadata(content, meetingId, metaUpdates);
                if (updates.date) { meeting.date = new Date(updates.date); }
                if (updates.time !== undefined) { (meeting as any).time = updates.time || undefined; }
            }

            await this.fileService.writeFile(meeting.filePath, content);
            meeting.updatedAt = new Date();
        } catch (error) {
            throw new Error(`Failed to update meeting: ${error instanceof Error ? error.message : String(error)}`);
        }
        });
    }

    async archiveTask(taskId: string): Promise<void> {
        return this.withWriteLock(async () => {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        // Read the tasks year-file and remove section
        const content = await this.fileService.readFile(task.filePath);

        // First update status to archived in the source file (crash-safe: archive written first)
        const contentWithArchivedStatus = updateSectionMetadata(content, taskId, { status: 'archived' });
        const { updatedContent, removedSection } = removeSection(contentWithArchivedStatus, taskId);

        if (!removedSection) {
            throw new Error(`Task ${taskId} section not found in file`);
        }

        // Determine archive year from task's created date
        const rawYear = task.createdAt.getFullYear();
        const createdYear = isNaN(rawYear) ? new Date().getFullYear() : rawYear;
        const tasksDir = path.dirname(task.filePath);
        const archiveFileName = getArchivedTasksFileName(createdYear);
        const archivePath = path.join(tasksDir, archiveFileName);

        // Read or create archive file
        let archiveContent: string;
        try {
            archiveContent = await this.fileService.readFile(archivePath);
        } catch {
            const spaceId = task.spaceId;
            archiveContent = emptyArchivedTasksFile(spaceId, createdYear);
        }

        // Append archived section (already has status: archived)
        archiveContent = archiveContent.trimEnd() + '\n\n' + removedSection + '\n';

        // Write archive first (crash-safe: if source removal fails, archive has the task)
        await this.fileService.writeFile(archivePath, archiveContent);
        await this.fileService.writeFile(task.filePath, updatedContent);

        task.filePath = archivePath;
        task.status = 'archived';
        });
    }

    async deleteTask(taskId: string): Promise<void> {
        return this.withWriteLock(async () => {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        const content = await this.fileService.readFile(task.filePath);
        const { updatedContent } = removeSection(content, taskId);
        await this.fileService.writeFile(task.filePath, updatedContent);
        this.tasks.delete(taskId);
        });
    }

    async moveTaskToSpace(taskId: string, targetSpaceId: string): Promise<Task> {
        return this.withWriteLock(async () => {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        const targetRoot = this.findSpaceRoot(targetSpaceId);
        if (!targetRoot) {
            throw new Error(`Target space ${targetSpaceId} not found`);
        }

        if (task.spaceId === targetSpaceId) {
            throw new Error('Task is already in the target space');
        }

        // Extract section from source file
        const sourceContent = await this.fileService.readFile(task.filePath);
        const { updatedContent, removedSection } = removeSection(sourceContent, taskId);
        if (!removedSection) {
            throw new Error(`Task ${taskId} section not found in file`);
        }

        // Determine target year-file from source file path
        const sourceYearMatch = path.basename(task.filePath).match(/(\d{4})\.md$/);
        const year = sourceYearMatch ? Number(sourceYearMatch[1]) : new Date().getFullYear();
        const targetFileName = getTasksFileName(year);
        const targetTasksDir = path.join(targetRoot, TASKS_DIR);
        const targetFilePath = path.join(targetTasksDir, targetFileName);

        let targetContent: string;
        try {
            targetContent = await this.fileService.readFile(targetFilePath);
        } catch {
            await this.fileService.createDirectory(targetTasksDir);
            targetContent = emptyTasksFile(targetSpaceId, year);
        }

        targetContent = targetContent.trimEnd() + '\n\n' + removedSection + '\n';

        // Write target first (crash-safe: if source removal fails, target has the task)
        await this.fileService.writeFile(targetFilePath, targetContent);
        await this.fileService.writeFile(task.filePath, updatedContent);

        // Update cache
        const written = await this.fileService.readFile(targetFilePath);
        const lineNumber = findSectionLine(written, taskId);

        task.spaceId = targetSpaceId;
        task.filePath = targetFilePath;
        task.lineNumber = lineNumber;
        task.updatedAt = new Date();

        return task;
        });
    }

    async moveMeetingToSpace(meetingId: string, targetSpaceId: string): Promise<Meeting> {
        return this.withWriteLock(async () => {
        const meeting = this.meetings.get(meetingId);
        if (!meeting) {
            throw new Error(`Meeting ${meetingId} not found`);
        }

        const targetRoot = this.findSpaceRoot(targetSpaceId);
        if (!targetRoot) {
            throw new Error(`Target space ${targetSpaceId} not found`);
        }

        if (meeting.spaceId === targetSpaceId) {
            throw new Error('Meeting is already in the target space');
        }

        // Extract section from source file
        const sourceContent = await this.fileService.readFile(meeting.filePath);
        const { updatedContent, removedSection } = removeSection(sourceContent, meetingId);
        if (!removedSection) {
            throw new Error(`Meeting ${meetingId} section not found in file`);
        }

        // Determine target year-file from source file path
        const sourceYearMatch = path.basename(meeting.filePath).match(/(\d{4})\.md$/);
        const year = sourceYearMatch ? Number(sourceYearMatch[1]) : new Date().getFullYear();
        const targetFileName = getMeetingsFileName(year);
        const targetMeetingsDir = path.join(targetRoot, MEETINGS_DIR);
        const targetFilePath = path.join(targetMeetingsDir, targetFileName);

        let targetContent: string;
        try {
            targetContent = await this.fileService.readFile(targetFilePath);
        } catch {
            await this.fileService.createDirectory(targetMeetingsDir);
            targetContent = emptyMeetingsFile(targetSpaceId, year);
        }

        targetContent = targetContent.trimEnd() + '\n\n' + removedSection + '\n';

        // Write target first (crash-safe: if source removal fails, target has the meeting)
        await this.fileService.writeFile(targetFilePath, targetContent);
        await this.fileService.writeFile(meeting.filePath, updatedContent);

        // Update cache
        const written = await this.fileService.readFile(targetFilePath);
        const lineNumber = findSectionLine(written, meetingId);

        meeting.spaceId = targetSpaceId;
        meeting.filePath = targetFilePath;
        meeting.lineNumber = lineNumber;
        meeting.updatedAt = new Date();

        return meeting;
        });
    }

    // -----------------------------------------------------------------------
    // Meetings
    // -----------------------------------------------------------------------

    async createMeeting(spaceId: string, title: string, date: string, options?: {
        time?: string;
        duration?: number;
        attendees?: string[];
        tags?: string[];
        meetingType?: MeetingType;
    }): Promise<Meeting> {
        return this.withWriteLock(async () => {
        const spaceRoot = this.findSpaceRoot(spaceId);
        if (!spaceRoot) {
            throw new Error(`Space ${spaceId} not found`);
        }

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw new Error(`Invalid date format: "${date}". Expected YYYY-MM-DD.`);
        }
        const parsedDate = new Date(date + 'T00:00:00');
        if (isNaN(parsedDate.getTime())) {
            throw new Error(`Invalid date: "${date}".`);
        }

        const meetingId = `${date}-${title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}-${crypto.randomBytes(3).toString('hex')}`;
        const year = parseInt(date.substring(0, 4), 10);
        const fileName = getMeetingsFileName(year);
        const meetingsDir = path.join(spaceRoot, MEETINGS_DIR);
        const filePath = path.join(meetingsDir, fileName);

        const section: MeetingSection = {
            title,
            id: meetingId,
            date,
            time: options?.time,
            duration: options?.duration ? `${options.duration}m` : undefined,
            participants: options?.attendees,
            tags: options?.tags,
            meetingType: options?.meetingType,
            sections: {
                'Agenda': '1. \n2. \n3. ',
                'Notes': '',
                'Action Items': '- [ ] ',
                'Decisions': '',
            },
        };

        let content: string;
        try {
            content = await this.fileService.readFile(filePath);
        } catch {
            await this.fileService.createDirectory(meetingsDir);
            content = emptyMeetingsFile(spaceId, year);
        }

        const updatedContent = addMeetingSection(content, section);
        await this.fileService.writeFile(filePath, updatedContent);

        const written = await this.fileService.readFile(filePath);
        const lineNumber = findSectionLine(written, meetingId);

        const meeting: Meeting = {
            id: meetingId,
            spaceId,
            title,
            date: new Date(date + 'T00:00:00'),
            time: options?.time,
            duration: options?.duration,
            attendees: options?.attendees,
            tags: options?.tags,
            filePath,
            createdAt: new Date(),
            updatedAt: new Date(),
            lineNumber,
        };

        this.meetings.set(meetingId, meeting);
        return meeting;
        });
    }

    async getMeetingsForSpace(spaceId: string): Promise<Meeting[]> {
        return this.withLock(async () => {
        const spaceRoot = this.findSpaceRoot(spaceId);
        if (!spaceRoot) { return []; }

        const meetings: Meeting[] = [];
        const meetingsDir = path.join(spaceRoot, MEETINGS_DIR);

        try {
            const files = await this.fileService.listFiles(meetingsDir);
            const years = findYearFiles(files, 'meetings');

            for (const year of years) {
                const filePath = path.join(meetingsDir, getMeetingsFileName(year));
                try {
                    const content = await this.fileService.readFile(filePath);
                    const parsed = parseMeetingsFile(content);

                    for (const sec of parsed.meetings) {
                        const dateVal = sec.date ? new Date(sec.date + 'T00:00:00') : new Date();
                        const dur = sec.duration ? parseInt(sec.duration) : undefined;
                        const meeting: Meeting = {
                            id: sec.id,
                            spaceId,
                            title: sec.title,
                            date: isNaN(dateVal.getTime()) ? new Date() : dateVal,
                            time: sec.time,
                            duration: dur && !isNaN(dur) ? dur : undefined,
                            attendees: sec.participants,
                            tags: sec.tags,
                            filePath,
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            meetingType: sec.meetingType,
                            lineNumber: sec.headingLine,
                        };
                        meetings.push(meeting);
                    }
                } catch (error) {
                    console.warn(`Koban: failed to parse meetings file ${filePath}:`, error);
                }
            }
        } catch {
            // .meetings/ dir doesn't exist yet — not an error
        }

        // Cache swap (safe: we're inside withLock)
        for (const [id, m] of this.meetings) {
            if (m.spaceId === spaceId) { this.meetings.delete(id); }
        }
        for (const m of meetings) { this.meetings.set(m.id, m); }

        return meetings;
        });
    }

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    private findSpaceRoot(spaceId: string): string | undefined {
        const space = this.spaceService.getSpace(spaceId);
        return space?.rootPath;
    }
}
