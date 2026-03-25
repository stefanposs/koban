# Spaces

Spaces are the top-level organizational unit in Koban. Each space represents a project, area, or initiative.

## Creating a Space

Use the command palette or the sidebar:

- **Command Palette:** `Koban: New Space`
- **Sidebar:** Click the `+` icon in the Koban panel

You'll be asked to choose a template:

| Template | Description |
|----------|-------------|
| **Blank** | Empty space with minimal setup |
| **Client Project** | Client-facing project with milestones |
| **Sprint** | Sprint-based agile workflow |
| **Documentation** | Docs & content creation |
| **Personal** | Personal task tracking |

## Space Detection

Koban discovers spaces automatically using three methods:

| Priority | Method | How It Works |
|----------|--------|-------------|
| 1 | **Explicit** | Looks for `.mkw/space.yml` |
| 2 | **Frontmatter** | Looks for `_meta.md` with `type: space` |
| 3 | **Convention** | Looks for a `.tasks/` directory |

## Space Status

Spaces can be in one of three states:

- **Active** — Visible on the Kanban board, tasks editable
- **Paused** — Visible but dimmed, useful for blocked projects
- **Archived** — Hidden from the board by default

Right-click a space in the sidebar to change its status.

## Space Meta File

Each space has a `_meta.md` describing it:

```markdown
---
type: space
id: website-relaunch
name: Website Relaunch
description: Complete website redesign project
owner: Team Alpha
status: active
color: "#3b82f6"
created: 2024-03-01
---

# Website Relaunch
Overview and project notes go here...
```

## Multi-Space Board

Koban shows a **unified Kanban board** — all active spaces are merged into shared columns. When multiple spaces exist, each task card shows a space label badge.
