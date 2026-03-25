# 🎯 Koban - Lean MVP & UX Manifest
*Status: Optimiert & Rasiermesserscharf*

## 1. Die harte Wahrheit (Produkt-Fokus)
Ein gutes Produkt löst **ein** Problem perfekt. Koban darf im MVP nicht Jira, Trello und Notion gleichzeitig ersetzen wollen.
- **Die Zielgruppe:** Der Solo-Entwickler / Indie-Hacker, der seinen Editor für Task-Management nicht verlassen will.
- **Das Problem:** Kontextwechsel zwischen Code und Ticketsystem tötet den Flow.
- **Die Lösung:** Ein Kanban-Board, das zu 100% aus lokalen Markdown-Dateien generiert wird und sofort ohne Setup funktioniert.

---

## 2. Die "Zero-Config" Onboarding-UX (Time-to-Value < 60 Sekunden)
Der kritischste Moment für eine VS Code Extension ist die erste Minute. Wenn der User erst eine Config-JSON schreiben oder Ordner anlegen muss, wird die Extension deinstalliert.

1. **Installation:** User lädt Extension herunter.
2. **Aktivierung:** Sidebar-Icon taucht auf. User klickt es an.
3. **Empty State (Magic Button):**
   - Ein großer, einladender Button: *"🚀 Initialize Koban Workspace in this Project"*
   - **Was im Hintergrund passiert:** Koban erstellt stillschweigend einen `.koban/` Ordner (in `.gitignore` eingetragen via API) mit einer `_board.md` und einem Beispiel-Task.
4. **Instant Gratification:** Das Kanban-Board rendert sich **sofort** mit einem Konfetti-Effekt oder einer geschmeidigen Animation. Der User kann den ersten Task sofort per Drag-and-Drop verschieben.

---

## 3. UX & UI Optimierungen für Entwickler
Entwickler hassen langsame, unübersichtliche Webviews. Das UI muss sich anfühlen wie natives VS Code.

### A. Tastatur-Erste-Philosophie (Keyboard-First)
Alles muss ohne Maus machbar sein.
- `CMD/CTRL + Shift + K`: Öffnet das Koban Board.
- `C`: Erstellt neuen Task in der "Backlog" Spalte.
- `J / K`: Navigiert durch Tasks.
- `Space`: Öffnet Task-Details (Markdown-Side-by-Side View).
- `1, 2, 3, 4`: Verschiebt markierten Task in die jeweilige Spalte (Backlog, In Progress, Review, Done).

### B. "Code-to-Task" Workflow (Das Killer-Feature)
- Markiere eine Code-Zeile (oder ein `// TODO: ...`) direkt im Editor.
- Rechtsklick -> *"Create Koban Task from Selection"*.
- Koban legt eine Markdown-Karte an und fügt den Code-Snippet sowie einen klickbaren Link (z.B. `[src/auth.ts#L42]`) als Referenz ein.
- **Warum das genial ist:** Der Task ist untrennbar mit der Codebasis verbunden.

### C. Visual Design: Nativ & Clean
- **Theming:** Die Webview MUSS die CSS-Variablen von VS Code (`var(--vscode-editor-background)`, etc.) nutzen. Wenn der User "Dracula" nutzt, ist Koban "Dracula". Keine eigenen Farben, kein Blinging – reine Konsistenz.
- **Font-Rendering:** Nutze die Standard-Monospace-Fonts des Editors für Ticket-IDs und Code-Snippets.

---

## 4. Was wir für V1.0 ERSATZLOS STREICHEN (Scope-Cuts)
Um schnell launchen zu können, werfen wir Folgendes raus:
❌ **Spaces & Team-Sync:** Keine Git-Hooks im ersten Release. Kein komplexes Merging. Wer es trackt, committet den `.koban` Ordner einfach.
❌ **Custom Fields & Komplexe YAML-Schemas:** Wir nutzen feste Standard-Felder (`title`, `status`, `priority`). Keine freien Custom Fields im MVP.
❌ **Analytics & Burndown-Charts:** Unwichtig für den Solo-Entwickler. Er will nur "To-Do" nach "Done" schieben.
❌ **Kalender-View:** Wir sind ein Kanban-Tool, kein Terminplaner.

---

## 5. Technische UX (Performance)
1. **Keine Loading-Spinner:** Weil alle Daten lokal im `.koban` Ordner liegen, muss das Board in **<100ms** rendern. Wir cachen den State in Memory.
2. **Markdown Bi-Direktionalität:**
   - Ändert der User den Status im Board via Drag & Drop -> Die `.md` Datei wird im Hintergrund via Node.js `fs` modifiziert.
   - Ändert der User die `.md` Datei händisch im Editor -> Der FileSystemWatcher erkennt das und das Board updatet sich reaktiv in Echtzeit (ohne Reload).

## Nächste Schritte zur Implementierung
Wir sollten die Code-Struktur exakt nach diesem MVP-Prinzip aufbauen:
1. VS Code Extension registrieren (Activation Events: `onView:koban-sidebar`).
2. Webview mit React & `dnd-kit` (für performantes Dragging) aufsetzen.
3. Den lokalen Markdown-Parser (z.B. `gray-matter`) via IPC an die Webview binden.