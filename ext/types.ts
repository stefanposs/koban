/**
 * Koban Type Definitions
 */

export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done' | 'blocked' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type SpaceStatus = 'active' | 'paused' | 'archived';
export type MeetingType = 'daily' | 'planning' | 'review' | 'retro' | 'kickoff' | 'stakeholder';

export interface Space {
    id: string;
    name: string;
    description?: string;
    rootPath: string;
    status: SpaceStatus;
    color?: string;
    owner?: string;
    createdAt: Date;
    updatedAt: Date;
    detectionMethod: 'frontmatter' | 'convention' | 'explicit';
    stats: SpaceStats;
}

export interface SpaceStats {
    totalTasks: number;
    tasksByStatus: Record<TaskStatus, number>;
    totalMeetings: number;
    upcomingMeetings: number;
    completionPercentage: number;
}

export interface Task {
    id: string;
    spaceId: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    assignee?: string;
    dueDate?: Date;
    tags: string[];
    filePath: string;
    createdAt: Date;
    updatedAt: Date;
    description?: string;
    checklist: ChecklistItem[];
    links: Link[];
}

export interface ChecklistItem {
    id: string;
    text: string;
    completed: boolean;
}

export interface Link {
    type: 'task' | 'meeting' | 'external' | 'file';
    target: string;
    displayText?: string;
}

export interface Meeting {
    id: string;
    spaceId: string;
    title: string;
    date: Date;
    duration?: number;
    attendees?: string[];
    agenda?: string;
    notes?: string;
    filePath: string;
    createdAt: Date;
    updatedAt: Date;
    meetingType?: MeetingType;
}

export interface KanbanColumnConfig {
    id: string;
    name: string;
    status: TaskStatus;
    color?: string;
    wipLimit?: number;
}

export interface KobanConfig {
    global: {
        excludePatterns: string[];
        showSystemFolders: boolean;
        defaultTaskTemplate: string;
        defaultMeetingTemplate: string;
        autoSave: boolean;
        autoArchiveDays: number;
        kanbanColumns: KanbanColumnConfig[];
    };
    workspace?: Partial<KobanConfig['global']>;
}

export interface ParsedFrontmatter {
    [key: string]: any;
}

export interface SpaceMeta {
    type: 'space';
    id: string;
    name: string;
    description?: string;
    owner?: string;
    created?: string;
    status?: SpaceStatus;
    color?: string;
}

export interface TaskMeta {
    id: string;
    space: string;
    status: TaskStatus;
    priority?: TaskPriority;
    assignee?: string;
    due?: string;
    tags?: string[];
    created?: string;
}

export interface MeetingMeta {
    type: 'meeting';
    id: string;
    space: string;
    meeting_type?: MeetingType;
    date: string;
    start_time?: string;
    duration?: string;
    participants?: string[];
}

// =====================================================
// Service Interfaces (for DI & testability)
// =====================================================

export interface IFileService {
    readFile(filePath: string): Promise<string>;
    writeFile(filePath: string, content: string): Promise<void>;
    deleteFile(filePath: string): Promise<void>;
    moveFile(source: string, target: string): Promise<void>;
    createDirectory(dirPath: string): Promise<void>;
    listFiles(dirPath: string): Promise<string[]>;
    fileExists(filePath: string): Promise<boolean>;
    directoryExists(dirPath: string): Promise<boolean>;
}

export interface IConfigService {
    getExcludePatterns(): string[];
    getKanbanColumns(): KanbanColumnConfig[];
    getDefaultSpaceId(): string | undefined;
    getAutoArchiveDays(): number;
    getAutoSave(): boolean;
    getDefaultTaskTemplate(): string;
    getDefaultMeetingTemplate(): string;
    getShowSystemFolders(): boolean;
    onConfigurationChanged(handler: () => void): { dispose(): void };
}

export interface ISpaceService {
    discoverSpaces(): Promise<Space[]>;
    getSpaces(): Space[];
    getSpace(id: string): Space | undefined;
    updateSpaceStatus(id: string, status: SpaceStatus): Promise<void>;
}

export interface ITaskService {
    createTask(spaceId: string, title: string, options?: { status?: TaskStatus; priority?: TaskPriority; tags?: string[]; assignee?: string; dueDate?: string }): Promise<Task>;
    getTasksForSpace(spaceId: string, includeArchived?: boolean): Promise<Task[]>;
    getMeetingsForSpace(spaceId: string): Promise<Meeting[]>;
    updateTaskStatus(taskId: string, newStatus: TaskStatus): Promise<void>;
    deleteTask(taskId: string): Promise<void>;
    archiveTask(taskId: string): Promise<void>;
    createMeeting(spaceId: string, title: string, date: string): Promise<Meeting>;
}
