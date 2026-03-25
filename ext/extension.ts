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
import * as path from 'path';

let spaceService: SpaceService;
let taskService: TaskService;
let fileService: FileService;
let configService: ConfigService;
let spaceExplorerProvider: SpaceExplorerProvider;
let extensionUri: vscode.Uri;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Koban extension is now active');

    extensionUri = context.extensionUri;
    // Initialize services
    configService = new ConfigService();
    fileService = new FileService();
    spaceService = new SpaceService(fileService, configService);
    taskService = new TaskService(fileService, configService, spaceService);

    // Initialize Space Explorer Tree View
    spaceExplorerProvider = new SpaceExplorerProvider(spaceService, taskService);
    const treeView = vscode.window.createTreeView('kobanSpaces', {
        treeDataProvider: spaceExplorerProvider,
        showCollapseAll: true
    });

    // Set context to indicate Koban is initialized
    vscode.commands.executeCommand('setContext', 'kobanInitialized', true);

    // Register commands
    context.subscriptions.push(
        // Initialize Workspace
        vscode.commands.registerCommand('koban.initializeWorkspace', async () => {
            await initializeWorkspace();
        }),

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

        // Tree view
        treeView
    );

    // Watch for file changes
    setupFileWatcher(context);

    // Auto-open Kanban board when sidebar becomes visible
    const visibilityDisposable = treeView.onDidChangeVisibility(e => {
        if (e.visible && spaceService.getSpaces().length > 0) {
            openKanbanBoard();
        }
    });
    context.subscriptions.push(visibilityDisposable);

    // Initial space discovery (await to ensure tree view is populated on startup)
    await discoverSpaces();

    // Auto-open Kanban board if spaces exist (zero-click UX)
    const spaces = spaceService.getSpaces();
    if (spaces.length > 0) {
        openKanbanBoard();
    }
}

export function deactivate() {
    console.log('Koban extension is now deactivated');
}

async function initializeWorkspace(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
    }

    const rootPath = workspaceFolders[0].uri.fsPath;
    const rootUri = vscode.Uri.file(rootPath);
    const today = new Date().toISOString().split('T')[0];
    
    try {
        // Create .mkw directory for extension metadata
        const mkwPath = vscode.Uri.joinPath(rootUri, '.mkw');
        await vscode.workspace.fs.createDirectory(mkwPath);
        
        // Create initial config file
        const configContent = Buffer.from(`# Koban Workspace Configuration\nworkspace:\n  name: "${workspaceFolders[0].name}"\n  initialized: true\n  version: "0.1.0"\n`);
        await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(mkwPath, 'config.yml'), configContent);

        // Create a default "Getting Started" space with a sample task
        const spaceName = 'Getting Started';
        const spaceId = 'getting-started';
        const spacePath = vscode.Uri.joinPath(rootUri, spaceId);
        await vscode.workspace.fs.createDirectory(spacePath);

        const metaContent = Buffer.from(`---\ntype: space\nid: ${spaceId}\nname: ${spaceName}\nstatus: active\ncreated: ${today}\n---\n\n# ${spaceName}\n\nWelcome to Koban! This is your first space.\n\n## Quick Start\n- Open the Kanban board by clicking the space or pressing \`CMD+Shift+K\`\n- Create tasks with \`CMD+Shift+T\`\n- Select code, right-click → \"Create Koban Task from Selection\"\n`);
        await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(spacePath, '_meta.md'), metaContent);

        const tasksPath = vscode.Uri.joinPath(spacePath, '.tasks');
        const meetingsPath = vscode.Uri.joinPath(spacePath, '.meetings');
        await vscode.workspace.fs.createDirectory(tasksPath);
        await vscode.workspace.fs.createDirectory(meetingsPath);

        // Create sample task
        const taskId = `task-${Date.now()}`;
        const sampleTask = Buffer.from(`---\nid: ${taskId}\nspace: ${spaceId}\nstatus: todo\npriority: medium\ncreated: ${today}\n---\n\n# My First Task\n\n## Description\nThis is a sample task. Edit it or create new ones!\n\n## Checklist\n- [ ] Explore the Kanban board\n- [ ] Create a new task\n- [ ] Move a task between columns\n\n## Links\n- Related tasks:\n- External resources:\n`);
        await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(tasksPath, `${taskId}.md`), sampleTask);

        // Add .mkw to .gitignore if it exists
        await addToGitignore(rootPath, '.mkw/');

        vscode.window.showInformationMessage('Koban workspace initialized! 🚀');
        
        await discoverSpaces();
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to initialize workspace: ${error}`);
    }
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
        vscode.window.showErrorMessage(`Failed to create space: ${error}`);
    }
}

async function createNewTask(node?: any): Promise<void> {
    let spaceId: string | undefined;
    
    if (node && node.space) {
        spaceId = node.space.id;
    } else {
        // Show quick pick of available spaces, with default space pre-selected
        const spaces = await spaceService.getSpaces();
        if (spaces.length === 0) {
            vscode.window.showErrorMessage('No spaces found. Create a space first.');
            return;
        }
        
        if (spaces.length === 1) {
            // Only one space — use it directly
            spaceId = spaces[0].id;
        } else {
            const defaultSpaceId = configService.getDefaultSpaceId();
            const items = spaces.map(s => ({
                label: s.name,
                description: s.id === defaultSpaceId ? '(default)' : s.id,
                space: s
            }));
            // Put default space first
            if (defaultSpaceId) {
                items.sort((a, b) => (a.space.id === defaultSpaceId ? -1 : b.space.id === defaultSpaceId ? 1 : 0));
            }
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a space for the task'
            });
            if (!selected) { return; }
            spaceId = selected.space.id;
        }
    }

    const taskTitle = await vscode.window.showInputBox({
        prompt: 'Enter task title',
        placeHolder: 'e.g., Implement API endpoint'
    });

    if (!taskTitle || !spaceId) {
        return;
    }

    try {
        const task = await taskService.createTask(spaceId, taskTitle);
        vscode.window.showInformationMessage(`Task "${taskTitle}" created successfully!`);
        
        // Refresh the tree view
        await refreshSpaces();
        
        // Open the task file
        const doc = await vscode.workspace.openTextDocument(task.filePath);
        await vscode.window.showTextDocument(doc);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create task: ${error}`);
    }
}

