import type { IConfigService, KanbanColumnConfig } from '../../ext/types';

export class FakeConfigService implements IConfigService {
    excludePatterns: string[] = ['**/node_modules/**', '**/.git/**'];
    kanbanColumns: KanbanColumnConfig[] = [
        { id: 'todo', name: 'To Do', status: 'todo' },
        { id: 'in-progress', name: 'In Progress', status: 'in-progress' },
        { id: 'review', name: 'Review', status: 'review' },
        { id: 'done', name: 'Done', status: 'done' },
    ];
    defaultSpaceId: string | undefined = undefined;
    autoArchiveDays = 0;
    defaultTaskTemplate = '';
    showSystemFolders = false;

    getExcludePatterns(): string[] { return this.excludePatterns; }
    getKanbanColumns(): KanbanColumnConfig[] { return this.kanbanColumns; }
    getDefaultSpaceId(): string | undefined { return this.defaultSpaceId; }
    getAutoArchiveDays(): number { return this.autoArchiveDays; }
    getDefaultTaskTemplate(): string { return this.defaultTaskTemplate; }
    getShowSystemFolders(): boolean { return this.showSystemFolders; }
    onConfigurationChanged(_handler: () => void): { dispose(): void } {
        return { dispose() {} };
    }
}
