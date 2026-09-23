# TECHY — System Documentation

Deep-dive technical reference for **TECHY — Local AI Assistant**, a Next.js 16 / React 19 local-first application.

**App root**: project root (`D:\GARY 2026\FRONT END\techy`)
**Entry docs**: [README.md](../README.md)

---

## 1. Architecture

- **App Router** convention throughout (`src/app/**/{page,layout,route}.tsx`).
- **Root layout** (`src/app/layout.tsx`): `html lang="en" class="h-full antialiased dark"`, fonts Inter + Space Grotesk (via `next/font`), metadata `"TECHY — Local AI Assistant"`.
  - Provider chain: `AppProvider` → `BrandProvider` → `AppShell`.
- **AppShell**: `bg-navy-950 bg-circuit` background. Composes:
  - `Sidebar` — fixed rail (expanded `ml-64`, collapsed `ml-[60px]`), avatar/name from branding, live system status dot.
  - `TopBar` — sticky `h-16` blur bar: local/online state, **RUNNING LOCALLY · OFFLINE-FIRST** badge, command-mode trigger (`Ctrl Space`), global mic, `NotificationBell`, HUD clock/date.
  - `CommandMode` — global overlay (Ctrl+Space / Ctrl+K).
  - Scrollable `<main>` area.
- **Dashboard** (`src/app/page.tsx`): left `AICore` (particle canvas) + greeting + input; right stack of `BriefingPanel`, `SystemMonitorPanel`, `WeatherPanel`, `TaskPanel`, `QuickAppsPanel`, `AIModelPanel`, `RecentActivityPanel`.

19 application pages + 53 API route handlers.

---

## 2. Data Layer

`DATA_DIR = path.join(process.cwd(), "data")` — gitignored. Every store uses a serialized **`queueWrite`** chain:

```ts
let writeQueue: Promise<unknown> = Promise.resolve();
function queueWrite(updater) {
  const run = writeQueue.then(async () => {
    const next = updater(await read());
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(next, null, 2), "utf8");
    return next;
  });
  writeQueue = run.catch(() => {});
  return run;
}
```

| Module (`src/lib/`) | File | Notes |
|---|---|---|
| `activity.ts` | `activity.json` | FIFO, `MAX_ENTRIES 500`, respects `logActivity` policy |
| `automation.ts` | `automations.json` | uses `watch/`, `summaries/`, `processed/` dirs |
| `branding.ts` | `branding.json` | `ALLOWED_FIELDS` list, ≤24-char AI name |
| `briefing.ts` | `briefing.json` | section toggles, `"GOOD MORNING."` greeting |
| `calendar.ts` | `calendar.json` | `CalendarPatch`, `markPrepared` |
| `conversations.ts` | `conversations.json` | messages + attachments/tool executions |
| `memory.ts` | `memory.json` | `MAX_FACTS 50`, `MAX_PREFERENCES 30` |
| `notifications.ts` | `notifications.json` | generated from tasks/events/storage thresholds |
| `offline.ts` | — (probes) | `OfflineService` model, 15 s / 60 s probe caches |
| `plugins.ts` | `plugins.json` | plugin registry + built-in permissions |
| `projects.ts` | scans `data/projects` | `DOCUMENT_EXTS`/`DESIGN_EXTS`, depth ≤ 3 |
| `reminders.ts` | `reminder-log.json` | `fire-due` + `advanceRepeat` |
| `security.ts` | `security-policy.json` | per-category permission policy |
| `tasks.ts` | `tasks.json` | TaskStatus/priority/repeat enums |
| `system/recents.ts` | `recents.json` | CAP 20 |
| `system/favorites.ts` | `favorites.json` | CAP 20 |
| `schedule.ts` | — | time parsing, `nextWeekdayAt`, cron-adjacent helpers |
| `prep.ts` | — | meeting-prep findings (notes/proposal/folder/images/document) |
| `dev.ts` | — | git/log/ports snapshot (git 5 s timeout, last 80 log lines) |
| `imaging.ts` | — | PNG signature + IHDR parse, dominant colors (top 6) |
| `knowledge.ts` | — | full-text index: TTL 60 s, ≤800 files, ≤8 MB, ≤512 KB/file, ≤140-char snippets, 600 reads cap |

---

## 3. AI Subsystem

Source: `src/lib/ai/` — `agents.ts`, `skills.ts`, `tools.ts`, `provider.ts`, `ollama.ts`.