async function createNewMeeting(node?: any): Promise<void> {
    let spaceId: string | undefined;
    
    if (node && node.space) {
        spaceId = node.space.id;
    } else {
        const spaces = await spaceService.getSpaces();
        if (spaces.length === 0) {
            vscode.window.showErrorMessage('No spaces found. Create a space first.');
            return;
        }
        
        const selected = await vscode.window.showQuickPick(
            spaces.map(s => ({ label: s.name, description: s.id, space: s })),
            { placeHolder: 'Select a space' }
        );
        
        if (!selected) {
            return;
        }
        spaceId = selected.space.id;
    }

    const meetingTitle = await vscode.window.showInputBox({
        prompt: 'Enter meeting title',
        placeHolder: 'e.g., Sprint Planning'
    });

    if (!meetingTitle || !spaceId) {
        return;
    }

    const meetingDate = await vscode.window.showInputBox({
        prompt: 'Enter meeting date (YYYY-MM-DD)',
        placeHolder: new Date().toISOString().split('T')[0],
        value: new Date().toISOString().split('T')[0]
    });

    if (!meetingDate) {
        return;
    }

    try {
        const meeting = await taskService.createMeeting(spaceId, meetingTitle, meetingDate);
        vscode.window.showInformationMessage(`Meeting "${meetingTitle}" created successfully!`);
        
        await refreshSpaces();
        
        const doc = await vscode.workspace.openTextDocument(meeting.filePath);
        await vscode.window.showTextDocument(doc);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create meeting: ${error}`);
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
        vscode.window.showErrorMessage(`Failed to delete task: ${error}`);
    }
}

async function moveTask(node: any, newStatus: string): Promise<void> {
    if (!node || !node.task) {
        return;
    }

    try {
        await taskService.updateTaskStatus(node.task.id, newStatus as any);
        await refreshSpaces();
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to move task: ${error}`);
    }
}

async function discoverSpaces(): Promise<void> {
    await spaceService.discoverSpaces();
    const spaces = spaceService.getSpaces();
    
    vscode.commands.executeCommand('setContext', 'workspaceHasKobanSpaces', spaces.length > 0);
    
    // Refresh the tree view to show discovered spaces
    spaceExplorerProvider.refresh();
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

    const spaces = spaceService.getSpaces();
    if (spaces.length === 0) {
        vscode.window.showErrorMessage('No spaces found. Create a space first.');
        return;
    }

    const selected = await vscode.window.showQuickPick(
        spaces.map(s => ({ label: s.name, description: s.id, space: s })),
        { placeHolder: 'Select a space for the new task' }
    );

    if (!selected) {
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

        const task = await taskService.createTask(selected.space.id, taskTitle);

        // Append code reference to the task file
        const taskContent = await fileService.readFile(task.filePath);
        const enhancedContent = taskContent.replace(
            '## Links\n- Related tasks:\n- External resources:',
            `## Links\n- Source: ${codeRef}\n\n## Code Reference\n\`\`\`\n${selectedText}\n\`\`\``
        );
        await fileService.writeFile(task.filePath, enhancedContent);

        vscode.window.showInformationMessage(`Task "${taskTitle}" created from selection!`);
        await refreshSpaces();
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to create task: ${error}`);
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
        vscode.window.showErrorMessage(`Failed to update space: ${error}`);
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
        vscode.window.showErrorMessage(`Failed to archive task: ${error}`);
    }
}

function setupFileWatcher(context: vscode.ExtensionContext): void {
    let debounceTimer: NodeJS.Timeout | undefined;
    const debouncedRefresh = () => {
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        debounceTimer = setTimeout(() => {
            refreshSpaces();
        }, 500);
    };

    // Use separate watchers for each detection method to avoid
    // unreliable nested ** inside brace expansions
    const watchPatterns = [
        '**/_meta.md',       // Frontmatter-based space detection
        '**/.tasks/**',      // Convention-based detection (tasks)
        '**/.meetings/**',   // Convention-based detection (meetings)
        '**/.mkw/**',        // Explicit detection (.yml and other files)
    ];

    for (const pattern of watchPatterns) {
        const watcher = vscode.workspace.createFileSystemWatcher(pattern);
        watcher.onDidCreate(debouncedRefresh);
        watcher.onDidDelete(debouncedRefresh);
        watcher.onDidChange(debouncedRefresh);
        context.subscriptions.push(watcher);
    }

    // Re-discover spaces when workspace folders are added or removed
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

async function addToGitignore(rootPath: string, entry: string): Promise<void> {
    const gitignorePath = path.join(rootPath, '.gitignore');
    try {
        const exists = await fileService.fileExists(gitignorePath);
        if (exists) {
            const content = await fileService.readFile(gitignorePath);
            if (!content.includes(entry)) {
                const newContent = content.endsWith('\n') ? `${content}${entry}\n` : `${content}\n${entry}\n`;
                await fileService.writeFile(gitignorePath, newContent);
            }
        } else {
            await fileService.writeFile(gitignorePath, `${entry}\n`);
        }
    } catch {
        // Silently ignore if .gitignore cannot be updated
    }
}
