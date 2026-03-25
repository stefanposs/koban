/**
 * Koban - Markdown Kanban Workspace
 * VS Code Extension Entry Point
 */

import * as vscode from 'vscode';
import { SpaceExplorerProvider } from './views/spaceExplorer';
import { KanbanPanel } from './views/kanbanPanel';
import { SpaceService } from './services/spaceService';
import { TaskService } from './services/taskService';
import { FileService } from './services/fileService';
import { ConfigService } from './services/configService';
import { TaskStatus, Space } from './types';
import { DAILY_DIR, META_FILE } from './constants';
import * as path from 'path';

let spaceService: SpaceService;
let taskService: TaskService;
let fileService: FileService;
let configService: ConfigService;
let spaceExplorerProvider: SpaceExplorerProvider;
let extensionUri: vscode.Uri;
let statusBarItem: vscode.StatusBarItem;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Koban extension is now active');

    extensionUri = context.extensionUri;
    // Initialize services
    configService = new ConfigService();
    fileService = new FileService();
    spaceService = new SpaceService(fileService, configService);
    taskService = new TaskService(fileService, configService, spaceService);

    // Initialize Space Explorer Tree View
    spaceExplorerProvider = new SpaceExplorerProvider(spaceService, taskService, fileService);
    const treeView = vscode.window.createTreeView('kobanSpaces', {
        treeDataProvider: spaceExplorerProvider,
        showCollapseAll: true
    });

    // Register commands
    context.subscriptions.push(
        // New Space
        vscode.commands.registerCommand('koban.newSpace', async () => {
            await createNewSpace();
        }),

        // New Task
        vscode.commands.registerCommand('koban.newTask', async (node) => {
            await createNewTask(node);
        }),

        // New Meeting
        vscode.commands.registerCommand('koban.newMeeting', async (node) => {
            await createNewMeeting(node);
        }),

        // Open Kanban
        vscode.commands.registerCommand('koban.openKanban', async (node) => {
            await openKanbanBoard(node);
        }),

        // Reindex Spaces
        vscode.commands.registerCommand('koban.reindexSpaces', async () => {
            await reindexSpaces();
        }),

        // Refresh Spaces
        vscode.commands.registerCommand('koban.refreshSpaces', async () => {
            await refreshSpaces();
        }),

        // Open Task
        vscode.commands.registerCommand('koban.openTask', async (node) => {
            await openTask(node);
        }),

        // Delete Task
        vscode.commands.registerCommand('koban.deleteTask', async (node) => {
            await deleteTask(node);
        }),

        // Move Task
        vscode.commands.registerCommand('koban.moveTask', async (node, newStatus) => {
            await moveTask(node, newStatus);
        }),

        // Create Task from Selection (Code-to-Task)
        vscode.commands.registerCommand('koban.createTaskFromSelection', async () => {
            await createTaskFromSelection();
        }),

        // Pause Space
        vscode.commands.registerCommand('koban.pauseSpace', async (node) => {
            await changeSpaceStatus(node, 'paused');
        }),

        // Archive Space
        vscode.commands.registerCommand('koban.archiveSpace', async (node) => {
            await changeSpaceStatus(node, 'archived');
        }),

        // Activate Space
        vscode.commands.registerCommand('koban.activateSpace', async (node) => {
            await changeSpaceStatus(node, 'active');
        }),

        // Archive Task
        vscode.commands.registerCommand('koban.archiveTask', async (node) => {
            await archiveTask(node);
        }),

        // Daily Note
        vscode.commands.registerCommand('koban.dailyNote', async () => {
            await openDailyNote();
        }),

        // Quick Capture
        vscode.commands.registerCommand('koban.quickCapture', async () => {
            await quickCapture();
        }),

        // New Note
        vscode.commands.registerCommand('koban.newNote', async (node) => {
            await createNewNote(node);
        }),

        // Tree view
        treeView
    );

    // Status bar
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
    statusBarItem.command = 'koban.openKanban';
    context.subscriptions.push(statusBarItem);

    // Watch for file changes
    setupFileWatcher(context);

    // Initial space discovery
    await discoverSpaces();
}

let debounceTimer: NodeJS.Timeout | undefined;

export function deactivate() {
    if (debounceTimer) { clearTimeout(debounceTimer); }
    console.log('Koban extension is now deactivated');
}

