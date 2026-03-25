import { describe, it, expect, beforeEach } from 'vitest'
import { TaskService } from '../../ext/services/taskService'
import { FakeFileService } from '../fakes/fakeFileService'
import { FakeConfigService } from '../fakes/fakeConfigService'
import { FakeSpaceService } from '../fakes/fakeSpaceService'
import { parseFrontmatter } from '../../ext/utils/frontmatterParser'

describe('TaskService', () => {
    let fileService: FakeFileService
    let configService: FakeConfigService
    let spaceService: FakeSpaceService
    let taskService: TaskService

    beforeEach(() => {
        fileService = new FakeFileService()
        configService = new FakeConfigService()
        spaceService = new FakeSpaceService()
        spaceService.addSpace('project-a', '/workspace/project-a')
        taskService = new TaskService(fileService, configService, spaceService)
    })

    describe('createTask', () => {
        it('creates a task file with correct frontmatter', async () => {
            const task = await taskService.createTask('project-a', 'My New Task')

            expect(task.title).toBe('My New Task')
            expect(task.status).toBe('todo')
            expect(task.priority).toBe('medium')
            expect(task.spaceId).toBe('project-a')
            expect(task.id).toMatch(/^task-\d+-[a-z0-9]+$/)

            const fileContent = fileService.getFile(task.filePath)
            expect(fileContent).toBeDefined()
            expect(fileContent).toContain('# My New Task')

            const fm = parseFrontmatter(fileContent!)
            expect(fm.status).toBe('todo')
        })

        it('applies custom options', async () => {
            const task = await taskService.createTask('project-a', 'Urgent Fix', {
                status: 'in-progress',
                priority: 'critical',
                tags: ['bug', 'hotfix'],
                assignee: 'alice',
            })

            expect(task.status).toBe('in-progress')
            expect(task.priority).toBe('critical')
            expect(task.tags).toEqual(['bug', 'hotfix'])
            expect(task.assignee).toBe('alice')

            const fm = parseFrontmatter(fileService.getFile(task.filePath)!)
            expect(fm.status).toBe('in-progress')
            expect(fm.priority).toBe('critical')
        })

        it('throws when space does not exist', async () => {
            await expect(taskService.createTask('nonexistent', 'Fail'))
                .rejects.toThrow('Space nonexistent not found')
        })

        it('generates unique IDs for consecutive tasks', async () => {
            const t1 = await taskService.createTask('project-a', 'Task 1')
            const t2 = await taskService.createTask('project-a', 'Task 2')
            expect(t1.id).not.toBe(t2.id)
        })
    })

    describe('getTasksForSpace', () => {
        it('returns empty array when no tasks exist', async () => {
            const tasks = await taskService.getTasksForSpace('project-a')
            expect(tasks).toEqual([])
        })

        it('reads tasks from .tasks/ directory', async () => {
            // Seed a task file
            fileService.addFile('/workspace/project-a/.tasks/task-001.md', `---
id: task-001
status: todo
priority: high
created: 2025-01-01
---

# Seeded Task

## Description
A seeded task.
`)
            const tasks = await taskService.getTasksForSpace('project-a')
            expect(tasks).toHaveLength(1)
            expect(tasks[0].id).toBe('task-001')
            expect(tasks[0].title).toBe('Seeded Task')
            expect(tasks[0].status).toBe('todo')
            expect(tasks[0].priority).toBe('high')
        })

        it('skips non-md files', async () => {
            fileService.addFile('/workspace/project-a/.tasks/.DS_Store', '')
            fileService.addFile('/workspace/project-a/.tasks/task-001.md', `---
id: task-001
status: todo
---

# Task
`)
            const tasks = await taskService.getTasksForSpace('project-a')
            expect(tasks).toHaveLength(1)
        })

        it('excludes archived tasks by default', async () => {
            fileService.addFile('/workspace/project-a/.tasks/task-active.md', `---
id: task-active
status: todo
---
# Active`)

            fileService.addFile('/workspace/project-a/.tasks/.archive/task-old.md', `---
id: task-old
status: archived
---
# Old`)

            const tasks = await taskService.getTasksForSpace('project-a', false)
            expect(tasks).toHaveLength(1)
            expect(tasks[0].id).toBe('task-active')
        })

        it('includes archived tasks when requested', async () => {
            fileService.addFile('/workspace/project-a/.tasks/task-active.md', `---
id: task-active
status: todo
---
# Active`)

            fileService.addFile('/workspace/project-a/.tasks/.archive/task-old.md', `---
id: task-old
status: archived
---
# Old`)

            const tasks = await taskService.getTasksForSpace('project-a', true)
            expect(tasks).toHaveLength(2)
        })


    })

    describe('updateTaskStatus', () => {
        it('updates frontmatter status in file', async () => {
            const task = await taskService.createTask('project-a', 'Status Task')
            await taskService.updateTaskStatus(task.id, 'in-progress')

            const fm = parseFrontmatter(fileService.getFile(task.filePath)!)
            expect(fm.status).toBe('in-progress')
        })

        it('throws for unknown task ID', async () => {
            await expect(taskService.updateTaskStatus('ghost', 'done'))
                .rejects.toThrow('Task ghost not found')
        })
    })

    describe('archiveTask', () => {
        it('moves file to .archive and updates status', async () => {
            const task = await taskService.createTask('project-a', 'Archive Me')
            const origPath = task.filePath

            await taskService.archiveTask(task.id)

            // Original file should be gone
            expect(fileService.getFile(origPath)).toBeUndefined()
            // Archived file should exist under .archive/
            expect(task.filePath).toContain('.archive')
            expect(task.status).toBe('archived')

            const fm = parseFrontmatter(fileService.getFile(task.filePath)!)
            expect(fm.status).toBe('archived')
        })

        it('throws for unknown task ID', async () => {
            await expect(taskService.archiveTask('ghost'))
                .rejects.toThrow('Task ghost not found')
        })
    })

    describe('deleteTask', () => {
        it('removes file and map entry', async () => {
            const task = await taskService.createTask('project-a', 'Delete Me')
            await taskService.deleteTask(task.id)

            expect(fileService.getFile(task.filePath)).toBeUndefined()
            // Trying to update a deleted task should fail
            await expect(taskService.updateTaskStatus(task.id, 'done'))
                .rejects.toThrow()
        })

        it('throws for unknown task ID', async () => {
            await expect(taskService.deleteTask('ghost'))
                .rejects.toThrow('Task ghost not found')
        })
    })

    describe('createMeeting', () => {
        it('creates a meeting file with correct frontmatter', async () => {
            const meeting = await taskService.createMeeting('project-a', 'Sprint Planning', '2025-02-01')

            expect(meeting.title).toBe('Sprint Planning')
            expect(meeting.spaceId).toBe('project-a')

            const fm = parseFrontmatter(fileService.getFile(meeting.filePath)!)
            expect(fm.type).toBe('meeting')
            expect(fm.date).toBe('2025-02-01')
        })

        it('sanitizes meeting title in filename', async () => {
            const meeting = await taskService.createMeeting('project-a', 'Bad/Name<script>', '2025-02-01')
            // Filename should only contain safe characters
            const basename = meeting.filePath.split('/').pop()!
            expect(basename).not.toMatch(/[<>/]/)
        })

        it('throws for unknown space', async () => {
            await expect(taskService.createMeeting('ghost', 'Test', '2025-01-01'))
                .rejects.toThrow('Space ghost not found')
        })
    })

    describe('getMeetingsForSpace', () => {
        it('returns empty array when no meetings exist', async () => {
            const meetings = await taskService.getMeetingsForSpace('project-a')
            expect(meetings).toEqual([])
        })

        it('reads meetings from .meetings/ directory', async () => {
            fileService.addFile('/workspace/project-a/.meetings/2025-01-15-standup.md', `---
type: meeting
id: 2025-01-15-standup
date: 2025-01-15
---

# Standup
`)
            const meetings = await taskService.getMeetingsForSpace('project-a')
            expect(meetings).toHaveLength(1)
            expect(meetings[0].title).toBe('Standup')
            expect(meetings[0].id).toBe('2025-01-15-standup')
        })
    })

    describe('createMeeting date validation', () => {
        it('rejects invalid date format', async () => {
            await expect(taskService.createMeeting('project-a', 'Test', '../../evil'))
                .rejects.toThrow('Invalid date format')
        })

        it('rejects non-date strings', async () => {
            await expect(taskService.createMeeting('project-a', 'Test', 'not-a-date'))
                .rejects.toThrow('Invalid date format')
        })

        it('accepts valid YYYY-MM-DD dates', async () => {
            const meeting = await taskService.createMeeting('project-a', 'Valid', '2025-06-15')
            expect(meeting.title).toBe('Valid')
        })
    })

    describe('checklist extraction', () => {
        it('parses mixed completed and incomplete items', async () => {
            fileService.addFile('/workspace/project-a/.tasks/task-cl.md', `---
id: task-cl
status: in-progress
---

# Checklist Task

## Checklist
- [x] Setup database
- [ ] Write migrations
- [X] Configure CI
- [ ] Deploy to staging
`)
            const tasks = await taskService.getTasksForSpace('project-a')
            expect(tasks).toHaveLength(1)
            expect(tasks[0].checklist).toHaveLength(4)
            expect(tasks[0].checklist[0]).toEqual({ text: 'Setup database', completed: true })
            expect(tasks[0].checklist[1]).toEqual({ text: 'Write migrations', completed: false })
            expect(tasks[0].checklist[2]).toEqual({ text: 'Configure CI', completed: true })
            expect(tasks[0].checklist[3]).toEqual({ text: 'Deploy to staging', completed: false })
        })
    })

    describe('corrupted frontmatter handling', () => {
        it('skips files with missing id', async () => {
            fileService.addFile('/workspace/project-a/.tasks/bad.md', `---
status: todo
---
# No ID`)
            const tasks = await taskService.getTasksForSpace('project-a')
            expect(tasks).toHaveLength(0)
        })

        it('handles files without frontmatter', async () => {
            fileService.addFile('/workspace/project-a/.tasks/plain.md', `# Just Markdown`)
            const tasks = await taskService.getTasksForSpace('project-a')
            expect(tasks).toHaveLength(0)
        })
    })
})
