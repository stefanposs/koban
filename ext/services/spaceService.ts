/**
 * Space Service - Manages space discovery and operations
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { Space, SpaceMeta, SpaceStats, TaskStatus, IFileService, IConfigService, ISpaceService } from '../types';
import { parseFrontmatter, updateFrontmatter } from '../utils/frontmatterParser';
import { META_FILE } from '../constants';
import { parseTasksFile, parseMeetingsFile, findYearFiles, getTasksFileName, getMeetingsFileName } from '../utils/taskFileParser';
import { TASKS_DIR, MEETINGS_DIR } from '../constants';

export class SpaceService implements ISpaceService {
    private spaces: Map<string, Space> = new Map();
    private fileService: IFileService;
    private configService: IConfigService;

    constructor(fileService: IFileService, configService: IConfigService) {
        this.fileService = fileService;
        this.configService = configService;
    }

    async discoverSpaces(): Promise<Space[]> {
        const newSpaces = new Map<string, Space>();
        
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            this.spaces = newSpaces;
            return [];
        }

        for (const folder of workspaceFolders) {
            await this.scanForSpaces(folder.uri.fsPath, newSpaces);
        }

        this.spaces = newSpaces;
        return Array.from(this.spaces.values());
    }

    private async scanForSpaces(rootPath: string, target: Map<string, Space>): Promise<void> {
        const excludePatterns = this.configService.getExcludePatterns();
        const excludeGlob = `{${excludePatterns.join(',')}}`;
        
        // Single detection method: _meta.md with type: space frontmatter
        const metaPattern = new vscode.RelativePattern(rootPath, `**/${META_FILE}`);
        const metaFiles = await vscode.workspace.findFiles(metaPattern, excludeGlob, 500);

        for (const file of metaFiles) {
            await this.processMetaFile(file.fsPath, target);
        }
    }

    private async processMetaFile(filePath: string, target: Map<string, Space>): Promise<void> {
        try {
            const content = await this.fileService.readFile(filePath);
            const frontmatter = parseFrontmatter(content);

            if (frontmatter.type === 'space') {
                const meta = frontmatter as SpaceMeta;
                const spaceId = meta.id || path.basename(path.dirname(filePath));
                const rootPath = path.dirname(filePath);

                const stats = await this.calculateSpaceStats(rootPath);

                const space: Space = {
                    id: spaceId,
                    name: meta.name || spaceId,
                    description: meta.description,
                    rootPath: rootPath,
                    status: meta.status || 'active',
                    createdAt: meta.created ? new Date(meta.created) : new Date(),
                    updatedAt: new Date(),
                    stats,
                    color: (frontmatter as any).color,
                };

                if (target.has(spaceId)) {
                    console.warn(`Koban: duplicate space ID "${spaceId}" — skipping ${filePath}`);
                } else {
                    target.set(spaceId, space);
                }
            }
        } catch (error) {
            console.error(`Error processing meta file ${filePath}:`, error);
        }
    }

    private async calculateSpaceStats(rootPath: string): Promise<SpaceStats> {
        let totalTasks = 0;
        const tasksByStatus: Record<TaskStatus, number> = {
            'todo': 0,
            'in-progress': 0,
            'review': 0,
            'done': 0,
            'blocked': 0,
            'archived': 0
        };
        let totalMeetings = 0;
        let upcomingMeetings = 0;

        // Read tasks from .tasks/ subdirectory
        const tasksDir = path.join(rootPath, TASKS_DIR);
        try {
            const files = await this.fileService.listFiles(tasksDir);
            const taskYears = findYearFiles(files, 'tasks');
            for (const year of taskYears) {
                try {
                    const content = await this.fileService.readFile(path.join(tasksDir, getTasksFileName(year)));
                    const parsed = parseTasksFile(content);
                    for (const sec of parsed.tasks) {
                        totalTasks++;
                        const status = sec.status as TaskStatus;
                        if (tasksByStatus[status] !== undefined) {
                            tasksByStatus[status]++;
                        } else {
                            tasksByStatus['todo']++;
                        }
                    }
                } catch (err) {
                    console.warn(`Koban: failed to parse tasks file for year ${year}:`, err);
                }
            }
        } catch {
            // .tasks/ doesn't exist yet — not an error
        }

        // Read meetings from .meetings/ subdirectory
        const meetingsDir = path.join(rootPath, MEETINGS_DIR);
        try {
            const files = await this.fileService.listFiles(meetingsDir);
            const meetingYears = findYearFiles(files, 'meetings');
            const today = new Date().toISOString().split('T')[0];
            for (const year of meetingYears) {
                try {
                    const content = await this.fileService.readFile(path.join(meetingsDir, getMeetingsFileName(year)));
                    const parsed = parseMeetingsFile(content);
                    for (const sec of parsed.meetings) {
                        totalMeetings++;
                        if (sec.date >= today) {
                            upcomingMeetings++;
                        }
                    }
                } catch (err) {
                    console.warn(`Koban: failed to parse meetings file for year ${year}:`, err);
                }
            }
        } catch {
            // .meetings/ doesn't exist yet — not an error
        }

        const completedTasks = tasksByStatus['done'];
        const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        return {
            totalTasks,
            tasksByStatus,
            totalMeetings,
            upcomingMeetings,
            completionPercentage
        };
    }

    getSpaces(): Space[] {
        return Array.from(this.spaces.values());
    }

    getSpace(id: string): Space | undefined {
        return this.spaces.get(id);
    }

    async updateSpaceStatus(id: string, status: 'active' | 'paused' | 'archived'): Promise<void> {
        const space = this.spaces.get(id);
        if (!space) {
            throw new Error(`Space ${id} not found`);
        }

        const metaPath = path.join(space.rootPath, META_FILE);
        
        try {
            let content: string;
            try {
                content = await this.fileService.readFile(metaPath);
            } catch {
                // Create new meta file
                content = `---\ntype: space\nid: ${id}\nname: ${space.name}\nstatus: ${status}\ncreated: ${new Date().toISOString().split('T')[0]}\n---\n\n# ${space.name}\n`;
            }

            const updatedContent = updateFrontmatter(content, { status });
            await this.fileService.writeFile(metaPath, updatedContent);
            space.status = status;
            space.updatedAt = new Date();
        } catch (error) {
            throw new Error(`Failed to update space status: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
