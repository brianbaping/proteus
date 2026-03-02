# Proteus-Forge — UI Element Reference Guide

Use this guide when describing changes to the prototype. Each element has a canonical name, its CSS class(es), and a plain-language description of where it lives and what it does.

---

## GLOBAL CHROME (present on every phase)

| Element | Class(es) | Description |
|---|---|---|
| **Top Bar** | `.topbar` | Fixed 48px header strip at the very top of the page |
| **Logo** | `.logo` | "Proteus-Forge" wordmark — "Proteus-" in green, "Forge" in amber |
| **Top Bar Divider** | `.topbar-divider` | Thin vertical rule between logo and project name |
| **Project Name** | `.project-name` | Shows "Project: ecommerce-v0.3" — muted label + bold value |
| **Start New Button** | `.btn.btn-secondary` inside `.topbar-right` | Secondary button reading "+ Start New" — sits immediately left of the Session Status Badge |
| **Session Status Badge** | `.status-badge.status-active` | Green pill in the top-right corner showing "● ACTIVE SESSION" |
| **Progress Bar** | `.progress-bar` / `#progressFill` | Thin 2px green-to-amber gradient bar below the Top Bar; advances as phases complete |
| **Phase Tab Strip** | `.phase-tabs` | 44px row of phase tabs below the progress bar |
| **Phase Tab** | `.phase-tab` | Individual tab — holds a Phase Number Badge + label |
| **Phase Number Badge** | `.phase-num` | Small square number chip inside each tab (green when active, outlined when completed, dark when locked) |
| **Phase Connector** | `.phase-connector` | The `›` arrow glyph between tabs |
| **Tab States** | `.active` / `.completed` / `.locked` | Active = green underline; Completed = dim green, clickable; Locked = greyed out, not clickable |
| **Complete Bar** | `.complete-bar` / `#completeBar` | Fixed footer strip above the AI Chat; Destroy button on the left, hint + Complete button on the right |
| **Destroy Phase & Revert Button** | `.btn` with red background, left side of `.complete-bar` | Red button reading "← Destroy Phase & Revert" — mirrors the size and weight of the Complete Phase button |
| **Complete Hint** | `.complete-hint` | Muted text describing what to do before proceeding — sits left of the Complete Phase button |
| **Complete Phase Button** | `.btn.btn-amber` inside `.complete-bar` | Amber button reading "Complete Phase & Unlock Next →" — advances to the next phase |
| **AI Chat Panel** | `.ai-chat` | 220px panel docked at the very bottom of the screen, present on all phases |
| **Chat Header** | `.chat-header` | Top strip of the AI Chat showing the pulsing green dot and phase-specific label |
| **Chat Dot** | `.chat-dot` | Pulsing green circle indicating the AI is active |
| **Chat Messages Area** | `.chat-messages` / `#chatMessages` | Scrollable message thread above the input row |
| **Chat Message** | `.chat-msg` | A single message row containing a role label + message text |
| **Chat Role Label** | `.chat-msg-role` | "AI" (green) or "YOU" (amber) label prefixing each message |
| **Chat Message Text** | `.chat-msg-text` | The body text of each chat message |
| **Chat Input Row** | `.chat-input-row` | Bottom strip of the AI Chat containing the text field and send button |
| **Chat Input Field** | `.chat-input` / `#chatInput` | Monospace text field — placeholder reads "Ask about this phase's findings..." |
| **Chat Send Button** | `.chat-send` | Green "SEND" button to the right of the chat input |

---

## SHARED COMPONENTS (reused across phases)

| Element | Class(es) | Description |
|---|---|---|
| **Artifact Header** | `.artifact-header` | Title row at the top of every artifact canvas — contains title, status badge, and action buttons |
| **Artifact Title** | `.artifact-title` | Large Syne-font heading for the current artifact |
| **Artifact Badge** | `.artifact-badge` | Inline status chip next to the artifact title |
| **Model Selector** | `.model-select` | Dropdown in every phase artifact header, right of the status badge — lists claude-opus-4-6, claude-sonnet-4-6 (default), claude-haiku-4-5 |
| — Analyzing state | `.badge-analyzing` | Amber — "IN PROGRESS" |
| — Complete state | `.badge-complete` | Green — "COMPLETE" |
| — Draft state | `.badge-draft` | Cyan — "DRAFT" |
| **Artifact Actions** | `.artifact-actions` | Button group on the right side of the Artifact Header |
| **Primary Button** | `.btn.btn-primary` | Solid green button |
| **Secondary Button** | `.btn.btn-secondary` | Transparent button with a subtle border — dims to amber on hover |
| **Amber Button** | `.btn.btn-amber` | Solid amber button — used for approve/advance actions |
| **Sidebar Section Title** | `.sidebar-section-title` | Small all-caps label with a bottom border used as a section divider inside sidebars |
| **Mono Input** | `.mono-input` | Monospace text input field used for forms across the app |
| **Input Group** | `.input-group` | Wrapper for a label + input pair |
| **Input Label** | `.input-label` | Tiny all-caps label above an input field |
| **Info Card** | `.info-card` | Dark card with a muted title and a prominent value — used for stats |