### Agents & routing (`agents.ts`)

`chooseAgent` scores each specialist with inclusive keyword hits:

| Agent | Color | Direction keywords |
|---|---|---|
| orchestrator | `#22d3ee` | default fallback |
| research | `#8b5cf6` | analysis, research, data… |
| file | `#f59e0b` | file, find, open, proposal, folder… |
| coding | `#34d399` | server, error, log, git, script… |
| design | `#ec4899` | artwork, print, design, image… |
| productivity | `#38bdf8` | task, meeting, schedule, briefing, agenda… |
| system | `#22c55e` | cpu, ram, gpu, temp, process, startup, network… |
| communication | — | notify, notification, message, email, alert |

Tie-break is the first best match; `TOOL_AGENTS` maps individual tools to their owning agent for `meta.agent` labeling.

### Offline skills (`skills.ts`)

When no model is available, the dispatcher matches offline skills by regex so common requests still work:

- **answerDevDiagnose** — "why isn't my application starting?" → git/log/ports snapshot
- **answerPrintArtwork** — print-readiness inspection for workspace artwork
- **answerFindFile** — workspace file search
- **answerAnalyzeData** — analyze spreadsheet/dataset files
- **answerBriefing / answerAgenda / completeTaskSkill** — productivity helpers

### Tools (`tools.ts`)

`ToolSpec`/`ToolResult`; examples: `get_system_metrics`, `read_document`, `list_tasks`, `create_task`, `complete_task`, `search_knowledge`, `get_calendar`, `create_event`, `prepare_meeting`, `run_automation`, `get_briefing`, `get_developer_snapshot`, `inspect_image`, `open_application`, `find_apps_by_category`, `search_installed_apps`, `get_top_processes`. Tool runs emit entries through a shared `ACTIVITY_KIND` map.

### Chat (non-stream) — `api/chat/route.ts`

- Environment: `OLLAMA_TAGS` / `OLLAMA_CHAT`, `SYSTEM_PROMPT`, `MAX_MESSAGES 20`.
- `pickModel` prefers the personalized `branding.model` (case-insensitive, eager `name`/`name:` match) falling back to the first model in tags; `num_ctx 8192`, 60 s timeout.

### Streaming — `api/chat/stream/route.ts`

NDJSON stream with `meta` · `status` · `tool` · `delta` · `done` · `error` events.

- Constants: `OLLAMA_BASE`, `MAX_MESSAGES 24`, `MAX_TOOL_ROUNDS 3`, `MAX_CONTEXT_CHARS 48 000`.
- `pickModel` implements the same `branding.model` preference.
- Gates: when `security.localOnly` is set, the stream reports `meta.localOnly: true` and uses offline skills instead of hitting any network.

---

## 4. System Integration (`src/lib/system/`)

| Module | Capability |
|---|---|
| `files.ts` | `WORKSPACE_ROOT`, scopes `system`/`device`, `MAX_ENTRIES 1500`, `OutsideWorkspaceError`/`NotFoundError`, Windows drive enumeration (CIM, 60 s cache) |
| `hardware.ts` | bounded PowerShell spawns, HARDWARE TTL 5 min, GPU classification (dedicated/integrated/virtual), battery, storage, temps |
| `apps.ts` | installed-app catalog via `HKCU\...\Uninstall` registry + Start-Menu shortcuts, 120 s cache, icon/install-date parsing |
| `documents.ts` | lazy `createRequire` anchor for pdf-parse bundling; mammoth (docx), XLSX (xlsx/xls); 12 `DocumentKind`s; `MAX_DOC_CHARS 200 000` |
| `search.ts` | `MAX_RESULTS 200`, `MAX_VISITED 25 k`, `MAX_DEPTH 9`, ≤1 MB content reads, SKIP_DIRS for node_modules/.git/.next/Windows |
| `appCategories.ts` | category classification (design/development/browser/communication/office/media/games/utilities) |
| `recents.ts` / `favorites.ts` | JSON-backed CAP-20 lists |
| `documents.ts` helpers | `extractText` — strips `-- N of M --` pagination markers |

---

## 5. API Catalog

Helper: `src/lib/http/response.ts` → `jsonResponse` (brotli → gzip for ≥512-byte payloads, `Vary: Accept-Encoding`). API routes are `runtime = "nodejs"`, `dynamic = "force-dynamic"` unless noted.

