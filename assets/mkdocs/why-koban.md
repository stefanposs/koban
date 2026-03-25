# Why Koban?

## The Problem

Most project management tools force you out of your editor into a separate app — Jira, Trello, Notion, Linear. Every context switch costs you focus. And your task data is locked in someone else's database.

## Koban's Approach

| Traditional Tools | Koban |
|---|---|
| Separate browser tab | Inside VS Code |
| Proprietary database | Plain Markdown files |
| SaaS lock-in | Git-versioned, portable |
| Requires internet | Fully offline |
| Per-seat pricing | Free & open source |
| Complex setup | Zero-config onboarding |

## Core Principles

### 1. Markdown as Source of Truth

Every task is a `.md` file with YAML frontmatter. You can read, edit, search, and `grep` your tasks with any tool — not just Koban.

```markdown
---
id: task-1711234567
space: website-relaunch
status: in-progress
priority: high
tags: [backend, api]
---

# API Endpoint Implementation
```

### 2. Zero Lock-In

Uninstall Koban and your tasks are still there — readable Markdown files in your project directories. No migration needed, no export step.

### 3. Git-Native Workflow

Task changes = file changes = Git diffs. Review task status transitions in PRs, automate with Git hooks, and track history with `git log`.

### 4. VS Code Native

Koban uses VS Code's Activity Bar, theme variables, and native UI primitives. It looks and feels like part of VS Code, not a bolted-on webapp.

### 5. Keyboard-First

Every action has a keyboard shortcut. Navigate with `J/K`, move tasks with `1-4`, create with `C`, archive with `A`. Mouse is optional.
