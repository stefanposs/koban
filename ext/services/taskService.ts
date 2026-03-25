/**
 * Task Service - Manages task and meeting operations
 */

import * as path from 'path';
import { Task, Meeting, TaskStatus, TaskPriority, MeetingType, TaskMeta, MeetingMeta, IFileService, IConfigService, ISpaceService, ITaskService } from '../types';
import { parseFrontmatter, stringifyFrontmatter, updateFrontmatter } from '../utils/frontmatterParser';

export class TaskService implements ITaskService {
    private tasks: Map<string, Task> = new Map();
    private meetings: Map<string, Meeting> = new Map();
    private fileService: IFileService;
    private configService: IConfigService;
    private spaceService: ISpaceService;

    constructor(fileService: IFileService, configService: IConfigService, spaceService: ISpaceService) {
        this.fileService = fileService;
        this.configService = configService;
        this.spaceService = spaceService;
    }

    async createTask(spaceId: string, title: string, options?: {
        status?: TaskStatus;
        priority?: TaskPriority;
        assignee?: string;
        dueDate?: string;
        tags?: string[];
    }): Promise<Task> {
        // Find space root path
        const spaceRoot = this.findSpaceRoot(spaceId);
        if (!spaceRoot) {
            throw new Error(`Space ${spaceId} not found`);
        }

        const tasksDir = path.join(spaceRoot, '.tasks');
        
        // Ensure tasks directory exists
        try {
            await this.fileService.createDirectory(tasksDir);
        } catch {
            // Directory might already exist
        }

        // Generate task ID
        const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const fileName = `${taskId}.md`;
        const filePath = path.join(tasksDir, fileName);

        const now = new Date().toISOString();
        const today = now.split('T')[0];

        const frontmatter: TaskMeta = {
            id: taskId,
            space: spaceId,
            status: options?.status || 'todo',
            priority: options?.priority || 'medium',
            assignee: options?.assignee,
            due: options?.dueDate,
            tags: options?.tags || [],
            created: today
        };

        const content = `---
${stringifyFrontmatter(frontmatter)}---

# ${title}

## Description
Add task description here...

## Checklist
- [ ] First step
- [ ] Second step

## Links
- Related tasks:
- External resources:
`;

        await this.fileService.writeFile(filePath, content);

        const task: Task = {
            id: taskId,
            spaceId: spaceId,
            title: title,
            status: options?.status || 'todo',
            priority: options?.priority || 'medium',
            assignee: options?.assignee,
            dueDate: options?.dueDate ? new Date(options.dueDate) : undefined,
            tags: options?.tags || [],
            filePath: filePath,
            createdAt: new Date(),
            updatedAt: new Date(),
            description: '',
            checklist: []
        };

        this.tasks.set(taskId, task);
        return task;
    }

