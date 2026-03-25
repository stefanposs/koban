# Getting Started (Development)

## Prerequisites

- **Node.js** >= 18
- **npm** >= 9
- **VS Code** >= 1.74

## Setup

```bash
git clone https://github.com/stefanposs/koban.git
cd koban
npm install
```

## Development Workflow

### Build

```bash
# Build extension host (→ dist/extension.cjs)
npm run build:ext

# Build for production (minified, no sourcemaps)
npm run build:ext -- --production

# Build everything
npm run build:all
```

### Watch Mode

```bash
npm run watch:ext
```

This watches `ext/` for changes and auto-rebuilds. Press `F5` in VS Code to launch the Extension Development Host.

### Test

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Package & Install

```bash
# Package as VSIX
npm run package

# Install locally
code --install-extension koban-*.vsix
```

## Project Structure

```
koban/
├── ext/                      # Extension host (TypeScript)
│   ├── extension.ts          # Entry point, command registration
│   ├── types.ts              # Shared types & service interfaces
│   ├── services/
│   │   ├── fileService.ts    # File I/O abstraction
│   │   ├── configService.ts  # VS Code settings wrapper
│   │   ├── spaceService.ts   # Space discovery & management
│   │   └── taskService.ts    # Task CRUD & meetings
│   ├── utils/
│   │   └── frontmatterParser.ts  # YAML frontmatter read/write
│   └── views/
│       ├── kanbanPanel.ts    # Webview panel (Kanban board)
│       └── spaceExplorer.ts  # TreeView (sidebar)
├── media/                    # Webview assets
│   ├── kanban.js             # Board client-side logic
│   ├── kanban.css            # Board styles
│   └── koban-icon.svg        # Activity bar icon
├── templates/                # Space templates
├── tests/
│   ├── unit/                 # Vitest unit tests
│   └── fakes/                # Test doubles (in-memory services)
├── assets/mkdocs/            # MkDocs source files
├── docs/                     # Built documentation (GitHub Pages)
├── esbuild.ext.mjs           # esbuild config
├── vitest.config.ts          # Vitest config
├── mkdocs.yml                # MkDocs config
└── package.json
```

## Tech Stack

| Tool | Purpose |
|------|---------|
| **TypeScript** | Extension host language |
| **esbuild** | Bundler (ext → dist/extension.cjs) |
| **Vitest** | Unit testing framework |
| **MkDocs Material** | Documentation site |
| **GitHub Actions** | CI/CD (typecheck → build → test → package → publish) |
| **@vscode/vsce** | Extension packaging & publishing |
