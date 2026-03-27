/**
 * Koban Type Definitions
 */

export type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done' | 'blocked' | 'archived';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type SpaceStatus = 'active' | 'paused' | 'archived';
export type MeetingType = string;

export interface Space {
    id: string;
    name: string;
    description?: string;
    rootPath: string;
    status: SpaceStatus;
    createdAt: Date;
    updatedAt: Date;
    stats: SpaceStats;
    color?: string;
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
    /** 0-based line number of the ## heading inside the year-file */
    lineNumber?: number;
}

export interface Meeting {
    id: string;
    spaceId: string;
    title: string;
    date: Date;
    time?: string;
    duration?: number;
    attendees?: string[];
    tags?: string[];
    agenda?: string;
    notes?: string;
    filePath: string;
    createdAt: Date;
    updatedAt: Date;
    meetingType?: MeetingType;
    /** 0-based line number of the ## heading inside the year-file */
    lineNumber?: number;
}

export interface KanbanColumnConfig {
    id: string;
    name: string;
    status: TaskStatus;
    color?: string;
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
    created?: string;
    status?: SpaceStatus;
    color?: string;
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
    updateTask(taskId: string, updates: { title?: string; priority?: string; due?: string; status?: string; description?: string }): Promise<void>;
    updateMeeting(meetingId: string, updates: { title?: string; date?: string; time?: string }): Promise<void>;
    deleteTask(taskId: string): Promise<void>;
    archiveTask(taskId: string): Promise<void>;
    moveTaskToSpace(taskId: string, targetSpaceId: string): Promise<Task>;
    moveMeetingToSpace(meetingId: string, targetSpaceId: string): Promise<Meeting>;
    createMeeting(spaceId: string, title: string, date: string, options?: { time?: string; duration?: number; attendees?: string[]; tags?: string[]; meetingType?: MeetingType }): Promise<Meeting>;
}
