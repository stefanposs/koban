# Koban

Markdown-powered Kanban board for VS Code — your workspace, in plain sight.

![VS Code](https://img.shields.io/badge/VS%20Code-%3E%3D1.74-blue)
![Version](https://img.shields.io/badge/version-0.1.0-green)
![License](https://img.shields.io/badge/license-MIT-brightgreen)

## What is Koban?

Koban is a VS Code extension that bridges folder-based project structures with visual Kanban boards using **Markdown as the single source of truth**. No external tools, no SaaS lock-in — just `.md` files tracked in Git.

Tasks flow through configurable columns via drag-and-drop or keyboard shortcuts, and every change writes back to human-readable Markdown with YAML frontmatter.

## Features

- **Semantic Spaces** — Organize work into projects, areas, or initiatives — each with its own tasks, meetings, and notes
- **Visual Kanban Board** — Drag-and-drop task management inside VS Code
- **Keyboard-First** — `J/K` navigate, `Space` opens, `1-4` moves columns, `C` creates
- **Daily Notes** — One-keystroke daily journal (`.daily/YYYY-MM-DD.md`)
- **Quick Capture** — Fast task creation without leaving your flow
- **Code-to-Task** — Select code → right-click → "Create Koban Task from Selection" with clickable source link
- **Markdown-First** — All data in `.md` files — version control friendly, no lock-in
- **Space Templates** — Blank, Client Project, Sprint, Documentation, Personal
- **Meeting Management** — Track meetings, agendas, and action items
- **Status Bar** — See in-progress/total tasks at a glance
- **VS Code Native** — Respects your theme, uses VS Code CSS variables

## Quick Start

### Install from VSIX

```bash
# Clone and build
git clone https://github.com/stefanposs/koban.git
cd koban
npm install
just package-extension

# Install the extension
code --install-extension koban-*.vsix
```

### Get Started

1. Click the **Koban** icon in the Activity Bar
2. Click **"+ Create New Space"**
3. Choose a template and name your space
4. Press `Cmd+Shift+K` to open the Kanban board

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                VS Code Extension Host               │
├─────────────────────────────────────────────────────┤
│ Space Explorer    Kanban Webview    Command Palette │
│    (TreeView)       (HTML/JS/CSS)                   │
│         │                │                │         │
│         └────────────────┴────────────────┘         │
│                          │                          │
│              ┌───────────┴───────────┐              │
│              │    Core Services      │              │
│              │  SpaceService         │              │
│              │  TaskService          │              │
│              │  FileService          │              │
│              │  ConfigService        │              │
│              └───────────┬───────────┘              │
│                          │                          │
│              ┌───────────┴───────────┐              │
│              │   File System Layer   │              │
│              │ FileWatcher (debounce)│              │
│              │  Frontmatter Parser   │              │
│              └───────────────────────┘              │
└─────────────────────────────────────────────────────┘
                           │
                           ▼
              Workspace: .md files (Git)
```

| Layer | Technology | Purpose |
|-------|------------|---------|
| TreeView | VS Code TreeDataProvider | Space explorer sidebar |
| Webview | Vanilla JS + CSS | Kanban board with drag-and-drop |
| Services | TypeScript | Space/Task/File/Config management |
| Persistence | Markdown + YAML frontmatter | Tasks as `.tasks/*.md` files |

## Space Structure

```
workspace/
├── .daily/                   # Daily notes (global)
│   ├── 2026-03-24.md
│   └── 2026-03-25.md
│
├── website-relaunch/         # ← Space
│   ├── _meta.md              # Space metadata (type: space)
│   ├── .tasks/               # Task files
│   │   ├── task-1711234567.md
│   │   └── task-1711234890.md
│   ├── .meetings/            # Meeting files
│   │   └── 2024-03-22-kickoff.md
│   ├── architecture.md       # ← Note (loose .md file)
│   └── docs/                 # Your content
│       └── api-spec.md
│
└── backend/                  # ← Another Space
    ├── _meta.md
    ├── .tasks/
    └── .meetings/
```

### Space Detection

A folder becomes a **Space** when it contains a `_meta.md` file with `type: space` frontmatter. That's it.

## Task Format

```markdown
---
id: task-1711234567
space: website-relaunch
status: in-progress
priority: high
assignee: Max
due: 2024-04-15
tags: [backend, api]
created: 2024-03-22
---

# API Endpoint Implementation

## Description
Create REST endpoint for user management.

## Checklist
- [x] OpenAPI spec
- [ ] Implementation
- [ ] Tests

## Links
- Related tasks:
- External resources:
```

## Commands

| Command | Keybinding | Description |
|---------|------------|-------------|
| `Koban: Open Kanban Board` | `Cmd+Shift+K` | Open Kanban board |
| `Koban: New Task` | `Cmd+K Cmd+T` | Create a new task |
| `Koban: New Meeting` | `Cmd+K Cmd+M` | Create a meeting |
| `Koban: New Space` | — | Create a new space from template |
| `Koban: New Note` | — | Create a note in a space |
| `Koban: Daily Note` | `Cmd+Shift+D` | Open/create today's daily note |
| `Koban: Quick Capture` | `Cmd+Shift+N` | Fast task creation |
| `Koban: Reindex Spaces` | — | Re-scan workspace for spaces |
| `Koban: Create Task from Selection` | Right-click | Create task from selected code |

## Configuration

```json
{
  "koban.excludePatterns": ["**/node_modules/**", "**/.git/**"],
  "koban.showSystemFolders": false,
  "koban.autoSave": true,
  "koban.kanbanColumns": [
    { "id": "todo", "name": "To Do", "status": "todo", "color": "#6b7280" },
    { "id": "in-progress", "name": "In Progress", "status": "in-progress", "color": "#3b82f6" },
    { "id": "review", "name": "Review", "status": "review", "color": "#f59e0b" },
    { "id": "done", "name": "Done", "status": "done", "color": "#10b981" }
  ]
}
```

## Development

```bash
# Install dependencies
npm install

# Build extension host (→ dist/extension.cjs)
npm run build:ext

# Watch mode (auto-rebuild on save)
npm run watch:ext

# Run tests (11 unit tests)
npm test

# Package as VSIX
npm run package
```

### Using Just

```bash
just                    # Show available recipes
just dev                # Watch extension host changes
just build-ext          # Build extension host
just build              # Build everything
just build-prod         # Build for production (minified)
just typecheck          # Type-check extension host
just test               # Run unit tests
just qa                 # Type-check + test
just package-extension  # Package as VSIX
just install-extension  # Install locally
just clean              # Remove build artifacts
just reset              # Clean + install
```

## Tech Stack

- **Extension Host:** TypeScript, esbuild
- **Webview:** Vanilla JS + CSS (VS Code theme variables)
- **Parsing:** Custom frontmatter parser (zero dependencies)
- **Testing:** Vitest (32 tests)
- **Build:** esbuild (bundler) + TypeScript (type-checking)
- **CI/CD:** GitHub Actions
- **License:** MIT

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes (`git commit -m 'feat: add my feature'`)
4. Push to the branch (`git push origin feat/my-feature`)
5. Open a Pull Request

## License

[MIT](LICENSE) © Stefan Poss
