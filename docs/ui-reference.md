# Proteus Forge — GUI Reference Guide

> Quick reference for development conversations. Describes every component, layout region, design token, and interaction in the Electron GUI.

---

## App Shell Layout

```
┌──────────────────────────────────────────────────────┐
│  TopBar (h-12)                                       │
│  Logo · ProjectSelector · "+ Start New" · ⚙ · Badge  │
├──────────────────────────────────────────────────────┤
│  ProgressBar (h-[2px], green→amber gradient)         │
├──────────────────────────────────────────────────────┤
│  PhaseTabStrip (h-11)                                │
│  [1 Inspection] › [2 Design] › [3 Planning] › ...   │
├─────────────┬────────────────────────────────────────┤
│             │                                        │
│  Sidebar    │  Artifact Canvas                       │
│  (w-80)     │  (flex-1, scrollable)                  │
│             │                                        │
│  Controls,  │  ArtifactHeader + StalenessWarning     │
│  inputs,    │  StatCards (2×2 or 3-col grid)         │
│  run/stop   │  Phase-specific content                │
│             │  Artifact card grid (3-col)            │
│             │                                        │
├─────────────┴────────────────────────────────────────┤
│  CompleteBar (h-12)                                  │
│  [← Destroy] · $cost · duration · sessionId · [→]   │
├──────────────────────────────────────────────────────┤
│  AIChatPanel (h-[220px])                             │
│  Header · scrollable message log · input + Send      │
└──────────────────────────────────────────────────────┘
```

All navigation is state-driven (Zustand stores, no router). Modals overlay via `fixed inset-0 z-50`.

---

## Chrome Components (`components/chrome/`)

| Component | File | What it does |
|-----------|------|-------------|
| **TopBar** | `TopBar.tsx` | App header — Logo, ProjectSelector dropdown, "+ Start New" button (opens NewProjectDialog), Settings gear (opens SettingsDialog), SessionBadge |
| **Logo** | `Logo.tsx` | "Proteus-" in green + "Forge" in amber, `font-display` (Syne) |
| **ProjectSelector** | `ProjectSelector.tsx` | Dropdown of all projects. Label: "PROJECT:" (uppercase, muted). Reads/writes `projectStore` |
| **SessionBadge** | `SessionBadge.tsx` | Pill: "ACTIVE SESSION" (green, pulsing dot) or "IDLE" (gray). Reads `sessionStore.isRunning` |
| **ProgressBar** | `ProgressBar.tsx` | 2px gradient bar, green→amber, fills proportionally to completed stages (1/5 = 20%) |
| **PhaseTabStrip** | `PhaseTabStrip.tsx` | 5 tabs with number badges. States: **active** (green bg), **completed** (green border), **locked** (gray, disabled). Separated by `›` chevrons. Green underline on active |
| **CompleteBar** | `CompleteBar.tsx` | Bottom action bar — left: red "← Destroy Phase & Revert" + cost/duration/sessionId; right: hint text + amber "Complete Phase & Unlock Next →" |
| **AIChatPanel** | `AIChatPanel.tsx` | Fixed 220px chat. Header pulses green when running. Messages tagged "AI" (green) or "YOU" (amber). Enter sends, reads/writes `chatStore` + `sessionStore` |

---

## Phase Components (5 phases)

Each phase follows the **Container + Canvas** pattern:
- **Container** (`<PhaseName>Phase.tsx`): owns state, loads artifacts on mount, calls `electronAPI`
- **Canvas** (`<PhaseName>Canvas.tsx`): pure presentational, receives `data` prop
- **Transform function**: converts raw JSON artifact → display data type

### Phase 1 — Inspection (`components/inspection/`)

| Component | Role |
|-----------|------|
| **InspectionPhase** | Container. Loads `features.json` via `featuresJsonToInspectionData()`. Manages `excludeStyle` toggle |
| **IngestSidebar** | Left panel (w-80). Source selection: "Upload Archive" or "GitHub Repo" toggle → FileDropZone / URL input + Clone. POC/Target path inputs with Browse buttons. "Exclude UI/Style" toggle. Green Run / red Stop button |
| **InspectionCanvas** | Right panel. Stats: Files Analyzed, Lines of Code, Issues Found, Stack Detected. File tree (indented folders/files with 📁/📄). Findings list (severity badges: critical=red, warning=amber, info=green). Artifact cards (3-col grid) |

