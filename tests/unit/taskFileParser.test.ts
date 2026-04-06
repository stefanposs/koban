import { describe, it, expect } from 'vitest'
import {
    parseTasksFile,
    parseMeetingsFile,
    serializeTasksFile,
    serializeMeetingsFile,
    addTaskSection,
    addMeetingSection,
    removeSection,
    updateSectionMetadata,
    findSectionLine,
    isSystemFile,
    findYearFiles,
    getTasksFileName,
    getMeetingsFileName,
    getArchivedTasksFileName,
    emptyTasksFile,
    moveSectionToPosition,
} from '../../ext/utils/taskFileParser'

describe('taskFileParser', () => {
    // -----------------------------------------------------------------------
    // Naming helpers
    // -----------------------------------------------------------------------

    describe('getTasksFileName / getMeetingsFileName / getArchivedTasksFileName', () => {
        it('generates correct filenames', () => {
            expect(getTasksFileName(2025)).toBe('tasks-2025.md')
            expect(getMeetingsFileName(2026)).toBe('meetings-2026.md')
            expect(getArchivedTasksFileName(2025)).toBe('archived-tasks-2025.md')
        })
    })

    describe('findYearFiles', () => {
        it('extracts years for the given prefix', () => {
            const files = ['tasks-2024.md', 'tasks-2025.md', 'meetings-2025.md', '_meta.md', 'notes.md']
            expect(findYearFiles(files, 'tasks')).toEqual([2024, 2025])
            expect(findYearFiles(files, 'meetings')).toEqual([2025])
        })

        it('returns empty array when no matches', () => {
            expect(findYearFiles(['_meta.md'], 'tasks')).toEqual([])
        })
    })

    describe('isSystemFile', () => {
        it('recognizes system files', () => {
            expect(isSystemFile('tasks-2025.md')).toBe(true)
            expect(isSystemFile('meetings-2025.md')).toBe(true)
            expect(isSystemFile('archived-tasks-2025.md')).toBe(true)
        })

        it('rejects non-system files', () => {
            expect(isSystemFile('_meta.md')).toBe(false)
            expect(isSystemFile('notes.md')).toBe(false)
            expect(isSystemFile('tasks.md')).toBe(false)
        })
    })

    // -----------------------------------------------------------------------
    // Parse tasks
    // -----------------------------------------------------------------------

    const TASKS_CONTENT = `---
type: tasks
spaceId: project-a
year: 2025
---

## First Task
id: task-001
status: todo
priority: high
tags: bug, hotfix
created: 2025-01-01

Some description here.

## Second Task
id: task-002
status: in-progress
priority: medium
assignee: alice
`

    describe('parseTasksFile', () => {
        it('parses multiple task sections', () => {
            const parsed = parseTasksFile(TASKS_CONTENT)
            expect(parsed.tasks).toHaveLength(2)
            expect(parsed.tasks[0].id).toBe('task-001')
            expect(parsed.tasks[0].title).toBe('First Task')
            expect(parsed.tasks[0].status).toBe('todo')
            expect(parsed.tasks[0].priority).toBe('high')
            expect(parsed.tasks[0].tags).toEqual(['bug', 'hotfix'])
            expect(parsed.tasks[0].description).toBe('Some description here.')

            expect(parsed.tasks[1].id).toBe('task-002')
            expect(parsed.tasks[1].assignee).toBe('alice')
        })

        it('skips sections without id', () => {
            const content = `---
type: tasks
spaceId: x
year: 2025
---

## No ID Section
status: todo

## With ID
id: has-id
status: done
`
            const parsed = parseTasksFile(content)
            expect(parsed.tasks).toHaveLength(1)
            expect(parsed.tasks[0].id).toBe('has-id')
        })

        it('handles empty file (frontmatter only)', () => {
            const content = emptyTasksFile('test', 2025)
            const parsed = parseTasksFile(content)
            expect(parsed.tasks).toEqual([])
        })

        it('records headingLine for each section', () => {
            const parsed = parseTasksFile(TASKS_CONTENT)
            expect(typeof parsed.tasks[0].headingLine).toBe('number')
            expect(parsed.tasks[0].headingLine).toBeGreaterThanOrEqual(0)
        })
    })

    // -----------------------------------------------------------------------
    // Parse meetings
    // -----------------------------------------------------------------------

    const MEETINGS_CONTENT = `---
type: meetings
spaceId: project-a
year: 2025
---

## Sprint Planning
id: 2025-01-15-sprint-planning
date: 2025-01-15
duration: 60m
participants: alice, bob

### Agenda
1. Review backlog
2. Assign tasks

### Notes
Good session overall.

### Action Items
- [ ] Alice: update docs

### Decisions
Use new framework.
`

    describe('parseMeetingsFile', () => {
        it('parses meeting sections with sub-sections', () => {
            const parsed = parseMeetingsFile(MEETINGS_CONTENT)
            expect(parsed.meetings).toHaveLength(1)

            const m = parsed.meetings[0]
            expect(m.id).toBe('2025-01-15-sprint-planning')
            expect(m.title).toBe('Sprint Planning')
            expect(m.date).toBe('2025-01-15')
            expect(m.duration).toBe('60m')
            expect(m.participants).toEqual(['alice', 'bob'])

            expect(m.sections['Agenda']).toContain('Review backlog')
            expect(m.sections['Notes']).toBe('Good session overall.')
            expect(m.sections['Action Items']).toContain('Alice: update docs')
            expect(m.sections['Decisions']).toBe('Use new framework.')
        })
    })

    // -----------------------------------------------------------------------
    // Serializers
    // -----------------------------------------------------------------------

    describe('serializeTasksFile', () => {
        it('roundtrips through parse', () => {
            const parsed = parseTasksFile(TASKS_CONTENT)
            const serialized = serializeTasksFile('project-a', 2025, parsed.tasks)
            const reparsed = parseTasksFile(serialized)
            expect(reparsed.tasks).toHaveLength(2)
            expect(reparsed.tasks[0].id).toBe('task-001')
            expect(reparsed.tasks[1].id).toBe('task-002')
        })
    })

    describe('serializeMeetingsFile', () => {
        it('roundtrips through parse', () => {
            const parsed = parseMeetingsFile(MEETINGS_CONTENT)
            const serialized = serializeMeetingsFile('project-a', 2025, parsed.meetings)
            const reparsed = parseMeetingsFile(serialized)
            expect(reparsed.meetings).toHaveLength(1)
            expect(reparsed.meetings[0].id).toBe('2025-01-15-sprint-planning')
        })
    })

    // -----------------------------------------------------------------------
    // Section manipulation
    // -----------------------------------------------------------------------

    describe('addTaskSection', () => {
        it('appends a new task section to file content', () => {
            const base = emptyTasksFile('test', 2025)
            const result = addTaskSection(base, {
                title: 'New Task',
                id: 'task-new',
                status: 'todo',
            })
            expect(result).toContain('## New Task')
            expect(result).toContain('id: task-new')
            const parsed = parseTasksFile(result)
            expect(parsed.tasks).toHaveLength(1)
        })
    })

    describe('addMeetingSection', () => {
        it('appends a meeting section', () => {
            const base = `---\ntype: meetings\nspaceId: x\nyear: 2025\n---\n`
            const result = addMeetingSection(base, {
                title: 'Standup',
                id: '2025-01-20-standup',
                date: '2025-01-20',
                sections: { 'Agenda': '', 'Notes': '' },
            })
            const parsed = parseMeetingsFile(result)
            expect(parsed.meetings).toHaveLength(1)
            expect(parsed.meetings[0].title).toBe('Standup')
        })
    })

    describe('removeSection', () => {
        it('removes a section by id and returns it', () => {
            const { updatedContent, removedSection } = removeSection(TASKS_CONTENT, 'task-001')
            expect(removedSection).toContain('## First Task')
            expect(removedSection).toContain('id: task-001')

            const parsed = parseTasksFile(updatedContent)
            expect(parsed.tasks).toHaveLength(1)
            expect(parsed.tasks[0].id).toBe('task-002')
        })

        it('returns empty removedSection when id not found', () => {
            const { updatedContent, removedSection } = removeSection(TASKS_CONTENT, 'ghost')
            expect(removedSection).toBe('')
            expect(updatedContent).toBe(TASKS_CONTENT)
        })
    })

    describe('updateSectionMetadata', () => {
        it('updates an existing metadata field', () => {
            const updated = updateSectionMetadata(TASKS_CONTENT, 'task-001', { status: 'done' })
            const parsed = parseTasksFile(updated)
            expect(parsed.tasks[0].status).toBe('done')
            // Other task unchanged
            expect(parsed.tasks[1].status).toBe('in-progress')
        })

        it('appends a new metadata field', () => {
            const updated = updateSectionMetadata(TASKS_CONTENT, 'task-001', { assignee: 'bob' })
            const parsed = parseTasksFile(updated)
            expect(parsed.tasks[0].assignee).toBe('bob')
        })

        it('returns content unchanged when id not found', () => {
            const result = updateSectionMetadata(TASKS_CONTENT, 'ghost', { status: 'done' })
            expect(result).toBe(TASKS_CONTENT)
        })
    })

    describe('findSectionLine', () => {
        it('returns the heading line number', () => {
            const line = findSectionLine(TASKS_CONTENT, 'task-001')
            const lines = TASKS_CONTENT.split('\n')
            expect(lines[line]).toBe('## First Task')
        })

        it('returns -1 for unknown id', () => {
            expect(findSectionLine(TASKS_CONTENT, 'ghost')).toBe(-1)
        })
    })

    describe('moveSectionToPosition', () => {
        const threeTaskFile = `---
type: tasks
spaceId: test
year: 2026
---

## Task A
id: task-a
status: todo
priority: high

## Task B
id: task-b
status: todo
priority: medium

## Task C
id: task-c
status: todo
priority: low
`

        it('moves a task to the top when afterItemId is null', () => {
            const result = moveSectionToPosition(threeTaskFile, 'task-c', null)
            const sections = parseTasksFile(result)
            expect(sections.tasks.map(t => t.id)).toEqual(['task-c', 'task-a', 'task-b'])
        })

        it('moves a task after another task', () => {
            const result = moveSectionToPosition(threeTaskFile, 'task-c', 'task-a')
            const sections = parseTasksFile(result)
            expect(sections.tasks.map(t => t.id)).toEqual(['task-a', 'task-c', 'task-b'])
        })

        it('updates status when moving', () => {
            const result = moveSectionToPosition(threeTaskFile, 'task-a', null, 'in-progress')
            const sections = parseTasksFile(result)
            expect(sections.tasks[0].id).toBe('task-a')
            expect(sections.tasks[0].status).toBe('in-progress')
        })

        it('returns original content when itemId not found', () => {
            const result = moveSectionToPosition(threeTaskFile, 'nonexistent', null)
            expect(result).toBe(threeTaskFile)
        })

        it('returns original content when afterItemId not found', () => {
            const result = moveSectionToPosition(threeTaskFile, 'task-a', 'nonexistent')
            expect(result).toBe(threeTaskFile)
        })
    })
})
