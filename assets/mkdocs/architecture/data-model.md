# Data Model

## Types

All types are defined in `ext/types.ts`.

### TaskStatus

```typescript
type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done' | 'blocked' | 'archived';
```

### TaskPriority

```typescript
type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
```

### Space

```typescript
interface Space {
    id: string;
    name: string;
    description?: string;
    rootPath: string;
    status: 'active' | 'paused' | 'archived';
    color?: string;
    owner?: string;
    createdAt: Date;
    updatedAt: Date;
    detectionMethod: 'frontmatter' | 'convention' | 'explicit';
    stats: SpaceStats;
}
```

### Task

```typescript
interface Task {
    id: string;
    spaceId: string;
    title: string;
    status: TaskStatus;
    priority: TaskPriority;
    assignee?: string;
    dueDate?: Date;
    tags: string[];
    filePath: string;
    createdAt: Date;
    updatedAt: Date;
    description?: string;
    checklist: ChecklistItem[];
    links: Link[];
}
```

### Meeting

```typescript
interface Meeting {
    id: string;
    spaceId: string;
    title: string;
    date: Date;
    duration?: number;
    attendees?: string[];
    filePath: string;
    createdAt: Date;
    updatedAt: Date;
    meetingType?: MeetingType;
}
```

## File Formats

### Task File (`.tasks/*.md`)

```markdown
---
id: task-1711234567-a3f2
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
```

### Space Meta File (`_meta.md`)

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
Project overview and notes...
```

### Meeting File (`.meetings/*.md`)

```markdown
---
type: meeting
id: 2024-03-22-kickoff
space: website-relaunch
date: 2024-03-22
meeting_type: kickoff
duration: 60m
participants: [Alice, Bob]
---

# Project Kickoff

## Agenda
1. Project scope review
2. Timeline planning

## Action Items
- [ ] Alice: Create initial wireframes
```

## Directory Structure

```
workspace/
├── .mkw/                     # Extension metadata
│   └── config.yml
├── website-relaunch/         # ← Space
│   ├── _meta.md              # Space metadata
│   ├── .tasks/               # Task files
│   │   ├── task-171123.md
│   │   └── .archive/         # Archived tasks
│   │       └── task-170000.md
│   └── .meetings/            # Meeting files
│       └── 2024-03-22-kickoff.md
└── backend/                  # ← Another Space
    ├── _meta.md
    ├── .tasks/
    └── .meetings/
```