**Data type — `InspectionData`**: `filesAnalyzed`, `linesOfCode`, `issuesFound`, `stackDetected`, `findings[]`, `fileTree[]`, `artifacts[]`

### Phase 2 — Design (`components/design/`)

| Component | Role |
|-----------|------|
| **DesignPhase** | Container. Sidebar (w-72): textarea for brief, FileDropZone for upload, "Exclude UI" toggle, Run/Stop. Loads `design-meta.json` via `designMetaToDesignData()` |
| **DesignCanvas** | Stats: Architecture Style, Services, Features Mapped, Framework. Target Stack (key-value list). Services list (name, discipline badge in cyan, description, counts). Artifact cards |

**Data type — `DesignData`**: `architectureStyle`, `framework`, `servicesCount`, `featuresMapped`, `targetStack` (Record), `services[]`, `artifacts[]`

### Phase 3 — Planning (`components/planning/`)

| Component | Role |
|-----------|------|
| **PlanningPhase** | Container. Sidebar: textarea for notes, FileDropZone, "APPROVE PLAN" button. Loads `plan.json` via `planJsonToPlanData()` |
| **PlanningCanvas** | Stats: Total Tasks, Execution Waves, Critical Path, Disciplines. Wave timeline (task cards with discipline/complexity/testing badges). Critical path (amber pill chain with → separators). Artifact cards |

**Badge colors**: complexity: green=low, amber=medium, red=high. Testing: cyan=unit, purple=integration, gray=none.

**Data type — `PlanData`**: `totalTasks`, `waveCount`, `criticalPathLength`, `disciplines[]`, `waves[]`, `criticalPath[]`, `artifacts[]`

### Phase 4 — Breakdown (`components/breakdown/`)

| Component | Role |
|-----------|------|
| **BreakdownPhase** | Container. Sidebar: textarea for notes, FileDropZone, "APPROVE BREAKDOWN" button. Loads `manifest.json` via `manifestToBreakdownData()` |
| **BreakdownCanvas** | Stats (3-col): Total Tracks, Total Tasks, Disciplines. Track cards: discipline name (capitalized) with color badge, task count, dependency info (depends on / required by). Artifact cards |

**Discipline colors**: purple=shared, cyan=data, green=backend, amber=frontend, red=devops.

**Data type — `BreakdownData`**: `totalTracks`, `totalTasks`, `disciplines[]`, `tracks[]`, `artifacts[]`

### Phase 5 — Execution (`components/execution/`)

| Component | Role |
|-----------|------|
| **ExecutionPhase** | Container. Sidebar (w-64): "EXECUTION TICKETS" title, track list from manifest, "BUILD CANDIDATE" button. Loads `session.json` via `sessionJsonToExecutionData()` |
| **ExecutionCanvas** | Stats: Total Tasks, Completed, Failed, Success Rate (%). Session details: status badge, session ID, timestamps, duration. Stacked progress bar (green=completed, red=failed). Artifact cards |

**Data type — `ExecutionData`**: `totalTasks`, `completed`, `failed`, `successRate`, `status`, `sessionId`, `startedAt`, `completedAt`, `duration`, `artifacts[]`

---

## Shared Components (`components/shared/`)

| Component | Props | Visual |
|-----------|-------|--------|
| **ArtifactHeader** | `title`, `badge: BadgeType`, `actions?: ReactNode` | Display font title + status pill. Badge types: complete (green-dark), analyzing (amber-dark), draft (cyan-dark), idle (bg-3) |
| **StatCard** | `label`, `value` | Dark card (bg-3). Uppercase muted label (2xs) + large bold value (2xl) |
| **FileDropZone** | `onFilePath`, `accept?`, `label?` | Dashed border box. Highlights green on drag-over. Click opens file picker |
| **StalenessWarning** | `stage: StageName` | Amber banner: "STALE" badge + reason text. Appears below ArtifactHeader when upstream changed |

