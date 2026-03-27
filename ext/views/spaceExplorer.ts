/**
 * Space Explorer Tree View Provider
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { Space, Task, Meeting, ISpaceService, ITaskService, IFileService } from '../types';
import { META_FILE } from '../constants';
import { isSystemFile } from '../utils/taskFileParser';

export class SpaceExplorerProvider implements vscode.TreeDataProvider<SpaceTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<SpaceTreeItem | undefined | void> = new vscode.EventEmitter<SpaceTreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<SpaceTreeItem | undefined | void> = this._onDidChangeTreeData.event;

    private spaceService: ISpaceService;
    private taskService: ITaskService;
    private fileService: IFileService;

    constructor(spaceService: ISpaceService, taskService: ITaskService, fileService: IFileService) {
        this.spaceService = spaceService;
        this.taskService = taskService;
        this.fileService = fileService;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: SpaceTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: SpaceTreeItem): Promise<SpaceTreeItem[]> {
        if (!element) {
            // Root level - return spaces
            const spaces = await this.spaceService.getSpaces();
            return spaces.map(space => new SpaceItem(space));
        }

        if (element instanceof SpaceItem) {
            // Space level - return categories
            const space = element.space;
            const items: SpaceTreeItem[] = [];

            // Tasks category
            const tasks = await this.taskService.getTasksForSpace(space.id);
            if (tasks.length > 0) {
                items.push(new CategoryItem('Tasks', 'tasks', space, tasks.length));
            }

            // Meetings category
            const meetings = await this.taskService.getMeetingsForSpace(space.id);
            if (meetings.length > 0) {
                items.push(new CategoryItem('Meetings', 'meetings', space, meetings.length));
            }

            // Notes category — loose .md files in space root (excluding _meta.md)
            try {
                const files = await this.fileService.listFiles(space.rootPath);
                const notes = files.filter(f => f.endsWith('.md') && f !== META_FILE && !isSystemFile(f));
                if (notes.length > 0) {
                    items.push(new CategoryItem('Notes', 'notes', space, notes.length));
                }
            } catch {
                // ignore
            }

            return items;
        }

        if (element instanceof CategoryItem) {
            // Category level - return items
            const space = element.space;
            
            if (element.categoryType === 'tasks') {
                const tasks = await this.taskService.getTasksForSpace(space.id);
                return tasks.map(task => new TaskItem(task, space));
            }

            if (element.categoryType === 'meetings') {
                const meetings = await this.taskService.getMeetingsForSpace(space.id);
                return meetings.map(meeting => new MeetingItem(meeting, space));
            }

            if (element.categoryType === 'notes') {
                try {
                    const files = await this.fileService.listFiles(space.rootPath);
                    const notes = files.filter(f => f.endsWith('.md') && f !== META_FILE && !isSystemFile(f));
                    return notes.map(f => new NoteItem(f, space));
                } catch {
                    return [];
                }
            }
        }

        return [];
    }

    getParent(element: SpaceTreeItem): vscode.ProviderResult<SpaceTreeItem> {
        if (element instanceof CategoryItem) {
            return new SpaceItem(element.space);
        }
        if (element instanceof TaskItem) {
            return new CategoryItem('Tasks', 'tasks', element.space, 0);
        }
        if (element instanceof MeetingItem) {
            return new CategoryItem('Meetings', 'meetings', element.space, 0);
        }
        if (element instanceof NoteItem) {
            return new CategoryItem('Notes', 'notes', element.space, 0);
        }
        return null;
    }
}

export type SpaceTreeItem = SpaceItem | CategoryItem | TaskItem | MeetingItem | NoteItem;

export class SpaceItem extends vscode.TreeItem {
    space: Space;

    constructor(space: Space) {
        super(
            space.name,
            vscode.TreeItemCollapsibleState.Collapsed
        );
        this.space = space;
        this.contextValue = space.status === 'active' ? 'space' : `space-${space.status}`;
        this.tooltip = `${space.name}\n${space.description || ''}\nStatus: ${space.status}\nTasks: ${space.stats.totalTasks}`;
        this.description = `${space.stats.totalTasks} tasks, ${space.stats.completionPercentage}% complete`;
        
        // Set icon based on status
        switch (space.status) {
            case 'active':
                this.iconPath = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('testing.iconPassed'));
                break;
            case 'paused':
                this.iconPath = new vscode.ThemeIcon('circle-outline', new vscode.ThemeColor('testing.iconQueued'));
                break;
            case 'archived':
                this.iconPath = new vscode.ThemeIcon('archive');
                break;
            default:
                this.iconPath = new vscode.ThemeIcon('folder');
        }

        this.command = {
            command: 'koban.openKanban',
            title: 'Open Kanban',
            arguments: [{ space }]
        };
    }
}

export class CategoryItem extends vscode.TreeItem {
    space: Space;
    categoryType: string;

    constructor(label: string, categoryType: string, space: Space, count: number) {
        super(
            label,
            vscode.TreeItemCollapsibleState.Collapsed
        );
        this.space = space;
        this.categoryType = categoryType;
        this.contextValue = 'category';
        this.description = `${count} items`;
        
        if (categoryType === 'tasks') {
            this.iconPath = new vscode.ThemeIcon('checklist');
        } else if (categoryType === 'meetings') {
            this.iconPath = new vscode.ThemeIcon('calendar');
        }
    }
}

export class TaskItem extends vscode.TreeItem {
    task: Task;
    space: Space;

    constructor(task: Task, space: Space) {
        super(
            task.title,
            vscode.TreeItemCollapsibleState.None
        );
        this.task = task;
        this.space = space;
        this.contextValue = 'task';
        
        // Build tooltip
        let tooltip = `${task.title}\nStatus: ${task.status}\nPriority: ${task.priority}`;
        if (task.assignee) {
            tooltip += `\nAssignee: ${task.assignee}`;
        }
        if (task.dueDate) {
            tooltip += `\nDue: ${task.dueDate.toLocaleDateString()}`;
        }
        if (task.tags.length > 0) {
            tooltip += `\nTags: ${task.tags.join(', ')}`;
        }
        this.tooltip = tooltip;

        // Set description
        const parts: string[] = [];
        if (task.priority) {
            parts.push(`[${task.priority.charAt(0).toUpperCase()}]`);
        }
        if (task.dueDate) {
            parts.push(`📅 ${task.dueDate.toLocaleDateString()}`);
        }
        if (task.tags.length > 0) {
            parts.push(`#${task.tags[0]}`);
        }
        this.description = parts.join(' ');

        // Set icon based on status
        switch (task.status) {
            case 'todo':
                this.iconPath = new vscode.ThemeIcon('circle-outline');
                break;
            case 'in-progress':
                this.iconPath = new vscode.ThemeIcon('play-circle');
                break;
            case 'review':
                this.iconPath = new vscode.ThemeIcon('eye');
                break;
            case 'done':
                this.iconPath = new vscode.ThemeIcon('check');
                break;
            case 'blocked':
                this.iconPath = new vscode.ThemeIcon('warning');
                break;
            default:
                this.iconPath = new vscode.ThemeIcon('circle-outline');
        }

        this.command = {
            command: 'koban.openTask',
            title: 'Open Task',
            arguments: [{ task }]
        };
    }
}

export class MeetingItem extends vscode.TreeItem {
    meeting: Meeting;
    space: Space;

    constructor(meeting: Meeting, space: Space) {
        super(
            meeting.title,
            vscode.TreeItemCollapsibleState.None
        );
        this.meeting = meeting;
        this.space = space;
        this.contextValue = 'meeting';
        
        let tooltip = `${meeting.title}\nDate: ${meeting.date.toLocaleDateString()}`;
        if (meeting.duration) {
            tooltip += `\nDuration: ${meeting.duration} min`;
        }
        if (meeting.attendees && meeting.attendees.length > 0) {
            tooltip += `\nAttendees: ${meeting.attendees.join(', ')}`;
        }
        this.tooltip = tooltip;

        this.description = meeting.date.toLocaleDateString();
        this.iconPath = new vscode.ThemeIcon('calendar');

        this.command = {
            command: 'koban.openTask',
            title: 'Open Meeting',
            arguments: [{ task: meeting }]
        };
    }
}

export class NoteItem extends vscode.TreeItem {
    space: Space;

    constructor(fileName: string, space: Space) {
        super(fileName.replace('.md', ''), vscode.TreeItemCollapsibleState.None);
        this.space = space;
        this.contextValue = 'note';
        this.iconPath = new vscode.ThemeIcon('note');
        this.tooltip = fileName;
        const filePath = path.join(space.rootPath, fileName);
        this.command = {
            command: 'vscode.open',
            title: 'Open Note',
            arguments: [vscode.Uri.file(filePath)]
        };
    }
}
