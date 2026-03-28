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
import { DAILY_DIR, TASKS_DIR, MEETINGS_DIR } from './constants';
import { isSystemFile, getDailyFileName, findSectionLine } from './utils/taskFileParser';
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

        // Lightweight refresh: sidebar tree only (no kanban panel re-read)
        vscode.commands.registerCommand('koban.refreshExplorer', async () => {
            await discoverSpaces();
            spaceExplorerProvider.refresh();
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

        // Move Task to another Space
        vscode.commands.registerCommand('koban.moveTaskToSpace', async (node) => {
            await moveTaskToSpace(node);
        }),

        // Move Meeting to another Space
        vscode.commands.registerCommand('koban.moveMeetingToSpace', async (node) => {
            await moveMeetingToSpace(node);
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
    // Dispose the Kanban panel to avoid stale service references
    if (KanbanPanel.currentPanel) { KanbanPanel.currentPanel.dispose(); }
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

    // Prevent overwriting existing space
    try {
        await vscode.workspace.fs.stat(spacePath);
        vscode.window.showErrorMessage(`A space with ID "${spaceId}" already exists.`);
        return;
    } catch {
        // Directory doesn't exist — good, proceed
    }

    const today = new Date().toISOString().split('T')[0];

    try {
        // Create space directory and hidden subdirs
        await vscode.workspace.fs.createDirectory(spacePath);
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(spacePath, TASKS_DIR));
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(spacePath, MEETINGS_DIR));

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

async function openKanbanBoard(_node?: any): Promise<void> {
    await discoverSpaces();
    const spaces = spaceService.getSpaces();
    if (spaces.length === 0) {
        vscode.window.showErrorMessage('No spaces found. Create a space first.');
        return;
    }

    // Always show all active spaces (fall back to all if none active)
    let targetSpaces = spaces.filter(s => s.status === 'active');
    if (targetSpaces.length === 0) {
        targetSpaces = spaces;
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
        const filter = KanbanPanel.currentPanel.spaceFilter;
        const allKnown = spaceService.getSpaces();
        // Respect the panel's space filter — only show spaces it was opened with
        const filtered = allKnown.filter(s => filter.includes(s.id));
        // Fall back to all active spaces if filtered set is empty (e.g., space was deleted)
        const spacesToShow = filtered.length > 0
            ? filtered
            : allKnown.filter(s => s.status === 'active').length > 0
                ? allKnown.filter(s => s.status === 'active')
                : allKnown;
        const boards = await Promise.all(
            spacesToShow.map(async (space) => ({
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
        const editor = await vscode.window.showTextDocument(doc);
        // Re-compute line number from disk to avoid stale cached values
        const freshLine = findSectionLine(doc.getText(), node.task.id);
        const line = Math.max(0, freshLine >= 0 ? freshLine : (node.task.lineNumber ?? 0));
        const range = new vscode.Range(line, 0, line, 0);
        editor.revealRange(range, vscode.TextEditorRevealType.AtTop);
        editor.selection = new vscode.Selection(line, 0, line, 0);
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

        const description = `Source: ${codeRef}\n\n\`\`\`\`\n${selectedText}\n\`\`\`\``;
        const task = await taskService.createTask(space.id, taskTitle);

        // Set description via taskService (serialized through write lock)
        await taskService.updateTask(task.id, { description });

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

async function moveTaskToSpace(node: any): Promise<void> {
    if (!node || !node.task) {
        return;
    }

    const spaces = spaceService.getSpaces().filter(s => s.id !== node.task.spaceId);
    if (spaces.length === 0) {
        vscode.window.showInformationMessage('No other spaces available.');
        return;
    }

    const items = spaces.map(s => ({ label: s.name, description: s.id, space: s }));
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Move task to which space?'
    });
    if (!selected) { return; }

    try {
        await taskService.moveTaskToSpace(node.task.id, selected.space.id);
        await refreshSpaces();
        vscode.window.showInformationMessage(`Task "${node.task.title}" moved to "${selected.space.name}".`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to move task: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function moveMeetingToSpace(node: any): Promise<void> {
    if (!node || !node.meeting) {
        return;
    }

    const spaces = spaceService.getSpaces().filter(s => s.id !== node.meeting.spaceId);
    if (spaces.length === 0) {
        vscode.window.showInformationMessage('No other spaces available.');
        return;
    }

    const items = spaces.map(s => ({ label: s.name, description: s.id, space: s }));
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Move meeting to which space?'
    });
    if (!selected) { return; }

    try {
        await taskService.moveMeetingToSpace(node.meeting.id, selected.space.id);
        await refreshSpaces();
        vscode.window.showInformationMessage(`Meeting "${node.meeting.title}" moved to "${selected.space.name}".`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to move meeting: ${error instanceof Error ? error.message : String(error)}`);
    }
}

async function openDailyNote(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open.');
        return;
    }

    const dailyDir = path.join(workspaceFolders[0].uri.fsPath, DAILY_DIR);
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const year = now.getFullYear();
    const filePath = path.join(dailyDir, getDailyFileName(year));
    const heading = `## ${today}`;

    try {
        await fileService.createDirectory(dailyDir);

        const exists = await fileService.fileExists(filePath);
        let content: string;

        if (!exists) {
            // Create year-file with frontmatter and today's entry
            content = `---\ntype: daily\nyear: ${year}\n---\n\n${heading}\n\n- **Good:** \n- **Not good:** \n- **Change:** \n`;
            await fileService.writeFile(filePath, content);
        } else {
            content = await fileService.readFile(filePath);
            if (!content.includes(heading)) {
                // Prepend today's entry after frontmatter
                const fmEnd = content.indexOf('\n---', 1);
                const insertIdx = fmEnd >= 0 ? fmEnd + 4 : 0;
                const before = content.slice(0, insertIdx);
                const after = content.slice(insertIdx);
                content = `${before}\n${heading}\n\n- **Good:** \n- **Not good:** \n- **Change:** \n${after}`;
                await fileService.writeFile(filePath, content);
            }
        }

        // Open and jump to today's heading
        const doc = await vscode.workspace.openTextDocument(filePath);
        const editor = await vscode.window.showTextDocument(doc);
        const lines = doc.getText().split('\n');
        const headingLineIdx = lines.findIndex(l => l.trim() === heading);
        if (headingLineIdx >= 0) {
            const range = new vscode.Range(headingLineIdx, 0, headingLineIdx, 0);
            editor.revealRange(range, vscode.TextEditorRevealType.AtTop);
            editor.selection = new vscode.Selection(headingLineIdx, 0, headingLineIdx, 0);
        }
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
        const exists = await fileService.fileExists(filePath);
        if (exists) {
            const doc = await vscode.workspace.openTextDocument(filePath);
            await vscode.window.showTextDocument(doc);
            return;
        }
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
    const SELF_WRITE_SUPPRESS_MS = 1000;
    const debouncedRefresh = () => {
        // Skip file-watcher refresh if the extension itself just wrote the file
        if (Date.now() - taskService.lastSelfWriteAt < SELF_WRITE_SUPPRESS_MS) { return; }
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
        '**/.tasks/tasks-*.md',
        '**/.tasks/archived-tasks-*.md',
        '**/.meetings/meetings-*.md',
        '.daily/daily-*.md',
        '.daily/archived-daily-*.md',
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