---

## Dialog Components (`components/dialogs/`)

### NewProjectDialog
- **Trigger**: "+ Start New" in TopBar
- **Size**: 480px wide, centered modal with `bg-black/60` backdrop
- **Fields**: Project Name (text), Source Path (text + Browse), Target Path (text + Browse, auto-generated)
- **Buttons**: Cancel (secondary) + Create Project (green, disabled if name/source empty)

### SettingsDialog
- **Trigger**: gear icon in TopBar
- **Size**: 600px wide, max 80vh, scrollable
- **3 tabs**:
  - **Providers**: name + type + API key (password field, show/hide toggle) per provider. "+ Add Provider" button
  - **Tiers**: fixed 3 rows (fast/standard/advanced). Each: tier name + provider dropdown + model text input
  - **Roles**: role name + custom checkbox + tier dropdown or provider+model inputs. "+ Add Role"

---

## Stores (`stores/`)

### projectStore
| State | Type | Purpose |
|-------|------|---------|
| `registry` | `ProjectRegistry \| null` | All projects |
| `activeProjectName` | `string \| null` | Selected project |
| `activeEntry` | `ProjectEntry \| null` | Source/target paths |
| `stageStatuses` | `StageStatus[]` | Completion of all 5 stages |
| `staleness` | `Array<{stage, staleReason}>` | Upstream invalidations |
| `loading` | `boolean` | Loading indicator |

Actions: `loadRegistry()`, `setActiveProject(name)`, `refreshStatus()`, `createProject()`, `updateProject()`

### sessionStore
| State | Type | Purpose |
|-------|------|---------|
| `isRunning` | `boolean` | Stage in progress |
| `currentStage` | `StageName \| null` | Which stage is running |
| `logs` | `string[]` | Log messages |
| `errors` | `string[]` | Error messages |
| `cost` | `number` | Estimated $ cost |
| `duration` | `string` | Elapsed time |
| `sessionId` | `string` | AI session ID |
| `completedStages` | `StageName[]` | Stages user has explicitly completed |

Actions: `startStage(stage)`, `addLog()`, `addError()`, `endSession(success, cost, duration, sessionId)`, `completeStage(stage)`, `initCompletedStages(stages)`, `reset()`

### chatStore
| State | Type | Purpose |
|-------|------|---------|
| `messages` | `ChatMessage[]` | `{role: "ai"\|"user", text, timestamp}` |
| `inputValue` | `string` | Current input value |

Actions: `addMessage(role, text)`, `setInput(value)`, `clearMessages()`

---

## Design Tokens

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `green` | `#00ff88` | Primary actions, active states, success, AI labels |
| `green-dim` | `#00cc6a` | Hover states |
| `green-dark` | `#003322` | Background tints, selected states |
| `amber` | `#ffb830` | Secondary actions, advance buttons, "Forge" logo |
| `amber-dim` | `#cc9326` | Hover states |
| `amber-dark` | `#332200` | Background tints |
| `red` | `#ff4466` | Critical, destructive, errors |
| `red-dark` | `#331118` | Error background tints |
| `cyan` | `#00ddcc` | Tertiary, database/infra, discipline badges |
| `cyan-dark` | `#002b28` | Cyan background tints |
| `bg` | `#0a0c0e` | Deepest background |
| `bg-2` | `#0f1215` | Panel/card background |
| `bg-3` | `#141820` | Elevated surfaces |
| `bg-4` | `#1a1f2e` | Further elevated |
| `fg` | `#e2e8f0` | Primary text |
| `fg-dim` | `#8899aa` | Secondary text |
| `fg-muted` | `#4a5568` | Disabled/tertiary text |
| `border` | `#1f2937` | Subtle borders |
| `border-2` | `#2d3748` | Input/card borders |

### Typography

| Class | Font | Size |
|-------|------|------|
| `font-display` | Syne | — (for headings, logo) |
| `font-mono` | JetBrains Mono | — (default body, inputs, code) |
| `text-2xs` | — | 9px / 12px |
| `text-xs` | — | 11px / 16px |
| `text-sm` | — | 12px / 18px |
| `text-base` | — | 13px / 20px |
| `text-lg` | — | 15px / 22px |
| `text-xl` | — | 18px / 24px |
| `text-2xl` | — | 20px / 28px |
| `text-3xl` | — | 24px / 32px |

