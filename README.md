# TECHY — Local AI Assistant

A **local-first, offline-first AI assistant** built on Next.js. TECHY runs entirely on your machine — your files, tasks, calendar, system, memory and documents stay local and work with or without the internet.

> Runs locally. Cloud optional. Your data never leaves the box.

---

## Key Features

### Offline-First by Design
Every core capability — chat, files, system monitoring, applications, tasks, automations, calendar, knowledge and local memory — works with no internet. A live status page (`/offline`) shows the state of every local and cloud service, and the top bar carries a permanent **RUNNING LOCALLY · OFFLINE-FIRST** badge.

### Specialist AI Agents
Conversations are routed to specialist agents based on intent:

| Agent | Focus |
|---|---|
| Orchestrator | Route queries to specialists |
| Coding | Developer diagnostics, git, logs, ports, scripts |
| Creative | Artwork inspection, print readiness |
| Research | Knowledge search, documents, local intelligence |
| File | Find, open and prepare files |
| Productivity | Briefing, agenda, meetings, tasks, reminders |
| System | CPU/RAM/GPU/processes/startup/network |

When a local model (Ollama) is unavailable, offline **skills** answer common requests so the assistant never stops working.

### Universal Command Palette (`Ctrl+Space`)
TECHY's signature interaction. Tap `Ctrl+Space` anywhere and the palette appears — over the app *and* over any other application via the native desktop launcher. Type what you want outside the chat — "Find the latest proposal and summarize it" — and TECHY routes it to the right surface, or answers it in chat. Filter with **All / Files / Apps / System / Web / AI** chips, or `Ctrl+K` as a shortcut fallback.

### Clipboard Intelligence (`/clipboard`)
TECHY watches the clipboard and classifies what lands in it — URLs, code, tables, emails, phone numbers, addresses, images or plain text — then offers context actions: **summarize, explain, rewrite, translate, improve, format code, to markdown, analyze, draft reply** and **Save to memory**. Detection and deterministic transforms (summary, normalize, table→markdown, format) run fully offline; deeper transformations use the local model when connected. The desktop launcher brings these actions to any app via `desktop/techy-launcher.bat`.

### Drag-and-Drop AI
Drop almost anything onto TECHY — PDF, image, audio, video, spreadsheet, code, archive — and a HUD appears ("DROP ANYTHING") while TECHY decides what it can do. Files drop straight into the chat as attachments; plain text you drag in is auto-analyzed on the Clipboard page.

### Personalization
Fully adjustable identity and appearance, persisted to `data/branding.json`:

- AI name, avatar (4 presets), accent color (6 themes), interface density
- Theme, motion intensity, default workspace, wake word, voice, preferred model
- Privacy mode (strictly offline / anonymous help / local only)

### Local Productivity Suite
- **Chat** — streaming NDJSON responses, attachments (docx / pdf / xlsx / images), markdown rendering, conversation history, export to Markdown/JSON
- **Clipboard** — clipboard intelligence + action transforms (see above)
- **Tasks & Reminders** — priorities, repeats, snooze, reminder log
- **Calendar** — events, meeting-prep assistant
- **Projects** — workspace project tracking (design + document files)
- **Automations** — WHEN/THEN workflows (manual, file-watch, schedule) with 7 actions
- **Plugins** — catalog, install/run/disable
- **Knowledge base** — full-text index over your workspace documents
- **Files** — browse/search/preview/rename/open across system and device scopes
- **Apps** — launch installed Windows apps, quick-launch panel
- **System** — live CPU/RAM/GPU/temps/storage/battery, processes, startup apps
- **Developer** — git status, logs, open ports, package scripts
- **Security Center** — per-category permission policy + strict local-only mode
- **Activity** — full audit trail of everything TECHY has done

---

## Tech Stack

- **Next.js 16.3.5** (App Router, Turbopack)
- **React 19** + **TypeScript 5**
- **Tailwind CSS v4** (CSS-first config, `@theme` tokens)
- **lucide-react** icons, **framer-motion** animation, **class-variance-authority** style variants
- **mammoth / pdf-parse / xlsx** for document parsing (lazy-loaded)
- Local AI via **Ollama** (`http://localhost:11434`) — optional, not required

---

## Getting Started

