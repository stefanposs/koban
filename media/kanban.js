/**
 * Kanban Board JavaScript
 * Keyboard-First Philosophy: J/K navigate, Space opens, 1-4 moves, C creates
 */

(function() {
    const vscode = acquireVsCodeApi();
    let draggedTask = null;
    let selectedTaskIndex = -1;
    let allTaskCards = [];

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
        initializeDragAndDrop();
        initializeEventListeners();
        initializeKeyboardNavigation();
        refreshTaskCardList();
    });

    function refreshTaskCardList() {
        allTaskCards = Array.from(document.querySelectorAll('.task-card'));
    }

    // =====================================================
    // Keyboard Navigation
    // =====================================================

    function initializeKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            // Don't capture keys when typing in inputs/modals
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
                if (e.key === 'Escape') {
                    closeAllModals();
                    e.target.blur();
                }
                return;
            }

            switch (e.key) {
                case 'j': // Next task
                    e.preventDefault();
                    navigateTask(1);
                    break;
                case 'k': // Previous task
                    e.preventDefault();
                    navigateTask(-1);
                    break;
                case ' ': // Open task details
                case 'Enter':
                    e.preventDefault();
                    openSelectedTask();
                    break;
                case 'c': // Create new task
                    e.preventDefault();
                    showAddTaskModal();
                    break;
                case 'm': // Create new meeting
                    e.preventDefault();
                    showAddMeetingModal();
                    break;
                case '1': // Move to column 1 (Todo)
                case '2': // Move to column 2 (In Progress)
                case '3': // Move to column 3 (Review)
                case '4': // Move to column 4 (Done)
                    e.preventDefault();
                    moveSelectedTaskToColumn(parseInt(e.key) - 1);
                    break;
                case 'a': // Archive selected task
                    e.preventDefault();
                    archiveSelectedTask();
                    break;
                case 'Escape':
                    clearSelection();
                    closeAllModals();
                    break;
                case 'Delete':
                case 'Backspace':
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        deleteSelectedTask();
                    }
                    break;
            }
        });
    }

    function navigateTask(direction) {
        refreshTaskCardList();
        if (allTaskCards.length === 0) { return; }

        // Remove previous selection
        if (selectedTaskIndex >= 0 && selectedTaskIndex < allTaskCards.length) {
            allTaskCards[selectedTaskIndex].classList.remove('selected');
        }

        // Move selection
        selectedTaskIndex += direction;
        if (selectedTaskIndex < 0) { selectedTaskIndex = allTaskCards.length - 1; }
        if (selectedTaskIndex >= allTaskCards.length) { selectedTaskIndex = 0; }

        // Apply selection
        const card = allTaskCards[selectedTaskIndex];
        card.classList.add('selected');
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function openSelectedTask() {
        if (selectedTaskIndex >= 0 && selectedTaskIndex < allTaskCards.length) {
            const taskId = allTaskCards[selectedTaskIndex].getAttribute('data-task-id');
            if (taskId) {
                vscode.postMessage({ type: 'openTask', taskId });
            }
        }
    }

    function moveSelectedTaskToColumn(columnIndex) {
        if (selectedTaskIndex < 0 || selectedTaskIndex >= allTaskCards.length) { return; }

        const columns = document.querySelectorAll('.kanban-column');
        if (columnIndex >= columns.length) { return; }

        const targetColumn = columns[columnIndex];
        const newStatus = targetColumn.getAttribute('data-status');
        const taskId = allTaskCards[selectedTaskIndex].getAttribute('data-task-id');

        if (taskId && newStatus) {
            vscode.postMessage({ type: 'moveTask', taskId, newStatus });
        }
    }

    function deleteSelectedTask() {
        if (selectedTaskIndex >= 0 && selectedTaskIndex < allTaskCards.length) {
            const taskId = allTaskCards[selectedTaskIndex].getAttribute('data-task-id');
            if (taskId) {
                vscode.postMessage({ type: 'deleteTask', taskId });
            }
        }
    }

    function archiveSelectedTask() {
        if (selectedTaskIndex >= 0 && selectedTaskIndex < allTaskCards.length) {
            const taskId = allTaskCards[selectedTaskIndex].getAttribute('data-task-id');
            if (taskId) {
                vscode.postMessage({ type: 'archiveTask', taskId });
            }
        }
    }

    function closeAllModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
    }

    function clearSelection() {
        allTaskCards.forEach(card => card.classList.remove('selected'));
        selectedTaskIndex = -1;
    }

    // =====================================================
    // Drag and Drop
    // =====================================================

    function initializeDragAndDrop() {
        const taskCards = document.querySelectorAll('.task-card');
        taskCards.forEach(card => {
            card.addEventListener('dragstart', handleDragStart);
            card.addEventListener('dragend', handleDragEnd);
        });

        const columns = document.querySelectorAll('.column-content');
        columns.forEach(column => {
            column.addEventListener('dragover', handleDragOver);
            column.addEventListener('dragleave', handleDragLeave);
            column.addEventListener('drop', handleDrop);
        });
    }

    function initializeEventListeners() {
        // Add task button
        const addTaskBtn = document.getElementById('btn-add-task');
        if (addTaskBtn) {
            addTaskBtn.addEventListener('click', showAddTaskModal);
        }

        // Add meeting button
        const addMeetingBtn = document.getElementById('btn-add-meeting');
        if (addMeetingBtn) {
            addMeetingBtn.addEventListener('click', showAddMeetingModal);
        }

        // Refresh button
        const refreshBtn = document.getElementById('btn-refresh');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                vscode.postMessage({ type: 'refresh' });
            });
        }

        // Modal close buttons (all modals)
        document.querySelectorAll('.modal .close').forEach(closeBtn => {
            closeBtn.addEventListener('click', () => {
                const modalId = closeBtn.getAttribute('data-modal');
                if (modalId) {
                    hideModal(modalId);
                } else {
                    hideAddTaskModal();
                }
            });
        });

        // Create task button
        const createTaskBtn = document.getElementById('btn-create-task');
        if (createTaskBtn) {
            createTaskBtn.addEventListener('click', createNewTask);
        }

        // Create meeting button
        const createMeetingBtn = document.getElementById('btn-create-meeting');
        if (createMeetingBtn) {
            createMeetingBtn.addEventListener('click', createNewMeeting);
        }

        // Task menu buttons
        const taskMenus = document.querySelectorAll('.task-menu');
        taskMenus.forEach(menu => {
            menu.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskId = menu.getAttribute('data-task-id');
                showTaskContextMenu(e, taskId);
            });
        });

        // Archive buttons
        const archiveBtns = document.querySelectorAll('.task-archive');
        archiveBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const taskId = btn.getAttribute('data-task-id');
                if (taskId) {
                    vscode.postMessage({ type: 'archiveTask', taskId });
                }
            });
        });

        // Task card click (open task)
        const taskCards = document.querySelectorAll('.task-card');
        taskCards.forEach((card, index) => {
            card.addEventListener('click', (e) => {
                if (!e.target.closest('.task-menu') && !e.target.closest('.context-menu') && !e.target.closest('.task-archive')) {
                    // Select the card visually
                    clearSelection();
                    selectedTaskIndex = index;
                    card.classList.add('selected');

                    // Single-click opens
                    const taskId = card.getAttribute('data-task-id');
                    vscode.postMessage({ type: 'openTask', taskId });
                }
            });
        });

        // Close modal when clicking outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });
        });

        // Enter key in task title input
        const taskTitleInput = document.getElementById('new-task-title');
        if (taskTitleInput) {
            taskTitleInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    createNewTask();
                }
            });
        }

        // Enter key in meeting title input
        const meetingTitleInput = document.getElementById('new-meeting-title');
        if (meetingTitleInput) {
            meetingTitleInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    createNewMeeting();
                }
            });
        }

        // Quick-add inputs in columns
        document.querySelectorAll('.quick-add-input').forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const title = input.value.trim();
                    if (title) {
                        const status = input.getAttribute('data-status') || 'todo';
                        const spaceId = input.getAttribute('data-space-id');
                        vscode.postMessage({ type: 'createTask', title, status, spaceId });
                        input.value = '';
                    }
                }
            });
        });

        // Close context menu on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.context-menu') && !e.target.closest('.task-menu')) {
                closeContextMenu();
            }
        });
    }

    function handleDragStart(e) {
        draggedTask = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', e.target.getAttribute('data-task-id'));
    }

    function handleDragEnd(e) {
        e.target.classList.remove('dragging');
        draggedTask = null;
        
        document.querySelectorAll('.column-content').forEach(col => {
            col.classList.remove('drag-over');
        });
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('drag-over');
    }

    function handleDragLeave(e) {
        if (e.currentTarget.classList.contains('column-content')) {
            e.currentTarget.classList.remove('drag-over');
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('drag-over');
        
        const taskId = e.dataTransfer.getData('text/plain');
        const newStatus = e.currentTarget.getAttribute('data-status');
        
        if (taskId && newStatus) {
            vscode.postMessage({ type: 'moveTask', taskId, newStatus });
        }
    }

    // =====================================================
    // Modal & Context Menu
    // =====================================================

    function showAddTaskModal() {
        const modal = document.getElementById('add-task-modal');
        if (modal) {
            modal.classList.add('show');
            const input = document.getElementById('new-task-title');
            if (input) {
                input.value = '';
                input.focus();
            }
        }
    }

    function hideAddTaskModal() {
        const modal = document.getElementById('add-task-modal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    function createNewTask() {
        const titleInput = document.getElementById('new-task-title');
        const statusSelect = document.getElementById('new-task-status');
        const spaceSelect = document.getElementById('new-task-space');
        
        const title = titleInput ? titleInput.value.trim() : '';
        const status = statusSelect ? statusSelect.value : 'todo';
        const spaceId = spaceSelect ? spaceSelect.value : (window.kanbanData.boards && window.kanbanData.boards[0] ? window.kanbanData.boards[0].space.id : undefined);
        
        if (title) {
            vscode.postMessage({ type: 'createTask', title, status, spaceId });
            hideAddTaskModal();
        }
    }

    // =====================================================
    // Meeting Modal
    // =====================================================

    function showAddMeetingModal() {
        const modal = document.getElementById('add-meeting-modal');
        if (modal) {
            modal.classList.add('show');
            const input = document.getElementById('new-meeting-title');
            if (input) {
                input.value = '';
                input.focus();
            }
        }
    }

    function hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
        }
    }

    function createNewMeeting() {
        const titleInput = document.getElementById('new-meeting-title');
        const dateInput = document.getElementById('new-meeting-date');
        const spaceSelect = document.getElementById('new-meeting-space');
        
        const title = titleInput ? titleInput.value.trim() : '';
        const date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
        const spaceId = spaceSelect ? spaceSelect.value : (window.kanbanData.boards && window.kanbanData.boards[0] ? window.kanbanData.boards[0].space.id : undefined);
        
        if (title) {
            vscode.postMessage({ type: 'createMeeting', title, date, spaceId });
            hideModal('add-meeting-modal');
        }
    }

    function showTaskContextMenu(e, taskId) {
        closeContextMenu();

        const columns = window.kanbanData.columns;
        const menu = document.createElement('div');
        menu.className = 'context-menu';

        function addMenuItem(label, action, attrs) {
            const item = document.createElement('div');
            item.className = 'context-menu-item';
            item.textContent = label;
            item.dataset.action = action;
            if (attrs) {
                for (const [k, v] of Object.entries(attrs)) {
                    item.dataset[k] = v;
                }
            }
            menu.appendChild(item);
        }

        addMenuItem('📄 Open', 'open');
        addMenuItem('📦 Archive', 'archive');
        addMenuItem('🗑️ Delete', 'delete');

        const divider = document.createElement('div');
        divider.className = 'context-menu-divider';
        menu.appendChild(divider);

        columns.forEach(col => {
            addMenuItem('→ ' + col.name, 'move', { status: col.status });
        });

        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        document.body.appendChild(menu);

        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', () => {
                const action = item.getAttribute('data-action');
                if (action === 'open') {
                    vscode.postMessage({ type: 'openTask', taskId });
                } else if (action === 'archive') {
                    vscode.postMessage({ type: 'archiveTask', taskId });
                } else if (action === 'delete') {
                    vscode.postMessage({ type: 'deleteTask', taskId });
                } else if (action === 'move') {
                    const newStatus = item.getAttribute('data-status');
                    vscode.postMessage({ type: 'moveTask', taskId, newStatus });
                }
                closeContextMenu();
            });
        });
    }

    function closeContextMenu() {
        const existing = document.querySelector('.context-menu');
        if (existing) { existing.remove(); }
    }

    // =====================================================
    // Messages from Extension
    // =====================================================

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'taskMoved':
            case 'taskCreated':
            case 'taskDeleted':
            case 'refresh':
                // Board will be re-rendered by the extension
                break;
        }
    });
})();