async function pickSpace(node?: any, options?: { useDefault?: boolean }): Promise<Space | undefined> {
    if (node && node.space) {
        return node.space;
    }

    const spaces = spaceService.getSpaces();
    if (spaces.length === 0) {
        vscode.window.showErrorMessage('No spaces found. Create a space first.');
        return undefined;
    }

    if (spaces.length === 1) {
        return spaces[0];
    }

    if (options?.useDefault) {
        const defaultId = configService.getDefaultSpaceId();
        const defaultSpace = defaultId ? spaces.find(s => s.id === defaultId) : undefined;
        if (defaultSpace) { return defaultSpace; }
    }

    const defaultSpaceId = configService.getDefaultSpaceId();
    const items = spaces.map(s => ({
        label: s.name,
        description: s.id === defaultSpaceId ? '(default)' : s.id,
        space: s
    }));
    if (defaultSpaceId) {
        items.sort((a, b) => (a.space.id === defaultSpaceId ? -1 : b.space.id === defaultSpaceId ? 1 : 0));
    }

    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select a space'
    });
    return selected?.space;
}

async function createNewSpace(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const spaceName = await vscode.window.showInputBox({
        prompt: 'Enter space name',
        placeHolder: 'e.g., Website Relaunch Q2'
    });

    if (!spaceName) {
        return;
    }

    // Template selection
    const templates = [
        { label: '📄 Blank', description: 'Empty space with basic structure', id: 'blank' },
        { label: '🏢 Client Project', description: 'With docs folder and client info', id: 'client-project' },
        { label: '🏃 Sprint / Iteration', description: 'Sprint goals, DoD, and retro', id: 'sprint' },
        { label: '📚 Documentation', description: 'Review workflow for docs', id: 'documentation' },
        { label: '👤 Personal', description: 'Simple todo structure', id: 'personal' }
    ];

    const selectedTemplate = await vscode.window.showQuickPick(templates, {
        placeHolder: 'Select a space template'
    });

    if (!selectedTemplate) {
        return;
    }

    const spaceId = spaceName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    if (!spaceId) {
        vscode.window.showErrorMessage('Space name must contain at least one alphanumeric character.');
        return;
    }
    const rootPath = workspaceFolders[0].uri.fsPath;
    const spacePath = vscode.Uri.file(`${rootPath}/${spaceId}`);
    const today = new Date().toISOString().split('T')[0];

    try {
        // Create space directory
        await vscode.workspace.fs.createDirectory(spacePath);

        // Read and process template
        const templatePath = path.join(extensionUri.fsPath, 'templates', `${selectedTemplate.id}.md`);
        let metaContent: string;
        try {
            metaContent = await fileService.readFile(templatePath);
            metaContent = metaContent
                .replace(/\{\{id\}\}/g, spaceId)
                .replace(/\{\{name\}\}/g, spaceName)
                .replace(/\{\{date\}\}/g, today);
        } catch {
            // Fallback if template not found
            metaContent = `---\ntype: space\nid: ${spaceId}\nname: ${spaceName}\nstatus: active\ncreated: ${today}\n---\n\n# ${spaceName}\n`;
        }

        const metaPath = vscode.Uri.joinPath(spacePath, '_meta.md');
        await vscode.workspace.fs.writeFile(metaPath, Buffer.from(metaContent));

        // Create system directories
        const tasksPath = vscode.Uri.joinPath(spacePath, '.tasks');
        const meetingsPath = vscode.Uri.joinPath(spacePath, '.meetings');
        await vscode.workspace.fs.createDirectory(tasksPath);
        await vscode.workspace.fs.createDirectory(meetingsPath);

        // Create extra dirs for client-project template
        if (selectedTemplate.id === 'client-project') {
            await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(spacePath, 'docs'));
            await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(spacePath, 'assets'));
        }

        vscode.window.showInformationMessage(`Space "${spaceName}" created successfully!`);
        
        await refreshSpaces();
        
        const doc = await vscode.workspace.openTextDocument(metaPath);
        await vscode.window.showTextDocument(doc);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create space: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function createNewTask(node?: any): Promise<void> {
    const space = await pickSpace(node);
    if (!space) { return; }

    const taskTitle = await vscode.window.showInputBox({
        prompt: 'Enter task title',
        placeHolder: 'e.g., Implement API endpoint'
    });

    if (!taskTitle) {
        return;
    }

    try {
        const task = await taskService.createTask(space.id, taskTitle);
        vscode.window.showInformationMessage(`Task "${taskTitle}" created successfully!`);
        
        // Refresh the tree view
        await refreshSpaces();
        
        // Open the task file
        const doc = await vscode.workspace.openTextDocument(task.filePath);
        await vscode.window.showTextDocument(doc);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create task: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function createNewMeeting(node?: any): Promise<void> {
    const space = await pickSpace(node);
    if (!space) { return; }

    const meetingTitle = await vscode.window.showInputBox({
        prompt: 'Enter meeting title',
        placeHolder: 'e.g., Sprint Planning'
    });

    if (!meetingTitle) {
        return;
    }

    const meetingDate = await vscode.window.showInputBox({
        prompt: 'Enter meeting date (YYYY-MM-DD)',
        placeHolder: new Date().toISOString().split('T')[0],
        value: new Date().toISOString().split('T')[0],
        validateInput: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) ? null : 'Use YYYY-MM-DD format'
    });

    if (!meetingDate) {
        return;
    }

    try {
        const meeting = await taskService.createMeeting(space.id, meetingTitle, meetingDate);
        vscode.window.showInformationMessage(`Meeting "${meetingTitle}" created successfully!`);
        
        await refreshSpaces();
        
        const doc = await vscode.workspace.openTextDocument(meeting.filePath);
        await vscode.window.showTextDocument(doc);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create meeting: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function openKanbanBoard(node?: any): Promise<void> {
    await discoverSpaces();
    const spaces = spaceService.getSpaces();
    if (spaces.length === 0) {
        vscode.window.showErrorMessage('No spaces found. Create a space first.');
        return;
    }

    // If called with a specific space node, show only that space
    // Otherwise show all active spaces
    let targetSpaces: typeof spaces;
    if (node && node.space) {
        targetSpaces = [node.space];
    } else {
        targetSpaces = spaces.filter(s => s.status === 'active');
        if (targetSpaces.length === 0) {
            targetSpaces = spaces;
        }
    }

    const boards = await Promise.all(
        targetSpaces.map(async (space) => ({
            space,
            tasks: await taskService.getTasksForSpace(space.id),
            meetings: await taskService.getMeetingsForSpace(space.id)
        }))
    );

    KanbanPanel.createOrShow(extensionUri, boards, configService.getKanbanColumns(), taskService, spaceService);
}

async function reindexSpaces(): Promise<void> {
    await discoverSpaces();
    vscode.window.showInformationMessage('Spaces reindexed successfully!');
}

async function refreshSpaces(): Promise<void> {
    await discoverSpaces();
    spaceExplorerProvider.refresh();

    // If the Kanban board is open, refresh it with current space data
    if (KanbanPanel.currentPanel) {
        const spaces = spaceService.getSpaces().filter(s => s.status === 'active');
        const allSpaces = spaces.length > 0 ? spaces : spaceService.getSpaces();
        const boards = await Promise.all(
            allSpaces.map(async (space) => ({
                space,
                tasks: await taskService.getTasksForSpace(space.id),
                meetings: await taskService.getMeetingsForSpace(space.id)
            }))
        );
        KanbanPanel.currentPanel.updateBoards(boards, configService.getKanbanColumns());
    }
}

async function openTask(node: any): Promise<void> {
    if (node && node.task && node.task.filePath) {
        const doc = await vscode.workspace.openTextDocument(node.task.filePath);
        await vscode.window.showTextDocument(doc);
    }
}

async function deleteTask(node: any): Promise<void> {
    if (!node || !node.task) {
        return;
    }

    const confirm = await vscode.window.showWarningMessage(
        `Are you sure you want to delete task "${node.task.title}"?`,
        'Delete',
        'Cancel'
    );

    if (confirm !== 'Delete') {
        return;
    }

    try {
        await taskService.deleteTask(node.task.id);
        await refreshSpaces();
        vscode.window.showInformationMessage('Task deleted successfully!');
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to delete task: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function moveTask(node: any, newStatus: string): Promise<void> {
    if (!node || !node.task) {
        return;
    }

    const validStatuses: TaskStatus[] = ['todo', 'in-progress', 'review', 'done', 'blocked', 'archived'];
    if (!validStatuses.includes(newStatus as TaskStatus)) {
        vscode.window.showErrorMessage(`Invalid task status: ${newStatus}`);
        return;
    }

    try {
        await taskService.updateTaskStatus(node.task.id, newStatus as TaskStatus);
        await refreshSpaces();
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to move task: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function discoverSpaces(): Promise<void> {
    await spaceService.discoverSpaces();
    const spaces = spaceService.getSpaces();
    
    vscode.commands.executeCommand('setContext', 'workspaceHasKobanSpaces', spaces.length > 0);
    
    // Refresh the tree view to show discovered spaces
    spaceExplorerProvider.refresh();
    updateStatusBar();
}

async function createTaskFromSelection(): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active editor');
        return;
    }

    const selection = editor.selection;
    const selectedText = editor.document.getText(selection);
    if (!selectedText) {
        vscode.window.showErrorMessage('No text selected');
        return;
    }

    const space = await pickSpace();
    if (!space) {
        return;
    }

    // Derive task title from first line or TODO comment
    const firstLine = selectedText.split('\n')[0].trim();
    const todoMatch = firstLine.match(/\/\/\s*(?:TODO|FIXME|BUG|HACK):\s*(.+)/i);
    const defaultTitle = todoMatch ? todoMatch[1].trim() : firstLine.substring(0, 80);

    const taskTitle = await vscode.window.showInputBox({
        prompt: 'Enter task title',
        value: defaultTitle,
        placeHolder: 'e.g., Fix authentication bug'
    });

    if (!taskTitle) {
        return;
    }

    try {
        const relativePath = vscode.workspace.asRelativePath(editor.document.uri);
        const lineNumber = selection.start.line + 1;
        const codeRef = `[${relativePath}#L${lineNumber}](${relativePath}#L${lineNumber})`;

        const task = await taskService.createTask(space.id, taskTitle);

        // Append code reference to the task file
        const taskContent = await fileService.readFile(task.filePath);
        const enhancedContent = taskContent.replace(
            '## Links\n- Related tasks:\n- External resources:',
            `## Links\n- Source: ${codeRef}\n\n## Code Reference\n\`\`\`\`\n${selectedText}\n\`\`\`\``
        );
        await fileService.writeFile(task.filePath, enhancedContent);

        vscode.window.showInformationMessage(`Task "${taskTitle}" created from selection!`);
        await refreshSpaces();
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create task: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function changeSpaceStatus(node: any, status: 'active' | 'paused' | 'archived'): Promise<void> {
    if (!node || !node.space) {
        return;
    }

    try {
        await spaceService.updateSpaceStatus(node.space.id, status);
        await refreshSpaces();
        vscode.window.showInformationMessage(`Space "${node.space.name}" is now ${status}.`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to update space: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function archiveTask(node: any): Promise<void> {
    if (!node || !node.task) {
        return;
    }

    try {
        await taskService.archiveTask(node.task.id);
        await refreshSpaces();
        vscode.window.showInformationMessage(`Task "${node.task.title}" archived.`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to archive task: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function openDailyNote(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const dailyDir = path.join(rootPath, DAILY_DIR);
    const today = new Date().toISOString().split('T')[0];
    const filePath = path.join(dailyDir, `${today}.md`);

    try {
        const exists = await fileService.fileExists(filePath);
        if (!exists) {
            await fileService.createDirectory(dailyDir);
            const content = `---\ndate: ${today}\n---\n\n# ${today}\n\n## Tasks\n- [ ] \n\n## Notes\n\n`;
            await fileService.writeFile(filePath, content);
        }
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to open daily note: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function quickCapture(): Promise<void> {
    const taskTitle = await vscode.window.showInputBox({
        prompt: 'Quick Capture — Enter task title',
        placeHolder: 'What needs to be done?'
    });

    if (!taskTitle) {
        return;
    }

    const space = await pickSpace(undefined, { useDefault: true });
    if (!space) {
        return;
    }

    try {
        await taskService.createTask(space.id, taskTitle);
        vscode.window.showInformationMessage(`Task captured in "${space.name}"`);
        await refreshSpaces();
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to capture task: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function updateStatusBar(): void {
    const spaces = spaceService.getSpaces().filter(s => s.status === 'active');
    if (spaces.length === 0) {
        statusBarItem.hide();
        return;
    }

    const totalTasks = spaces.reduce((sum, s) => sum + s.stats.totalTasks, 0);
    const inProgress = spaces.reduce((sum, s) => sum + (s.stats.tasksByStatus['in-progress'] || 0), 0);
    statusBarItem.text = `$(checklist) ${inProgress}/${totalTasks}`;
    statusBarItem.tooltip = `Koban: ${inProgress} in progress, ${totalTasks} total tasks`;
    statusBarItem.show();
}

async function createNewNote(node?: any): Promise<void> {
    const space = await pickSpace(node);
    if (!space) {
        return;
    }

    const title = await vscode.window.showInputBox({
        prompt: 'Enter note title',
        placeHolder: 'e.g., Architecture decisions'
    });
    if (!title) { return; }

    const fileName = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') + '.md';
    const filePath = path.join(space.rootPath, fileName);

    try {
        const today = new Date().toISOString().split('T')[0];
        const content = `---\ntitle: ${title}\ncreated: ${today}\n---\n\n# ${title}\n\n`;
        await fileService.writeFile(filePath, content);
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
        await refreshSpaces();
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create note: ${error instanceof Error ? error.message : String(error)}`);
    }
}

function setupFileWatcher(context: vscode.ExtensionContext): void {
    const debouncedRefresh = () => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            refreshSpaces();
        }, 500);
    };

    // Watch for space and content changes
    const watchPatterns = [
        '**/_meta.md',
        '**/.tasks/**',
        '**/.meetings/**',
    ];

    for (const pattern of watchPatterns) {
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        watcher.onDidCreate(debouncedRefresh);
        watcher.onDidDelete(debouncedRefresh);
        watcher.onDidChange(debouncedRefresh);
        context.subscriptions.push(watcher);
    }

    // Re-discover spaces when workspace folders change
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            debouncedRefresh();
        })
    );

    // Listen for configuration changes
    context.subscriptions.push(
        configService.onConfigurationChanged(() => {
            refreshSpaces();
        })
    );
}
