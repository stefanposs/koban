# Architecture Overview

## High-Level Architecture

```mermaid
graph TB
    subgraph "VS Code Extension Host"
        EXT[extension.ts<br/>Entry Point]
        SE[SpaceExplorer<br/>TreeView]
        KP[KanbanPanel<br/>Webview]
        
        subgraph Services
            SS[SpaceService]
            TS[TaskService]
            FS[FileService]
            CS[ConfigService]
        end
        
        subgraph Utils
            FP[FrontmatterParser]
        end
    end
    
    subgraph "Webview"
        JS[kanban.js]
        CSS[kanban.css]
    end
    
    subgraph "File System"
        MD[".tasks/*.md"]
        MT[".meetings/*.md"]
        META["_meta.md"]
        CFG[".mkw/config.yml"]
    end
    
    EXT --> SE
    EXT --> KP
    EXT --> SS
    EXT --> TS
    SE --> SS
    KP --> TS
    KP --> JS
    KP --> CSS
    SS --> FS
    TS --> FS
    FS --> MD
    FS --> MT
    FS --> META
    FS --> CFG
    TS --> FP
    SS --> FP
```

## Layer Overview

| Layer | Technology | Purpose |
|-------|------------|---------|
| **TreeView** | VS Code TreeDataProvider | Space explorer sidebar |
| **Webview** | Vanilla JS + CSS | Kanban board with drag-and-drop |
| **Services** | TypeScript (interfaces) | Space/Task/File/Config management |
| **Utils** | FrontmatterParser | YAML frontmatter read/write |
| **Persistence** | Markdown + YAML frontmatter | Tasks as `.tasks/*.md` files |

## Data Flow

```mermaid
sequenceDiagram
    participant U as User
    participant W as Webview (kanban.js)
    participant K as KanbanPanel
    participant T as TaskService
    participant F as FileService
    participant D as Disk (.md files)
    
    U->>W: Drag task to "Done"
    W->>K: postMessage({type: 'moveTask'})
    K->>T: updateTaskStatus(id, 'done')
    T->>F: readFile(task.filePath)
    T->>T: updateFrontmatter(content, {status: 'done'})
    T->>F: writeFile(task.filePath, updated)
    F->>D: Write to disk
    K->>K: _refresh() → reload all tasks
    K->>W: postMessage({type: 'update', boards})
    W->>U: Re-render board
```

## Extension Entry Point

The extension activates on `onStartupFinished` and registers:

- **Commands** — 15+ commands for task/space/meeting operations
- **TreeView** — `SpaceExplorer` in the Activity Bar
- **File Watcher** — Scoped to `**/{_meta,.tasks/**,.meetings/**,.mkw/**}.md`
- **Auto-open** — Board opens automatically when the sidebar becomes visible

## Service Interfaces

All services implement interfaces defined in `types.ts` for testability:

- `IFileService` — File I/O abstraction
- `IConfigService` — VS Code configuration wrapper
- `ISpaceService` — Space discovery and management
- `ITaskService` — Task CRUD, status transitions, archival
