---
tags: [vscode-extension, architecture, kanban, markdown, specification]
created: 2026-03-23
version: 2.0
status: comprehensive-specification
---

# 🎯 Markdown Kanban Workspace (MKW) - Vollständige Spezifikation

## Executive Summary

**Markdown Kanban Workspace (MKW)** ist eine VS Code Extension, die **ordnerbasierte Projektstruktur** mit **visuellem Kanban-Board** verbindet - mit Markdown als Single Source of Truth.

> **Warum Markdown?** Im Zuge der KI-Revolution gewinnen strukturierte, menschlich lesbare Daten zunehmend an Bedeutung.

---

## 🏷️ Empfohlener Name: **Koban**

Nach umfassender Analyse empfehlen wir **"Koban"** als Produktnamen:

| Aspekt | Bewertung |
|--------|-----------|
| **Kurz & einprägsam** | 2 Silben, leicht auszusprechen |
| **Einzigartig** | Keine direkte Konkurrenz im Markt |
| **Assoziation** | Kurzform von "Kanban" + "Ko" (Kollaboration) |
| **Domain** | koban.io wahrscheinlich verfügbar |
| **Command Prefix** | `koban:` oder `kb:` |

**Alternativen:**
- **MarkBoard** - Klarer, professioneller
- **SpaceBoard** - Betont das einzigartige Space-Konzept
- **KanbanMD** - Entwickler-freundlich, selbsterklärend

**Tagline:** *"Your workspace, in plain sight"* oder *"Where files meet flow"*

---

## 🏗️ Kernkonzept: Spaces

### Was ist ein Space?

Ein **Space** ist ein selbstgeschlossener Kontext, der als Verantwortungsbereich fungiert. Ein Space ist nicht einfach "ein Ordner", sondern ein bewusst definierter Bereich mit eigener Aufgaben- und Meeting-Struktur.

| Typ | Beispiel |
|-----|----------|
| Projekt | "Website-Relaunch Q2" |
| Verantwortungsbereich | "Backend-Infrastruktur" |
| Thema/Stream | "KI-Integration" |
| Initiative | "Security-Audit 2024" |

> **Wichtiger Unterschied:** Ein übergeordneter Ordner wie `Projekte/` ist **kein Space** - er enthält nur Spaces. Erst die darin liegenden Ordner werden durch Konfiguration zu Spaces.

### Space-Erkennung (3 Methoden)

Ein Ordner wird zum Space durch **eines** dieser Kriterien (Priorität: explizit > frontmatter > konventionell):

| Priorität | Methode | Erkennung |
|-----------|---------|-----------|
| 1 | **Explizit** | `.mkw/space.yml` Konfigurationsdatei |
| 2 | **Frontmatter** | `_meta.md` mit `type: space` |
| 3 | **Konventionell** | Enthält `.tasks/` und `.meetings/` (Systemordner) |

### Ordnerstruktur

```
workspace/
├── .mkw/                    # Extension-Metadaten (optional)
│   └── config.yml
│
├── Projekte/                # ← Container (kein Space)
│   ├── Website-Relaunch/    # ← Space
│   │   ├── _meta.md
│   │   ├── .tasks/          # System-Ordner (versteckt)
│   │   │   ├── task-001.md
│   │   │   └── task-002.md
│   │   ├── .meetings/       # System-Ordner (versteckt)
│   │   │   ├── 2024-03-22-kickoff.md
│   │   │   └── 2024-03-25-review.md
│   │   ├── docs/            # ← Beliebige Inhalte
│   │   │   ├── api-spec.md
│   │   │   └── mockups.png  # ← Verlinkbar, nicht geparst
│   │   └── ...
│   │
│   └── Mobile-App/          # ← Space
│       ├── _meta.md
│       ├── .tasks/
│       └── .meetings/
│
├── Verantwortungsbereiche/  # ← Container (kein Space)
│   └── Backend/             # ← Space
│       ├── _meta.md
│       ├── .tasks/
│       └── .meetings/
│
└── Archive/                 # Abgeschlossene Spaces
    └── ...
```

### Flexibilität innerhalb eines Spaces

- Beliebige Unterordner und Dateien
- Nicht-Markdown-Dateien werden **verlinkt**, nicht geparst
- Eigene Dokumentationsstruktur neben den System-Ordnern
- Verlinkungen zwischen Spaces via `[[Space::Dokument]]`

---

## 📝 Markdown-Schema

### Space-Metadaten (_meta.md)