Section headers use `uppercase tracking-wider text-2xs text-fg-muted`.

### Component Recipes

**Primary button**: `bg-green text-bg hover:bg-green-dim font-bold rounded px-4 py-1.5 text-sm`
**Amber button**: `bg-amber text-bg hover:bg-amber-dim`
**Destructive button**: `bg-red-dark text-red border border-red/30 hover:bg-red/20`
**Secondary button**: `border border-border-2 text-fg-dim hover:text-amber`
**Input field**: `bg-bg text-fg px-3 py-2 rounded border border-border-2 focus:border-green/50 outline-none font-mono text-xs`
**Card**: `bg-bg-3 rounded-lg p-4 border border-border`
**Badge (status)**: `px-2 py-0.5 rounded border uppercase text-2xs font-mono tracking-wider`
**Toggle switch**: track `w-10 h-5 rounded-full` (off: `bg-bg-3`, on: `bg-amber`), thumb `w-4 h-4 rounded-full bg-white`

---

## IPC Surface (Electron ↔ React)

All calls go through `window.electronAPI` (defined in `preload.ts`).

| Domain | Channels |
|--------|----------|
| **Project** | `listProjects`, `getActiveProject`, `setActiveProject`, `createProject`, `destroyProject`, `getProjectStatus`, `readArtifacts`, `updateProject`, `cloneRepo`, `extractArchive` |
| **Pipeline** | `runStage`, `abortStage`, `revertStage` |
| **Events** | `onSessionEvent`, `onReporterLog`, `onReporterWarn`, `onReporterError` |
| **Chat** | `sendMessage` |
| **Config** | `readGlobalConfig`, `writeGlobalConfig`, `readCosts` |
| **Dialogs** | `openDirectory`, `openFile`, `saveFile` |

Session events: `agent-spawned`, `agent-activity`, `agent-done`, `session-start`, `session-end`, `progress`, `error`

---

## Empty & Loading States

- **Empty** (no data): Centered message "Run [stage] to begin analysis..." (h-64)
- **Running** (session active): Spinning green-border circle + status text
- **Complete**: Full canvas with data + "complete" badge on ArtifactHeader

---

## File Map

```
packages/gui/
├── electron/
│   ├── main.ts                    # Window creation (1440×900, min 1024×600)
│   ├── preload.ts                 # ElectronAPI interface
│   ├── gui-dashboard.ts           # Agent status → IPC events
│   └── ipc/
│       ├── project.ts             # Project + artifact handlers
│       ├── pipeline.ts            # Stage execution + costs
│       └── dialog.ts              # File/directory pickers
├── src/
│   ├── App.tsx                    # Root layout + event subscriptions
│   ├── main.tsx                   # React entry
│   ├── index.css                  # Tailwind directives + CSS vars
│   ├── global.d.ts                # Window.electronAPI type
│   ├── stores/
│   │   ├── project-store.ts
│   │   ├── session-store.ts
│   │   └── chat-store.ts
│   └── components/
│       ├── chrome/                # TopBar, ProgressBar, PhaseTabStrip,
│       │                          # CompleteBar, Logo, ProjectSelector,
│       │                          # SessionBadge, AIChatPanel
│       ├── shared/                # ArtifactHeader, StatCard,
│       │                          # FileDropZone, StalenessWarning
│       ├── dialogs/               # NewProjectDialog, SettingsDialog
│       ├── inspection/            # InspectionPhase, IngestSidebar,
│       │                          # InspectionCanvas
│       ├── design/                # DesignPhase, DesignCanvas
│       ├── planning/              # PlanningPhase, PlanningCanvas
│       ├── breakdown/             # BreakdownPhase, BreakdownCanvas
│       └── execution/             # ExecutionPhase, ExecutionCanvas
├── tailwind.config.ts             # All design tokens
├── index.html                     # HTML template (<html class="dark">)
└── vite.config.ts
```