---

## PHASE 1 — INSPECTION

### Ingest Sidebar (left column, 320px)

| Element | Class(es) | Description |
|---|---|---|
| **Ingest Sidebar** | `.ingest-sidebar` | Left panel where the user configures the code source and inspection options |
| **Ingest Option Card** | `.ingest-option` | Selectable card — one for "Upload Archive", one for "GitHub Repo" |
| **Ingest Option Title** | `.ingest-option-title` | Bold title line inside an Ingest Option Card |
| **Ingest Option Description** | `.ingest-option-desc` | Muted description text inside an Ingest Option Card |
| **Selected state** | `.ingest-option.selected` | Green border + dark green background — the currently chosen ingest method |
| **Upload Zone** | `.upload-zone` | Dashed drag-and-drop area for .zip / .tar.gz files |
| **GitHub Input** | `#githubInput` | Text field + "Clone & Analyze" button; shown when GitHub Repo is selected |
| **Production Candidate Folder Section** | `.sidebar-section-title` "PRODUCTION CANDIDATE FOLDER" | Section in the Ingest Sidebar between the ingest source options and the Run button — specifies where output artifacts are written |
| **POC Repo Path Input** | `.mono-input` first field in the Production Candidate Folder section | Text field for the path to the POC/prototype repo (e.g. `/projects/ecommerce-poc`) |
| **POC Repo Browse Button** | `.btn.btn-secondary` next to POC Repo Path Input | Small secondary button to open a folder picker for the POC repo |
| **Candidate Repo Path Input** | `.mono-input` second field in the Production Candidate Folder section | Text field for the destination folder path (e.g. `/projects/ecommerce-prod`) |
| **Browse Button** | `.btn.btn-secondary` next to Output Path Input | Small secondary button to open a folder picker |
| **Output Path Hint** | Dark info box below the Output Path Input | Muted note: "Generated production artifacts will be written to this folder at the end of each phase." |
| **Run Inspection Button** | `.btn.btn-primary` at bottom of sidebar | Green "▶ RUN INSPECTION" button pinned to the bottom of the sidebar |

### Inspection Artifact Canvas (right column)

| Element | Class(es) | Description |
|---|---|---|
| **Inspection Layout** | `.inspection-layout` | Two-column grid: Ingest Sidebar (left) + Artifact Canvas (right) |
| **Artifact Canvas** | `.artifact-canvas` | Scrollable right column containing all inspection output |
| **Inspection Grid** | `.inspection-grid` | 2-column stat card grid at the top of the artifact canvas |
| **Stat Card** | `.info-card` inside `.inspection-grid` | Individual stat tile (Files Analyzed, Lines of Code, Issues Found, Stack Detected) |
| **File Tree Card** | `.file-tree` | Full-width card showing the project directory structure |
| **Tree Item** | `.tree-item` | A single file or folder row in the file tree |
| **Highlighted Tree Item** | `.tree-item.highlight` | Amber-colored tree row flagging a problematic file |
| **Findings List** | `.findings-list` | Full-width list of finding cards below the file tree |
| **Finding Item** | `.finding-item` | A single finding row: severity badge + description text |
| **Severity Badge** | `.finding-severity` | Colored pill label inside a Finding Item |
| — Critical | `.sev-critical` | Red badge |
| — Warning | `.sev-warn` | Amber badge |
| — Info | `.sev-info` | Green badge |
| **Finding Text** | `.finding-text` | The description body of a finding |

**Inspection Artifacts**

| Element | Class(es) | Description |
|---|---|---|
| **Inspection Artifacts Section** | `.info-card` below `.findings-list` | Full-width card below the Findings List — displays generated output files from the inspection run |
| **Artifact File Item** | `.artifact-file` | Clickable file tile — icon, filename, and file size; hover highlights in green |
| **Artifact Upload Card** | `.artifact-file` with dashed border | Special tile at the end of the artifact file list — dashed border, upload icon, "Upload / Add artifact" label; opens a file picker |
| **Artifact File Icon** | `.artifact-file-icon` | Large emoji icon representing the file type |
| **Artifact File Name** | `.artifact-file-name` | Filename label below the icon |
| **Artifact File Meta** | `.artifact-file-meta` | Muted file size label below the filename |

---

## PHASE 2 — DESIGN

