# Changelog

## [0.3.1] - 2026-03-28

### Fixed
- **Space Dropdown Pre-Selection** — Task/meeting creation modals now pre-select the currently displayed space instead of defaulting to the first alphabetical space
- **Board Auto-Expansion** — Creating a task/meeting in a space not currently on the board dynamically adds that space’s board so the item appears immediately
- **Field Update Data Loss** — `_updateTask`/`_updateMeeting` no longer early-return on invalid `targetSpaceId`, ensuring field edits (title, priority, due, status, description) are always applied
- **Quick-Add Space Targeting** — Quick-add inputs in Kanban columns now include `data-space-id`, preventing tasks from always being created in the first board’s space on multi-space boards
- **CreateTask Status Validation** — Webview `createTask` messages now validate the status field against allowed values, falling back to ‘todo’
- **Numeric ID Coercion** — `parseFrontmatter` no longer auto-converts all numeric-looking values to numbers; only `year` is coerced, preventing corruption of purely numeric space/task IDs
- **Duplicate Space ID Warning** — `processMetaFile` now warns and skips duplicate space IDs instead of silently overwriting the first space
- **Move Year-File Targeting** — `moveTaskToSpace`/`moveMeetingToSpace` now derive the target year-file from the source file path instead of from `createdAt`/`date`, preventing tasks from landing in wrong year-files
- **Stale Space Metadata** — KanbanPanel `_refresh()` now re-fetches space data (name, color, stats) so changes are reflected without re-opening the panel

## [0.3.0] - 2026-03-27

### Fixed
- **Read/Write Lock Split** — Read-only operations (`getTasksForSpace`, `getMeetingsForSpace`) no longer suppress file-watcher events; only write operations set the self-write flag
- **Self-Write Suppression** — Replaced boolean `isSelfWriting` flag with timestamp-based approach (`lastSelfWriteAt`) that correctly survives async file-watcher event delivery
- **Refresh Path Consolidation** — KanbanPanel now calls lightweight `koban.refreshExplorer` (sidebar-only) instead of full `koban.refreshSpaces`, eliminating redundant I/O and double DOM renders
- **Space Filter Preservation** — KanbanPanel remembers which spaces it was opened with; external refreshes no longer switch a single-space view to all-spaces
- **Space Name Collision Guard** — `createNewSpace` checks if directory exists before creating, preventing silent overwrite of existing spaces
- **Move/Update Error Isolation** — `_updateTask`/`_updateMeeting` wrap space-move in separate try/catch so field updates still apply even if move fails
- **Description H2 Escape** — Lines starting with `##` in task descriptions are escaped on write and unescaped on read, preventing description text from being misinterpreted as section boundaries
- **Metadata Block Boundary** — `updateSectionMetadata` and `updateSectionDescription` use `metaBlockSealed` flag to stop scanning at the first non-metadata line, preventing description text from being overwritten or dropped
- **Metadata Before ID** — `updateSectionMetadata` second pass now scans from section heading (not just after `id:` line), preventing duplicate key accumulation when metadata keys appear before `id:`
- **Section Removal Spacing** — `removeSection` preserves blank-line separator before next `##` heading
- **Frontmatter Quote Round-Trip** — `parseFrontmatter` now correctly unescapes `\"` in double-quoted values, preventing progressive backslash accumulation
- **Error Logging** — Silent `catch {}` blocks replaced with `console.warn` diagnostics in `taskService` and `spaceService`
- **WebView SpaceId Validation** — `_updateTask`/`_updateMeeting` validate `targetSpaceId` against known spaces before moving

## [0.2.0] - 2026-03-27

### Added
- **Task Description** — Free-text description field on tasks (edit modal + card preview)
- **Move to Space** — Move tasks and meetings between spaces via context menu and edit modal
- **Edit Modals** — Inline edit modals for tasks (title, priority, due, status, description) and meetings (title, date, time)
- **Space Badge Tooltips** — Full space name tooltip on space indicator badges

### Fixed
- **Data Loss Prevention** — Move-to-space now writes target before removing source (crash-safe)
- **Write Lock Bypass** — Code-to-task creation now uses `TaskService.updateTask` instead of direct file writes
- **Stale Meetings Cache** — `getMeetingsForSpace` now properly clears old cache entries before repopulating
- **Meeting Open from Webview** — Clicking "Open" on meetings in the Kanban board now works (was silently failing)
- **Metadata Parser** — Allow empty metadata values (e.g. `due:` with no value)
- **Frontmatter Parser** — Correctly skip indented/nested YAML lines
- **Date Validation** — Invalid date strings in task files no longer produce silent `NaN` errors
- **Meeting Date Validation** — `createMeeting` now validates semantic date correctness (rejects `2025-99-99`)
- **Meeting Duration NaN** — Non-numeric duration values no longer propagate as `NaN`
- **Archive Year Fallback** — Tasks with invalid `createdAt` dates now archive to current year instead of `NaN`
- **Stale Line Numbers** — `openTask` now re-computes line position from disk instead of using cached values
- **Panel Disposal** — `KanbanPanel` is properly disposed on extension deactivate to prevent stale service references
- **Context Menu Overflow** — Context menus near viewport edges are now clamped to stay visible
- **Board State Consistency** — KanbanPanel actions now reload from disk via `_refresh()` instead of patching in-memory arrays

### Changed
- **Daily Template** — Changed daily note template from German to English (Good / Not good / Change)
- **Button Styling** — Redesigned toolbar with semantic button grouping and improved visual hierarchy
- **Tab Navigation** — Tasks/Meetings tab bar with underline indicators

## [0.1.0] - 2026-03-25

### Added
- **Spaces** — Folder-based project workspaces with `_meta.md` discovery
- **Kanban Board** — Visual drag-and-drop board with keyboard navigation (J/K, 1-4, Space)
- **Tasks** — Markdown-based task management with frontmatter metadata
- **Meetings** — Meeting notes with agenda, action items, and decisions
- **Daily Notes** — Quick daily journal entries with `Cmd+K Cmd+D`
- **Quick Capture** — Fast task creation with `Cmd+K Cmd+N`
- **Space Templates** — 5 templates: Blank, Client Project, Sprint, Documentation, Personal
- **Code-to-Task** — Create tasks from selected code with source reference
- **Space Status** — Active, paused, archived states for project lifecycle
- **Status Bar** — Live task count showing in-progress/total
- **File Watcher** — Automatic refresh when task/meeting files change
- **Sidebar Explorer** — Tree view with spaces, tasks, meetings, and notes categories