### Core
| Route | Methods |
|---|---|
| `/api/chat` · `/api/chat/stream` | POST (non-stream) · POST (NDJSON stream) |
| `/api/conversations` · `/api/conversations/[id]` · `/api/conversations/[id]/messages` | GET/POST · GET/PATCH/DELETE · GET/POST |
| `/api/memory` · `/api/memory/[id]` · `/api/memory/preferences[/[key]]` | GET/POST · DELETE · POST/DELETE |
| `/api/branding` | GET/POST (personalization) |
| `/api/agents` | GET |

### Productivity
| Route | Methods |
|---|---|
| `/api/calendar` · `/api/calendar/[id]` · `/api/calendar/prepare` | GET/POST · GET/PATCH/DELETE · POST |
| `/api/tasks` · `/api/tasks/[id]` · `/api/tasks/reminders[/dismiss]` | GET/POST · PATCH/DELETE · GET · POST |
| `/api/automations` · `/api/automations/[id]` · `/api/automations/[id]/run` · `/api/automations/sweep` | GET/POST · PATCH/DELETE · POST · GET |
| `/api/briefing` | GET/POST |
| `/api/projects` | GET |
| `/api/recents` · `/api/favorites` | GET/POST · GET/POST/DELETE |

### Files & knowledge
| Route | Methods |
|---|---|
| `/api/files` · `/api/files/search` · `/api/files/rename` · `/api/files/preview` · `/api/files/media` · `/api/files/open` | GET · POST · POST · GET · GET · POST |
| `/api/knowledge` · `/api/knowledge/stats` | GET (`?q=`) · GET (`?refresh=1`) |
| `/api/imaging` | GET (`?path=`) |

### System
| Route | Methods |
|---|---|
| `/api/system/metrics` · `/api/system/processes` · `/api/system/startup` | GET |
| `/api/apps/launch` · `/api/apps/installed` · `/api/apps/installed/launch` | POST · GET · POST |
| `/api/developer` | GET |
| `/api/offline/status` | GET |

### Governance & observability
| Route | Methods |
|---|---|
| `/api/security` | GET/POST |
| `/api/plugins` · `/api/plugins/[id]` · `/api/plugins/[id]/run` | GET/POST · PATCH/DELETE · POST |
| `/api/activity` | GET/POST/DELETE |
| `/api/notifications` · `/api/notifications/unread` | GET/POST/DELETE · GET |

---

## 6. Security Model

- `security.ts` `DEFAULT_POLICY`:
  `fileAccess: allowed`, `appLaunch: allowed`, `terminal: confirm`, `deleteFiles: confirm`, `systemSettings: confirm`, `network: restricted`, `localOnly: false`, `logActivity: true`.
- `src/lib/security/permissions.ts` — `SecurityManager.requestPermission` (Phase 4 stub; currently auto-approves after ~1 s mock).
- Enforced end-to-end in `/api/security` POST; used by the stream router (`localOnly` → offline skills only) and activity logging (`logActivity`).
- Path traversal guard: `OutsideWorkspaceError` from `resolveSystemTarget`; media route enforces extension + content-type allowlists.

---

## 7. Offline-First Behavior

`/api/offline/status` → `getOfflineStatus()`:

- `runningLocally: true`, `offlineFirst: true`
- `model: { available, name }` via `/api/tags` (2.5 s probe, 15 s cache)
- `internet` via HEAD `https://www.google.com/generate_204` (4 s probe, 60 s cache) — disabled when `localOnly`
- `localOnly = policy.localOnly || !internet`
- `services[]`: AI, Files & Documents, System Monitoring, Applications, Tasks & Reminders, Memory & Knowledge, Voice, Cloud Models (all local services `optional:false`; cloud `optional:true`)

`OfflineStatusPanel` polls every 30 s. Dashboards use graceful `FALLBACK` values (weather/metrics) so nothing crashes when a probe fails.

---

## 8. Automation & Plugins

**Automations** (`automation.ts` + `/api/automations`) — triggers `manual | file_watch (folder + extensions) | schedule (cron + "At HH:MM")`. Actions: `read_text`, `summarize`, `rename` (`{name}-{date}{ext}`), `move` (→ `processed/`), `notify`, `create_task`, `briefing`. `sweep` fires due items; runs log activity + notifications.