| Element | Class(es) | Description |
|---|---|---|
| **Design Layout** | `.design-layout` | Three-column grid: Design Sidebar (280px left) + Architecture Decisions pane + System Diagram pane |
| **Design Sidebar** | `.design-sidebar` | Left panel mirroring the Ingest Sidebar — contains Manual Brief, Upload Brief, Options, Briefs list, and Run button |
| **Manual Brief Input** | `textarea.mono-input` at top of `.design-sidebar` | Multi-line text area for typing or pasting a design brief directly — sits above the Upload Brief zone |
| **Upload Brief Zone** | `.upload-zone` inside `.design-sidebar` | Dashed drag-and-drop area for .pdf, .md, or .txt brief files |
| **Options Section** | `.sidebar-section-title` "OPTIONS" | Section below the Upload Brief zone |
| **Exclude UI Toggle Row** | `.toggle-row` | Full-width row containing the "Exclude UI" label and toggle switch |
| **Exclude UI Label** | `.toggle-label` | "Exclude UI" text on the left of the toggle row |
| **Toggle Switch** | `.toggle-switch` | Pill-style on/off switch — off state is grey, on state is amber |
| **Toggle Track** | `.toggle-track` | The pill background of the toggle |
| **Toggle Thumb** | `.toggle-thumb` | The white circular knob that slides inside the toggle track |
| **Uploaded Briefs Section** | `.sidebar-section-title` "UPLOADED BRIEFS" | Section listing all uploaded brief files |
| **Brief List** | `.brief-list` | Scrollable list of uploaded brief items |
| **Brief Item** | `.brief-item` | A single uploaded brief row — icon, name/meta, and remove button |
| **Brief Item Icon** | `.brief-item-icon` | File type emoji icon on the left of a Brief Item |
| **Brief Item Name** | `.brief-item-name` | Filename of the uploaded brief |
| **Brief Item Meta** | `.brief-item-meta` | Muted file size and upload time below the filename |
| **Brief Item Remove** | `.brief-item-remove` | "✕" button on the right of a Brief Item — turns red on hover |
| **Run Design Button** | `.btn.btn-primary` at bottom of `.design-sidebar` | Green "▶ RUN DESIGN" button pinned to the bottom of the sidebar |
| **Design Pane** | `.design-pane` | Either of the two right content columns — scrollable |
| **Decision Card** | `.decision-card` | Dark card holding an architecture decision — amber title + muted body text |
| **Decision Title** | `.decision-title` | Amber all-caps heading inside a Decision Card |
| **Decision Body** | `.decision-body` | Description text inside a Decision Card |
| **Architecture Diagram** | `.arch-diagram` | Dark box with a scan-line animation showing the proposed system topology |
| **Scan Line** | `.scan-line` | Animated green horizontal line that sweeps the diagram |
| **Architecture Node** | `.arch-node` | A colored box representing a system component in the diagram |
| — Frontend node | `.arch-node.frontend` | Green node |
| — Backend node | `.arch-node.backend` | Amber node |
| — Database node | `.arch-node.db` | Cyan node |
| **Architecture Arrow** | `.arch-arrow` | The `↕` glyph connecting nodes in the diagram |

---

## PHASE 3 — PLANNING

| Element | Class(es) | Description |
|---|---|---|
| **Planning Layout** | `.planning-layout` | Two-column grid: Planning Sidebar (280px left) + Planning Content (right) |
| **Planning Sidebar** | `.planning-sidebar` | Left panel — contains Manual Plan textarea, Upload Plan zone, Uploaded Plans list, and Approve button |
| **Manual Plan Input** | `textarea.mono-input` at top of `.planning-sidebar` | Multi-line text area for typing or pasting planning notes directly |
| **Upload Plan Zone** | `.upload-zone` inside `.planning-sidebar` | Dashed drag-and-drop area for .pdf, .md, or .txt plan files |
| **Uploaded Plans Section** | `.sidebar-section-title` "UPLOADED PLANS" | Section listing all uploaded plan files |
| **Uploaded Plan Items** | `.brief-item` inside `.planning-sidebar` | Reuses the Brief Item component — icon, filename, meta, remove button |
| **Approve Plan Button** | `.btn.btn-primary` at bottom of `.planning-sidebar` | Green "▶ APPROVE PLAN" button pinned to the bottom of the sidebar |
| **Planning Content** | `.planning-content` | Scrollable right column showing the milestone roadmap |
| **Milestone Card** | `.milestone` | Expandable card representing a named work milestone |
| **Milestone Header** | `.milestone-header` | Top bar of a Milestone Card — number badge, title, and time estimate |
| **Milestone Number** | `.milestone-num` | Green numbered square in the milestone header |
| **Milestone Title** | `.milestone-title` | Bold title of the milestone |
| **Milestone Meta** | `.milestone-meta` | Muted time estimate text (e.g. "Est. 2 weeks") |
| **Milestone Tasks** | `.milestone-tasks` | List of task rows inside a Milestone Card |
| **Task Item** | `.task-item` | A single task row with a checkbox placeholder + description |
| **Task Checkbox** | `.task-check` | Small empty square representing an unchecked task |

