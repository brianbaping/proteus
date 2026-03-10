# Proteus Forge Desktop GUI — User Guide

This guide walks you through the Proteus Forge desktop app, from first launch to reviewing production output. The GUI wraps the same pipeline as the CLI but provides a visual interface for managing projects, monitoring agents in real time, and reviewing artifacts.

> **Related docs:** [CLI User Guide](user-guide.md) · [CLI Commands](commands.md) · [Artifacts](artifacts.md) · [Schemas](schemas.md)

---

## Quickstart

```bash
# Build and launch
npm install
npm run build -w @proteus-forge/shared
npm run dev -w @proteus-forge/gui
```

1. Click **+ Start New** in the top bar
2. Enter a project name and select your POC source folder
3. On the Inspection tab, click **Run Inspection**
4. Work through each tab: Design, Planning, Breakdown, Execution
5. Review results on each canvas and session history in the Log tab

---

## Table of Contents

1. [Launching the App](#launching-the-app)
2. [Interface Overview](#interface-overview)
3. [Creating a Project](#creating-a-project)
4. [Switching Between Projects](#switching-between-projects)
5. [Running the Inspection Phase](#running-the-inspection-phase)
6. [Running the Design Phase](#running-the-design-phase)
7. [Running the Planning Phase](#running-the-planning-phase)
8. [Running the Breakdown Phase](#running-the-breakdown-phase)
9. [Running the Execution Phase](#running-the-execution-phase)
10. [Chatting with Agents](#chatting-with-agents)
11. [Watching Agent Activity](#watching-agent-activity)
12. [Reviewing Session Logs](#reviewing-session-logs)
13. [Reverting a Phase](#reverting-a-phase)
14. [Deleting a Project](#deleting-a-project)
15. [Configuring Settings](#configuring-settings)
16. [Changing the Theme](#changing-the-theme)
17. [Adjusting Zoom](#adjusting-zoom)
18. [Keyboard Shortcuts](#keyboard-shortcuts)

---

## Launching the App

### Development mode (hot-reload)

```bash
npm run build -w @proteus-forge/shared   # required first time
npm run dev -w @proteus-forge/gui
```

### Production build

```bash
npm run build -w @proteus-forge/gui
```

The app opens at 1440x900 (minimum 1024x600). Your last-used theme and zoom level are restored automatically.

---

## Interface Overview

The app is organized into horizontal sections from top to bottom:

| Section | Purpose |
|---------|---------|
| **Top Bar** | Logo, project selector, "+ Start New" button, settings gear |
| **Progress Bar** | Green-to-amber gradient showing pipeline completion (0–100%) |
| **Phase Tab Strip** | Navigate between Inspection, Design, Planning, Breakdown, Execution, and Log |
| **Main Content** | Left sidebar (run controls + options) and right canvas (artifacts + stats) |
| **Action Bar** | "Destroy Phase & Revert" button, cost, duration, session ID |
| **Chat Panel** | Collapsible bottom panel for sending messages to agents |

The phase tabs are always clickable — you can navigate to any phase at any time to review its artifacts or run it.

---

## Creating a Project

1. Click **+ Start New** in the top bar
2. Fill in the dialog:
   - **Project Name** (required) — a unique identifier for this project
   - **Source Path** (required) — your POC folder. Click Browse to use a native directory picker.
   - **Target Path** (optional) — where production code will be built. If left empty, defaults to `{source-directory}/../{name}-prod`.
3. Click **Create Project**

The app switches to the new project and opens the Inspection tab. The target directory is initialized with a git repo and `.proteus-forge/` config folder.

---

## Switching Between Projects

Click the **project name dropdown** in the top bar to see all registered projects. Select one to switch. The phase tabs, artifacts, and session state update to reflect the selected project.

---

## Running the Inspection Phase

The Inspection tab has two panels: a **sidebar** on the left for controls and a **canvas** on the right for results.

### Providing source code

The sidebar offers two ways to load your POC:

**Option A — Upload or browse:**
Click "Upload" or use the file picker to select a `.zip`, `.tar.gz`, or folder. Archives are automatically extracted. The source path is populated for you.

**Option B — Clone from GitHub:**
Paste a repository URL and click "Clone Repository". The repo is cloned (shallow) into your project's source path.

### Setting paths

- **POC Repo Path** — path to your source POC (auto-filled if you uploaded or cloned)
- **Candidate Repo Path** — the target directory for production code (auto-generated, editable)

Both paths have Browse buttons for native directory pickers.

### Options

- **Exclude UI/Style** — toggle this on to skip style extraction (colors, typography, visual identity). Useful for backend-only projects.

### Running

Click **Run Inspection**. While running:
- The button changes to a red **Stop** button
- The chat panel auto-opens
- Agent activity appears in real time (see [Watching Agent Activity](#watching-agent-activity))
- The badge on the canvas header shows "IN PROGRESS"

When complete:
- The canvas populates with stats (files analyzed, lines of code, issues found, stack detected)
- A file tree shows the analyzed structure
- Findings are listed with severity badges (CRITICAL, WARNING, INFO)
- Artifact files appear in a clickable grid — double-click to open in your default app

---

## Running the Design Phase

Navigate to the **Design** tab. The sidebar provides:

### Design brief (optional but recommended)

- **Manual Brief** — type architectural requirements directly (e.g., "Use microservices with Go and gRPC")
- **Upload Brief** — drop or select a file containing your requirements

The brief is included in the architect agent's prompt. It guides service boundaries, tech stack choices, and API design.

### Options

- **Exclude UI** — toggle to skip UI/frontend design considerations

### Running

Click **Run Design**. On completion, the canvas shows:
- Architecture style and framework
- Target stack (language, database, etc.)
- Service cards with discipline badges, descriptions, feature counts, and interface counts
- Artifact files (design.md, design-meta.json)

### Staleness warnings

If you re-ran Inspection after a previous Design, a red warning banner appears indicating the design may be based on outdated analysis. Re-run Design to refresh.

---

## Running the Planning Phase

Navigate to the **Planning** tab. The sidebar provides:

- **Manual Plan Notes** — optional text input to guide task generation
- **Upload Plan** — drop or select a notes file

Click **Run Planning**. On completion, the canvas shows:
- Total tasks, wave count, critical path length, and disciplines
- Execution waves with per-task details (complexity, discipline, test expectations)
- Artifact files (plan.json, plan.md)

---

## Running the Breakdown Phase

Navigate to the **Breakdown** tab. The sidebar provides:

- **Manual Breakdown Notes** — optional guidance for track partitioning
- **Upload Breakdown** — drop or select a notes file

Click **Run Breakdown**. On completion, the canvas shows:
- Total tracks, total tasks, and disciplines
- Track cards showing discipline, task count, and dependencies between tracks
- Artifact files (manifest.json, per-track files)

---

## Running the Execution Phase

Navigate to the **Execution** tab. The sidebar shows:

- **Execution Tickets** — read-only list of tracks from the Breakdown phase. Each card shows the discipline, task count, and dependencies. This is what the agent teams will work from.

Click **Run Execution**. This is the longest-running phase — parallel agent teams write production code wave by wave, with git checkpoints after each wave.

On completion, the canvas shows:
- Total tasks, completed, failed, and success rate
- Duration and session ID
- Artifact files (session.json, execute.md)

Post-execution verification (npm install, build, test, lint) runs automatically.

---

## Chatting with Agents

The **Chat Panel** sits at the bottom of the screen and lets you communicate with the lead agent during a running session.

### Collapsed state

When collapsed, the panel shows a single-line input bar:
- A **green pulsing dot** indicates agents are running (gray when idle)
- Type a message and press **Enter** or click **Send**
- The input is disabled when no session is active
- A **Chat (N)** counter shows how many messages exist — click it to expand

### Expanded state

Click the counter or drag the resize handle upward to expand:
- **Your messages** appear right-aligned with a green tint
- **Agent messages** appear left-aligned with agent names color-coded
- The panel auto-scrolls to the latest message
- **Export** saves the chat thread as a `.txt` file
- **Clear** empties the chat history
- Click the **collapse arrow** to minimize

The panel auto-opens when you start a run.

### What to say

Messages are delivered to the lead agent's inbox. Use them to steer execution in real time:
- "Use async bcrypt for password hashing"
- "The design system uses Radix UI primitives"
- "Skip the e2e test setup for now"

Press **Shift+Enter** for a newline within a message.

---

## Watching Agent Activity

During any running phase, an **Agent Activity Tree** appears showing the hierarchy of spawned agents:

- **Root node** — the Lead agent
- **Child nodes** — specialist agents spawned by the Lead
- Each node shows the agent name, a color badge, status (spawned/active/done), message count, and duration

Click a node to expand or collapse its subtree and view individual agent messages.

After a run completes, the tree is persisted to disk and available in the [Log tab](#reviewing-session-logs).

---

## Reviewing Session Logs

The **Log** tab (after Execution in the tab strip) provides a historical view of all completed runs.

### What you see

- One collapsible section per completed phase
- Click a section to expand and view the full agent activity tree for that run
- Each section shows agent count and total duration

### Exporting

Click **Export** to save all session logs as a single JSON file. Useful for auditing, post-mortems, or sharing with teammates.

---

## Reverting a Phase

To undo a phase and all downstream work:

1. Navigate to the phase you want to revert
2. Click **Destroy Phase & Revert** in the action bar at the bottom
3. Confirm in the dialog

This removes the current phase's artifacts and everything downstream. For example, reverting Design removes Design, Planning, Breakdown, and Execution artifacts. You keep Inspection and can re-run from Design.

The button is disabled when no artifacts exist for the current phase or when a session is running.

---

## Deleting a Project

1. Click the **red X** next to the project name in the top bar dropdown
2. The Destroy Project dialog appears:
   - Confirms the project name
   - Warns that the target directory will be deleted (irreversible)
   - Optional checkbox: "Also delete POC source folder" (shows the source path)
3. Click **Destroy** to confirm

Your source POC is preserved by default — only the target (production) directory is removed unless you check the source deletion box.

---

## Configuring Settings

Click the **gear icon** in the top bar to open the Settings dialog. It has four tabs:

### General

- **Max Output Tokens** — controls how much output agents can produce per turn (16,000–128,000; default 32,000)
- **Zoom Level** — adjust UI scale (see [Adjusting Zoom](#adjusting-zoom))
- **Theme** — select a color theme (see [Changing the Theme](#changing-the-theme))

### Providers

Manage API provider connections:
- Each provider has a name, type, and API key
- Click the **eye icon** to show/hide the API key
- Click **+ Add Provider** to add a new one
- Click the **remove button** to delete a provider

### Tiers

Configure which model each tier uses:
- **fast** — used for quick analysis (default: `claude-haiku-4-5`)
- **standard** — used for planning stages (default: `claude-sonnet-4-6`)
- **advanced** — used for design and execution (default: `claude-opus-4-6`)

Each tier has a provider dropdown and a model name field.

### Phases

Map each pipeline phase to a tier or a custom model:
- Phase names are read-only (inspect, style, design, plan, split, execute)
- By default, each phase inherits its tier's model
- Check **Custom** to override with a specific provider and model

Click **Save** to apply changes, or **Cancel** to discard. Canceling also reverts any live theme or zoom preview.

---

## Changing the Theme

Six built-in color themes are available:

| Theme | Description |
|-------|-------------|
| **Dark** | Cool grays with green accents (default) |
| **Light** | Light backgrounds with dark text |
| **Hot Dog Stand** | Retro primary colors |
| **Synthwave** | Neon purple and pink |
| **Solarized** | Warm amber and cool blue |
| **Forest** | Deep greens and earth tones |

To change: **Settings > General > Theme**. The theme previews live as you select it. Click Save to keep the change, or Cancel to revert.

The theme persists across sessions. A flash-prevention script loads the theme from local storage before React renders, so you never see a flash of the wrong theme on startup.

---

## Adjusting Zoom

Three ways to adjust the UI scale:

1. **Settings > General > Zoom Level** — dropdown with presets from 60% to 200%
2. **Keyboard shortcuts** — Ctrl+= (zoom in), Ctrl+- (zoom out), Ctrl+0 (reset to 100%)
3. **Settings > General > A-/A+ buttons** — step through zoom levels

Zoom level persists across sessions and is stored in your global config.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl+=** | Zoom in |
| **Ctrl+-** | Zoom out |
| **Ctrl+0** | Reset zoom to 100% |
| **Ctrl+Shift+I** | Toggle developer tools |
| **F11** | Toggle fullscreen |
| **Enter** | Send chat message |
| **Shift+Enter** | Newline in chat input |

---

## Tips

- **Provide a design brief.** The single highest-leverage input you can give is a design brief on the Design tab. Even a sentence ("Use Next.js with Prisma") significantly focuses the architecture.

- **Watch the agent tree during Execution.** The activity tree shows you which agents are active, what they're working on, and how far along each wave is. If something looks off, send a chat message to the lead.

- **Revert early, not late.** If Inspection missed something, revert and re-run before investing in Design and downstream stages. Each phase builds on the previous one.

- **Export logs before destroying.** Use the Log tab's Export button to save session history before reverting phases. Exported logs are useful for comparing runs.

- **Use Exclude UI/Style for API-only projects.** If your POC is a backend service with no frontend, toggle "Exclude UI/Style" on the Inspection tab to skip visual identity extraction and focus on architecture.

- **Check the action bar for costs.** After each run, the bottom bar shows the cost and duration. Use this to calibrate budget expectations before running expensive phases like Execution.
