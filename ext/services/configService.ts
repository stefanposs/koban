/**
 * Config Service - Manages extension configuration
 */

import * as vscode from 'vscode';
import { KobanConfig, KanbanColumnConfig, IConfigService } from '../types';

export class ConfigService implements IConfigService {
    private getConfig(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration('koban');
    }

    getExcludePatterns(): string[] {
        return this.getConfig().get<string[]>('excludePatterns', [
            '**/node_modules/**',
            '**/.git/**',
            '**/dist/**',
            '**/build/**'
        ]);
    }

    getShowSystemFolders(): boolean {
        return this.getConfig().get<boolean>('showSystemFolders', false);
    }

    getAutoSave(): boolean {
        return this.getConfig().get<boolean>('autoSave', true);
    }

    getAutoArchiveDays(): number {
        return this.getConfig().get<number>('autoArchiveDays', 0);
    }

    getDefaultSpaceId(): string | undefined {
        return this.getConfig().get<string>('defaultSpace') || undefined;
    }

    getKanbanColumns(): KanbanColumnConfig[] {
        return this.getConfig().get<KanbanColumnConfig[]>('kanbanColumns', [
            {
                id: 'todo',
                name: 'To Do',
                status: 'todo',
                color: '#6b7280'
            },
            {
                id: 'in-progress',
                name: 'In Progress',
                status: 'in-progress',
                color: '#3b82f6'
            },
            {
                id: 'review',
                name: 'Review',
                status: 'review',
                color: '#f59e0b'
            },
            {
                id: 'blocked',
                name: 'Blocked',
                status: 'blocked',
                color: '#ef4444'
            },
            {
                id: 'done',
                name: 'Done',
                status: 'done',
                color: '#10b981'
            }
        ]);
    }

    getDefaultTaskTemplate(): string {
        return this.getConfig().get<string>('defaultTaskTemplate', `---
id: {{id}}
status: todo
priority: medium
created: {{date}}
---

# {{title}}

## Description

## Checklist
- [ ] 

## Links
`);
    }

    getDefaultMeetingTemplate(): string {
        return this.getConfig().get<string>('defaultMeetingTemplate', `---
type: meeting
id: {{id}}
date: {{date}}
---

# {{title}}

## Agenda
1. 

## Notes

## Action Items
- [ ] 

## Decisions
`);
    }

    onConfigurationChanged(callback: () => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('koban')) {
                callback();
            }
        });
    }
}