---

## PHASE 4 — BREAKDOWN

| Element | Class(es) | Description |
|---|---|---|
| **Breakdown Layout** | `.breakdown-layout` | Two-column grid: Breakdown Sidebar (280px left) + Breakdown Content (right) — mirrors Planning phase |
| **Breakdown Sidebar** | `.breakdown-sidebar` | Left panel — Manual Breakdown textarea, Upload Breakdown zone, Uploaded Breakdowns list, Approve button |
| **Manual Breakdown Input** | `textarea.mono-input` at top of `.breakdown-sidebar` | Multi-line text area for typing or pasting breakdown notes |
| **Upload Breakdown Zone** | `.upload-zone` inside `.breakdown-sidebar` | Dashed drag-and-drop area for .pdf, .md, or .txt files |
| **Uploaded Breakdowns Section** | `.sidebar-section-title` "UPLOADED BREAKDOWNS" | Section listing uploaded breakdown files — reuses Brief Item component |
| **Approve Breakdown Button** | `.btn.btn-primary` at bottom of `.breakdown-sidebar` | Green "▶ APPROVE BREAKDOWN" button pinned to the bottom |
| **Breakdown Content** | `.breakdown-content` | Scrollable right column showing the Roadmap Break Down |
| **Roadmap Break Down** | Artifact title in `.breakdown-content` | The artifact canvas title — replaces the old "Sprint Breakdown" label |
| **Breakdown Milestones** | `.milestone` inside `.breakdown-content` | Six engineering-domain milestone cards: Security, Data, Backend, Frontend, Infrastructure, Testing — each uses the same Milestone Card component as Planning |

---

## PHASE 5 — EXECUTION

| Element | Class(es) | Description |
|---|---|---|
| **Execution Layout** | `.execution-layout` | Two-column grid: Ticket Sidebar (left, 260px) + Execution Main (right) |
| **Execution Sidebar** | `.exec-sidebar` | Narrow left panel listing all tickets in the current sprint |
| **Execution Ticket Row** | `.exec-ticket` | A clickable ticket row in the sidebar |
| **Active Ticket Row** | `.exec-ticket.active-ticket` | The currently selected ticket — green border + dark green background |
| **Execution Ticket ID** | `.exec-ticket-id` | Muted ticket ID inside a sidebar ticket row |
| **Execution Ticket Title** | `.exec-ticket-title` | Ticket description inside a sidebar ticket row (green when active) |
| **Execution Main** | `.exec-main` | Scrollable right column showing the generated artifact for the active ticket |
| **Code Block** | `.code-block` | A syntax-highlighted code artifact card |
| **Code Block Header** | `.code-block-header` | Top strip of a Code Block — file path (amber) + language label (muted) |
| **Code File Label** | `.code-file` | Amber filename in the Code Block Header |
| **Code Language Label** | `.code-lang` | Muted all-caps language/type label (e.g. "JAVASCRIPT · GENERATED") |
| **Code Body** | `.code-body` | The syntax-highlighted code content area |
| **Code Syntax — Keyword** | `.code-kw` | Purple — language keywords (`const`, `async`, etc.) |
| **Code Syntax — Function** | `.code-fn` | Green — function names and calls |
| **Code Syntax — String** | `.code-str` | Amber — string literals |
| **Code Syntax — Comment** | `.code-comment` | Muted grey — inline comments |
| **Code Syntax — Type/Constant** | `.code-type` | Cyan — types, env vars, constants |
| **Mark Done Button** | `.btn.btn-secondary` inside `.exec-main` | "Mark Done ✓" button in the artifact header for the active ticket |

---

## DESIGN TOKENS (color reference)

| Token | Value | Usage |
|---|---|---|
| `--green` | `#00ff88` | Active states, AI role label, primary buttons, completed indicators |
| `--amber` | `#ffb830` | Approve/advance buttons, decision titles, sprint titles, "Shift" in logo |
| `--red` | `#ff4466` | Critical severity badges |
| `--cyan` | `#00ddcc` | DB nodes, infra tags, type syntax highlighting |
| `--text` | `#e2e8f0` | Primary body text |
| `--text-dim` | `#8899aa` | Secondary / descriptive text |
| `--text-muted` | `#4a5568` | Tertiary text, labels, locked state text |
| `--bg` | `#0a0c0e` | Deepest background (code blocks, inputs) |
| `--bg2` | `#0f1215` | Default panel/card background |
| `--bg3` | `#141820` | Slightly elevated surface (ingest options, ticket cards) |
| `--border` | `#1f2937` | Subtle border between panels |
| `--border2` | `#2d3748` | Slightly more visible borders (card edges, inputs) |