    async createMeeting(spaceId: string, title: string, date: string, options?: {
        duration?: number;
        attendees?: string[];
        meetingType?: MeetingType;
    }): Promise<Meeting> {
        const spaceRoot = this.findSpaceRoot(spaceId);
        if (!spaceRoot) {
            throw new Error(`Space ${spaceId} not found`);
        }

        const meetingsDir = path.join(spaceRoot, '.meetings');
        
        try {
            await this.fileService.createDirectory(meetingsDir);
        } catch {
            // Directory might already exist
        }

        const meetingId = `${date}-${title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
        const fileName = `${meetingId}.md`;
        const filePath = path.join(meetingsDir, fileName);

        const frontmatter: MeetingMeta = {
            type: 'meeting',
            id: meetingId,
            space: spaceId,
            date: date,
            meeting_type: options?.meetingType,
            duration: options?.duration ? `${options.duration}m` : undefined,
            participants: options?.attendees
        };

        const content = `---
${stringifyFrontmatter(frontmatter)}---

# ${title}

## Agenda
1. 
2. 
3. 

## Notes

## Action Items
- [ ] 

## Decisions

`;

        await this.fileService.writeFile(filePath, content);

        const meeting: Meeting = {
            id: meetingId,
            spaceId: spaceId,
            title: title,
            date: new Date(date),
            duration: options?.duration,
            attendees: options?.attendees,
            filePath: filePath,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        this.meetings.set(meetingId, meeting);
        return meeting;
    }

    async getTasksForSpace(spaceId: string, includeArchived = false): Promise<Task[]> {
        const spaceRoot = this.findSpaceRoot(spaceId);
        if (!spaceRoot) {
            return [];
        }

        const tasksDir = path.join(spaceRoot, '.tasks');
        const tasks: Task[] = [];

        // Scan main .tasks/ directory
        await this._scanTasksDir(tasksDir, spaceId, tasks);

        // Scan .tasks/.archive/ if requested
        if (includeArchived) {
            const archiveDir = path.join(tasksDir, '.archive');
            await this._scanTasksDir(archiveDir, spaceId, tasks);
        }

        return tasks;
    }

    private async _scanTasksDir(dir: string, spaceId: string, tasks: Task[]): Promise<void> {
        try {
            const files = await this.fileService.listFiles(dir);
            
            for (const file of files) {
                if (file.endsWith('.md')) {
                    try {
                        const filePath = path.join(dir, file);
                        const content = await this.fileService.readFile(filePath);
                        const frontmatter = parseFrontmatter(content);

                        if (frontmatter.id && frontmatter.space === spaceId) {
                            const task: Task = {
                                id: frontmatter.id,
                                spaceId: frontmatter.space,
                                title: this.extractTitle(content) || file.replace('.md', ''),
                                status: frontmatter.status || 'todo',
                                priority: frontmatter.priority || 'medium',
                                assignee: frontmatter.assignee,
                                dueDate: frontmatter.due ? new Date(frontmatter.due) : undefined,
                                tags: frontmatter.tags || [],
                                filePath: filePath,
                                createdAt: frontmatter.created ? new Date(frontmatter.created) : new Date(),
                                updatedAt: new Date(),
                                description: this.extractDescription(content),
                                checklist: this.extractChecklist(content)
                            };
                            tasks.push(task);
                            this.tasks.set(task.id, task);
                        }
                    } catch (error) {
                        console.error(`Error parsing task file ${file}:`, error);
                    }
                }
            }
        } catch {
            // Directory doesn't exist
        }
    }

    async getMeetingsForSpace(spaceId: string): Promise<Meeting[]> {
        const spaceRoot = this.findSpaceRoot(spaceId);
        if (!spaceRoot) {
            return [];
        }

        const meetingsDir = path.join(spaceRoot, '.meetings');
        const meetings: Meeting[] = [];

        try {
            const files = await this.fileService.listFiles(meetingsDir);
            
            for (const file of files) {
                if (file.endsWith('.md')) {
                    try {
                        const filePath = path.join(meetingsDir, file);
                        const content = await this.fileService.readFile(filePath);
                        const frontmatter = parseFrontmatter(content);

                        if (frontmatter.id && frontmatter.space === spaceId) {
                            const meeting: Meeting = {
                                id: frontmatter.id,
                                spaceId: frontmatter.space,
                                title: this.extractTitle(content) || file.replace('.md', ''),
                                date: new Date(frontmatter.date),
                                duration: frontmatter.duration ? parseInt(frontmatter.duration) : undefined,
                                attendees: frontmatter.participants,
                                filePath: filePath,
                                createdAt: new Date(),
                                updatedAt: new Date()
                            };
                            meetings.push(meeting);
                            this.meetings.set(meeting.id, meeting);
                        }
                    } catch (error) {
                        console.error(`Error parsing meeting file ${file}:`, error);
                    }
                }
            }
        } catch {
            // Directory doesn't exist
        }

        return meetings;
    }

    async updateTaskStatus(taskId: string, newStatus: TaskStatus): Promise<void> {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        try {
            const content = await this.fileService.readFile(task.filePath);
            const updatedContent = updateFrontmatter(content, { status: newStatus });
            await this.fileService.writeFile(task.filePath, updatedContent);
            task.status = newStatus;
            task.updatedAt = new Date();
        } catch (error) {
            throw new Error(`Failed to update task status: ${error}`);
        }
    }

    async archiveTask(taskId: string): Promise<void> {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        // Update status to archived in frontmatter
        await this.updateTaskStatus(taskId, 'archived');

        // Move file to .tasks/.archive/ subfolder
        const tasksDir = path.dirname(task.filePath);
        const archiveDir = path.join(tasksDir, '.archive');
        try {
            await this.fileService.createDirectory(archiveDir);
        } catch {
            // Directory might already exist
        }
        const archivePath = path.join(archiveDir, path.basename(task.filePath));
        await this.fileService.moveFile(task.filePath, archivePath);

        task.filePath = archivePath;
        task.status = 'archived';
    }

    async deleteTask(taskId: string): Promise<void> {
        const task = this.tasks.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }

        await this.fileService.deleteFile(task.filePath);
        this.tasks.delete(taskId);
    }

    private findSpaceRoot(spaceId: string): string | undefined {
        const space = this.spaceService.getSpace(spaceId);
        return space?.rootPath;
    }

    private extractTitle(content: string): string | undefined {
        const match = content.match(/^# (.+)$/m);
        return match ? match[1].trim() : undefined;
    }

    private extractDescription(content: string): string {
        const match = content.match(/## Description\s*\n([^#]+)/);
        return match ? match[1].trim() : '';
    }

    private extractChecklist(content: string): Array<{ text: string; completed: boolean }> {
        const checklist: Array<{ text: string; completed: boolean }> = [];
        const regex = /^- \[(.)\ ] (.+)$/gm;
        let match;
        
        while ((match = regex.exec(content)) !== null) {
            checklist.push({
                text: match[2].trim(),
                completed: match[1] === 'x' || match[1] === 'X'
            });
        }

        return checklist;
    }
}
