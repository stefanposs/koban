import type { ISpaceService, Space, SpaceStatus, SpaceStats, TaskStatus } from '../../ext/types';

function defaultStats(): SpaceStats {
    return {
        totalTasks: 0,
        tasksByStatus: {
            'todo': 0, 'in-progress': 0, 'review': 0,
            'done': 0, 'blocked': 0, 'archived': 0,
        } as Record<TaskStatus, number>,
        totalMeetings: 0,
        upcomingMeetings: 0,
        completionPercentage: 0,
    };
}

export class FakeSpaceService implements ISpaceService {
    private spaces = new Map<string, Space>();

    addSpace(id: string, rootPath: string, overrides?: Partial<Space>): Space {
        const space: Space = {
            id,
            name: overrides?.name ?? id,
            rootPath,
            status: overrides?.status ?? 'active',
            createdAt: overrides?.createdAt ?? new Date(),
            updatedAt: overrides?.updatedAt ?? new Date(),
            stats: overrides?.stats ?? defaultStats(),
            ...overrides,
        };
        this.spaces.set(id, space);
        return space;
    }

    async discoverSpaces(): Promise<Space[]> {
        return [...this.spaces.values()];
    }

    getSpaces(): Space[] {
        return [...this.spaces.values()];
    }

    getSpace(id: string): Space | undefined {
        return this.spaces.get(id);
    }

    async updateSpaceStatus(id: string, status: SpaceStatus): Promise<void> {
        const space = this.spaces.get(id);
        if (!space) { throw new Error(`Space ${id} not found`); }
        space.status = status;
    }
}
