# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Privacy-minded people who want to run a large language model on their own
machine and talk to it the way they would talk to a hosted assistant. They are
comfortable installing Docker Desktop but do not want to manage a stack by hand,
and they are choosing local inference specifically so their conversations never
leave the computer. The job is ongoing, multi-turn conversation with a local
model — open the app, get a working assistant.

Single-user artifacts in the current code are prototype scaffolding, not product
truth: the greeting hardcoded to "Ronald" in `src/config.ts` and the browser user
ID generated into local storage are placeholders for real identity, not a
statement that Maia is for one person.

## Product Purpose

Maia is a desktop control surface for a locally hosted LLM stack. It launches the
local services itself, waits until they are healthy, and then presents a
dashboard of the things the owner wants at hand — conversation first among them.
Success is a person opening the app and talking to their own model after a single
startup wait — no account, no API key, no data leaving the machine, and no
terminal.

## Positioning

Maia owns the whole local stack lifecycle, not just the chat window. On launch it
checks for Docker, starts Docker Desktop when the engine is not already running,
auto-detects an NVIDIA GPU and falls back to CPU inference when there is none,
builds and starts the Compose stack, reports Docker → Services → Maia readiness,
and tears the stack back down when the process exits with named volumes intact.
A chat UI that assumes an endpoint is already running cannot make that claim.

## Operating Context

- Ships as a Tauri desktop window (`productName` "Maia", identifier
  `com.tauri.dev`, 800×600 default, resizable) rendering the Vite-built React UI.
  It is a desktop-shaped web interface, not a native-toolkit app.
- The local service stack lives in a sibling checkout at
  `../PERSONAL-harness-deployment`, which owns `docker-compose.yml`, the optional
  `docker-compose.gpu.yml` override, and the `VITE_` env values Vite loads from
  that directory. The backend image is built from `../PERSONAL-harness-backend`
  through `scripts/docker-compose.dev.yml`, so the deployment Compose file stays
  unmodified.
- Startup orchestration runs in `scripts/tauri-dev.mjs`, which serves status on
  `127.0.0.1:1421` at `/orchestrator/status`, `/start`, `/cancel`, and `/retry`.
  Vite proxies `/api` to the backend (default `http://127.0.0.1:8000`) and
  `/orchestrator` to port 1421, keeping browser requests same-origin in
  development.
- Startup steps reported to the UI: `waiting-ui`, `checking-docker`,
  `starting-docker`, `waiting-docker`, `checking-gpu`, `starting-stack`,
  `waiting-backend`. The startup screen collapses these into three visible
  stages: Docker, Services, Maia.
- GPU behavior is controlled by `HARNESS_GPU` (`auto` | `on` | `off`). `auto`
  probes `nvidia-smi`, applies the GPU Compose override when a GPU is present,
  and retries on CPU if GPU containers fail to come up.
- When Docker Desktop is not installed, startup stops before Compose and offers
  only a cancel action — retry is deliberately hidden because retrying cannot
  help.
- Readiness polls every second, shows a delayed-reassurance state after 20s, and
  fails after 15 minutes. A 900ms minimum display keeps the startup screen from
  flashing.
- `npm run stack:up` and `npm run stack:down` exist for manual stack control
  outside the app.

## Capabilities and Constraints

Surface architecture:

- The landing surface is a **dashboard**, not a chat home. It replaces the
  greeting-and-quick-starts screen entirely and is what the user sees once
  startup completes.
- The dashboard is an **extensible panel system**, designed so further panels can
  join later without a rewrite. Its initial panels are pending tasks, today's
  weather, and chat.
- **Only the chat panel is real.** It expands into the full conversation surface,
  and that expansion is a spatial one: the panel grows from its dashboard
  position into the full page so the user keeps their sense of where they came
  from.
- **Tasks and weather are placeholders** with no data source, no backend, and no
  expansion — they do not route anywhere. They must be visibly legible as
  placeholders so no one mistakes them for live data, and no design may imply
  Maia is fetching weather or syncing tasks today.
- Because both placeholder panels stay offline, the local-and-private principle
  is unamended: nothing about the dashboard introduces a network call beyond the
  local stack.

Confirmed and in force:

- Backend contract: `POST /api/chat` with `{message, model, user_id, session_id,
  temperature, max_tokens}` returning `{content, session_id, usage?,
  finish_reason?}`; health is `GET /api/health` returning `{status: "ok"}`. These
  are snake_case on the wire and camelCase in the application layer — the
  translation belongs in the adapter.
- The backend's returned `session_id` is stored on the frontend conversation and
  reused for later turns. Editing an earlier user message clears the session and
  starts a new context, and the user is told so via a toast.
- Architecture boundary to preserve: components → `SendChat` use case →
  `ChatPort` → `HttpChatAdapter`, plus `UserIdentityPort` →
  `LocalStorageUserIdentityAdapter`, composed in `src/main.tsx`. Backend contract
  changes land in `src/infrastructure/`, never in components.
