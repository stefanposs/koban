---
tags: [vscode-extension, ux-design, kanban, design-system]
created: 2026-03-23
version: 1.0
status: design-specification
---

# 🎨 Koban UX Design System

> **Design Philosophy:** *"Where files meet flow"* — Every interaction should feel like moving through water: fluid, responsive, and satisfying.

---

## 📋 Table of Contents

1. [Micro-interactions](#1-micro-interactions)
2. [Visual Design Language](#2-visual-design-language)
3. [Interaction Patterns](#3-interaction-patterns)
4. [Feedback Systems](#4-feedback-systems)
5. [Gamification Elements](#5-gamification-elements)
6. [Accessibility](#6-accessibility)
7. [Onboarding Experience](#7-onboarding-experience)

---

## 1. Micro-interactions

### 1.1 Task Drag-and-Drop Animations

#### Visual States

```typescript
// Drag state definitions with spring physics
interface DragStates {
  idle: {
    scale: 1;
    shadow: '0 1px 3px rgba(0,0,0,0.1)';
    border: '1px solid transparent';
  };
  lift: {
    scale: 1.02;
    shadow: '0 8px 30px rgba(0,0,0,0.12), 0 4px 8px rgba(0,0,0,0.08)';
    border: '2px solid var(--accent-primary)';
    cursor: 'grabbing';
  };
  dragging: {
    scale: 1.05;
    shadow: '0 20px 40px rgba(0,0,0,0.15), 0 8px 16px rgba(0,0,0,0.1)';
    opacity: 0.95;
    rotate: 2; // Subtle rotation for realism
  };
  overValid: {
    scale: 1.02;
    border: '2px dashed var(--accent-primary)';
    background: 'var(--accent-primary-10)';
  };
  overInvalid: {
    scale: 1;
    border: '2px dashed var(--error)';
    cursor: 'not-allowed';
  };
  drop: {
    scale: [1.05, 0.98, 1]; // Bounce effect
    shadow: '0 1px 3px rgba(0,0,0,0.1)';
  };
}
```

#### Implementation with Framer Motion

```tsx
import { motion, useSpring, useTransform } from 'framer-motion';
import { useDrag } from '@dnd-kit/core';

function KanbanCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDrag({
    id: task.id,
  });

  // Spring-based transform for smooth movement
  const springConfig = { stiffness: 400, damping: 25 };
  const x = useSpring(transform?.x ?? 0, springConfig);
  const y = useSpring(transform?.y ?? 0, springConfig);
  const scale = useSpring(isDragging ? 1.05 : 1, springConfig);
  const rotate = useSpring(isDragging ? 2 : 0, springConfig);

  return (
    <motion.div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        x,
        y,
        scale,
        rotate,
      }}
      animate={{
        boxShadow: isDragging
          ? '0 20px 40px rgba(0,0,0,0.15)'
          : '0 1px 3px rgba(0,0,0,0.1)',
        borderColor: isDragging ? 'var(--accent-primary)' : 'transparent',
      }}
      transition={{ duration: 0.2 }}
      className="kanban-card"
      whileHover={{ y: -2, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Card content */}
    </motion.div>
  );
}
```

#### Drop Zone Feedback

```tsx
function KanbanColumn({ status, tasks }: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id: status });
  const { isOverValid } = useDropValidation(status);

  return (
    <motion.div
      ref={setNodeRef}
      className="kanban-column"
      animate={{
        backgroundColor: isOver
          ? isOverValid
            ? 'var(--accent-primary-5)'
            : 'var(--error-5)'
          : 'var(--surface-elevated)',
        borderColor: isOver
          ? isOverValid
            ? 'var(--accent-primary)'
            : 'var(--error)'
          : 'transparent',
        borderStyle: isOver ? 'dashed' : 'solid',
      }}
      transition={{ duration: 0.15 }}
    >
      {/* Column header with task count animation */}
      <ColumnHeader
        count={tasks.length}
        isOver={isOver}
      />
      
      {/* Task list */}
      <AnimatePresence mode="popLayout">
        {tasks.map(task => (
          <KanbanCard key={task.id} task={task} />
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

// Animated task counter
function ColumnHeader({ count, isOver }: { count: number; isOver: boolean }) {
  return (
    <div className="column-header">
      <span className="column-title">{status}</span>
      <motion.span
        key={count}
        className="task-count"
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.5, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 500 }}
      >
        {count}
      </motion.span>
    </div>
  );
}
```

### 1.2 Status Change Transitions

```typescript
// Status transition animation configuration
const statusTransitions: Record<TaskStatus, { color: string; icon: string; sound: string }> = {
  'todo': { color: '#6b7280', icon: '○', sound: 'click' },
  'in-progress': { color: '#3b82f6', icon: '◐', sound: 'whoosh' },
  'review': { color: '#f59e0b', icon: '◑', sound: 'pop' },
  'done': { color: '#10b981', icon: '●', sound: 'success' },
  'blocked': { color: '#ef4444', icon: '⊘', sound: 'error' },
};

function StatusBadge({ status, onChange }: StatusBadgeProps) {
  const config = statusTransitions[status];
  const [isChanging, setIsChanging] = useState(false);

  const handleStatusChange = (newStatus: TaskStatus) => {
    setIsChanging(true);
    
    // Play sound effect
    playSound(statusTransitions[newStatus].sound);
    
    // Trigger haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
    
    onChange(newStatus);
    
    setTimeout(() => setIsChanging(false), 300);
  };

  return (
    <motion.button
      className="status-badge"
      animate={{
        backgroundColor: config.color + '20',
        color: config.color,
        scale: isChanging ? [1, 1.2, 1] : 1,
      }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <motion.span
        key={status}
        initial={{ rotate: -180, opacity: 0 }}
        animate={{ rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        {config.icon}
      </motion.span>
      <span className="status-label">{status}</span>
    </motion.button>
  );
}
```

### 1.3 Completion Celebrations

```typescript
class CompletionCelebration {
  private particleSystem: ParticleSystem;
  
  constructor() {
    this.particleSystem = new ParticleSystem();
  }

  celebrate(element: HTMLElement, intensity: 'small' | 'medium' | 'large' = 'medium') {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const configs = {
      small: { count: 15, spread: Math.PI / 2, colors: ['#10b981'] },
      medium: { count: 30, spread: Math.PI, colors: ['#10b981', '#34d399', '#6ee7b7'] },
      large: { count: 50, spread: Math.PI * 2, colors: ['#10b981', '#34d399', '#6ee7b7', '#fbbf24', '#f59e0b'] },
    };

    const config = configs[intensity];

    // Confetti burst
    this.particleSystem.emit({
      x: centerX,
      y: centerY,
      count: config.count,
      spread: config.spread,
      speed: 300,
      gravity: 400,
      lifetime: 1.5,
      colors: config.colors,
      shapes: ['circle', 'square'],
    });

    // Play success sound
    playSound('success');

    // Haptic feedback pattern
    if (navigator.vibrate) {
      navigator.vibrate([10, 50, 10]);
    }
  }
}

// Usage in task completion
function TaskCard({ task }: { task: Task }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const celebration = useMemo(() => new CompletionCelebration(), []);

  const handleComplete = () => {
    if (cardRef.current) {
      // Determine intensity based on task properties
      const intensity = task.priority === 'critical' ? 'large' : 
                       task.priority === 'high' ? 'medium' : 'small';
      celebration.celebrate(cardRef.current, intensity);
    }
    
    updateTaskStatus(task.id, 'done');
  };

  return (
    <div ref={cardRef} className="task-card">
      {/* Task content */}
      <CompleteButton onClick={handleComplete} />
    </div>
  );
}
```

### 1.4 Loading States

```tsx
// Skeleton loading for Kanban board
function KanbanBoardSkeleton() {
  return (
    <div className="kanban-board-skeleton">
      {[1, 2, 3, 4].map(column => (
        <div key={column} className="column-skeleton">
          {/* Column header skeleton */}
          <div className="column-header-skeleton">
            <Shimmer width={100} height={20} />
            <Shimmer width={30} height={20} circle />
          </div>
          
          {/* Task cards skeleton */}
          {[1, 2, 3].map(card => (
            <motion.div
              key={card}
              className="card-skeleton"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: card * 0.1 }}
            >
              <Shimmer width="90%" height={16} />
              <Shimmer width="60%" height={14} />
              <div className="card-footer-skeleton">
                <Shimmer width={60} height={20} circle />
                <Shimmer width={40} height={20} />
              </div>
            </motion.div>
          ))}
        </div>
      ))}
    </div>
  );
}

// Shimmer effect component
function Shimmer({ width, height, circle = false }: ShimmerProps) {
  return (
    <div 
      className={`shimmer ${circle ? 'circle' : ''}`}
      style={{ width, height }}
    >
      <div className="shimmer-wave" />
    </div>
  );
}
```

```css
/* Shimmer animation */
.shimmer {
  background: var(--surface-elevated);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.shimmer.circle {
  border-radius: 50%;
}

.shimmer-wave {
  position: absolute;
  top: 0;
  left: -100%;
  width: 50%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    var(--surface-hover),
    transparent
  );
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { left: -100%; }
  100% { left: 200%; }
}
```

### 1.5 Empty States

```tsx
// Empty state with illustration and CTA
function EmptyColumnState({ status }: { status: TaskStatus }) {
  const illustrations = {
    'todo': { icon: '📝', message: 'Ready to start something new?', action: 'Create your first task' },
    'in-progress': { icon: '🚀', message: 'No tasks in progress', action: 'Drag a task here to start' },
    'review': { icon: '👀', message: 'Nothing to review', action: 'Move tasks here when ready' },
    'done': { icon: '🎉', message: 'No completed tasks yet', action: 'Complete your first task!' },
    'blocked': { icon: '🚧', message: 'No blocked tasks', action: 'Great! Everything is flowing' },
  };

  const { icon, message, action } = illustrations[status];

  return (
    <motion.div
      className="empty-column-state"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="empty-icon"
        animate={{ 
          y: [0, -5, 0],
          rotate: [0, -5, 5, 0],
        }}
        transition={{ 
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        {icon}
      </motion.div>
      <p className="empty-message">{message}</p>
      <p className="empty-action">{action}</p>
    </motion.div>
  );
}

// Empty space state
function EmptySpaceState() {
  return (
    <div className="empty-space-state">
      <motion.div
        className="empty-illustration"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Animated SVG illustration */}
        <svg viewBox="0 0 200 200" className="empty-svg">
          <motion.circle
            cx="100"
            cy="100"
            r="60"
            fill="none"
            stroke="var(--accent-primary)"
            strokeWidth="2"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />
          <motion.path
            d="M70 100 L90 120 L130 80"
            fill="none"
            stroke="var(--success)"
            strokeWidth="4"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.5, delay: 1 }}
          />
        </svg>
      </motion.div>
      
      <h2>No Spaces Found</h2>
      <p>Create your first Space to start organizing tasks</p>
      
      <motion.button
        className="create-space-btn"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => commands.executeCommand('koban.newSpace')}
      >
        <span className="btn-icon">+</span>
        Create Space
      </motion.button>
    </div>
  );
}
```

---

## 2. Visual Design Language

### 2.1 Color System

```typescript
// Color tokens following VS Code theme integration
const colorSystem = {
  // Semantic colors
  accent: {
    primary: 'var(--vscode-button-background)',
    primaryHover: 'var(--vscode-button-hoverBackground)',
    secondary: 'var(--vscode-button-secondaryBackground)',
    secondaryHover: 'var(--vscode-button-secondaryHoverBackground)',
  },
  
  // Status colors
  status: {
    todo: { 
      bg: '#6b728020', 
      fg: '#6b7280',
      border: '#6b7280',
      icon: '○'
    },
    inProgress: { 
      bg: '#3b82f620', 
      fg: '#3b82f6',
      border: '#3b82f6',
      icon: '◐'
    },
    review: { 
      bg: '#f59e0b20', 
      fg: '#f59e0b',
      border: '#f59e0b',
      icon: '◑'
    },
    done: { 
      bg: '#10b98120', 
      fg: '#10b981',
      border: '#10b981',
      icon: '●'
    },
    blocked: { 
      bg: '#ef444420', 
      fg: '#ef4444',
      border: '#ef4444',
      icon: '⊘'
    },
  },
  
  // Priority colors
  priority: {
    low: { 
      bg: '#22c55e15', 
      fg: '#22c55e',
      icon: '↓',
      label: 'Low'
    },
    medium: { 
      bg: '#eab30815', 
      fg: '#eab308',
      icon: '→',
      label: 'Medium'
    },
    high: { 
      bg: '#f9731615', 
      fg: '#f97316',
      icon: '↑',
      label: 'High'
    },
    critical: { 
      bg: '#dc262615', 
      fg: '#dc2626',
      icon: '‼',
      label: 'Critical'
    },
  },
  
  // Surface colors
  surface: {
    background: 'var(--vscode-editor-background)',
    elevated: 'var(--vscode-editor-background)',
    hover: 'var(--vscode-list-hoverBackground)',
    selected: 'var(--vscode-list-activeSelectionBackground)',
    border: 'var(--vscode-panel-border)',
  },
  
  // Text colors
  text: {
    primary: 'var(--vscode-foreground)',
    secondary: 'var(--vscode-descriptionForeground)',
    muted: 'var(--vscode-disabledForeground)',
    accent: 'var(--vscode-textLink-foreground)',
  },
};
```

#### Priority Badge Component

```tsx
function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const config = colorSystem.priority[priority];
  
  return (
    <span 
      className="priority-badge"
      style={{
        backgroundColor: config.bg,
        color: config.fg,
      }}
    >
      <span className="priority-icon">{config.icon}</span>
      <span className="priority-label">{config.label}</span>
    </span>
  );
}
```

### 2.2 Typography Hierarchy

```typescript
// Typography scale
const typography = {
  // Headings
  h1: {
    fontSize: '24px',
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '-0.02em',
  },
  h2: {
    fontSize: '20px',
    fontWeight: 600,
    lineHeight: 1.3,
    letterSpacing: '-0.01em',
  },
  h3: {
    fontSize: '16px',
    fontWeight: 600,
    lineHeight: 1.4,
  },
  
  // Body text
  body: {
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: 1.5,
  },
  bodySmall: {
    fontSize: '13px',
    fontWeight: 400,
    lineHeight: 1.5,
  },
  caption: {
    fontSize: '12px',
    fontWeight: 400,
    lineHeight: 1.4,
  },
  
  // UI elements
  label: {
    fontSize: '11px',
    fontWeight: 500,
    lineHeight: 1.2,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  button: {
    fontSize: '13px',
    fontWeight: 500,
    lineHeight: 1,
  },
};
```

### 2.3 Spacing System

```typescript
// 8px base grid system
const spacing = {
  '0': '0',
  '1': '4px',
  '2': '8px',
  '3': '12px',
  '4': '16px',
  '5': '20px',
  '6': '24px',
  '8': '32px',
  '10': '40px',
  '12': '48px',
  '16': '64px',
};

// Component-specific spacing
const componentSpacing = {
  card: {
    padding: spacing['4'],
    gap: spacing['3'],
    borderRadius: '8px',
  },
  column: {
    padding: spacing['3'],
    gap: spacing['3'],
    borderRadius: '12px',
  },
  board: {
    gap: spacing['4'],
    padding: spacing['4'],
  },
};
```

### 2.4 Iconography

```typescript
// Icon mapping using Lucide icons
const icons = {
  // Navigation
  spaces: 'FolderKanban',
  tasks: 'CheckSquare',
  meetings: 'Calendar',
  archive: 'Archive',
  
  // Actions
  add: 'Plus',
  edit: 'Pencil',
  delete: 'Trash2',
  duplicate: 'Copy',
  move: 'Move',
  link: 'Link',
  
  // Status
  todo: 'Circle',
  inProgress: 'Loader2',
  review: 'Eye',
  done: 'CheckCircle2',
  blocked: 'Ban',
  
  // Priority
  priorityLow: 'ArrowDown',
  priorityMedium: 'Minus',
  priorityHigh: 'ArrowUp',
  priorityCritical: 'AlertTriangle',
  
  // Meta
  dueDate: 'CalendarClock',
  assignee: 'User',
  tag: 'Tag',
  attachment: 'Paperclip',
  
  // Views
  kanban: 'LayoutGrid',
  list: 'List',
  calendar: 'CalendarDays',
  
  // Misc
  filter: 'Filter',
  sort: 'ArrowUpDown',
  search: 'Search',
  settings: 'Settings',
  more: 'MoreHorizontal',
};
```

### 2.5 Dark/Light Mode Support

```typescript
// CSS custom properties that adapt to VS Code theme
const themeTokens = {
  light: {
    '--kanban-bg': '#f8fafc',
    '--column-bg': '#ffffff',
    '--card-bg': '#ffffff',
    '--card-hover': '#f1f5f9',
    '--border': '#e2e8f0',
    '--shadow-sm': '0 1px 2px rgba(0,0,0,0.05)',
    '--shadow-md': '0 4px 6px rgba(0,0,0,0.07)',
    '--shadow-lg': '0 10px 15px rgba(0,0,0,0.1)',
  },
  dark: {
    '--kanban-bg': '#0f172a',
    '--column-bg': '#1e293b',
    '--card-bg': '#1e293b',
    '--card-hover': '#334155',
    '--border': '#334155',
    '--shadow-sm': '0 1px 2px rgba(0,0,0,0.3)',
    '--shadow-md': '0 4px 6px rgba(0,0,0,0.4)',
    '--shadow-lg': '0 10px 15px rgba(0,0,0,0.5)',
  },
};

// React hook for theme detection
function useVSCodeTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  
  useEffect(() => {
    // Listen for VS Code theme changes
    const observer = new MutationObserver(() => {
      const isDark = document.body.classList.contains('vscode-dark') ||
                     document.body.classList.contains('vscode-high-contrast');
      setTheme(isDark ? 'dark' : 'light');
    });
    
    observer.observe(document.body, { attributes: true });
    
    return () => observer.disconnect();
  }, []);
  
  return theme;
}
```

---

## 3. Interaction Patterns

### 3.1 Drag and Drop Behavior

```typescript
// Comprehensive drag and drop configuration
interface DragConfig {
  // Activation
  activationConstraint: {
    delay: 0, // Immediate
    tolerance: 5, // 5px movement required
  };
  
  // Sensors
  sensors: ['mouse', 'touch', 'keyboard'];
  
  // Collision detection
  collisionDetection: 'closestCenter' | 'pointerWithin';
  
  // Auto-scroll
  autoScroll: {
    enabled: true;
    threshold: {
      x: 0.2, // 20% of viewport
      y: 0.2,
    };
    speed: 10;
  };
  
  // Snap to grid
  snapToGrid: {
    enabled: false;
    x: 8;
    y: 8;
  };
}

// Keyboard drag support
const keyboardDragConfig = {
  coordinateGetter: (event: KeyboardEvent) => {
    switch (event.code) {
      case 'ArrowUp': return { y: -50 };
      case 'ArrowDown': return { y: 50 };
      case 'ArrowLeft': return { x: -200 };
      case 'ArrowRight': return { x: 200 };
      default: return null;
    }
  },
};
```

### 3.2 Right-Click Context Menus

```typescript
// Context menu items configuration
const taskContextMenu = [
  {
    id: 'edit',
    label: 'Edit Task',
    icon: 'Pencil',
    shortcut: '⌘E',
    action: 'koban.editTask',
  },
  {
    id: 'duplicate',
    label: 'Duplicate',
    icon: 'Copy',
    shortcut: '⌘D',
    action: 'koban.duplicateTask',
  },
  { type: 'separator' },
  {
    id: 'status',
    label: 'Change Status',
    icon: 'ArrowRightLeft',
    submenu: [
      { id: 'todo', label: 'To Do', icon: 'Circle' },
      { id: 'in-progress', label: 'In Progress', icon: 'Loader2' },
      { id: 'review', label: 'In Review', icon: 'Eye' },
      { id: 'done', label: 'Done', icon: 'CheckCircle2' },
      { id: 'blocked', label: 'Blocked', icon: 'Ban' },
    ],
  },
  {
    id: 'priority',
    label: 'Set Priority',
    icon: 'Flag',
    submenu: [
      { id: 'low', label: 'Low', color: '#22c55e' },
      { id: 'medium', label: 'Medium', color: '#eab308' },
      { id: 'high', label: 'High', color: '#f97316' },
      { id: 'critical', label: 'Critical', color: '#dc2626' },
    ],
  },
  { type: 'separator' },
  {
    id: 'move',
    label: 'Move to Space...',
    icon: 'Move',
    action: 'koban.moveTask',
  },
  {
    id: 'copy-link',
    label: 'Copy Link',
    icon: 'Link',
    shortcut: '⌘⇧C',
    action: 'koban.copyTaskLink',
  },
  { type: 'separator' },
  {
    id: 'delete',
    label: 'Delete',
    icon: 'Trash2',
    shortcut: '⌘⌫',
    action: 'koban.deleteTask',
    danger: true,
  },
];

// Context menu component
function TaskContextMenu({ task, position, onClose }: ContextMenuProps) {
  return (
    <motion.div
      className="context-menu"
      style={{ left: position.x, top: position.y }}
      initial={{ opacity: 0, scale: 0.95, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      transition={{ duration: 0.15 }}
    >
      {taskContextMenu.map(item => (
        item.type === 'separator' ? (
          <div key={item.id} className="context-menu-separator" />
        ) : (
          <ContextMenuItem
            key={item.id}
            item={item}
            onClick={() => {
              executeCommand(item.action, task);
              onClose();
            }}
          />
        )
      ))}
    </motion.div>
  );
}
```

### 3.3 Keyboard Navigation

```typescript
// Keyboard shortcuts configuration
const keyboardShortcuts = {
  // Navigation
  'cmd+k cmd+s': 'Open Space',
  'cmd+k cmd+t': 'Open Task',
  'cmd+k cmd+m': 'Open Meeting',
  
  // Actions
  'cmd+shift+n': 'New Task',
  'cmd+shift+m': 'New Meeting',
  'cmd+shift+s': 'New Space',
  
  // Task operations
  'cmd+e': 'Edit Task',
  'cmd+d': 'Duplicate Task',
  'cmd+shift+d': 'Delete Task',
  'cmd+enter': 'Toggle Complete',
  
  // Board navigation
  'arrowup': 'Focus previous task',
  'arrowdown': 'Focus next task',
  'arrowleft': 'Focus previous column',
  'arrowright': 'Focus next column',
  'space': 'Start drag / Drop',
  'escape': 'Cancel drag',
  
  // Views
  'cmd+1': 'View: Kanban',
  'cmd+2': 'View: List',
  'cmd+3': 'View: Calendar',
  
  // Search
  'cmd+f': 'Find in Board',
  'cmd+shift+f': 'Search all Spaces',
  
  // Quick actions
  'cmd+shift+p': 'Command Palette',
  'cmd+.': 'Quick Actions',
};

// Focus management
function useKeyboardNavigation() {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Arrow key navigation
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        navigateFocus(e.key, focusedId);
      }
      
      // Space to start/stop drag
      if (e.key === ' ' && focusedId) {
        e.preventDefault();
        toggleDrag(focusedId);
      }
      
      // Escape to cancel
      if (e.key === 'Escape') {
        cancelDrag();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedId]);
  
  return { focusedId, setFocusedId };
}
```

### 3.4 Command Palette Integration

```typescript
// Command palette items
const commandPaletteItems = [
  {
    id: 'new-task',
    label: 'New Task',
    detail: 'Create a new task in the current space',
    icon: 'Plus',
    shortcut: '⌘⇧N',
    category: 'Create',
  },
  {
    id: 'new-space',
    label: 'New Space',
    detail: 'Create a new workspace space',
    icon: 'FolderPlus',
    shortcut: '⌘⇧S',
    category: 'Create',
  },
  {
    id: 'open-kanban',
    label: 'Open Kanban Board',
    detail: 'Open the Kanban view for current space',
    icon: 'LayoutGrid',
    shortcut: '⌘⇧K',
    category: 'View',
  },
  {
    id: 'filter-tasks',
    label: 'Filter Tasks...',
    detail: 'Filter tasks by status, priority, or assignee',
    icon: 'Filter',
    category: 'Filter',
  },
  {
    id: 'goto-task',
    label: 'Go to Task...',
    detail: 'Quickly navigate to any task',
    icon: 'Search',
    shortcut: '⌘T',
    category: 'Navigate',
  },
];

// Quick pick for task navigation
async function showTaskQuickPick() {
  const tasks = await getAllTasks();
  
  const items = tasks.map(task => ({
    label: task.title,
    description: `${task.space} • ${task.status}`,
    detail: task.priority && `Priority: ${task.priority}`,
    iconPath: getStatusIcon(task.status),
    task,
  }));
  
  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Type to search tasks...',
    matchOnDescription: true,
    matchOnDetail: true,
  });
  
  if (selected) {
    openTask(selected.task);
  }
}
```

### 3.5 Quick Actions

```tsx
// Quick action bar (floating action button alternative)
function QuickActions() {
  const [isOpen, setIsOpen] = useState(false);
  
  const actions = [
    { id: 'task', icon: 'CheckSquare', label: 'New Task', color: '#3b82f6' },
    { id: 'meeting', icon: 'Calendar', label: 'New Meeting', color: '#8b5cf6' },
    { id: 'space', icon: 'FolderKanban', label: 'New Space', color: '#10b981' },
  ];
  
  return (
    <div className="quick-actions">
      <AnimatePresence>
        {isOpen && actions.map((action, i) => (
          <motion.button
            key={action.id}
            className="quick-action-item"
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            transition={{ delay: i * 0.05 }}
            style={{ backgroundColor: action.color }}
            onClick={() => executeCommand(`koban.new${action.id}`)}
          >
            <Icon name={action.icon} />
            <span>{action.label}</span>
          </motion.button>
        ))}
      </AnimatePresence>
      
      <motion.button
        className="quick-actions-toggle"
        animate={{ rotate: isOpen ? 45 : 0 }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Icon name="Plus" />
      </motion.button>
    </div>
  );
}
```

---

## 4. Feedback Systems

### 4.1 Success Confirmations

```typescript
// Toast notification system
interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  description?: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
}

function ToastNotification({ toast }: { toast: Toast }) {
  const icons = {
    success: 'CheckCircle2',
    error: 'XCircle',
    info: 'Info',
    warning: 'AlertTriangle',
  };
  
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    info: '#3b82f6',
    warning: '#f59e0b',
  };
  
  return (
    <motion.div
      className={`toast toast-${toast.type}`}
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <div className="toast-icon" style={{ color: colors[toast.type] }}>
        <Icon name={icons[toast.type]} />
      </div>
      <div className="toast-content">
        <p className="toast-message">{toast.message}</p>
        {toast.description && (
          <p className="toast-description">{toast.description}</p>
        )}
      </div>
      {toast.action && (
        <button className="toast-action" onClick={toast.action.onClick}>
          {toast.action.label}
        </button>
      )}
    </motion.div>
  );
}

// Usage examples
const showSuccessToast = (message: string) => {
  showToast({
    type: 'success',
    message,
    duration: 3000,
  });
};

// Examples:
// showSuccessToast('Task moved to Done');
// showSuccessToast('Space created successfully');
// showSuccessToast('Task completed', { description: 'Great job!' });
```

### 4.2 Error Handling

```typescript
// Error boundary for webview
class KanbanErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  state = { hasError: false };
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Kanban Error:', error, errorInfo);
    
    // Send error to extension host
    vscode.postMessage({
      type: 'error',
      error: error.message,
      stack: error.stack,
    });
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-fallback">
          <div className="error-icon">⚠️</div>
          <h2>Something went wrong</h2>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>
            Reload Board
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}

// Inline error state for forms
function InlineError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <motion.div
      className="inline-error"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      <Icon name="AlertCircle" />
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry}>
          <Icon name="RefreshCw" />
          Retry
        </button>
      )}
    </motion.div>
  );
}
```

### 4.3 Progress Indicators

```tsx
// Circular progress for long operations
function CircularProgress({ progress, size = 40 }: { progress: number; size?: number }) {
  const circumference = 2 * Math.PI * ((size - 4) / 2);
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  
  return (
    <svg width={size} height={size} className="circular-progress">
      <circle
        className="progress-bg"
        cx={size / 2}
        cy={size / 2}
        r={(size - 4) / 2}
        fill="none"
        strokeWidth="3"
      />
      <motion.circle
        className="progress-fill"
        cx={size / 2}
        cy={size / 2}
        r={(size - 4) / 2}
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={circumference}
        animate={{ strokeDashoffset }}
        transition={{ duration: 0.3 }}
      />
      <text x="50%" y="50%" textAnchor="middle" dy=".3em" className="progress-text">
        {Math.round(progress)}%
      </text>
    </svg>
  );
}

// Linear progress for file operations
function LinearProgress({ progress, label }: { progress: number; label?: string }) {
  return (
    <div className="linear-progress">
      {label && <span className="progress-label">{label}</span>}
      <div className="progress-bar">
        <motion.div
          className="progress-fill"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <span className="progress-value">{Math.round(progress)}%</span>
    </div>
  );
}

// Indeterminate spinner
function Spinner({ size = 24 }: { size?: number }) {
  return (
    <motion.div
      className="spinner"
      style={{ width: size, height: size }}
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    >
      <svg viewBox="0 0 24 24">
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="40 60"
        />
      </svg>
    </motion.div>
  );
}
```

### 4.4 Notifications

```typescript
// VS Code notification integration
const notifications = {
  // Info notification
  info: (message: string, items?: string[]) => {
    if (items) {
      return vscode.window.showInformationMessage(message, ...items);
    }
    return vscode.window.showInformationMessage(message);
  },
  
  // Warning notification
  warning: (message: string, items?: string[]) => {
    return vscode.window.showWarningMessage(message, ...items);
  },
  
  // Error notification
  error: (message: string, items?: string[]) => {
    return vscode.window.showErrorMessage(message, ...items);
  },
  
  // Progress notification
  progress: async <T>(
    title: string,
    task: (progress: vscode.Progress<{ message?: string; increment?: number }>) => Promise<T>
  ): Promise<T> => {
    return vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title,
        cancellable: false,
      },
      task
    );
  },
};

// Usage examples
async function exampleUsage() {
  // Simple notification
  notifications.info('Task created successfully');
  
  // With actions
  const action = await notifications.info(
    'Space created',
    'Open Space',
    'Create Another'
  );
  
  if (action === 'Open Space') {
    openSpace();
  }
  
  // Progress notification
  await notifications.progress('Indexing spaces...', async (progress) => {
    const spaces = await discoverSpaces();
    
    for (let i = 0; i < spaces.length; i++) {
      await indexSpace(spaces[i]);
      progress.report({
        message: `Indexing ${spaces[i].name}...`,
        increment: 100 / spaces.length,
      });
    }
  });
}
```

### 4.5 Inline Validation

```tsx
// Form validation with inline feedback
function TaskForm() {
  const [title, setTitle] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  
  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!title.trim()) {
      newErrors.title = 'Title is required';
    } else if (title.length < 3) {
      newErrors.title = 'Title must be at least 3 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  return (
    <form className="task-form">
      <div className={`form-field ${errors.title && touched.title ? 'has-error' : ''}`}>
        <label htmlFor="title">Title *</label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            setTouched({ ...touched, title: true });
            validate();
          }}
          placeholder="Enter task title..."
        />
        <AnimatePresence>
          {errors.title && touched.title && (
            <motion.span
              className="field-error"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Icon name="AlertCircle" size={14} />
              {errors.title}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </form>
  );
}
```

---

## 5. Gamification Elements

### 5.1 Progress Visualization

```tsx
// Space progress overview
function SpaceProgress({ space }: { space: Space }) {
  const stats = space.stats;
  const total = stats.totalTasks;
  const completed = stats.tasksByStatus.done || 0;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  
  return (
    <div className="space-progress">
      <div className="progress-header">
        <span className="progress-title">Progress</span>
        <span className="progress-value">{percentage}%</span>
      </div>
      
      {/* Segmented progress bar */}
      <div className="segmented-progress">
        {(['todo', 'in-progress', 'review', 'done'] as TaskStatus[]).map(status => {
          const count = stats.tasksByStatus[status] || 0;
          const width = total > 0 ? (count / total) * 100 : 0;
          
          return (
            <motion.div
              key={status}
              className={`progress-segment ${status}`}
              style={{ backgroundColor: colorSystem.status[status].fg }}
              initial={{ width: 0 }}
              animate={{ width: `${width}%` }}
              transition={{ duration: 0.5, delay: 0.1 }}
              title={`${status}: ${count}`}
            />
          );
        })}
      </div>
      
      {/* Status breakdown */}
      <div className="status-breakdown">
        {(['todo', 'in-progress', 'review', 'done'] as TaskStatus[]).map(status => (
          <div key={status} className="status-item">
            <span 
              className="status-dot"
              style={{ backgroundColor: colorSystem.status[status].fg }}
            />
            <span className="status-name">{status}</span>
            <span className="status-count">{stats.tasksByStatus[status] || 0}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 5.2 Streaks

```tsx
// Daily activity streak
function StreakCounter({ streak }: { streak: number }) {
  const isOnFire = streak >= 7;
  const isLegendary = streak >= 30;
  
  return (
    <motion.div
      className={`streak-counter ${isOnFire ? 'on-fire' : ''}`}
      animate={isOnFire ? {
        boxShadow: [
          '0 0 0 rgba(249, 115, 22, 0)',
          '0 0 20px rgba(249, 115, 22, 0.3)',
          '0 0 0 rgba(249, 115, 22, 0)',
        ],
      } : {}}
      transition={{ duration: 2, repeat: Infinity }}
    >
      <motion.div
        className="streak-icon"
        animate={isOnFire ? {
          scale: [1, 1.1, 1],
          rotate: [0, -5, 5, 0],
        } : {}}
        transition={{ duration: 0.5, repeat: Infinity }}
      >
        {isLegendary ? '🔥' : isOnFire ? '🔥' : '✨'}
      </motion.div>
      
      <div className="streak-info">
        <span className="streak-count">{streak}</span>
        <span className="streak-label">
          day{streak !== 1 ? 's' : ''} streak
        </span>
      </div>
      
      {isOnFire && (
        <motion.div
          className="streak-badge"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500 }}
        >
          ON FIRE!
        </motion.div>
      )}
    </motion.div>
  );
}

// Weekly activity heatmap
function ActivityHeatmap({ data }: { data: ActivityData[] }) {
  const weeks = 12; // Show last 12 weeks
  const days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  
  return (
    <div className="activity-heatmap">
      <div className="heatmap-grid">
        {days.map((day, i) => (
          <span key={day} className="day-label">{day}</span>
        ))}
        
        {Array.from({ length: weeks * 7 }).map((_, i) => {
          const activity = data[i] || 0;
          const intensity = Math.min(4, Math.floor(activity / 2));
          
          return (
            <motion.div
              key={i}
              className={`heatmap-cell intensity-${intensity}`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.005 }}
              title={`${activity} tasks completed`}
            />
          );
        })}
      </div>
    </div>
  );
}
```

### 5.3 Achievements

```typescript
// Achievement definitions
const achievements: Achievement[] = [
  {
    id: 'first-task',
    name: 'Getting Started',
    description: 'Create your first task',
    icon: '🌱',
    rarity: 'common',
    condition: (stats) => stats.totalTasks >= 1,
  },
  {
    id: 'task-master',
    name: 'Task Master',
    description: 'Complete 50 tasks',
    icon: '✅',
    rarity: 'rare',
    condition: (stats) => stats.completedTasks >= 50,
  },
  {
    id: 'space-creator',
    name: 'Space Creator',
    description: 'Create 5 spaces',
    icon: '🚀',
    rarity: 'rare',
    condition: (stats) => stats.totalSpaces >= 5,
  },
  {
    id: 'organizer',
    name: 'Organizer',
    description: 'Have 10 tasks in Done at once',
    icon: '📊',
    rarity: 'epic',
    condition: (stats) => stats.tasksByStatus.done >= 10,
  },
  {
    id: 'speed-demon',
    name: 'Speed Demon',
    description: 'Complete 5 tasks in one day',
    icon: '⚡',
    rarity: 'epic',
    condition: (stats) => stats.tasksCompletedToday >= 5,
  },
  {
    id: 'kanban-ninja',
    name: 'Kanban Ninja',
    description: 'Complete 100 tasks',
    icon: '🥷',
    rarity: 'legendary',
    condition: (stats) => stats.completedTasks >= 100,
  },
];

// Achievement unlock animation
function AchievementUnlock({ achievement }: { achievement: Achievement }) {
  const rarityColors = {
    common: '#9ca3af',
    rare: '#3b82f6',
    epic: '#a855f7',
    legendary: '#f59e0b',
  };
  
  return (
    <motion.div
      className="achievement-unlock"
      initial={{ opacity: 0, y: 50, scale: 0.8 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      <div 
        className="achievement-glow"
        style={{ backgroundColor: rarityColors[achievement.rarity] }}
      />
      
      <motion.div
        className="achievement-icon"
        animate={{ 
          rotate: [0, -10, 10, 0],
          scale: [1, 1.2, 1],
        }}
        transition={{ duration: 0.5 }}
      >
        {achievement.icon}
      </motion.div>
      
      <div className="achievement-content">
        <span className="achievement-unlocked">Achievement Unlocked!</span>
        <h3 className="achievement-name">{achievement.name}</h3>
        <p className="achievement-description">{achievement.description}</p>
        <span 
          className="achievement-rarity"
          style={{ color: rarityColors[achievement.rarity] }}
        >
          {achievement.rarity.toUpperCase()}
        </span>
      </div>
    </motion.div>
  );
}
```

### 5.4 Stats Dashboard

```tsx
// Personal stats dashboard
function StatsDashboard({ stats }: { stats: UserStats }) {
  return (
    <div className="stats-dashboard">
      <h2>Your Progress</h2>
      
      {/* Key metrics */}
      <div className="stats-grid">
        <StatCard
          label="Tasks Completed"
          value={stats.completedTasks}
          icon="CheckCircle2"
          trend={+12}
          color="#10b981"
        />
        <StatCard
          label="Current Streak"
          value={stats.currentStreak}
          icon="Flame"
          suffix="days"
          color="#f97316"
        />
        <StatCard
          label="Spaces Active"
          value={stats.activeSpaces}
          icon="FolderKanban"
          color="#3b82f6"
        />
        <StatCard
          label="Completion Rate"
          value={stats.completionRate}
          icon="Target"
          suffix="%"
          color="#8b5cf6"
        />
      </div>
      
      {/* Activity chart */}
      <div className="activity-section">
        <h3>Activity</h3>
        <ActivityHeatmap data={stats.dailyActivity} />
      </div>
      
      {/* Recent achievements */}
      <div className="achievements-section">
        <h3>Recent Achievements</h3>
        <div className="achievements-list">
          {stats.recentAchievements.map(achievement => (
            <AchievementBadge key={achievement.id} achievement={achievement} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, trend, suffix = '', color }: StatCardProps) {
  return (
    <motion.div
      className="stat-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
    >
      <div className="stat-icon" style={{ color }}>
        <Icon name={icon} />
      </div>
      <div className="stat-content">
        <span className="stat-value" style={{ color }}>
          {value}{suffix}
        </span>
        <span className="stat-label">{label}</span>
        {trend !== undefined && (
          <span className={`stat-trend ${trend >= 0 ? 'positive' : 'negative'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
    </motion.div>
  );
}
```

---

## 6. Accessibility

### 6.1 Keyboard Shortcuts

```typescript
// Comprehensive keyboard shortcut system
const keyboardShortcuts = {
  // Global shortcuts
  global: {
    'Cmd+Shift+K': 'Open Kanban Board',
    'Cmd+Shift+N': 'New Task',
    'Cmd+Shift+M': 'New Meeting',
    'Cmd+Shift+S': 'New Space',
    'Cmd+Shift+F': 'Search Tasks',
    'Cmd+Shift+P': 'Command Palette',
  },
  
  // Board navigation
  board: {
    'ArrowUp': 'Focus previous task',
    'ArrowDown': 'Focus next task',
    'ArrowLeft': 'Focus previous column',
    'ArrowRight': 'Focus next column',
    'Home': 'Focus first task in column',
    'End': 'Focus last task in column',
    'PageUp': 'Scroll up',
    'PageDown': 'Scroll down',
  },
  
  // Task operations
  task: {
    'Space': 'Start/Stop drag',
    'Enter': 'Open task',
    'Cmd+E': 'Edit task',
    'Cmd+D': 'Duplicate task',
    'Cmd+Shift+D': 'Delete task',
    'Cmd+Enter': 'Toggle complete',
    '1-5': 'Set priority (1=Critical, 5=Low)',
  },
  
  // Drag and drop
  drag: {
    'ArrowKeys': 'Move task while dragging',
    'Enter/Space': 'Drop task',
    'Escape': 'Cancel drag',
  },
};

// Keyboard shortcut help modal
function KeyboardShortcutsHelp() {
  return (
    <div className="shortcuts-help">
      <h2>Keyboard Shortcuts</h2>
      
      {Object.entries(keyboardShortcuts).map(([category, shortcuts]) => (
        <section key={category}>
          <h3>{category.charAt(0).toUpperCase() + category.slice(1)}</h3>
          <table>
            <tbody>
              {Object.entries(shortcuts).map(([key, action]) => (
                <tr key={key}>
                  <td><kbd>{key}</kbd></td>
                  <td>{action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
```

### 6.2 Screen Reader Support

```tsx
// Accessible task card
function AccessibleTaskCard({ task }: { task: Task }) {
  const statusLabel = `Status: ${task.status}`;
  const priorityLabel = `Priority: ${task.priority}`;
  const dueLabel = task.dueDate ? `Due: ${formatDate(task.dueDate)}` : '';
  
  return (
    <div
      className="task-card"
      role="article"
      aria-label={`Task: ${task.title}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter') openTask(task);
        if (e.key === ' ') {
          e.preventDefault();
          startDrag(task);
        }
      }}
    >
      {/* Visually hidden description for screen readers */}
      <span className="sr-only">
        {statusLabel}, {priorityLabel}, {dueLabel}
      </span>
      
      {/* Visible content */}
      <h3 className="task-title">{task.title}</h3>
      
      <div className="task-meta" aria-hidden="true">
        <StatusBadge status={task.status} />
        <PriorityBadge priority={task.priority} />
        {task.dueDate && (
          <DueDate date={task.dueDate} />
        )}
      </div>
      
      {/* Drag handle with proper ARIA */}
      <button
        className="drag-handle"
        aria-label="Drag to reorder"
        aria-grabbed={isDragging}
        aria-dropeffect="move"
      >
        <Icon name="GripVertical" />
      </button>
    </div>
  );
}

// Live region for announcements
function LiveRegion() {
  const [announcement, setAnnouncement] = useState('');
  
  useEffect(() => {
    // Subscribe to events that need announcements
    const unsubscribe = eventBus.subscribe((event) => {
      switch (event.type) {
        case 'task:moved':
          setAnnouncement(`Task moved to ${event.data.newStatus}`);
          break;
        case 'task:completed':
          setAnnouncement('Task completed');
          break;
        case 'space:changed':
          setAnnouncement(`Switched to ${event.data.spaceName}`);
          break;
      }
    });
    
    return unsubscribe;
  }, []);
  
  return (
    <div 
      role="status" 
      aria-live="polite" 
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}
```

### 6.3 Color Contrast

```typescript
// Color contrast utilities
const contrastUtils = {
  // Calculate relative luminance
  getLuminance(r: number, g: number, b: number): number {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  },
  
  // Calculate contrast ratio
  getContrastRatio(color1: string, color2: string): number {
    const lum1 = this.getLuminance(...this.hexToRgb(color1));
    const lum2 = this.getLuminance(...this.hexToRgb(color2));
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  },
  
  // Ensure WCAG AA compliance (4.5:1 for normal text, 3:1 for large)
  getAccessibleColor(background: string, preferred: string): string {
    const ratio = this.getContrastRatio(background, preferred);
    if (ratio >= 4.5) return preferred;
    
    // Adjust color to meet contrast
    return this.adjustForContrast(background, preferred, 4.5);
  },
  
  hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16),
    ] : [0, 0, 0];
  },
};

// Accessible color tokens
const accessibleColors = {
  // Ensure all text meets WCAG AA
  text: {
    primary: contrastUtils.getAccessibleColor('#ffffff', '#1f2937'),
    secondary: contrastUtils.getAccessibleColor('#ffffff', '#6b7280'),
    onPrimary: '#ffffff', // White text on primary buttons
    onSuccess: '#ffffff',
    onError: '#ffffff',
  },
  
  // Status colors with guaranteed contrast
  status: {
    todo: { bg: '#f3f4f6', fg: '#374151', border: '#9ca3af' },
    inProgress: { bg: '#dbeafe', fg: '#1e40af', border: '#3b82f6' },
    review: { bg: '#fef3c7', fg: '#92400e', border: '#f59e0b' },
    done: { bg: '#d1fae5', fg: '#065f46', border: '#10b981' },
    blocked: { bg: '#fee2e2', fg: '#991b1b', border: '#ef4444' },
  },
};
```

### 6.4 Focus Management

```tsx
// Focus trap for modals
function FocusTrap({ children, isActive }: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!isActive) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    // Store previously focused element
    const previousFocus = document.activeElement as HTMLElement;
    
    // Focus first focusable element
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length > 0) {
      (focusableElements[0] as HTMLElement).focus();
    }
    
    // Handle tab navigation
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      
      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
      
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    };
    
    document.addEventListener('keydown', handleTabKey);
    
    return () => {
      document.removeEventListener('keydown', handleTabKey);
      previousFocus?.focus();
    };
  }, [isActive]);
  
  return <div ref={containerRef}>{children}</div>;
}

// Visible focus indicator
const focusStyles = `
  .focusable:focus {
    outline: 2px solid var(--vscode-focusBorder);
    outline-offset: 2px;
  }
  
  .focusable:focus-visible {
    outline: 2px solid var(--vscode-focusBorder);
    outline-offset: 2px;
    border-radius: 4px;
  }
  
  /* High contrast mode support */
  .vscode-high-contrast .focusable:focus {
    outline: 2px solid var(--vscode-contrastActiveBorder);
    outline-offset: 2px;
  }
`;

// Skip link for keyboard users
function SkipLink() {
  return (
    <a 
      href="#main-content" 
      className="skip-link"
      onClick={(e) => {
        e.preventDefault();
        document.getElementById('main-content')?.focus();
      }}
    >
      Skip to main content
    </a>
  );
}
```

---

## 7. Onboarding Experience

### 7.1 First Launch

```tsx
// Welcome screen for first-time users
function WelcomeScreen({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  
  const steps = [
    {
      title: 'Welcome to Koban',
      description: 'Your Markdown Kanban workspace in VS Code',
      illustration: <WelcomeIllustration />,
    },
    {
      title: 'Spaces',
      description: 'Organize your work into Spaces - projects, areas, or any context you need',
      illustration: <SpacesIllustration />,
    },
    {
      title: 'Kanban Board',
      description: 'Visualize your tasks with drag-and-drop Kanban boards',
      illustration: <KanbanIllustration />,
    },
    {
      title: 'Markdown First',
      description: 'All your data stays in Markdown - no lock-in, fully portable',
      illustration: <MarkdownIllustration />,
    },
  ];
  
  const currentStep = steps[step];
  
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
        >
          <div className="step-illustration">
            {currentStep.illustration}
          </div>
          <h1>{currentStep.title}</h1>
          <p>{currentStep.description}</p>
        </motion.div>
        
        {/* Progress dots */}
        <div className="step-indicators">
          {steps.map((_, i) => (
            <button
              key={i}
              className={`step-dot ${i === step ? 'active' : ''}`}
              onClick={() => setStep(i)}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>
        
        {/* Navigation */}
        <div className="step-navigation">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)}>Back</button>
          )}
          
          {step < steps.length - 1 ? (
            <button onClick={() => setStep(step + 1)}>Next</button>
          ) : (
            <button onClick={onComplete} className="primary">
              Get Started
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
```

### 7.2 Empty State Guidance

```tsx
// Guided empty state for new spaces
function GuidedEmptyState({ space }: { space: Space }) {
  const [showGuide, setShowGuide] = useState(true);
  
  const guideSteps = [
    {
      target: '.new-task-btn',
      title: 'Create your first task',
      description: 'Click here to add a task to this space',
      position: 'bottom',
    },
    {
      target: '.kanban-view',
      title: 'View your board',
      description: 'Switch to Kanban view to see your tasks visually',
      position: 'right',
    },
    {
      target: '.space-settings',
      title: 'Customize your space',
      description: 'Add a description, color, or configure columns',
      position: 'left',
    },
  ];
  
  return (
    <div className="guided-empty-state">
      <EmptyStateIllustration />
      <h2>This space is empty</h2>
      <p>Let's get you started with your first task</p>
      
      <motion.button
        className="create-first-task-btn"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => commands.executeCommand('koban.newTask')}
      >
        <Icon name="Plus" />
        Create First Task
      </motion.button>
      
      {showGuide && (
        <OnboardingTour
          steps={guideSteps}
          onComplete={() => setShowGuide(false)}
        />
      )}
    </div>
  );
}
```

### 7.3 Tooltips and Hints

```tsx
// Contextual tooltip system
function Tooltip({ 
  children, 
  content, 
  position = 'top',
  delay = 500,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();
  
  const show = () => {
    timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
  };
  
  const hide = () => {
    clearTimeout(timeoutRef.current);
    setIsVisible(false);
  };
  
  return (
    <div 
      className="tooltip-wrapper"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {children}
      
      <AnimatePresence>
        {isVisible && (
          <motion.div
            className={`tooltip tooltip-${position}`}
            initial={{ opacity: 0, y: position === 'top' ? 5 : -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            role="tooltip"
          >
            {content}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Usage
function IconButton({ icon, label, shortcut }: IconButtonProps) {
  return (
    <Tooltip content={`${label} (${shortcut})`}>
      <button className="icon-button" aria-label={label}>
        <Icon name={icon} />
      </button>
    </Tooltip>
  );
}

// Hint badge for new features
function NewFeatureHint({ feature }: { feature: string }) {
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem(`hint:${feature}`) === 'dismissed';
  });
  
  if (dismissed) return null;
  
  const dismiss = () => {
    localStorage.setItem(`hint:${feature}`, 'dismissed');
    setDismissed(true);
  };
  
  return (
    <motion.div
      className="new-feature-hint"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
    >
      <span className="hint-badge">NEW</span>
      <span className="hint-text">{feature}</span>
      <button className="hint-dismiss" onClick={dismiss}>
        <Icon name="X" size={14} />
      </button>
    </motion.div>
  );
}
```

### 7.4 Example Spaces

```typescript
// Example space templates for onboarding
const exampleSpaces: SpaceTemplate[] = [
  {
    id: 'personal-tasks',
    name: 'Personal Tasks',
    description: 'Track your personal to-dos and goals',
    color: '#3b82f6',
    tasks: [
      {
        title: 'Review weekly goals',
        status: 'todo',
        priority: 'high',
        dueDate: addDays(new Date(), 1),
      },
      {
        title: 'Schedule dentist appointment',
        status: 'todo',
        priority: 'medium',
      },
      {
        title: 'Buy groceries',
        status: 'done',
        priority: 'low',
      },
    ],
  },
  {
    id: 'website-project',
    name: 'Website Redesign',
    description: 'Company website redesign project',
    color: '#8b5cf6',
    tasks: [
      {
        title: 'Create wireframes',
        status: 'done',
        priority: 'high',
      },
      {
        title: 'Design mockups',
        status: 'in-progress',
        priority: 'high',
        assignee: 'designer',
      },
      {
        title: 'Review with stakeholders',
        status: 'todo',
        priority: 'medium',
      },
    ],
  },
  {
    id: 'learning-goals',
    name: 'Learning Goals',
    description: 'Track your learning and skill development',
    color: '#10b981',
    tasks: [
      {
        title: 'Complete TypeScript course',
        status: 'in-progress',
        priority: 'high',
      },
      {
        title: 'Read Clean Code',
        status: 'todo',
        priority: 'medium',
      },
      {
        title: 'Build side project',
        status: 'todo',
        priority: 'low',
      },
    ],
  },
];

// Example space selector
function ExampleSpaceSelector({ onSelect }: { onSelect: (template: SpaceTemplate) => void }) {
  return (
    <div className="example-spaces">
      <h2>Start with an example</h2>
      <p>Choose a template to get started quickly</p>
      
      <div className="template-grid">
        {exampleSpaces.map(template => (
          <motion.button
            key={template.id}
            className="template-card"
            style={{ borderColor: template.color }}
            whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelect(template)}
          >
            <div 
              className="template-color"
              style={{ backgroundColor: template.color }}
            />
            <h3>{template.name}</h3>
            <p>{template.description}</p>
            <span className="task-count">
              {template.tasks.length} sample tasks
            </span>
          </motion.button>
        ))}
      </div>
      
      <button 
        className="start-from-scratch"
        onClick={() => onSelect(null)}
      >
        Start from scratch
      </button>
    </div>
  );
}
```

---

## 📎 Appendix

### A. Animation Timing Reference

| Animation Type | Duration | Easing |
|---------------|----------|--------|
| Micro-interaction | 150-200ms | ease-out |
| Layout change | 300ms | ease-in-out |
| Page transition | 400ms | ease-out |
| Drag feedback | 0ms (instant) | linear |
| Spring animation | 500-800ms | spring physics |
| Celebration | 1000-1500ms | ease-out-bounce |

### B. Sound Effects Reference

| Event | Sound Type | Frequency/Duration |
|-------|-----------|-------------------|
| Task complete | Success chime | C5-E5-G5 arpeggio |
| Task move | Whoosh | 150ms sweep |
| Error | Low buzz | 200ms sawtooth |
| Click | Pop | 50ms 800Hz |
| Achievement | Fanfare | Multi-note sequence |

### C. Haptic Patterns

| Event | Pattern (ms) |
|-------|-------------|
| Light tap | [10] |
| Success | [10, 50, 10] |
| Error | [30, 30, 30] |
| Completion | [10, 30, 50, 30, 10] |

---

*Document created: 2026-03-23*
*Version: 1.0 - UX Design System for Koban*
