/**
 * Kanban Board Webview Panel
 */

import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { Space, Task, Meeting, TaskStatus, KanbanColumnConfig, ITaskService, ISpaceService } from '../types';
import { findSectionLine } from '../utils/taskFileParser';

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
    /** Space IDs this panel was opened with, used to preserve filter on external refresh. */
    private _spaceFilter: string[];

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
                ]
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
        this._spaceFilter = boards.map(b => b.space.id);

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
                    case 'moveTask': {
                        const validStatuses: TaskStatus[] = ['todo', 'in-progress', 'review', 'done', 'blocked', 'archived'];
                        if (validStatuses.includes(message.newStatus as TaskStatus)) {
                            await this._moveTask(message.taskId, message.newStatus);
                        }
                        break;
                    }
                    case 'openTask':
                        await this._openTask(message.taskId);
                        break;
                    case 'createTask':
                        await this._createTask(message.title, message.status, message.spaceId);
                        break;
                    case 'createMeeting':
                        await this._createMeeting(message.title, message.date, message.spaceId, message.time);
                        break;
                    case 'archiveTask':
                        await this._archiveTask(message.taskId);
                        break;
                    case 'deleteTask':
                        await this._deleteTask(message.taskId);
                        break;
                    case 'moveTaskToSpace':
                        await this._moveTaskToSpace(message.taskId, message.targetSpaceId);
                        break;
                    case 'moveMeetingToSpace':
                        await this._moveMeetingToSpace(message.meetingId, message.targetSpaceId);
                        break;
                    case 'updateTask':
                        await this._updateTask(message.taskId, message.updates);
                        break;
                    case 'updateMeeting':
                        await this._updateMeeting(message.meetingId, message.updates);
                        break;
                    case 'refresh':
                        await this._refresh();
                        break;
                    case 'dailyNote':
                        await vscode.commands.executeCommand('koban.dailyNote');
                        break;
                    case 'quickCapture':
                        await vscode.commands.executeCommand('koban.quickCapture');
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
        this._spaceFilter = boards.map(b => b.space.id);
        this._update();
    }

    /** Returns the space IDs currently displayed on this panel. */
    public get spaceFilter(): string[] {
        return this._spaceFilter;
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
            space: { ...b.space, color: b.space.color },
            tasks: b.tasks,
            meetings: b.meetings
        }));

        const title = 'Koban Board';

        // Merge all tasks and meetings across spaces into one unified board
        const allTasks = this._boards.flatMap(b => b.tasks.filter(t => t.status !== 'archived').map(t => ({ ...t, spaceName: b.space.name, spaceId: b.space.id, spaceColor: b.space.color })));
        const allMeetings = this._boards.flatMap(b => b.meetings.map(m => ({ ...m, spaceName: b.space.name, spaceId: b.space.id, spaceColor: b.space.color })));
        const multiSpace = this._boards.length > 1;

        // Upcoming meetings: group by timeline
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const sortedMeetings = [...allMeetings].sort((a, b) => {
            const dateA = new Date(a.date);
            const dateB = new Date(b.date);
            if (dateA.getTime() !== dateB.getTime()) { return dateA.getTime() - dateB.getTime(); }
            // Meetings without time go to end of day group
            const timeA = (a as any).time || 'ZZ:ZZ';
            const timeB = (b as any).time || 'ZZ:ZZ';
            return timeA.localeCompare(timeB);
        });

        const upcomingMeetings = sortedMeetings.filter(m => new Date(m.date) >= now);
        const pastMeetings = sortedMeetings.filter(m => new Date(m.date) < now).reverse();

        // Timeline grouping helpers
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const endOfWeek = new Date(today);
        endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
        const endOfNextWeek = new Date(endOfWeek);
        endOfNextWeek.setDate(endOfNextWeek.getDate() + 7);

        const meetingGroups: { label: string; meetings: typeof allMeetings }[] = [];
        const todayMeetings = upcomingMeetings.filter(m => { const d = new Date(m.date); d.setHours(0,0,0,0); return d.getTime() === today.getTime(); });
        const tomorrowMeetings = upcomingMeetings.filter(m => { const d = new Date(m.date); d.setHours(0,0,0,0); return d.getTime() === tomorrow.getTime(); });
        const thisWeekMeetings = upcomingMeetings.filter(m => { const d = new Date(m.date); d.setHours(0,0,0,0); return d > tomorrow && d <= endOfWeek; });
        const nextWeekMeetings = upcomingMeetings.filter(m => { const d = new Date(m.date); d.setHours(0,0,0,0); return d > endOfWeek && d <= endOfNextWeek; });
        const laterMeetings = upcomingMeetings.filter(m => { const d = new Date(m.date); d.setHours(0,0,0,0); return d > endOfNextWeek; });

        if (todayMeetings.length > 0) { meetingGroups.push({ label: 'Today', meetings: todayMeetings }); }
        if (tomorrowMeetings.length > 0) { meetingGroups.push({ label: 'Tomorrow', meetings: tomorrowMeetings }); }
        if (thisWeekMeetings.length > 0) { meetingGroups.push({ label: 'This Week', meetings: thisWeekMeetings }); }
        if (nextWeekMeetings.length > 0) { meetingGroups.push({ label: 'Next Week', meetings: nextWeekMeetings }); }
        if (laterMeetings.length > 0) { meetingGroups.push({ label: 'Later', meetings: laterMeetings }); }

        // Tasks by column
        const tasksByColumn: Record<string, typeof allTasks> = {};
        this._columns.forEach(col => {
            tasksByColumn[col.id] = allTasks.filter(t => t.status === col.status);
        });
        const totalTasks = allTasks.length;
        const doneTasks = allTasks.filter(t => t.status === 'done').length;
        const pct = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

        const spaceInitials = (name: string) => {
            const words = name.split(/\s+/);
            if (words.length > 1) {
                return words.map(w => w[0]).join('').substring(0, 2).toUpperCase();
            }
            // Single word: use first 3 chars
            return name.substring(0, 3).toUpperCase();
        };

        // All spaces in workspace (for dropdowns — not just displayed boards)
        const allSpaces = this._spaceService.getSpaces().map(s => ({ id: s.id, name: s.name }));

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
                    <div class="kanban-header-top">
                        <div class="kanban-header-left">
                            <h1>${this._escapeHtml(title)}</h1>
                            <span class="header-stats">${totalTasks} tasks · ${pct}%</span>
                        </div>
                        <div class="kanban-toolbar">
                            <div class="toolbar-group toolbar-create">
                                <button id="btn-add-task" class="btn-action btn-action-primary" title="New Task (C)">+ Task</button>
                                <button id="btn-add-meeting" class="btn-action" title="New Meeting (M)">+ Meeting</button>
                            </div>
                            <div class="toolbar-separator"></div>
                            <div class="toolbar-group toolbar-utils">
                                <button id="btn-daily-note" class="btn-action" title="Open Daily Review">Daily</button>
                                <button id="btn-refresh" class="btn-icon" title="Refresh">↻</button>
                            </div>
                        </div>
                    </div>
                    <nav class="view-tabs">
                        <button class="view-tab active" data-view="kanban">Tasks</button>
                        <button class="view-tab" data-view="meetings">Meetings</button>
                    </nav>
                </div>

                <!-- KANBAN VIEW -->
                <div id="view-kanban" class="view-panel active">
                    ${upcomingMeetings.length > 0 ? `
                    <div class="meetings-bar">
                        <span class="meetings-label">📅 Upcoming</span>
                        ${upcomingMeetings.slice(0, 8).map(m => `
                            <span class="meeting-chip" title="${this._escapeHtml(m.title)}${multiSpace ? ` (${this._escapeHtml(m.spaceName)})` : ''}">
                                ${multiSpace ? `<span class="space-badge" title="${this._escapeAttr(m.spaceName)}" style="background-color: ${this._safeColor((m as any).spaceColor)}">${this._escapeHtml(spaceInitials(m.spaceName))}</span>` : ''}
                                <span class="meeting-date">${new Date(m.date).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}</span>
                                ${this._escapeHtml(m.title)}
                            </span>
                        `).join('')}
                    </div>
                    ` : ''}

                    <div class="kanban-board">
                        ${this._columns.map(col => {
                            const colTasks = tasksByColumn[col.id] || [];
                            const isDoneColumn = col.status === 'done';
                            return `
                            <div class="kanban-column" data-column-id="${this._escapeAttr(col.id)}" data-status="${this._escapeAttr(col.status)}">
                                <div class="column-header" style="border-top-color: ${this._safeColor(col.color)}">
                                    <span class="column-title">${this._escapeHtml(col.name)}</span>
                                    <span class="column-count">${colTasks.length}</span>
                                </div>
                                <div class="column-content" data-status="${this._escapeAttr(col.status)}">
                                    ${colTasks.length === 0 ? '<div class="column-empty">No tasks</div>' : ''}
                                    ${colTasks.map(task => `
                                        <div class="task-card" data-task-id="${this._escapeAttr(task.id)}" data-space-id="${this._escapeAttr(task.spaceId)}" draggable="true">
                                            <div class="task-header">
                                                <span class="priority-dot priority-${this._escapeAttr(task.priority)}" title="${this._escapeHtml(task.priority)}"></span>
                                                ${multiSpace ? `<span class="space-badge" title="${this._escapeAttr(task.spaceName)}" style="background-color: ${this._safeColor((task as any).spaceColor)}">${this._escapeHtml(spaceInitials(task.spaceName))}</span>` : ''}
                                                <div class="task-actions">
                                                    ${isDoneColumn ? `<button class="task-archive" data-task-id="${this._escapeAttr(task.id)}" title="Archive">📦</button>` : ''}
                                                    <button class="task-menu" data-task-id="${this._escapeAttr(task.id)}">⋮</button>
                                                </div>
                                            </div>
                                            <div class="task-title">${this._escapeHtml(task.title)}</div>
                                            ${task.description ? `<div class="task-description">${this._escapeHtml(task.description.substring(0, 80))}${task.description.length > 80 ? '…' : ''}</div>` : ''}
                                            ${task.tags.length > 0 ? `
                                                <div class="task-tags">
                                                    ${task.tags.map(tag => `<span class="tag">#${this._escapeHtml(tag)}</span>`).join('')}
                                                </div>
                                            ` : ''}
                                            <div class="task-footer">
                                                ${task.assignee ? `<span class="task-assignee">👤 ${this._escapeHtml(task.assignee)}</span>` : ''}
                                                ${task.dueDate ? `<span class="task-due ${this._isOverdue(task.dueDate) ? 'overdue' : ''}">📅 ${new Date(task.dueDate).toLocaleDateString()}</span>` : ''}
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
                </div>

                <!-- MEETINGS VIEW -->
                <div id="view-meetings" class="view-panel">
                    <div class="meetings-timeline">
                        ${meetingGroups.map(group => `
                            <div class="timeline-group">
                                <div class="timeline-group-header sticky-header">${this._escapeHtml(group.label)}</div>
                                ${group.meetings.map(m => `
                                    <div class="meeting-card" data-meeting-id="${this._escapeAttr(m.id)}" data-space-id="${this._escapeAttr(m.spaceId)}">
                                        <div class="meeting-card-header">
                                            ${multiSpace ? `<span class="space-badge" title="${this._escapeAttr(m.spaceName)}" style="background-color: ${this._safeColor((m as any).spaceColor)}">${this._escapeHtml(spaceInitials(m.spaceName))}</span>` : ''}
                                            <span class="meeting-card-date">${new Date(m.date).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: '2-digit' })}${(m as any).time ? ` · ${this._escapeHtml((m as any).time)}` : ''}</span>
                                            ${m.duration ? `<span class="meeting-duration">${m.duration}m</span>` : ''}
                                        </div>
                                        <div class="meeting-card-title">${this._escapeHtml(m.title)}</div>
                                        ${(m as any).tags?.length ? `<div class="task-tags">${(m as any).tags.map((t: string) => `<span class="tag">#${this._escapeHtml(t)}</span>`).join('')}</div>` : ''}
                                        ${m.attendees?.length ? `<div class="meeting-attendees">👥 ${m.attendees.map(a => this._escapeHtml(a)).join(', ')}</div>` : ''}
                                    </div>
                                `).join('')}
                            </div>
                        `).join('')}

                        ${meetingGroups.length === 0 ? '<div class="column-empty" style="padding:40px">No upcoming meetings</div>' : ''}

                        ${pastMeetings.length > 0 ? `
                            <details class="past-meetings-section">
                                <summary class="timeline-group-header past-header">Past Meetings (${pastMeetings.length})</summary>
                                ${pastMeetings.slice(0, 20).map(m => `
                                    <div class="meeting-card past" data-meeting-id="${this._escapeAttr(m.id)}" data-space-id="${this._escapeAttr(m.spaceId)}">
                                        <div class="meeting-card-header">
                                            ${multiSpace ? `<span class="space-badge" title="${this._escapeAttr(m.spaceName)}" style="background-color: ${this._safeColor((m as any).spaceColor)}">${this._escapeHtml(spaceInitials(m.spaceName))}</span>` : ''}
                                            <span class="meeting-card-date">${new Date(m.date).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: '2-digit' })}${(m as any).time ? ` · ${this._escapeHtml((m as any).time)}` : ''}</span>
                                        </div>
                                        <div class="meeting-card-title">${this._escapeHtml(m.title)}</div>
                                    </div>
                                `).join('')}
                                ${pastMeetings.length > 20 ? `<div class="load-more-hint">${pastMeetings.length - 20} more past meetings</div>` : ''}
                            </details>
                        ` : ''}
                    </div>
                </div>

                <!-- Add Task Modal -->
                <div id="add-task-modal" class="modal">
                    <div class="modal-content">
                        <span class="close" data-modal="add-task-modal">&times;</span>
                        <h2>New Task</h2>
                        <label class="modal-label">Space</label>
                        <select id="new-task-space">
                            ${allSpaces.map(s => `<option value="${this._escapeAttr(s.id)}">${this._escapeHtml(s.name)}</option>`).join('')}
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
                            ${allSpaces.map(s => `<option value="${this._escapeAttr(s.id)}">${this._escapeHtml(s.name)}</option>`).join('')}
                        </select>
                        <label class="modal-label">Title</label>
                        <input type="text" id="new-meeting-title" placeholder="Meeting name...">
                        <label class="modal-label">Date</label>
                        <input type="date" id="new-meeting-date" value="${new Date().toISOString().split('T')[0]}">
                        <label class="modal-label">Time (optional)</label>
                        <input type="time" id="new-meeting-time" placeholder="HH:MM">
                        <button id="btn-create-meeting" class="btn-primary btn-full">Create Meeting</button>
                    </div>
                </div>

                <!-- Edit Task Modal -->
                <div id="edit-task-modal" class="modal">
                    <div class="modal-content">
                        <span class="close" data-modal="edit-task-modal">&times;</span>
                        <h2>Edit Task</h2>
                        <input type="hidden" id="edit-task-id">
                        <label class="modal-label">Title</label>
                        <input type="text" id="edit-task-title">
                        <label class="modal-label">Priority</label>
                        <select id="edit-task-priority">
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                        </select>
                        <label class="modal-label">Due Date</label>
                        <input type="date" id="edit-task-due">
                        <label class="modal-label">Description</label>
                        <textarea id="edit-task-description" rows="3" placeholder="Task description..."></textarea>
                        <label class="modal-label">Status</label>
                        <select id="edit-task-status">
                            ${this._columns.map(col => `<option value="${this._escapeAttr(col.status)}">${this._escapeHtml(col.name)}</option>`).join('')}
                        </select>
                        <label class="modal-label">Space</label>
                        <select id="edit-task-space">
                            ${allSpaces.map(s => `<option value="${this._escapeAttr(s.id)}">${this._escapeHtml(s.name)}</option>`).join('')}
                        </select>
                        <button id="btn-save-task" class="btn-primary btn-full">Save</button>
                    </div>
                </div>

                <!-- Edit Meeting Modal -->
                <div id="edit-meeting-modal" class="modal">
                    <div class="modal-content">
                        <span class="close" data-modal="edit-meeting-modal">&times;</span>
                        <h2>📅 Edit Meeting</h2>
                        <input type="hidden" id="edit-meeting-id">
                        <label class="modal-label">Title</label>
                        <input type="text" id="edit-meeting-title">
                        <label class="modal-label">Date</label>
                        <input type="date" id="edit-meeting-date">
                        <label class="modal-label">Time</label>
                        <input type="time" id="edit-meeting-time">
                        <label class="modal-label">Space</label>
                        <select id="edit-meeting-space">
                            ${allSpaces.map(s => `<option value="${this._escapeAttr(s.id)}">${this._escapeHtml(s.name)}</option>`).join('')}
                        </select>
                        <button id="btn-save-meeting" class="btn-primary btn-full">Save</button>
                    </div>
                </div>

                <!-- Search Bar -->
                <div id="search-overlay" class="search-overlay">
                    <input type="text" id="search-input" class="search-input" placeholder="Search tasks and meetings...">
                </div>

                <script nonce="${nonce}">
                    window.kanbanData = {
                        boards: ${this._safeJsonForHtml(boardsData)},
                        columns: ${this._safeJsonForHtml(this._columns)},
                        spaces: ${this._safeJsonForHtml(allSpaces)},
                        multiSpace: ${allSpaces.length > 1}
                    };
                </script>
                <script nonce="${nonce}" src="${scriptUri}"></script>

                <div class="keyboard-hints">
                    <span><kbd>J</kbd><kbd>K</kbd> Navigate</span>
                    <span><kbd>Space</kbd> Open</span>
                    <span><kbd>E</kbd> Edit</span>
                    <span><kbd>1</kbd>-<kbd>4</kbd> Move to column</span>
                    <span><kbd>C</kbd> New task</span>
                    <span><kbd>/</kbd> Search</span>
                </div>
            </body>
            </html>`;
    }

    private _escapeHtml(text: string | undefined | null): string {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    private _escapeAttr(text: string): string {
        return this._escapeHtml(String(text));
    }

    /** Validate color as hex to prevent CSS injection */
    private _safeColor(color: string | undefined): string {
        return color && /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : '#6b7280';
    }

    /** Safely serialize JSON for embedding in a <script> block (prevents </script> breakout) */
    private _safeJsonForHtml(data: unknown): string {
        return JSON.stringify(data)
            .replace(/</g, '\\u003c')
            .replace(/>/g, '\\u003e')
            .replace(/&/g, '\\u0026');
    }

    private _isOverdue(dueDate: Date): boolean {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const due = new Date(dueDate);
        due.setHours(0, 0, 0, 0);
        return due < today;
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

    private _findMeeting(meetingId: string): Meeting | undefined {
        for (const board of this._boards) {
            const meeting = board.meetings.find(m => m.id === meetingId);
            if (meeting) { return meeting; }
        }
        return undefined;
    }

    private async _moveTask(taskId: string, newStatus: TaskStatus): Promise<void> {
        try {
            await this._taskService.updateTaskStatus(taskId, newStatus);
            await this._refresh();
            vscode.commands.executeCommand('koban.refreshExplorer');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to move task: ${error}`);
        }
    }

    private async _openTask(taskId: string): Promise<void> {
        const item = this._findTask(taskId) || this._findMeeting(taskId);
        if (item) {
            const doc = await vscode.workspace.openTextDocument(item.filePath);
            const editor = await vscode.window.showTextDocument(doc);
            // Re-compute line number from disk to avoid stale cached values
            const freshLine = findSectionLine(doc.getText(), taskId);
            const line = Math.max(0, freshLine >= 0 ? freshLine : (item.lineNumber ?? 0));
            const range = new vscode.Range(line, 0, line, 0);
            editor.revealRange(range, vscode.TextEditorRevealType.AtTop);
            editor.selection = new vscode.Selection(line, 0, line, 0);
        }
    }

    private async _createTask(title: string, status: TaskStatus, spaceId?: string): Promise<void> {
        try {
            const targetSpaceId = spaceId || this._boards[0]?.space.id;
            if (!targetSpaceId) { return; }
            await this._taskService.createTask(targetSpaceId, title, { status });
            await this._refresh();
            vscode.commands.executeCommand('koban.refreshExplorer');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to create task: ${error}`);
        }
    }

    private async _createMeeting(title: string, date: string, spaceId?: string, time?: string): Promise<void> {
        try {
            const targetSpaceId = spaceId || this._boards[0]?.space.id;
            if (!targetSpaceId) { return; }
            const meeting = await this._taskService.createMeeting(targetSpaceId, title, date, time ? { time } : undefined);
            await this._refresh();
            vscode.commands.executeCommand('koban.refreshExplorer');
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
                await this._refresh();
                vscode.commands.executeCommand('koban.refreshExplorer');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to delete task: ${error}`);
            }
        }
    }

    private async _archiveTask(taskId: string): Promise<void> {
        try {
            await this._taskService.archiveTask(taskId);
            await this._refresh();
            vscode.commands.executeCommand('koban.refreshExplorer');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to archive task: ${error}`);
        }
    }

    private async _updateTask(taskId: string, updates: { title?: string; priority?: string; due?: string; status?: string; description?: string; targetSpaceId?: string }): Promise<void> {
        // Handle space move separately so field updates still apply on move failure
        if (updates.targetSpaceId) {
            const validSpaces = this._spaceService.getSpaces();
            if (!validSpaces.some(s => s.id === updates.targetSpaceId)) {
                vscode.window.showErrorMessage(`Invalid target space: ${updates.targetSpaceId}`);
                return;
            }
            const task = this._findTask(taskId);
            if (task && task.spaceId !== updates.targetSpaceId) {
                try {
                    await this._taskService.moveTaskToSpace(taskId, updates.targetSpaceId);
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to move task: ${error}`);
                }
            }
        }

        try {
            // Update fields
            const fieldUpdates: { title?: string; priority?: string; due?: string; status?: string; description?: string } = {};
            if (updates.title) { fieldUpdates.title = updates.title; }
            if (updates.priority) { fieldUpdates.priority = updates.priority; }
            if (updates.due !== undefined) { fieldUpdates.due = updates.due; }
            if (updates.status) { fieldUpdates.status = updates.status; }
            if (updates.description !== undefined) { fieldUpdates.description = updates.description; }

            if (Object.keys(fieldUpdates).length > 0) {
                await this._taskService.updateTask(taskId, fieldUpdates);
            }

            await this._refresh();
            vscode.commands.executeCommand('koban.refreshExplorer');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update task: ${error}`);
        }
    }

    private async _updateMeeting(meetingId: string, updates: { title?: string; date?: string; time?: string; targetSpaceId?: string }): Promise<void> {
        // Handle space move separately so field updates still apply on move failure
        if (updates.targetSpaceId) {
            const validSpaces = this._spaceService.getSpaces();
            if (!validSpaces.some(s => s.id === updates.targetSpaceId)) {
                vscode.window.showErrorMessage(`Invalid target space: ${updates.targetSpaceId}`);
                return;
            }
            const meeting = this._findMeeting(meetingId);
            if (meeting && meeting.spaceId !== updates.targetSpaceId) {
                try {
                    await this._taskService.moveMeetingToSpace(meetingId, updates.targetSpaceId);
                } catch (error) {
                    vscode.window.showErrorMessage(`Failed to move meeting: ${error}`);
                }
            }
        }

        try {
            // Update fields
            const fieldUpdates: { title?: string; date?: string; time?: string } = {};
            if (updates.title) { fieldUpdates.title = updates.title; }
            if (updates.date) { fieldUpdates.date = updates.date; }
            if (updates.time !== undefined) { fieldUpdates.time = updates.time; }

            if (Object.keys(fieldUpdates).length > 0) {
                await this._taskService.updateMeeting(meetingId, fieldUpdates);
            }

            await this._refresh();
            vscode.commands.executeCommand('koban.refreshExplorer');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to update meeting: ${error}`);
        }
    }

    private async _moveTaskToSpace(taskId: string, targetSpaceId: string): Promise<void> {
        try {
            await this._taskService.moveTaskToSpace(taskId, targetSpaceId);
            await this._refresh();
            vscode.commands.executeCommand('koban.refreshExplorer');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to move task: ${error}`);
        }
    }

    private async _moveMeetingToSpace(meetingId: string, targetSpaceId: string): Promise<void> {
        try {
            await this._taskService.moveMeetingToSpace(meetingId, targetSpaceId);
            await this._refresh();
            vscode.commands.executeCommand('koban.refreshExplorer');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to move meeting: ${error}`);
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
    return crypto.randomBytes(16).toString('base64url');
}