```yaml
---
type: space
id: website-relaunch-q2
name: Website Relaunch Q2
description: Komplette Überarbeitung der Unternehmenswebsite
owner: Max Mustermann
created: 2024-03-22
status: active          # active | paused | archived
color: "#3b82f6"
---

# Website Relaunch Q2

## Ziele
- [ ] Neue CI/CD live bis Mai
- [ ] Ladezeit < 2 Sekunden

## Ressourcen
- Design-System: [[design-system-v2]]
- Stakeholder: [[person::anna-mueller]]
```

### Task-Template

```yaml
---
id: task-001
space: website-relaunch-q2    # ← Verweis auf Space-ID
status: in-progress            # todo | in-progress | review | done | blocked
priority: high                 # low | medium | high | critical
assignee: Max
due: 2024-04-15
tags: [backend, api]
created: 2024-03-22
---

# API-Endpoint implementieren

## Beschreibung
REST-Endpoint für Benutzerverwaltung erstellen.

## Checkliste
- [x] OpenAPI-Spezifikation
- [ ] Implementierung
- [ ] Tests schreiben

## Verknüpfungen
- Meeting: [[2024-03-22-kickoff]]
- Blockiert von: [[task-000]]
- Extern: [Mockups](./docs/mockups.png)
```

### Meeting-Template (Erweitert)

```yaml
---
type: meeting
id: 2024-03-25-sprint-review
space: website-relaunch-q2
meeting_type: sprint_review      # daily | planning | review | retro | kickoff | stakeholder
date: 2024-03-25
start_time: "14:00"
duration: 60m
participants: [max, lisa, anna]
agenda:
  - "Demo completed features"
  - "Gather stakeholder feedback"
tasks_reviewed: [task-001, task-002, task-003]
decisions:
  - "Move API optimization to next sprint"
  - "Add performance testing to DoD"
action_items:
  - task: "Create performance test suite"
    assignee: lisa
    due: 2024-03-27
---

# Sprint Review — Website Relaunch

## Completed This Sprint
- ✅ API Endpoint implementation
- ✅ Auth Flow integration

## Feedback Received
- Load time target: < 2 seconds (currently 2.3s)

## Next Sprint Priorities
1. Performance optimization
2. Cache layer implementation
```

---

## 🏛️ Systemarchitektur

### High-Level Architektur

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         VS Code Extension Host                           │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │   Space      │  │   Kanban     │  │   Command    │  │   Config    │ │
│  │   Explorer   │  │   Webview    │  │   Palette    │  │   Manager   │ │
│  │  (TreeView)  │  │   (React)    │  │              │  │             │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                 │                  │                 │       │
│         └─────────────────┴──────────────────┴─────────────────┘       │
│                                    │                                    │
│                         ┌──────────┴──────────┐                         │
│                         │   Core Services     │                         │
│                         │  ┌───────────────┐  │                         │
│                         │  │ Space Service │  │                         │
│                         │  │ Task Service  │  │                         │
│                         │  │ File Service  │  │                         │
│                         │  │ Event Bus     │  │                         │
│                         │  └───────────────┘  │                         │
│                         └──────────┬──────────┘                         │
│                                    │                                    │
│                         ┌──────────┴──────────┐                         │
│                         │  File System Layer    │                         │
│                         │  ┌───────────────┐  │                         │
│                         │  │ File Watcher  │  │                         │
│                         │  │ Parser/Writer │  │                         │
│                         │  │ Index Manager │  │                         │
│                         │  └───────────────┘  │                         │
│                         └─────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Workspace File System                            │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │
│  │ _meta.md│  │ .tasks/ │  │.meetings│  │  docs/  │  │ .mkw/   │      │
│  │         │  │         │  │         │  │         │  │         │      │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Domain Model (TypeScript Interfaces)