### Requirements
- Node.js 20+ (tested with Node 24)
- Windows 10/11 (system, process and app features use PowerShell/CIM)
- Optional: [Ollama](https://ollama.com) with a model pulled (e.g. `llama3`, `qwen2.5`)

### Install & run

```bash
npm install
npm run dev          # development server
```

Open [http://localhost:3000](http://localhost:3000).

### Production

```bash
npm run build
npm run start        # serves the optimized build on :3000
```

### Desktop Launcher (global overlay)

```bash
desktop\techy-launcher.bat          # Ctrl+Space above any app + clipboard watch
desktop\techy-launcher.bat --smoke  # connectivity smoke test
```

The launcher is a native Windows form (no dependencies) that registers a **global Ctrl+Space hotkey**, watches the clipboard, and talks to the local TECHY server over `/api/clipboard/*`, `/api/chat` and `/api/memory`.

### Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Optimized production build |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint across the project |
| `npm run clean` | Remove `.next` build output |

---

## Project Structure

```
techy/
├─ src/
│  ├─ app/
│  │  ├─ api/            # 53 route handlers (see docs/SYSTEM.md)
│  │  ├─ (pages)         # chat, voice, clipboard, files, system, tasks, calendar,
│  │  │                  # automations, projects, designer, apps, agents, plugins,
│  │  │                  # developer, security, activity, offline, settings, home
│  │  ├─ layout.tsx      # Root layout: Fonts → AppProvider → BrandProvider
│  │  └─ globals.css     # Design system (navy/cyan/violet tokens, HUD utilities)
│  ├─ components/
│  │  ├─ ui/             # GlassPanel, HUDButton, StatusIndicator, DataGraph, ...
│  │  ├─ layout/         # AppShell, Sidebar, TopBar
│  │  ├─ chat/           # ChatInterface, MessageBubble, ToolExecutionCard, Markdown
│  │  ├─ dashboard/      # AICore, BriefingPanel, SystemMonitorPanel, TaskPanel, ...
│  │  ├─ panels/ish      # Feature components grouped by area
│  │  ├─ command/        # CommandMode (Ctrl+Space palette)
│  │  ├─ clipboard/      # ClipboardIntel (detect + act + save)
│  │  ├─ dnd/            # DropZone (global Drag-and-Drop AI overlay)
│  │  ├─ offline/        # OfflineStatusPanel
│  │  ├─ personalize/    # PersonalizationPanel
│  │  └─ settings/       # MemoryPanel, SecurityPanel
│  ├─ context/           # AppContext, BrandContext
│  ├─ hooks/             # useSystemMetrics, useMediaQuery, useDateTime, ...
│  ├─ lib/
│  │  ├─ ai/             # tools.ts, skills.ts, agents.ts, provider.ts, ollama.ts
│  │  ├─ system/         # hardware, files, apps, documents, search, recents, favorites
│  │  └─ ...             # 15 data-layer modules (calendar, tasks, memory, security, ...)
│  ├─ types/             # Shared TypeScript types
│  └─ lib/http/response.ts  # jsonResponse helper (brotli→gzip, Vary)
├─ data/                 # Local state (gitignored, see below)
├─ desktop/              # TechyLauncher.ps1 + techy-launcher.bat (global overlay)
└─ docs/SYSTEM.md        # Deep-dive system documentation
```

---

## Data & Persistence

All state is stored as JSON files under `data/` (gitignored) using a serialized `queueWrite` pattern:

| File | Purpose |
|---|---|
| `activity.json` | Audit trail (last 500 entries) |
| `automations.json` | Automation workflows + run history |
| `branding.json` | Personalization settings |
| `briefing.json` | Morning briefing section prefs |
| `calendar.json` | Calendar events |
| `conversations.json` | Chat conversations & messages |
| `favorites.json` | Favorited files |
| `memory.json` | Facts + preferences (knowledge) |
| `notifications.json` | Notification history |
| `plugins.json` | Plugin registry |
| `recents.json` | Recently opened files |
| `reminder-log.json` | Fired + dismissed reminders |
| `security-policy.json` | Permission policy |
| `tasks.json` | Tasks |
| `watch/· processed/· summaries/` | Automation watch folders & outputs |

---

## Security Model

The Security Center (`/security`) exposes a per-category policy:

| Category | Default |
|---|---|
| File access | allowed |
| App launch | allowed |
| Terminal / delete files / system settings | confirm |
| Network | restricted |
| **Local-only mode** | off (enabled → blocks all internet probes) |
| **Log activity** | on |

File operations are scoped to the workspace root (`OutsideWorkspaceError`) and media endpoints enforce extension/content-type allowlists.

---

## Personalization & Accents

Accent colors: **Cyan Cloud, Emerald Grid, Violet Vector, Amber Relay, Rose Node, Sky Uplink**.
Avatars: **Core Circuit, Network Node, Orbital Eye, Hex Matrix**.
Density: comfortable / compact · Theme: dark / auto · Motion: full / reduced · Privacy: strictly offline / anonymous help / local only.

---

## Documentation

- [**System Documentation**](docs/SYSTEM.md) — architecture, AI subsystem, API catalog, data layer, security, offline-first behavior, automation & plugins.

---

## License

Private project. Distributed under the terms of the repository's upstream project (see GitHub).
