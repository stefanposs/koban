/**
 * Space Service - Manages space discovery and operations
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { Space, SpaceMeta, SpaceStats, TaskStatus, IFileService, IConfigService, ISpaceService } from '../types';
import { parseFrontmatter, updateFrontmatter } from '../utils/frontmatterParser';

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
        const metaPattern = new vscode.RelativePattern(rootPath, '**/_meta.md');
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
                    stats
                };

                target.set(spaceId, space);
            }
        } catch (error) {
            console.error(`Error processing meta file ${filePath}:`, error);
        }
    }

    private async calculateSpaceStats(rootPath: string): Promise<SpaceStats> {
        const tasksPath = path.join(rootPath, '.tasks');
        const meetingsPath = path.join(rootPath, '.meetings');

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

        // Count tasks
        try {
            const allFiles = await this.fileService.listFiles(tasksPath);
            const taskFiles = allFiles.filter(f => f.endsWith('.md'));
            totalTasks = taskFiles.length;

            for (const file of taskFiles) {
                try {
                    const content = await this.fileService.readFile(path.join(tasksPath, file));
                    const frontmatter = parseFrontmatter(content);
                    const status = frontmatter.status as TaskStatus;
                    if (status && tasksByStatus[status] !== undefined) {
                        tasksByStatus[status]++;
                    } else {
                        tasksByStatus['todo']++;
                    }
                } catch {
                    tasksByStatus['todo']++;
                }
            }
        } catch {
            // Directory doesn't exist
        }

        // Count meetings
        try {
            const allMeetingFiles = await this.fileService.listFiles(meetingsPath);
            const meetingFiles = allMeetingFiles.filter(f => f.endsWith('.md'));
            totalMeetings = meetingFiles.length;

            const today = new Date().toISOString().split('T')[0];
            for (const file of meetingFiles) {
                try {
                    const content = await this.fileService.readFile(path.join(meetingsPath, file));
                    const frontmatter = parseFrontmatter(content);
                    if (frontmatter.date && String(frontmatter.date) >= today) {
                        upcomingMeetings++;
                    }
                } catch {
                    // Ignore
                }
            }
        } catch {
            // Directory doesn't exist
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

        const metaPath = path.join(space.rootPath, '_meta.md');
        
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
            throw new Error(`Failed to update space status: ${error}`);
        }
    }
}