```typescript
// ============================================================================
// Space - The primary organizational unit
// ============================================================================

interface Space {
  id: string;                    // Unique identifier
  name: string;                  // Human-readable name
  description?: string;         // Optional description
  rootPath: string;             // Absolute path to space root
  status: 'active' | 'paused' | 'archived';
  color?: string;               // Optional color for UI theming
  owner?: string;               // Owner/creator
  createdAt: Date;
  updatedAt: Date;
  detectionMethod: 'frontmatter' | 'convention' | 'explicit';
  stats: SpaceStats;
}

interface SpaceStats {
  totalTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
  totalMeetings: number;
  upcomingMeetings: number;
  completionPercentage: number;
}

// ============================================================================
// Task - Work item within a space
// ============================================================================

type TaskStatus = 'todo' | 'in-progress' | 'review' | 'done' | 'blocked';
type TaskPriority = 'low' | 'medium' | 'high' | 'critical';

interface Task {
  id: string;
  spaceId: string;              // Reference to parent space
  title: string;                // Task title (from Markdown heading)
  status: TaskStatus;
  priority: TaskPriority;
  assignee?: string;
  dueDate?: Date;
  tags: string[];
  filePath: string;            // Absolute path to task file
  createdAt: Date;
  updatedAt: Date;
  description?: string;
  checklist: ChecklistItem[];
  links: Link[];
}

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

interface Link {
  type: 'task' | 'meeting' | 'external' | 'file';
  target: string;
  displayText?: string;
}

// ============================================================================
// Meeting - Scheduled event within a space
// ============================================================================

interface Meeting {
  id: string;
  spaceId: string;
  title: string;
  date: Date;
  duration?: number;          // in minutes
  attendees?: string[];
  agenda?: string;
  notes?: string;
  filePath: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Configuration - Extension and workspace settings
// ============================================================================

interface MKWConfig {
  global: {
    excludePatterns: string[];           // File patterns to exclude
    showSystemFolders: boolean;          // Show hidden system folders
    defaultTaskTemplate: string;
    defaultMeetingTemplate: string;
    autoSave: boolean;
    kanbanColumns: KanbanColumnConfig[];
  };
  workspace?: Partial<MKWConfig['global']>;
}

interface KanbanColumnConfig {
  id: string;
  name: string;
  status: TaskStatus;
  color?: string;
  wipLimit?: number;           // Work in Progress limit
}
```

---

## 🧩 Extension-Komponenten

### 1. Space-Explorer (Tree View)

```
📁 Koban: Spaces
├── 🟢 Website Relaunch Q2        [5/12 tasks]
│   ├── 📋 Tasks (5)
│   │   ├── ⏳ [H] API Endpoint
│   │   └── ⏸️ [M] Docs aktualisieren
│   ├── 📅 Meetings (2)
│   │   └── ✅ 2024-03-22 Kickoff
│   └── 💡 Ideas (1)
│
├── 🟡 Backend Infrastructure     [paused]
│   └── ...
│
└── 📦 Archive (3 spaces)
```

**Kontextmenü:**
- `+ New Space` → Space-Template mit Ordnerstruktur
- `+ New Task` → Task in `.tasks/` erstellen
- `+ New Meeting` → Meeting mit Datum
- `Open Kanban` → Board für diesen Space

### 2. Kanban-Board (Webview)

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   TODO      │  │ IN PROGRESS │  │   REVIEW    │  │    DONE     │
│   (5)       │  │    (3)      │  │    (2)      │  │    (8)      │
├─────────────┤  ├─────────────┤  ├─────────────┤  ├─────────────┤
│ [H] API     │  │ [C] Auth    │  │ [M] DB      │  │ ✓ Setup     │
│   Endpoint  │  │   Flow      │  │   Schema    │  │   Repo      │
│ 📅 15.04    │  │ 👤 Max      │  │ 👤 Lisa     │  │ 📅 20.03    │
│ #backend    │  │ #security   │  │             │  │             │
├─────────────┤  ├─────────────┤  ├─────────────┤  ├─────────────┤
│ [M] Docs    │  │ [H] Cache   │  │             │  │ ✓ CI/CD     │
│   aktualis. │  │   Layer     │  │             │  │   Pipeline  │
│ 📎 mockups  │  │             │  │             │  │             │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

**Interaktionen:**
- Karte ziehen → `status:` im Frontmatter aktualisiert
- Doppelklick → Markdown-Editor öffnet
- 📎-Icon → verlinkte Nicht-Markdown-Dateien anzeigen

### 3. Command Palette

| Befehl | Funktion |
|--------|----------|
| `Koban: New Space` | Space mit Ordnerstruktur erstellen |
| `Koban: New Task` | Task im aktuellen Space |
| `Koban: New Meeting` | Meeting-Template mit Datum |
| `Koban: Open Kanban` | Board für aktuellen Space |
| `Koban: Reindex Spaces` | Space-Erkennung neu durchführen |

---

## 🔄 Workflow-Modell

### Task-Lifecycle & Transitions

```
┌─────────┐    ┌─────────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ BACKLOG │───▶│    TODO     │───▶│   IN    │───▶│ REVIEW  │───▶│  DONE   │
│         │    │  (Ready)    │    │PROGRESS │    │         │    │         │
└─────────┘    └─────────────┘    └────┬────┘    └────┬────┘    └─────────┘
                                        │              │
                                        ▼              ▼
                                   ┌─────────┐    ┌─────────┐
                                   │ BLOCKED │    │ REJECT  │
                                   │         │◄───│         │
                                   └────┬────┘    └─────────┘
                                        │
                                        └──────────────────────▶
```

