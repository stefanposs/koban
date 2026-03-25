/**
 * Space Service - Manages space discovery and operations
 */

import * as vscode from 'vscode';
import * as path from 'path';
import YAML from 'yaml';
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

    private async scanForSpaces(rootPath: string, target: Map<string, Space> = this.spaces): Promise<void> {
        const excludePatterns = this.configService.getExcludePatterns();
        const excludeGlob = `{${excludePatterns.join(',')}}`;
        
        // Method 1: Scan for _meta.md files (frontmatter detection)
        const metaPattern = new vscode.RelativePattern(rootPath, '**/_meta.md');
        const metaFiles = await vscode.workspace.findFiles(metaPattern, excludeGlob, 500);

        for (const file of metaFiles) {
            await this.processMetaFile(file.fsPath, target);
        }

        // Method 2: Scan for .mkw/space.yml files (explicit detection)
        const explicitPattern = new vscode.RelativePattern(rootPath, '**/.mkw/space.yml');
        const explicitFiles = await vscode.workspace.findFiles(explicitPattern, excludeGlob, 100);

        for (const file of explicitFiles) {
            const spaceDir = path.dirname(path.dirname(file.fsPath));
            const spaceId = path.basename(spaceDir);
            if (!target.has(spaceId)) {
                await this.createSpaceFromExplicit(spaceDir, spaceId, file.fsPath, target);
            }
        }

        // Method 3: Scan for directories containing .tasks or .meetings folders
        // We look for any file inside these folders to identify the parent directory
        const seenDirs = new Set<string>();
        
        // Check for .tasks folders
        const tasksPattern = new vscode.RelativePattern(rootPath, '**/.tasks/*');
        const taskFiles = await vscode.workspace.findFiles(tasksPattern, excludeGlob, 500);
        
        for (const file of taskFiles) {
            const tasksDir = path.dirname(file.fsPath);
            const parentDir = path.dirname(tasksDir);
            
            if (seenDirs.has(parentDir)) {
                continue;
            }
            seenDirs.add(parentDir);

            const spaceId = path.basename(parentDir);
            if (!target.has(spaceId)) {
                await this.createSpaceFromConvention(parentDir, spaceId, target);
            }
        }
        
        // Check for .meetings folders (in case a space has meetings but no tasks)
        const meetingsPattern = new vscode.RelativePattern(rootPath, '**/.meetings/*');
        const meetingFiles = await vscode.workspace.findFiles(meetingsPattern, excludeGlob, 500);
        
        for (const file of meetingFiles) {
            const meetingsDir = path.dirname(file.fsPath);
            const parentDir = path.dirname(meetingsDir);
            
            if (seenDirs.has(parentDir)) {
                continue;
            }
            seenDirs.add(parentDir);

            const spaceId = path.basename(parentDir);
            if (!target.has(spaceId)) {
                await this.createSpaceFromConvention(parentDir, spaceId, target);
            }
        }
    }

    private async processMetaFile(filePath: string, target: Map<string, Space> = this.spaces): Promise<void> {
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
                    color: meta.color,
                    owner: meta.owner,
                    createdAt: meta.created ? new Date(meta.created) : new Date(),
                    updatedAt: new Date(),
                    detectionMethod: 'frontmatter',
                    stats
                };

                target.set(spaceId, space);
            }
        } catch (error) {
            console.error(`Error processing meta file ${filePath}:`, error);
        }
    }

    private async createSpaceFromConvention(rootPath: string, spaceId: string, target: Map<string, Space> = this.spaces): Promise<void> {
        try {
            const stats = await this.calculateSpaceStats(rootPath);

            const space: Space = {
                id: spaceId,
                name: spaceId,
                rootPath: rootPath,
                status: 'active',
                createdAt: new Date(),
                updatedAt: new Date(),
                detectionMethod: 'convention',
                stats
            };

            target.set(spaceId, space);
        } catch (error) {
            console.error(`Error creating space from convention ${rootPath}:`, error);
        }
    }

    private async createSpaceFromExplicit(rootPath: string, spaceId: string, configPath: string, target: Map<string, Space> = this.spaces): Promise<void> {
        try {
            const content = await this.fileService.readFile(configPath);
            let parsed: Record<string, any> = {};
            try {
                parsed = YAML.parse(content) || {};
            } catch {
                // Fall back to empty if YAML parsing fails
            }
            const stats = await this.calculateSpaceStats(rootPath);

            const space: Space = {
                id: parsed.id || spaceId,
                name: parsed.name || spaceId,
                description: parsed.description,
                rootPath: rootPath,
                status: parsed.status || 'active',
                color: parsed.color,
                owner: parsed.owner,
                createdAt: parsed.created ? new Date(parsed.created) : new Date(),
                updatedAt: new Date(),
                detectionMethod: 'explicit',
                stats
            };

            target.set(space.id, space);
        } catch (error) {
            console.error(`Error creating space from explicit config ${configPath}:`, error);
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

    async refreshSpace(id: string): Promise<void> {
        const space = this.spaces.get(id);
        if (space) {
            space.stats = await this.calculateSpaceStats(space.rootPath);
            space.updatedAt = new Date();
        }
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