- One model in the roster: id `llama`, "Llama 3.1", captioned "Local model
  through LiteLLM". Local-only inference is the product, not a placeholder for a
  provider picker.
- Message lifecycle statuses: `thinking`, `streaming`, `complete`, `stopped`,
  `error`. Requests are abortable; regenerate and retry re-send the preceding
  user text against the same conversation session.
- Preferences persist to local storage under `harness.preferences`: `theme`
  (dark | light), `reduceMotion`, `showHints`, and `style` (snug | default |
  roomy, migrated from a legacy `textSize` value).
- Keyboard: Cmd/Ctrl+K toggles the search overlay, Cmd/Ctrl+B toggles the
  sidebar.
- Conversations group as today / yesterday / week. Temporary chats are excluded
  from history.

Known gaps that will close — design with room for them, do not harden around
their absence:

- **Streaming.** The backend returns a complete JSON response today, so the UI
  shows a thinking state and then the finished answer. Token streaming is
  planned; the `streaming` status already exists for it.
- **History persistence.** Conversations currently live only in React state and
  are lost on reload. The backend will own conversation history and the frontend
  will load it from there.
- **Attachments.** The `Attachment` type and its kinds exist but the feature is
  disabled until the backend exposes an attachment contract.
- **Identity.** Real user identity replaces the hardcoded greeting name and the
  locally generated browser ID.

Explicitly undecided: the visual direction (see Evidence on Hand), and the data
sources behind the tasks and weather panels. Weather in particular cannot be made
real without a deliberate, disclosed amendment to the local-and-private
principle, since it requires an outside network call; that amendment has not been
made and must not be assumed by later work.

Terminology to preserve exactly:

- **Maia** is the product and assistant name shown to users. "Harness" is the
  repository, backend, and stack name and stays out of the interface.
- **Temporary chat** — a conversation hidden from history.
- **Dashboard** — the landing surface; its tiles are **panels**.
- **Quick starts** — the suggestion prompts. The greeting home that carried them
  is replaced by the dashboard; the prompts themselves may live on in the chat
  surface's empty state.
- **Preferences** — the settings panel title; its rows are Appearance, Style,
  Reduce motion, and Keyboard hints.
- **Snug / Default / Roomy** — the interface style options.
- **Docker / Services / Maia** — the three startup stages.
- **Today / Yesterday / Previous 7 days** — conversation history groups.

## Brand Commitments

- The name "Maia" and the `MaiaMark` identity mark, which doubles as the thinking
  indicator during startup.
- A calm, quiet, unhyped voice. The shipped lines are the reference: "Local
  intelligence, thoughtfully prepared." and "Private by design · Running
  locally". Status copy reassures plainly rather than performing enthusiasm —
  "Local models can take a moment on first launch". No exclamation marks, no
  marketing register.
- No palette, typeface, or visual system is currently binding.

## Evidence on Hand

- The shipped interface is the only running visual system: `src/styles/`
  (`global.css` primitives, `theme-dark.css` and `theme-light.css` semantic
  tokens), a "French Roast" dark palette with a light counterpart, Inter Variable
  and JetBrains Mono Variable.
- `design-system/maia/MASTER.md` (untracked, generated by a different tool)
  specifies a purple/pink palette with Lora and Raleway. It is **not** binding,
  and the shipped CSS is not confirmed as final either. The visual direction is
  an open decision — neither file is design authority until that decision is
  made.
- Application icons in `src-tauri/icons/`, favicon at `public/favicon.svg`.
- There are no testimonials, users, benchmarks, pricing, licensing, or
  deployment claims. None exist to cite and none may be invented.

## Product Principles

1. **Readiness is part of the product.** The app owns the local stack's lifecycle
   and must always tell the truth about where startup is and what failed.
2. **Local and private by default.** No account, no key, nothing leaving the
   machine. Never introduce a surface that implies otherwise.
3. **Calm over eager.** Quiet voice, restrained motion, no hype — in both the
   waiting experience and the conversation.
4. **Build for the closing gaps.** Streaming, persisted history, attachments, and
   real identity are coming. Leave room for them instead of designing around
   their absence.
5. **Keep the port boundary.** Presentation talks to use cases, use cases talk to
   ports. Backend contract changes stay in adapters.

## Accessibility & Inclusion

- Reduce motion is a first-class product preference, not only a system setting.
  It is read from `documentElement.dataset.reduceMotion` before React mounts so
  the startup screen honors it, and combined with the OS preference through
  `MotionConfig` and `useReducedMotion` afterward.
- Keyboard operation matters: global shortcuts, a user-toggleable keyboard hints
  display, a visible focus ring token, `role="radiogroup"` semantics in
  Preferences, and `aria-live` status during startup.
- Dark and light themes are both first-class; the `theme-color` meta tag tracks
  the active theme.
- No specific conformance standard has been established as a requirement.
