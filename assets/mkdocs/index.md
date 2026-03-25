# Koban

**Markdown-powered Kanban board for VS Code — your workspace, in plain sight.**

---

## What is Koban?

Koban is a VS Code extension that bridges folder-based project structures with visual Kanban boards using **Markdown as the single source of truth**. No external tools, no SaaS lock-in — just `.md` files tracked in Git.

Tasks flow through configurable columns via drag-and-drop or keyboard shortcuts, and every change writes back to human-readable Markdown with YAML frontmatter.

## Key Features

- :material-view-column: **Visual Kanban Board** — Drag-and-drop task management inside VS Code
- :material-keyboard: **Keyboard-First** — `J/K` navigate, `1-4` moves columns, `C` creates
- :material-language-markdown: **Markdown-First** — All data in `.md` files — Git-friendly, no lock-in
- :material-folder-multiple: **Semantic Spaces** — Organize work into projects, areas, or initiatives
- :material-rocket-launch: **Zero-Config Onboarding** — Initialize and get your first board in < 60 seconds
- :material-code-braces: **Code-to-Task** — Select code → right-click → create Koban task with source link
- :material-archive: **Task Archiving** — Move completed tasks to `.archive/` to keep boards clean
- :material-calendar: **Meeting Management** — Track meetings, agendas, and action items

## Quick Start

```bash
# Install from VSIX
code --install-extension koban-0.1.0.vsix

# Or build from source
git clone https://github.com/stefanposs/koban.git
cd koban && npm install && npm run package
```

1. Click the **Koban** icon in the Activity Bar
2. Click **"🚀 Initialize Koban Workspace"**
3. Press ++cmd+shift+k++ to open the Kanban board

[:material-arrow-right: Installation Guide](setup/installation.md){ .md-button .md-button--primary }
[:material-book-open-variant: Architecture](architecture/overview.md){ .md-button }
