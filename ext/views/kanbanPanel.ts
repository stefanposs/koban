/**
 * Kanban Board Webview Panel
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { Space, Task, Meeting, TaskStatus, KanbanColumnConfig, ITaskService, ISpaceService } from '../types';

interface SpaceBoard {
    space: Space;
    tasks: Task[];
    meetings: Meeting[];
}

export class KanbanPanel {
    public static currentPanel: KanbanPanel | undefined;
    public static readonly viewType = 'kobanKanban';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private _boards: SpaceBoard[];
    private _columns: KanbanColumnConfig[];
    private _taskService: ITaskService;
    private _spaceService: ISpaceService;

    public static createOrShow(
        extensionUri: vscode.Uri,
        boards: SpaceBoard[],
        columns: KanbanColumnConfig[],
        taskService: ITaskService,
        spaceService: ISpaceService
    ): KanbanPanel {
        const column = vscode.window.activeTextEditor
            ? vscode.ViewColumn.Beside
            : vscode.ViewColumn.One;

        const title = boards.length === 1 ? `Kanban: ${boards[0].space.name}` : 'Koban Board';

        // If we already have a panel, show it
        if (KanbanPanel.currentPanel) {
            KanbanPanel.currentPanel._panel.reveal(column);
            KanbanPanel.currentPanel.updateBoards(boards, columns);
            return KanbanPanel.currentPanel;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            KanbanPanel.viewType,
            title,
            column,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media')
                ],
                retainContextWhenHidden: true
            }
        );

        KanbanPanel.currentPanel = new KanbanPanel(panel, extensionUri, boards, columns, taskService, spaceService);
        return KanbanPanel.currentPanel;
    }

    private constructor(
        panel: vscode.WebviewPanel,
        extensionUri: vscode.Uri,
        boards: SpaceBoard[],
        columns: KanbanColumnConfig[],
        taskService: ITaskService,
        spaceService: ISpaceService
    ) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._boards = boards;
        this._columns = columns;
        this._taskService = taskService;
        this._spaceService = spaceService;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Update the content based on view changes
        this._panel.onDidChangeViewState(
            e => {
                if (this._panel.visible) {
                    this._update();
                }
            },
            null,
            this._disposables
        );

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.type) {
                    case 'moveTask':
                        await this._moveTask(message.taskId, message.newStatus);
                        break;
                    case 'openTask':
                        await this._openTask(message.taskId);
                        break;
                    case 'createTask':
                        await this._createTask(message.title, message.status, message.spaceId);
                        break;
                    case 'createMeeting':
                        await this._createMeeting(message.title, message.date, message.spaceId);
                        break;
                    case 'archiveTask':
                        await this._archiveTask(message.taskId);
                        break;
                    case 'deleteTask':
                        await this._deleteTask(message.taskId);
                        break;
                    case 'updateTask':
                        await this._updateTask(message.taskId, message.updates);
                        break;
                    case 'refresh':
                        await this._refresh();
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    public updateBoards(boards: SpaceBoard[], columns: KanbanColumnConfig[]): void {
        this._boards = boards;
        this._columns = columns;
        this._update();
    }

    public dispose(): void {
        KanbanPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update(): void {
        const webview = this._panel.webview;
        this._panel.title = 'Koban Board';
        webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview): string {
        // Local path to main script run in the webview
        const scriptPathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'kanban.js');
        const stylePathOnDisk = vscode.Uri.joinPath(this._extensionUri, 'media', 'kanban.css');

        // And the uri we use to load this script in the webview
        const scriptUri = webview.asWebviewUri(scriptPathOnDisk);
        const styleUri = webview.asWebviewUri(stylePathOnDisk);

        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        // Prepare boards data for JS
        const boardsData = this._boards.map(b => ({
            space: b.space,
            tasks: b.tasks,
            meetings: b.meetings
        }));

        const title = 'Koban Board';

        // Merge all tasks and meetings across spaces into one unified board
        const allTasks = this._boards.flatMap(b => b.tasks.filter(t => t.status !== 'archived').map(t => ({ ...t, spaceName: b.space.name, spaceId: b.space.id })));
        const allMeetings = this._boards.flatMap(b => b.meetings.map(m => ({ ...m, spaceName: b.space.name, spaceId: b.space.id })));
        const multiSpace = this._boards.length > 1;

        // Upcoming meetings
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const upcomingMeetings = allMeetings
            .filter(m => new Date(m.date) >= now)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(0, 8);

        // Tasks by column
        const tasksByColumn: Record<string, typeof allTasks> = {};
        this._columns.forEach(col => {
            tasksByColumn[col.id] = allTasks.filter(t => t.status === col.status);
        });
        const totalTasks = allTasks.length;
        const doneTasks = allTasks.filter(t => t.status === 'done').length;
        const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link href="${styleUri}" rel="stylesheet">
                <title>${this._escapeHtml(title)}</title>
            </head>
            <body>
                <div class="kanban-header">
                    <div class="kanban-header-left">
                        <h1>${this._escapeHtml(title)}</h1>
                        <span class="header-stats">${totalTasks} tasks · ${pct}%</span>
                    </div>
                    <div class="kanban-actions">
                        <button id="btn-add-task" class="btn-primary">+ Task</button>
                        <button id="btn-add-meeting" class="btn-secondary">📅 Meeting</button>
                        <button id="btn-refresh" class="btn-icon" title="Refresh">🔄</button>
                    </div>
                </div>

                ${upcomingMeetings.length > 0 ? `
                <div class="meetings-bar">
                    <span class="meetings-label">📅 Upcoming</span>
                    ${upcomingMeetings.map(m => `
                        <span class="meeting-chip" title="${this._escapeHtml(m.title)}${multiSpace ? ` (${this._escapeHtml(m.spaceName)})` : ''}">
                            <span class="meeting-date">${new Date(m.date).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}</span>
                            ${this._escapeHtml(m.title)}
                        </span>
                    `).join('')}
                </div>
                ` : ''}

                <div class="kanban-board">
                    ${this._columns.map(col => {
                        const colTasks = tasksByColumn[col.id] || [];
                        const isWipExceeded = col.wipLimit && colTasks.length > col.wipLimit;
                        const isDoneColumn = col.status === 'done';
                        return `
                        <div class="kanban-column ${isWipExceeded ? 'wip-exceeded' : ''}" data-column-id="${this._escapeAttr(col.id)}" data-status="${this._escapeAttr(col.status)}">
                            <div class="column-header" style="border-top-color: ${this._escapeAttr(col.color || '#6b7280')}">
                                <span class="column-title">${this._escapeHtml(col.name)}</span>
                                <span class="column-count">${colTasks.length}${col.wipLimit ? `/${col.wipLimit}` : ''}</span>
                                ${isWipExceeded ? '<span class="wip-warning">⚠ WIP</span>' : ''}
                            </div>
                            <div class="column-content" data-status="${this._escapeAttr(col.status)}">
                                ${colTasks.length === 0 ? '<div class="column-empty">No tasks</div>' : ''}
                                ${colTasks.map(task => `
                                    <div class="task-card" data-task-id="${this._escapeAttr(task.id)}" data-space-id="${this._escapeAttr(task.spaceId)}" draggable="true">
                                        <div class="task-header">
                                            <span class="task-priority priority-${this._escapeAttr(task.priority)}">${this._escapeHtml(task.priority.charAt(0).toUpperCase())}</span>
                                            ${multiSpace ? `<span class="task-space-label">${this._escapeHtml(task.spaceName)}</span>` : ''}
                                            <div class="task-actions">
                                                ${isDoneColumn ? `<button class="task-archive" data-task-id="${this._escapeAttr(task.id)}" title="Archive">📦</button>` : ''}
                                                <button class="task-menu" data-task-id="${this._escapeAttr(task.id)}">⋮</button>
                                            </div>
                                        </div>
                                        <div class="task-title">${this._escapeHtml(task.title)}</div>
                                        ${task.tags.length > 0 ? `
                                            <div class="task-tags">
                                                ${task.tags.map(tag => `<span class="tag">#${this._escapeHtml(tag)}</span>`).join('')}
                                            </div>
                                        ` : ''}
                                        <div class="task-footer">
                                            ${task.assignee ? `<span class="task-assignee">👤 ${this._escapeHtml(task.assignee)}</span>` : ''}
                                            ${task.dueDate ? `<span class="task-due ${this._isOverdue(task.dueDate) ? 'overdue' : ''}">📅 ${task.dueDate.toLocaleDateString()}</span>` : ''}
                                        </div>
                                    </div>
                                `).join('')}
                                <div class="quick-add">
                                    <input type="text" class="quick-add-input" placeholder="+ Add task..." data-status="${this._escapeAttr(col.status)}">
                                </div>
                            </div>
                        </div>
                    `;
                    }).join('')}
                </div>

                <!-- Add Task Modal -->
                <div id="add-task-modal" class="modal">
                    <div class="modal-content">
                        <span class="close" data-modal="add-task-modal">&times;</span>
                        <h2>New Task</h2>
                        <label class="modal-label">Space</label>
                        <select id="new-task-space">
                            ${this._boards.map(b => `<option value="${this._escapeAttr(b.space.id)}">${this._escapeHtml(b.space.name)}</option>`).join('')}
                        </select>
                        <label class="modal-label">Title</label>
                        <input type="text" id="new-task-title" placeholder="What needs to be done?" autofocus>
                        <label class="modal-label">Column</label>
                        <select id="new-task-status">
                            ${this._columns.map(col => `<option value="${this._escapeAttr(col.status)}">${this._escapeHtml(col.name)}</option>`).join('')}
                        </select>
                        <button id="btn-create-task" class="btn-primary btn-full">Create Task</button>
                    </div>
                </div>

                <!-- Add Meeting Modal -->
                <div id="add-meeting-modal" class="modal">
                    <div class="modal-content">
                        <span class="close" data-modal="add-meeting-modal">&times;</span>
                        <h2>📅 New Meeting</h2>
                        <label class="modal-label">Space</label>
                        <select id="new-meeting-space">
                            ${this._boards.map(b => `<option value="${this._escapeAttr(b.space.id)}">${this._escapeHtml(b.space.name)}</option>`).join('')}
                        </select>
                        <label class="modal-label">Title</label>
                        <input type="text" id="new-meeting-title" placeholder="Meeting name...">
                        <label class="modal-label">Date</label>
                        <input type="date" id="new-meeting-date" value="${new Date().toISOString().split('T')[0]}">
                        <button id="btn-create-meeting" class="btn-primary btn-full">Create Meeting</button>
                    </div>
                </div>

                <script nonce="${nonce}">
                    window.kanbanData = {
                        boards: ${this._safeJsonForHtml(boardsData)},
                        columns: ${this._safeJsonForHtml(this._columns)},
                        multiSpace: ${this._boards.length > 1}
                    };
                </script>
                <script nonce="${nonce}" src="${scriptUri}"></script>

                <div class="keyboard-hints">
                    <span><kbd>J</kbd><kbd>K</kbd> Navigate</span>
                    <span><kbd>Space</kbd> Open</span>
                    <span><kbd>1</kbd>-<kbd>4</kbd> Move to column</span>
                    <span><kbd>C</kbd> New task</span>
                </div>
            </body>
            </html>`;
    }

    private _escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    private _escapeAttr(text: string): string {
        return this._escapeHtml(String(text));
    }

    /** Safely serialize JSON for embedding in a <script> block (prevents </script> breakout) */
    private _safeJsonForHtml(data: unknown): string {
        return JSON.stringify(data)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026');
    }

    private _isOverdue(dueDate: Date): boolean {
        return new Date(dueDate) < new Date();
    }

    private _findTask(taskId: string): Task | undefined {
        for (const board of this._boards) {
            const task = board.tasks.find(t => t.id === taskId);
            if (task) { return task; }
        }
        return undefined;
    }

    private _findBoard(taskId: string): SpaceBoard | undefined {
        return this._boards.find(b => b.tasks.some(t => t.id === taskId));
    }

    private async _moveTask(taskId: string, newStatus: TaskStatus): Promise<void> {
        try {
            await this._taskService.updateTaskStatus(taskId, newStatus);
            const task = this._findTask(taskId);
            if (task) {
                task.status = newStatus;
                this._update();
            }
            vscode.commands.executeCommand('koban.refreshSpaces');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to move task: ${error}`);
        }
    }

    private async _openTask(taskId: string): Promise<void> {
        const task = this._findTask(taskId);
        if (task) {
            const doc = await vscode.workspace.openTextDocument(task.filePath);
            await vscode.window.showTextDocument(doc);
        }
    }

    private async _createTask(title: string, status: TaskStatus, spaceId?: string): Promise<void> {
        try {
            const targetSpaceId = spaceId || this._boards[0]?.space.id;
            if (!targetSpaceId) { return; }
            const task = await this._taskService.createTask(targetSpaceId, title, { status });
            const board = this._boards.find(b => b.space.id === targetSpaceId);
            if (board) {
                board.tasks.push(task);
            }
            this._update();
            vscode.commands.executeCommand('koban.refreshSpaces');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create task: ${error}`);
        }
    }

    private async _createMeeting(title: string, date: string, spaceId?: string): Promise<void> {
        try {
            const targetSpaceId = spaceId || this._boards[0]?.space.id;
            if (!targetSpaceId) { return; }
            const meeting = await this._taskService.createMeeting(targetSpaceId, title, date);
            const board = this._boards.find(b => b.space.id === targetSpaceId);
            if (board) {
                board.meetings.push(meeting);
            }
            this._update();
            vscode.commands.executeCommand('koban.refreshSpaces');
            // Open the meeting file
            const doc = await vscode.workspace.openTextDocument(meeting.filePath);
            await vscode.window.showTextDocument(doc);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create meeting: ${error}`);
        }
    }

    private async _deleteTask(taskId: string): Promise<void> {
        const confirm = await vscode.window.showWarningMessage(
            'Are you sure you want to delete this task?',
            'Delete',
            'Cancel'
        );

        if (confirm === 'Delete') {
            try {
                await this._taskService.deleteTask(taskId);
                for (const board of this._boards) {
                    board.tasks = board.tasks.filter(t => t.id !== taskId);
                }
                this._update();
                vscode.commands.executeCommand('koban.refreshSpaces');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to delete task: ${error}`);
            }
        }
    }

    private async _archiveTask(taskId: string): Promise<void> {
        try {
            await this._taskService.archiveTask(taskId);
            for (const board of this._boards) {
                board.tasks = board.tasks.filter(t => t.id !== taskId);
            }
            this._update();
            vscode.commands.executeCommand('koban.refreshSpaces');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to archive task: ${error}`);
        }
    }

    private async _updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
        try {
            if (updates.status) {
                await this._taskService.updateTaskStatus(taskId, updates.status);
            }
            await this._refresh();
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update task: ${error}`);
        }
    }

    private async _refresh(): Promise<void> {
        for (const board of this._boards) {
            board.tasks = await this._taskService.getTasksForSpace(board.space.id);
            board.meetings = await this._taskService.getMeetingsForSpace(board.space.id);
        }
        this._update();
    }
}

function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
