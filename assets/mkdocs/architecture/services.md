# Services

Koban's business logic is organized into four services, each with an interface in `types.ts` for dependency injection and testability.

## FileService

**Interface:** `IFileService`

Abstracts all file system operations. Used by SpaceService and TaskService.

```typescript
interface IFileService {
    readFile(filePath: string): Promise<string>;
    writeFile(filePath: string, content: string): Promise<void>;
    deleteFile(filePath: string): Promise<void>;
    moveFile(source: string, target: string): Promise<void>;
    createDirectory(dirPath: string): Promise<void>;
    listFiles(dirPath: string): Promise<string[]>;
    fileExists(filePath: string): Promise<boolean>;
    directoryExists(dirPath: string): Promise<boolean>;
}
```

## ConfigService

**Interface:** `IConfigService`

Wraps `vscode.workspace.getConfiguration('koban')` with typed accessors.

| Method | Default | Description |
|--------|---------|-------------|
| `getExcludePatterns()` | `node_modules, .git, dist, build` | Patterns to skip during space scanning |
| `getKanbanColumns()` | 4 columns (To Do → Done) | Board column configuration |
| `getAutoArchiveDays()` | `0` (disabled) | Auto-archive completed tasks after N days |
| `getDefaultSpaceId()` | `undefined` | Skip space picker for new tasks |
| `getShowSystemFolders()` | `false` | Show `.tasks/` and `.meetings/` in explorer |

## SpaceService

**Interface:** `ISpaceService`

Discovers and manages workspace spaces using three detection methods:

| Priority | Method | Detection |
|----------|--------|-----------|
| 1 | **Explicit** | `.mkw/space.yml` config file |
| 2 | **Frontmatter** | `_meta.md` with `type: space` |
| 3 | **Convention** | Contains `.tasks/` directory |

Key design decisions:

- **Atomic map swap** — `discoverSpaces()` creates a fresh `Map` to avoid stale entries
- **`.md` filter** — File counts exclude non-Markdown files (`.DS_Store`, etc.)
- Uses `updateFrontmatter()` for status changes (no duplicated frontmatter logic)

## TaskService

**Interface:** `ITaskService`

Handles task creation, status transitions, archival, deletion, and meeting management.

```typescript
interface ITaskService {
    createTask(spaceId, title, options?): Promise<Task>;
    getTasksForSpace(spaceId, includeArchived?): Promise<Task[]>;
    getMeetingsForSpace(spaceId): Promise<Meeting[]>;
    updateTaskStatus(taskId, newStatus): Promise<void>;
    deleteTask(taskId): Promise<void>;
    archiveTask(taskId): Promise<void>;
    createMeeting(spaceId, title, date): Promise<Meeting>;
}
```

Key behaviors:

- **Task IDs** — `task-{timestamp}-{random}` to prevent collisions
- **Archival** — Updates status to `archived` and moves file to `.tasks/.archive/`
- **Meeting filenames** — Sanitized to `[a-z0-9-]` only (prevents path traversal)
- **Frontmatter** — Uses shared `updateFrontmatter()` utility from `frontmatterParser`
