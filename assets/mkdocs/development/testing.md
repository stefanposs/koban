# Testing

## Overview

Koban uses [Vitest](https://vitest.dev/) for unit testing with in-memory test doubles.

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Test Structure

```
tests/
├── unit/
│   ├── frontmatterParser.test.ts   # Frontmatter parsing/serialization
│   └── taskService.test.ts         # Task CRUD, status, archival
└── fakes/
    ├── fakeFileService.ts           # In-memory file system
    ├── fakeConfigService.ts         # Configurable defaults
    └── fakeSpaceService.ts          # In-memory space registry
```

## Test Fakes

All services have interfaces (`IFileService`, `IConfigService`, `ISpaceService`) that allow swapping real implementations with fakes in tests.

### FakeFileService

An in-memory `Map<string, string>` that implements `IFileService`. Supports:

- `addFile(path, content)` — seed files for test setup
- `getFile(path)` — inspect written files
- `getAllFiles()` — snapshot the entire "filesystem"

### FakeConfigService

All configuration values are public properties — override them directly:

```typescript
const config = new FakeConfigService();
config.autoArchiveDays = 7;
config.defaultSpaceId = 'my-space';
```

### FakeSpaceService

In-memory space registry with an `addSpace()` helper:

```typescript
const spaces = new FakeSpaceService();
spaces.addSpace('project-a', '/workspace/project-a');
```

## Writing Tests

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { TaskService } from '../../ext/services/taskService';
import { FakeFileService } from '../fakes/fakeFileService';
import { FakeConfigService } from '../fakes/fakeConfigService';
import { FakeSpaceService } from '../fakes/fakeSpaceService';

describe('TaskService', () => {
    let taskService: TaskService;
    let fileService: FakeFileService;

    beforeEach(() => {
        fileService = new FakeFileService();
        const configService = new FakeConfigService();
        const spaceService = new FakeSpaceService();
        spaceService.addSpace('test', '/workspace/test');
        taskService = new TaskService(fileService, configService, spaceService);
    });

    it('creates a task', async () => {
        const task = await taskService.createTask('test', 'My Task');
        expect(task.title).toBe('My Task');
        expect(fileService.getFile(task.filePath)).toContain('# My Task');
    });
});
```
