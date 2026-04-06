import { describe, it, expect, beforeEach } from 'vitest'
import { TaskService } from '../../ext/services/taskService'
import { FakeFileService } from '../fakes/fakeFileService'
import { FakeConfigService } from '../fakes/fakeConfigService'
import { FakeSpaceService } from '../fakes/fakeSpaceService'

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
        it('creates a task section in the year-file', async () => {
            const task = await taskService.createTask('project-a', 'My New Task')

            expect(task.title).toBe('My New Task')
            expect(task.status).toBe('todo')
            expect(task.priority).toBe('medium')
            expect(task.spaceId).toBe('project-a')
            expect(task.id).toMatch(/^task-\d+-[a-z0-9]+$/)

            const fileContent = fileService.getFile(task.filePath)
            expect(fileContent).toBeDefined()
            expect(fileContent).toContain('## My New Task')
            expect(fileContent).toContain(`id: ${task.id}`)
            expect(fileContent).toContain('status: todo')
        })

        it('applies custom options', async () => {
            const task = await taskService.createTask('project-a', 'Urgent Fix', {
                status: 'in-progress',
                priority: 'urgent',
                tags: ['bug', 'hotfix'],
                assignee: 'alice',
            })

            expect(task.status).toBe('in-progress')
            expect(task.priority).toBe('urgent')
            expect(task.tags).toEqual(['bug', 'hotfix'])
            expect(task.assignee).toBe('alice')

            const content = fileService.getFile(task.filePath)!
            expect(content).toContain('status: in-progress')
            expect(content).toContain('priority: urgent')
            expect(content).toContain('tags: bug, hotfix')
            expect(content).toContain('assignee: alice')
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

        it('appends multiple tasks to the same year-file', async () => {
            const t1 = await taskService.createTask('project-a', 'First')
            const t2 = await taskService.createTask('project-a', 'Second')
            expect(t1.filePath).toBe(t2.filePath)

            const content = fileService.getFile(t1.filePath)!
            expect(content).toContain('## First')
            expect(content).toContain('## Second')
        })
    })

    describe('getTasksForSpace', () => {
        it('returns empty array when no tasks exist', async () => {
            const tasks = await taskService.getTasksForSpace('project-a')
            expect(tasks).toEqual([])
        })

        it('reads tasks from tasks-YYYY.md file', async () => {
            const year = new Date().getFullYear()
            fileService.addFile(`/workspace/project-a/.tasks/tasks-${year}.md`, `---
space: project-a
year: ${year}
type: tasks
---

## Seeded Task
id: task-001
status: todo
priority: high
created: 2025-01-01

Description of the seeded task.
`)
            const tasks = await taskService.getTasksForSpace('project-a')
            expect(tasks).toHaveLength(1)
            expect(tasks[0].id).toBe('task-001')
            expect(tasks[0].title).toBe('Seeded Task')
            expect(tasks[0].status).toBe('todo')
            expect(tasks[0].priority).toBe('high')
        })

        it('excludes archived tasks by default', async () => {
            const year = new Date().getFullYear()
            fileService.addFile(`/workspace/project-a/.tasks/tasks-${year}.md`, `---
space: project-a
year: ${year}
type: tasks
---

## Active Task
id: task-active
status: todo
`)

            fileService.addFile(`/workspace/project-a/.tasks/archived-tasks-${year}.md`, `---
space: project-a
year: ${year}
type: archived-tasks
---

## Old Task
id: task-old
status: archived
`)

            const tasks = await taskService.getTasksForSpace('project-a', false)
            expect(tasks).toHaveLength(1)
            expect(tasks[0].id).toBe('task-active')
        })

        it('includes archived tasks when requested', async () => {
            const year = new Date().getFullYear()
            fileService.addFile(`/workspace/project-a/.tasks/tasks-${year}.md`, `---
space: project-a
year: ${year}
type: tasks
---

## Active Task
id: task-active
status: todo
`)

            fileService.addFile(`/workspace/project-a/.tasks/archived-tasks-${year}.md`, `---
space: project-a
year: ${year}
type: archived-tasks
---

## Old Task
id: task-old
status: archived
`)

            const tasks = await taskService.getTasksForSpace('project-a', true)
            expect(tasks).toHaveLength(2)
        })
    })

    describe('updateTaskStatus', () => {
        it('updates status metadata in the year-file', async () => {
            const task = await taskService.createTask('project-a', 'Status Task')
            await taskService.updateTaskStatus(task.id, 'in-progress')

            const content = fileService.getFile(task.filePath)!
            // Should contain updated status
            expect(content).toContain('status: in-progress')
        })

        it('throws for unknown task ID', async () => {
            await expect(taskService.updateTaskStatus('ghost', 'done'))
                .rejects.toThrow('Task ghost not found')
        })
    })

    describe('archiveTask', () => {
        it('moves section to archived-tasks file and updates status', async () => {
            const task = await taskService.createTask('project-a', 'Archive Me')
            const origPath = task.filePath

            await taskService.archiveTask(task.id)

            // Original file should no longer contain the task section
            const origContent = fileService.getFile(origPath)!
            expect(origContent).not.toContain('## Archive Me')

            // Archived file should contain the task
            expect(task.filePath).toContain('archived-tasks-')
            expect(task.status).toBe('archived')

            const archiveContent = fileService.getFile(task.filePath)!
            expect(archiveContent).toContain('## Archive Me')
            expect(archiveContent).toContain('status: archived')
        })

        it('throws for unknown task ID', async () => {
            await expect(taskService.archiveTask('ghost'))
                .rejects.toThrow('Task ghost not found')
        })
    })

    describe('deleteTask', () => {
        it('removes section from year-file', async () => {
            const task = await taskService.createTask('project-a', 'Delete Me')
            const filePath = task.filePath

            await taskService.deleteTask(task.id)

            const content = fileService.getFile(filePath)!
            expect(content).not.toContain('## Delete Me')
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
        it('creates a meeting section in the year-file', async () => {
            const meeting = await taskService.createMeeting('project-a', 'Sprint Planning', '2025-02-01')

            expect(meeting.title).toBe('Sprint Planning')
            expect(meeting.spaceId).toBe('project-a')

            const content = fileService.getFile(meeting.filePath)!
            expect(content).toContain('## Sprint Planning')
            expect(content).toContain('date: 2025-02-01')
            expect(content).toContain('### Agenda')
            expect(content).toContain('### Notes')
            expect(content).toContain('### Action Items')
            expect(content).toContain('### Decisions')
        })

        it('sanitizes meeting title in ID', async () => {
            const meeting = await taskService.createMeeting('project-a', 'Bad/Name<script>', '2025-02-01')
            expect(meeting.id).not.toMatch(/[<>/]/)
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

        it('reads meetings from meetings-YYYY.md file', async () => {
            fileService.addFile('/workspace/project-a/.meetings/meetings-2025.md', `---
space: project-a
year: 2025
type: meetings
---

## Standup
id: 2025-01-15-standup
date: 2025-01-15

### Agenda

### Notes

### Action Items

### Decisions
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

    describe('moveTaskToSpace', () => {
        beforeEach(() => {
            spaceService.addSpace('project-b', '/workspace/project-b')
        })

        it('moves a task from one space to another', async () => {
            const task = await taskService.createTask('project-a', 'Movable Task')
            const origPath = task.filePath

            const moved = await taskService.moveTaskToSpace(task.id, 'project-b')

            expect(moved.spaceId).toBe('project-b')
            expect(moved.filePath).toContain('/workspace/project-b/')
            expect(moved.title).toBe('Movable Task')

            // Original space file should no longer contain the task
            const origContent = fileService.getFile(origPath)!
            expect(origContent).not.toContain('## Movable Task')

            // Target space file should contain the task
            const targetContent = fileService.getFile(moved.filePath)!
            expect(targetContent).toContain('## Movable Task')
        })

        it('throws when task is already in target space', async () => {
            const task = await taskService.createTask('project-a', 'Stay Put')
            await expect(taskService.moveTaskToSpace(task.id, 'project-a'))
                .rejects.toThrow('already in the target space')
        })

        it('throws for unknown task', async () => {
            await expect(taskService.moveTaskToSpace('ghost', 'project-b'))
                .rejects.toThrow('Task ghost not found')
        })

        it('throws for unknown target space', async () => {
            const task = await taskService.createTask('project-a', 'Nowhere')
            await expect(taskService.moveTaskToSpace(task.id, 'nonexistent'))
                .rejects.toThrow('Target space nonexistent not found')
        })
    })

    describe('moveMeetingToSpace', () => {
        beforeEach(() => {
            spaceService.addSpace('project-b', '/workspace/project-b')
        })

        it('moves a meeting from one space to another', async () => {
            const meeting = await taskService.createMeeting('project-a', 'Standup', '2025-03-15')
            // Load meetings into cache
            await taskService.getMeetingsForSpace('project-a')
            const origPath = meeting.filePath

            const moved = await taskService.moveMeetingToSpace(meeting.id, 'project-b')

            expect(moved.spaceId).toBe('project-b')
            expect(moved.filePath).toContain('/workspace/project-b/')

            // Original space file should no longer contain the meeting
            const origContent = fileService.getFile(origPath)!
            expect(origContent).not.toContain('## Standup')

            // Target space file should contain the meeting
            const targetContent = fileService.getFile(moved.filePath)!
            expect(targetContent).toContain('## Standup')
        })

        it('throws when meeting is already in target space', async () => {
            const meeting = await taskService.createMeeting('project-a', 'Stay', '2025-03-15')
            await expect(taskService.moveMeetingToSpace(meeting.id, 'project-a'))
                .rejects.toThrow('already in the target space')
        })

        it('throws for unknown meeting', async () => {
            await expect(taskService.moveMeetingToSpace('ghost', 'project-b'))
                .rejects.toThrow('Meeting ghost not found')
        })
    })

    describe('reorderTask', () => {
        it('reorders tasks within the same column', async () => {
            const t1 = await taskService.createTask('project-a', 'First')
            const t2 = await taskService.createTask('project-a', 'Second')
            const t3 = await taskService.createTask('project-a', 'Third')

            // Move Third to top
            await taskService.reorderTask(t3.id, 'todo', null)

            const tasks = await taskService.getTasksForSpace('project-a')
            const todoTasks = tasks.filter(t => t.status === 'todo')
            expect(todoTasks.map(t => t.title)).toEqual(['Third', 'First', 'Second'])
        })

        it('changes status when reordering to different column', async () => {
            const t1 = await taskService.createTask('project-a', 'Task A')

            await taskService.reorderTask(t1.id, 'in-progress', null)

            const tasks = await taskService.getTasksForSpace('project-a')
            expect(tasks[0].status).toBe('in-progress')
        })

        it('throws on unknown task', async () => {
            await expect(taskService.reorderTask('nonexistent', 'todo', null))
                .rejects.toThrow('not found')
        })
    })
})
