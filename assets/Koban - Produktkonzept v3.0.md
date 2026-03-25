# Koban — Markdown Workspace for Work & Life

> Inspired by Obsidian. Built for VS Code. Everything is a Markdown file.

---

## Philosophie

Wie Obsidian: **Alles ist eine Datei.** Keine Datenbank, kein Lock-in, keine Magie.

- **Eine Datei = ein Ding** (Task, Meeting, Notiz, Daily Note)
- **Frontmatter = Metadaten** (Status, Datum, Tags)
- **Markdown-Body = Inhalt** (frei, unstrukturiert, deiner)
- **Templates = Struktur** (nicht Code)
- **Spaces = Ordner** mit `_meta.md`

Koban liest deine Dateien und zeigt sie dir als Board, Liste oder Übersicht.
Du schreibst Markdown. Koban macht den Rest.

---

## Dateistruktur

```
workspace/
├── projekt-alpha/              ← Space
│   ├── _meta.md
│   ├── .tasks/
│   │   ├── api-refactor.md
│   │   └── fix-login.md
│   ├── .meetings/
│   │   └── 2026-03-25-standup.md
│   ├── architektur-ideen.md    ← Notiz (jede .md die nicht in .tasks/.meetings)
│   └── rest-vs-graphql.md      ← Notiz
│
├── personal/                   ← Space
│   ├── _meta.md
│   ├── .tasks/
│   ├── .meetings/
│   │   └── 2026-03-25-1on1-chef.md
│   └── karriereplan.md         ← Notiz
│
├── .daily/                     ← Daily Notes (global, nicht pro Space)
│   ├── 2026-03-24.md
│   └── 2026-03-25.md
│
└── .koban/                     ← Config & Templates
    └── templates/
        ├── task.md
        ├── meeting.md
        └── daily.md
```

**Notizen brauchen keinen eigenen Ordner.** Jede `.md`-Datei im Space-Root,
die nicht `_meta.md` ist, ist automatisch eine Notiz.

---

## Die 3 Dateitypen + Daily Notes

### 1. Tasks — `.tasks/*.md`

```yaml
---
status: todo
priority: high
tags: [api, backend]
due: 2026-03-28
---

# API Refactor

Was gemacht werden muss...

## Checklist
- [ ] Endpoints definieren
- [x] Schema erstellen
```

Eine Datei, Frontmatter, fertig. Koban zeigt es als Kanban-Board.

### 2. Meetings — `.meetings/*.md`

```yaml
---
type: standup
date: 2026-03-25
with: Max, Lisa
tags: [team]
---

# Standup 25.03.

## Agenda
- [ ] Sprint-Status
- [ ] Blocker besprechen

## Notizen
...

## Action Items
- [ ] @Max: Design-Doc bis Freitag
```

Ein Template, eine Datei. Fertig.

### 3. Notizen — `*.md` im Space-Root

Jede Markdown-Datei die direkt im Space-Ordner liegt (nicht in `.tasks/`, `.meetings/`)
ist eine Notiz. Kein Frontmatter nötig, keine Regeln.

### 4. Daily Notes — `.daily/YYYY-MM-DD.md`

Ein Shortcut, die Datei für heute öffnet sich. Global, nicht pro Space.

```yaml
---
date: 2026-03-25
tags: [daily]
---

# Dienstag, 25. März

## Heute erledigt
- API Schema fertig
- 1:1 mit Chef

## Blocker
- CI ist instabil

## Morgen
- [ ] Tests schreiben
- [ ] PR reviewen

## Notizen
Gute Idee von Lisa: Caching-Layer einbauen
```

---

## Was Koban NICHT macht (bewusst)

- **Kein Goal-Tracking** — Ziele sind Tasks mit `tags: [goal, q2]`
- **Kein Report-Generator** — Daily Note IST dein Report
- **Kein Dashboard** — Das Kanban Board reicht
- **Keine Recurring Meetings** — Neue Datei aus Template
- **Kein Graph** — Markdown-Links reichen
- **Keine Sync** — Git ist dein Sync

---

## Befehle

| Befehl | Shortcut | Was es tut |
|--------|----------|-----------|
| Open Board | `Cmd+Shift+K` | Kanban Board für aktuellen Space |
| New Task | `Cmd+K Cmd+T` | Neue Task-Datei aus Template |
| New Meeting | `Cmd+K Cmd+M` | Neue Meeting-Datei aus Template |
| Daily Note | `Cmd+Shift+D` | Daily Note für heute öffnen/erstellen |
| Quick Capture | `Cmd+Shift+N` | Schnell Notiz/Task erstellen |

5 Befehle. Das wars.

---

## Templates

Templates leben in `.koban/templates/` oder nutzen die Defaults.
Variablen: `{{date}}`, `{{date_long}}`, `{{weekday}}`, `{{title}}`, `{{space}}`

---

## brainPath — Cross-Window Zugriff

```jsonc
// VS Code User Settings (global)
{
  "koban.brainPath": "/Users/stefan/koban-brain"
}
```

Ein Ordner = dein "Brain". Koban nutzt diesen Pfad in jedem VS Code Window.
Kein Workspace nötig. Funktioniert überall.

---

## Board-Ansicht

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Todo     │ │ Doing    │ │ Review   │ │ Done     │
│          │ │          │ │          │ │          │
│ • API    │ │ • Login  │ │          │ │ • Schema │
│ • Tests  │ │   Fix    │ │          │ │ • Docs   │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

Kein Dashboard. Kein Mood-Tracker. Kein Burndown-Chart.
Spalten = Frontmatter `status`. Drag & Drop ändert den Status.

---

## Sidebar (Space Explorer)

```
KOBAN
├── 📁 projekt-alpha (3 tasks, 1 meeting)
│   ├── 📋 Tasks
│   │   ├── 🔴 API Refactor (high)
│   │   └── 🟡 Fix Login (medium)
│   ├── 📅 Meetings
│   │   └── Standup 25.03.
│   └── 📝 Notes
│       ├── Architektur-Ideen
│       └── REST vs GraphQL
│
├── 📁 personal (1 task)
│   └── ...
│
└── 📅 Daily Notes
    ├── Heute (25.03.)
    └── Gestern (24.03.)
```

---

## Zusammenfassung

> **Koban = Obsidian für deinen Arbeitsalltag, direkt in VS Code.**
> 3 Dateitypen + Daily Notes. 5 Befehle. Alles Markdown.
