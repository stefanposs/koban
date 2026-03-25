/**
 * Config Service - Manages extension configuration
 */

import * as vscode from 'vscode';
import { KobanConfig, KanbanColumnConfig, IConfigService } from '../types';

export class ConfigService implements IConfigService {
    private config: vscode.WorkspaceConfiguration;

    constructor() {
        this.config = vscode.workspace.getConfiguration('koban');
    }

    getExcludePatterns(): string[] {
        return this.config.get('excludePatterns') || [
            '**/node_modules/**',
            '**/.git/**',
            '**/dist/**',
            '**/build/**'
        ];
    }

    getShowSystemFolders(): boolean {
        return this.config.get('showSystemFolders') || false;
    }

    getAutoSave(): boolean {
        return this.config.get('autoSave') !== false;
    }

    getAutoArchiveDays(): number {
        return this.config.get('autoArchiveDays') || 0; // 0 = disabled
    }

    getDefaultSpaceId(): string | undefined {
        return this.config.get('defaultSpace') || undefined;
    }

    getKanbanColumns(): KanbanColumnConfig[] {
        return this.config.get('kanbanColumns') || [
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
                id: 'done',
                name: 'Done',
                status: 'done',
                color: '#10b981'
            }
        ];
    }

    getDefaultTaskTemplate(): string {
        return this.config.get('defaultTaskTemplate') || `---
id: {{id}}
space: {{space}}
status: todo
priority: medium
created: {{date}}
---

# {{title}}

## Description

## Checklist
- [ ] 

## Links
`;
    }

    getDefaultMeetingTemplate(): string {
        return this.config.get('defaultMeetingTemplate') || `---
type: meeting
id: {{id}}
space: {{space}}
date: {{date}}
---

# {{title}}

## Agenda
1. 

## Notes

## Action Items
- [ ] 

## Decisions
`;
    }

    onConfigurationChanged(callback: () => void): vscode.Disposable {
        return vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('koban')) {
                this.config = vscode.workspace.getConfiguration('koban');
                callback();
            }
        });
    }
}