### State Definitions

| State | Definition | Exit Criteria |
|-------|-----------|---------------|
| **Backlog** | Prioritized but not ready | Refined, estimated, has acceptance criteria |
| **Todo** | Ready to start | WIP limit allows, assignee available |
| **In Progress** | Actively being worked | Work stopped or completed |
| **Review** | Awaiting validation | Code reviewed, tested, approved |
| **Done** | Completed per DoD | Archived after sprint/period |
| **Blocked** | Impediment preventing progress | Blocker resolved |
| **Rejected** | Does not meet requirements | Refined and re-prioritized |

### Meeting-Typen

| Meeting Type | Zweck | Frequenz |
|--------------|-------|----------|
| Daily Standup | Sync, Blocker | Täglich (15min) |
| Sprint Planning | Sprint Commitment | 2-wöchentlich |
| Backlog Refinement | Stories vorbereiten | Wöchentlich |
| Sprint Review | Demo, Feedback | Sprint-Ende |
| Retrospective | Prozess-Verbesserung | Sprint-Ende |
| Kickoff | Ziele abstimmen | Pro Projekt |
| Stakeholder Update | Status-Kommunikation | 2-wöchentlich |

### Cross-Space Collaboration Patterns

**Pattern 1: Dependency Chain**
```yaml
# In Frontend task
---
id: task-fe-001
space: frontend
status: blocked
blocked_by: [backend::task-api-001]  # Cross-space reference
---
```

**Pattern 2: Shared Initiative**
```yaml
# Tasks in both spaces reference initiative
initiative: security-audit-2024
```

**Pattern 3: Handoff Workflow**
- Task moves via `handoff_to: qa-space` trigger
- Creates linked task in target space
- Original task archived with `handed_off: true`

---

## 💡 Einzigartige Selling Points (USP)

| USP | Erklärung |
|-----|-----------|
| **Semantische Spaces** | Klare Unterscheidung zwischen Container-Ordnern und Verantwortungsbereichen |
| **Versteckte Systemstruktur** | `.tasks/`, `.meetings/` bleiben sauber, eigene Inhalte flexibel |
| **Markdown-First, nicht Markdown-Only** | Verlinkung beliebiger Dateien, keine Fragmentierung |
| **KI-optimiert** | Klare `space:`-Referenzen, parsbare Frontmatter für Agents |
| **Kein Lock-in** | Lesbares Markdown, standardkonforme Ordnerstruktur |
| **WIP Limits** | Konfigurierbare Work-in-Progress Limits pro Spalte |
| **Cross-Space Linking** | `[[Space::Document]]` Syntax für Verknüpfungen |

---

## 🛠️ Technologie-Stack

### Core Technologies

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Extension API** | VS Code Extension API | Native integration, event system, UI components |
| **Language** | TypeScript 5.x | Type safety, excellent VS Code support |
| **Build Tool** | esbuild / webpack | Fast bundling, VS Code extension compatibility |
| **Testing** | Vitest + VS Code Test | Unit and integration testing |
| **Linting** | ESLint + Prettier | Code quality and consistency |

### Webview Technologies

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Framework** | React 18 | Component-based UI, large ecosystem |
| **State Management** | Zustand | Lightweight, TypeScript-friendly |
| **Styling** | Tailwind CSS | Utility-first, rapid development |
| **Drag & Drop** | @dnd-kit | Modern, accessible, customizable |
| **Icons** | Lucide React | Consistent, lightweight icon set |
| **Build** | Vite | Fast HMR, optimized production builds |

### Parsing & Data

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Frontmatter** | gray-matter | Industry standard, reliable |
| **Markdown** | remark / unified | Extensible, plugin ecosystem |
| **Validation** | Zod | Runtime type validation |
| **Date Handling** | date-fns | Lightweight, tree-shakeable |

---

## 📊 Performance-Ziele

| Metrik | Ziel | Strategie |
|--------|------|-----------|
| Spaces pro Workspace | 100 | Lazy loading, virtual scrolling |
| Tasks pro Space | 500 | Pagination, filtering |
| Gesamt-Workspace-Tasks | 5.000 | Indexed queries, caching |
| Index-Build-Zeit | < 3s | Incremental updates, worker threads |
| Kanban-Board-Load | < 1s | Virtualized lists, lazy rendering |
| File-Change-Propagation | < 100ms | Debounced events, delta updates |

---

## 🔐 Architektur-Entscheidungen (ADRs)

### ADR-001: File System as Single Source of Truth

