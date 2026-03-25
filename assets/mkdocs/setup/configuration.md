# Configuration

All settings are under the `koban.*` namespace in VS Code settings.

## Settings Reference

### `koban.excludePatterns`

Glob patterns to exclude from space detection.

```json
{
  "koban.excludePatterns": [
    "**/node_modules/**",
    "**/.git/**",
    "**/dist/**",
    "**/build/**"
  ]
}
```

### `koban.kanbanColumns`

Customize the Kanban board columns. Each column maps to a `TaskStatus`.

```json
{
  "koban.kanbanColumns": [
    { "id": "todo", "name": "To Do", "status": "todo", "color": "#6b7280" },
    { "id": "in-progress", "name": "In Progress", "status": "in-progress", "color": "#3b82f6", "wipLimit": 3 },
    { "id": "review", "name": "Review", "status": "review", "color": "#f59e0b" },
    { "id": "done", "name": "Done", "status": "done", "color": "#10b981" }
  ]
}
```

!!! info "WIP Limits"
    Set `wipLimit` on a column to show a visual warning when the limit is exceeded.

### `koban.defaultSpace`

Skip the space picker when creating new tasks. Set to a space ID.

```json
{
  "koban.defaultSpace": "website-relaunch"
}
```

### `koban.autoArchiveDays`

Automatically archive tasks in the "done" column after N days. Set to `0` to disable.

```json
{
  "koban.autoArchiveDays": 14
}
```

### `koban.autoSave`

Auto-save changes when moving tasks between columns (default: `true`).

### `koban.showSystemFolders`

Show `.tasks/` and `.meetings/` directories in the VS Code file explorer (default: `false`).