**Plugins** (`plugins.ts` + `/api/plugins`) — groups Core/File/System/Browser/Developer/Creative/Custom; permission model `read/write/launch/execute/configure/network`; install form → `runPlugin` → activity log. Built-in catalog is overridden by user plugins of the same id.

---

## 9. Personalization & Branding

`BrandContext` (client) loads `/api/branding` and exposes:

- `brand` — `BrandingLite` (`aiName, avatar, accent, density, theme, voice, model, wakeWord, animation, defaultWorkspace, privacy`)
- `accent` — resolved `{hex, rgb, label}` token
- `apply(patch)` — optimistic local update + backend persist
- `openCommandMode()` — dispatches `window` `"techy:command"` custom event

Defaults (`src/lib/accents.ts`): aiName `TECHY`, avatar `core`, accent `cyan`, model `auto`, wakeWord `hey techy`, privacy `offline`.

Surfaces wired to branding: Sidebar logo/avatar, AICore idle orb, MessageBubble labels, chat empty state, export filename, command palette identity, TopBar badge, `document.title` + `documentElement.dataset.*`.

**Command Mode** (`src/components/command/CommandMode.tsx`): Ctrl+Space / Ctrl+K toggles; category chips All/Files/Apps/System/Web/AI; navigable suggestion list (arrow keys + Enter); Enter on free text → `router.push("/chat?q=…")` (auto-send prefill).

---

## 10. Design System (`src/app/globals.css`)

- **`@theme inline` tokens**: navy scale `#020817 → #1e3a6e`, cyan scale `#ecfeff → #0891b2`, violet `300–600`, status colors, surface/text/border tokens.
- `.glass-panel` + `.glass-panel-elevated` + `.glass-panel-interactive` — blur/backdrop surfaces.
- HUD utilities: `.hud-corner`, `.text-display`, `.text-hud` (mono, 0.65 rem, 0.1 em tracking, uppercase), `.text-metric` (tabular-nums), `.btn-hud`, `.bg-circuit`, `.bg-gradient-radial`.
- Animations: `pulse-glow`, `rotate-slow`, `scan-line`, `fade-in`, `slide-up/right`, `shimmer`, `orbit`, `data-flow`, command-mode grid/beam.
- UI primitives: `GlassPanel`, `StatusIndicator`, `HUDButton`, `DataGraph` (SVG), `CircularGauge`, `BlockBar`, `AnimatedNumber`.

---

## 11. Chat, Voice & Rendering

- **ChatInterface**: toolbar (Stop / History / export Markdown / export JSON / New Chat); empty state with suggestions; `?q=` URL prefill auto-send; attachments via drag-drop; `Markdown` is a **custom** tokenizer (fences/heading/list/quote/hr/para + copy-code button) with no external MD library.
- **MessageBubble**: system pill + copy (1.5 s feedback). **ToolExecutionCard**: status colors + collapsible output. **FileActionCard**: extracts Windows/POSIX paths (cap 4), kinds summarize|analyze.
- **Voice** (`/voice`): Web Speech API — recognition (`SpeechRecognition`/`webkitSpeechRecognition`) + synthesis (cancel on submit).

---

## 12. Observability

- `activity.ts`: `logActivity({ actor, kind, action, detail })` guards on `logActivity` policy; 12 kinds; drives `RecentActivityPanel` + `NotificationBell`.
- `notification history` — auto-generated from tasks/meetings/storage thresholds.
- Dashboard weather/metrics gracefully degrade with fallbacks when offline.

---

## 13. Known Phase-Gates / TODOs

- `OllamaProvider` is a Phase 3 stub (connection/chat methods compiled but chat wiring is on `api/chat` + stream routes via fetch).
- `SecurityManager.requestPermission` is a Phase 4 mock (auto-approve).
- Local-only mode, personalization and offline-first are fully implemented in the shipped milestone.

---

## 14. Local Development Tips

- Restart the preview: on Windows, kill the process listening on :3000 (`Get-NetTCPConnection -LocalPort 3000 -State Listen` → owning PID → `Stop-Process`) then `npm run start`.
- Verify loop before shipping: `npx tsc --noEmit` → `npm run lint` → `npm run build` → restart → smoke the key pages/APIs.
- `data/**`, `preview*.log` are gitignored — runtime state never pollutes commits.
- `npm run clean` wipes `.next` for a cold rebuild.