**Status:** Accepted

**Decision:** Use Markdown files as the single source of truth with in-memory indexing for performance.

**Consequences:**
- ✅ No lock-in, human-readable, version control friendly, works offline
- ✅ Natural integration with existing Markdown workflows
- ⚠️ File I/O is slower than database queries (mitigated by indexing)
- ⚠️ Concurrent edits can cause conflicts (mitigated by file locking)

### ADR-002: Event-Driven Architecture

**Status:** Accepted

**Decision:** Implement central Event Bus for decoupled communication between components.

**Consequences:**
- ✅ Loose coupling between components
- ✅ Easy to add new subscribers without modifying publishers
- ✅ Testable - can mock events
- ⚠️ Event ordering must be carefully managed

### ADR-003: Webview for Kanban Board

**Status:** Accepted

**Decision:** Use Webview API with React for the Kanban board UI.

**Consequences:**
- ✅ Full control over UI/UX
- ✅ Can use modern React ecosystem
- ✅ Drag-and-drop libraries readily available
- ⚠️ Communication with extension requires postMessage API
- ⚠️ Bundle size considerations

---

## 📋 Offene Fragen & Entscheidungen

- [ ] Verschachtelte Sub-Spaces erlauben? (Projekt → Phase → Sprint)
- [ ] Cross-Space-Verknüpfungen im Board visualisieren?
- [ ] Systemordner immer versteckt oder konfigurierbar?
- [ ] Synchronisation zwischen mehreren Benutzern?
- [ ] Mobile App oder Web-Version?
- [ ] Integration mit GitHub/GitLab Issues?

---

## 🚀 Nächste Schritte (Roadmap)

### Phase 1: MVP (4-6 Wochen)
- [ ] Prototyp: Space-Erkennung mit FileSystemWatcher
- [ ] React-Komponenten für Board-UI
- [ ] Parser: Frontmatter → TypeScript-Interfaces
- [ ] Test: Verschachtelte Ordnerstrukturen

### Phase 2: Core Features (4-6 Wochen)
- [ ] Drag-and-drop im Kanban-Board
- [ ] Space-Explorer Tree View
- [ ] Command Palette Integration
- [ ] Konfigurationsmanagement

### Phase 3: Polish (2-4 Wochen)
- [ ] Performance-Optimierungen
- [ ] Fehlerbehandlung
- [ ] Dokumentation
- [ ] VS Code Marketplace Release

### Phase 4: Erweiterungen
- [ ] WIP Limits
- [ ] Sprint/Iteration Support
- [ ] Epics/Parent Tasks
- [ ] Time Tracking
- [ ] Team-Kollaboration

---

## 📁 Projektstruktur (Vorschlag)

```
koban-extension/
├── src/
│   ├── extension.ts              # Entry point
│   ├── core/
│   │   ├── types.ts              # Core TypeScript interfaces
│   │   ├── constants.ts          # Constants and enums
│   │   └── events.ts             # Event emitters
│   ├── services/
│   │   ├── space-service.ts      # Space discovery & management
│   │   ├── task-service.ts       # Task CRUD operations
│   │   ├── file-watcher.ts       # File system monitoring
│   │   ├── markdown-parser.ts    # Frontmatter parsing
│   │   └── config-service.ts     # Configuration management
│   ├── providers/
│   │   └── space-tree-provider.ts # TreeDataProvider
│   ├── webview/
│   │   ├── kanban-panel.ts       # WebviewPanel manager
│   │   └── kanban-ui/            # React/Vue frontend
│   │       ├── src/
│   │       └── build/            # Bundled output
│   └── commands/
│       └── index.ts              # Command registrations
├── media/                        # Static assets for webview
├── package.json
└── tsconfig.json
```

---

## 📝 Zusammenfassung

**Koban** (Markdown Kanban Workspace) ist eine VS Code Extension, die:

1. **Ordnerbasierte Projektstruktur** mit visuellem Kanban-Board verbindet
2. **Markdown als Single Source of Truth** verwendet
3. **Spaces** als semantische Verantwortungsbereiche einführt
4. **Kein Lock-in** bietet - alle Daten bleiben lesbar und portabel
5. **KI-optimiert** ist durch strukturierte Frontmatter-Daten
6. **Flexibel** bleibt durch versteckte Systemordner + beliebige Inhalte

Die Architektur basiert auf einem Event-Driven Ansatz mit File System als Single Source of Truth, in-memory Indexing für Performance, und einem React-basierten Webview für das Kanban-Board.

---

*Dokument erstellt am: 2026-03-23*
*Version: 2.0 - Comprehensive Specification*
