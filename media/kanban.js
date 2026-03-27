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
        initializeViewToggle();
        initializeSearchInput();
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
                case 'e': // Edit selected task
                    e.preventDefault();
                    editSelectedTask();
                    break;
                case 'Escape':
                    clearSelection();
                    closeAllModals();
                    closeSearch();
                    break;
                case 'Delete':
                case 'Backspace':
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        deleteSelectedTask();
                    }
                    break;
                case '/':
                    e.preventDefault();
                    toggleSearch();
                    break;
            }
        });
    }

    // =====================================================
    // View Toggle (Tasks / Meetings)
    // =====================================================

    function initializeViewToggle() {
        document.querySelectorAll('.view-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.getAttribute('data-view');
                document.querySelectorAll('.view-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
                const panel = document.getElementById('view-' + view);
                if (panel) { panel.classList.add('active'); }
            });
        });

        // Meeting card clicks → open meeting in editor
        document.querySelectorAll('.meeting-card').forEach(card => {
            card.addEventListener('click', () => {
                const meetingId = card.getAttribute('data-meeting-id');
                if (meetingId) {
                    vscode.postMessage({ type: 'openTask', taskId: meetingId });
                }
            });
            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const meetingId = card.getAttribute('data-meeting-id');
                if (meetingId) {
                    showMeetingContextMenu(e, meetingId, card.getAttribute('data-space-id'));
                }
            });
        });
    }

    // =====================================================
    // Search
    // =====================================================

    function toggleSearch() {
        const overlay = document.getElementById('search-overlay');
        if (!overlay) { return; }
        if (overlay.classList.contains('show')) {
            closeSearch();
        } else {
            overlay.classList.add('show');
            const input = document.getElementById('search-input');
            if (input) { input.value = ''; input.focus(); }
        }
    }

    function closeSearch() {
        const overlay = document.getElementById('search-overlay');
        if (overlay) {
            overlay.classList.remove('show');
            // Reset visibility
            document.querySelectorAll('.task-card, .meeting-card').forEach(el => {
                el.style.display = '';
            });
        }
    }

    function initializeSearchInput() {
        const input = document.getElementById('search-input');
        if (!input) { return; }
        input.addEventListener('input', () => {
            const q = input.value.toLowerCase().trim();
            // Filter task cards
            document.querySelectorAll('.task-card').forEach(card => {
                const title = (card.querySelector('.task-title')?.textContent || '').toLowerCase();
                const tags = (card.querySelector('.task-tags')?.textContent || '').toLowerCase();
                card.style.display = (!q || title.includes(q) || tags.includes(q)) ? '' : 'none';
            });
            // Filter meeting cards
            document.querySelectorAll('.meeting-card').forEach(card => {
                const title = (card.querySelector('.meeting-card-title')?.textContent || '').toLowerCase();
                const attendees = (card.querySelector('.meeting-attendees')?.textContent || '').toLowerCase();
                card.style.display = (!q || title.includes(q) || attendees.includes(q)) ? '' : 'none';
            });
        });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeSearch();
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

    function editSelectedTask() {
        if (selectedTaskIndex >= 0 && selectedTaskIndex < allTaskCards.length) {
            const taskId = allTaskCards[selectedTaskIndex].getAttribute('data-task-id');
            if (taskId) {
                showEditTaskModal(taskId);
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

        // Daily Note button
        const dailyNoteBtn = document.getElementById('btn-daily-note');
        if (dailyNoteBtn) {
            dailyNoteBtn.addEventListener('click', () => {
                vscode.postMessage({ type: 'dailyNote' });
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

        // Save edit task button
        const saveTaskBtn = document.getElementById('btn-save-task');
        if (saveTaskBtn) {
            saveTaskBtn.addEventListener('click', saveEditTask);
        }

        // Save edit meeting button
        const saveMeetingBtn = document.getElementById('btn-save-meeting');
        if (saveMeetingBtn) {
            saveMeetingBtn.addEventListener('click', saveEditMeeting);
        }

        // Enter key in edit task title
        const editTaskTitle = document.getElementById('edit-task-title');
        if (editTaskTitle) {
            editTaskTitle.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') { saveEditTask(); }
            });
        }

        // Enter key in edit meeting title
        const editMeetingTitle = document.getElementById('edit-meeting-title');
        if (editMeetingTitle) {
            editMeetingTitle.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') { saveEditMeeting(); }
            });
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
        const timeInput = document.getElementById('new-meeting-time');
        const spaceSelect = document.getElementById('new-meeting-space');
        
        const title = titleInput ? titleInput.value.trim() : '';
        const date = dateInput ? dateInput.value : new Date().toISOString().split('T')[0];
        const time = timeInput ? timeInput.value : '';
        const spaceId = spaceSelect ? spaceSelect.value : (window.kanbanData.boards && window.kanbanData.boards[0] ? window.kanbanData.boards[0].space.id : undefined);
        
        if (title) {
            const msg = { type: 'createMeeting', title, date, spaceId };
            if (time) { msg.time = time; }
            vscode.postMessage(msg);
            hideModal('add-meeting-modal');
        }
    }

    function showTaskContextMenu(e, taskId) {
        closeContextMenu();

        const columns = window.kanbanData.columns;
        const spaces = window.kanbanData.spaces || [];
        const taskCard = e.target.closest('.task-card');
        const currentSpaceId = taskCard ? taskCard.getAttribute('data-space-id') : null;
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
        addMenuItem('✏️ Edit', 'edit');
        addMenuItem('📦 Archive', 'archive');
        addMenuItem('🗑️ Delete', 'delete');

        const divider = document.createElement('div');
        divider.className = 'context-menu-divider';
        menu.appendChild(divider);

        columns.forEach(col => {
            addMenuItem('→ ' + col.name, 'move', { status: col.status });
        });

        // Move to Space (only if multiple spaces)
        if (spaces.length > 1) {
            const spaceDivider = document.createElement('div');
            spaceDivider.className = 'context-menu-divider';
            menu.appendChild(spaceDivider);

            spaces.filter(s => s.id !== currentSpaceId).forEach(s => {
                addMenuItem('📁 → ' + s.name, 'moveToSpace', { targetSpaceId: s.id });
            });
        }

        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        document.body.appendChild(menu);

        // Clamp to viewport bounds
        const rect = menu.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menu.style.left = Math.max(0, window.innerWidth - rect.width) + 'px';
        }
        if (rect.bottom > window.innerHeight) {
            menu.style.top = Math.max(0, window.innerHeight - rect.height) + 'px';
        }

        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = item.getAttribute('data-action');
                if (action === 'open') {
                    vscode.postMessage({ type: 'openTask', taskId });
                } else if (action === 'edit') {
                    closeContextMenu();
                    showEditTaskModal(taskId);
                    return;
                } else if (action === 'archive') {
                    vscode.postMessage({ type: 'archiveTask', taskId });
                } else if (action === 'delete') {
                    vscode.postMessage({ type: 'deleteTask', taskId });
                } else if (action === 'move') {
                    const newStatus = item.getAttribute('data-status');
                    vscode.postMessage({ type: 'moveTask', taskId, newStatus });
                } else if (action === 'moveToSpace') {
                    const targetSpaceId = item.getAttribute('data-target-space-id');
                    vscode.postMessage({ type: 'moveTaskToSpace', taskId, targetSpaceId });
                }
                closeContextMenu();
            });
        });
    }

    function closeContextMenu() {
        const existing = document.querySelector('.context-menu');
        if (existing) { existing.remove(); }
    }

    function showMeetingContextMenu(e, meetingId, currentSpaceId) {
        closeContextMenu();

        const spaces = window.kanbanData.spaces || [];
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
        addMenuItem('✏️ Edit', 'edit');

        // Move to Space (only if multiple spaces)
        if (spaces.length > 1) {
            const divider = document.createElement('div');
            divider.className = 'context-menu-divider';
            menu.appendChild(divider);

            spaces.filter(s => s.id !== currentSpaceId).forEach(s => {
                addMenuItem('📁 → ' + s.name, 'moveToSpace', { targetSpaceId: s.id });
            });
        }

        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        document.body.appendChild(menu);

        // Clamp to viewport bounds
        const mRect = menu.getBoundingClientRect();
        if (mRect.right > window.innerWidth) {
            menu.style.left = Math.max(0, window.innerWidth - mRect.width) + 'px';
        }
        if (mRect.bottom > window.innerHeight) {
            menu.style.top = Math.max(0, window.innerHeight - mRect.height) + 'px';
        }

        menu.querySelectorAll('.context-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = item.getAttribute('data-action');
                if (action === 'open') {
                    vscode.postMessage({ type: 'openTask', taskId: meetingId });
                } else if (action === 'edit') {
                    closeContextMenu();
                    showEditMeetingModal(meetingId);
                    return;
                } else if (action === 'moveToSpace') {
                    const targetSpaceId = item.getAttribute('data-target-space-id');
                    vscode.postMessage({ type: 'moveMeetingToSpace', meetingId, targetSpaceId });
                }
                closeContextMenu();
            });
        });
    }

    // =====================================================
    // Edit Task / Meeting Modals
    // =====================================================

    function findTaskData(taskId) {
        const data = window.kanbanData;
        if (!data || !data.boards) { return null; }
        for (const board of data.boards) {
            const task = (board.tasks || []).find(t => t.id === taskId);
            if (task) { return { ...task, spaceId: board.space.id }; }
        }
        return null;
    }

    function findMeetingData(meetingId) {
        const data = window.kanbanData;
        if (!data || !data.boards) { return null; }
        for (const board of data.boards) {
            const meeting = (board.meetings || []).find(m => m.id === meetingId);
            if (meeting) { return { ...meeting, spaceId: board.space.id }; }
        }
        return null;
    }

    function showEditTaskModal(taskId) {
        const task = findTaskData(taskId);
        if (!task) { return; }

        const modal = document.getElementById('edit-task-modal');
        if (!modal) { return; }

        document.getElementById('edit-task-id').value = taskId;
        document.getElementById('edit-task-title').value = task.title || '';
        const prioritySelect = document.getElementById('edit-task-priority');
        if (prioritySelect) { prioritySelect.value = task.priority || 'medium'; }
        const dueInput = document.getElementById('edit-task-due');
        if (dueInput) {
            dueInput.value = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '';
        }
        const statusSelect = document.getElementById('edit-task-status');
        if (statusSelect) { statusSelect.value = task.status || 'todo'; }
        const descInput = document.getElementById('edit-task-description');
        if (descInput) { descInput.value = task.description || ''; }
        const spaceSelect = document.getElementById('edit-task-space');
        if (spaceSelect) { spaceSelect.value = task.spaceId || ''; }

        modal.classList.add('show');
        document.getElementById('edit-task-title').focus();
    }

    function showEditMeetingModal(meetingId) {
        const meeting = findMeetingData(meetingId);
        if (!meeting) { return; }

        const modal = document.getElementById('edit-meeting-modal');
        if (!modal) { return; }

        document.getElementById('edit-meeting-id').value = meetingId;
        document.getElementById('edit-meeting-title').value = meeting.title || '';
        const dateInput = document.getElementById('edit-meeting-date');
        if (dateInput) {
            dateInput.value = meeting.date ? new Date(meeting.date).toISOString().split('T')[0] : '';
        }
        const timeInput = document.getElementById('edit-meeting-time');
        if (timeInput) { timeInput.value = meeting.time || ''; }
        const spaceSelect = document.getElementById('edit-meeting-space');
        if (spaceSelect) { spaceSelect.value = meeting.spaceId || ''; }

        modal.classList.add('show');
        document.getElementById('edit-meeting-title').focus();
    }

    function saveEditTask() {
        const taskId = document.getElementById('edit-task-id').value;
        const title = document.getElementById('edit-task-title').value.trim();
        if (!taskId || !title) { return; }

        const updates = {
            title: title,
            priority: document.getElementById('edit-task-priority')?.value,
            due: document.getElementById('edit-task-due')?.value || '',
            status: document.getElementById('edit-task-status')?.value,
            description: document.getElementById('edit-task-description')?.value || '',
        };

        const spaceSelect = document.getElementById('edit-task-space');
        if (spaceSelect) { updates.targetSpaceId = spaceSelect.value; }

        vscode.postMessage({ type: 'updateTask', taskId, updates });
        hideModal('edit-task-modal');
    }

    function saveEditMeeting() {
        const meetingId = document.getElementById('edit-meeting-id').value;
        const title = document.getElementById('edit-meeting-title').value.trim();
        if (!meetingId || !title) { return; }

        const updates = {
            title: title,
            date: document.getElementById('edit-meeting-date')?.value || '',
            time: document.getElementById('edit-meeting-time')?.value || '',
        };

        const spaceSelect = document.getElementById('edit-meeting-space');
        if (spaceSelect) { updates.targetSpaceId = spaceSelect.value; }

        vscode.postMessage({ type: 'updateMeeting', meetingId, updates });
        hideModal('edit-meeting-modal');
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
