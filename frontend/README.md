# Why-Code frontend

The product UI for Why-Code: ask a repository *why* it works the way it does, read the grounded
answer with its evidence, explore the decision graph, browse the decision center, and share
conversations. Built with **Next.js 16 (App Router)**, **React 19**, **TypeScript** and
**Tailwind CSS v4**, with Base UI primitives styled as the site's warm, floating-bubble design
system (dark and light themes).

> This is Next.js 16 — APIs and conventions differ from older versions. Read `AGENTS.md` in this
> directory (and the guides under `node_modules/next/dist/docs/`) before changing app code.

## Quick start

```bash
cd frontend
npm install
cp .env.example .env.local   # defaults are fine
npm run dev                  # http://localhost:3000
```

The app runs **without a backend**: by default it uses the bundled fixtures in `src/lib/mock/`
(`NEXT_PUBLIC_API_MODE=mock`). The mock transport simulates the full product surface offline —
asks, plans, auth (with a demo OTP code shown on screen), share links (stored in `localStorage`),
decision records and refresh.

### Pointing at the live backend

```bash
# .env.local
NEXT_PUBLIC_API_MODE=http
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

No component changes are needed: the UI talks to a typed client interface, and the transport is
chosen once in `src/lib/api/index.ts`. Production builds force `http` mode.

| Environment variable | Default | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_API_MODE` | `mock` | `mock` fixtures or `http` live service |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Backend base URL (`http` mode) |
| `NEXT_PUBLIC_REPO` | — | Repository the UI asks about by default |

## Scripts

```bash
npm run dev        # dev server (Turbopack)
npm run build      # production build
npm run start      # serve the production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

## Screens

| Route | Screen |
| --- | --- |
| `/` | **Chat.** Landing hero (repo selector, example questions, Why?/Plan mode switch, model picker) that turns into a conversation: answers with Evidence / Graph path / Decisions tabs — plus Plan and Connections tabs in Plan mode. The right rail (wide screens) carries rotating "Ask a why" prompts, the active answer's graph bubble and the Repository card with its real GitHub *About* text and a **Refresh data** button. |
| `/decisions` | **Decision center.** Audit summary, live-updates feed, and the decision explorer: search (optionally across all indexed repos), status filters, Records/Supersessions views, evidence drill-down and ADR export. A right rail adds the status breakdown, needs-attention flags and live updates; the repository can be switched on the page. |
| `/graph` | **Graph explorer.** The shared graph canvas over the repository's decisions, with a tracer rail that retells the traced path step by step. |
| `/changes` | **Code changes.** What changed, the reasoning behind it and the PR that carried it — real commit stats, a view-on-GitHub button per commit, and a change-activity rail (volume, contributors, most-touched files). |
| `/people`, `/people/[login]` | **People.** Contributors and their changes, PRs and reviews. |
| `/settings` | **Settings.** Identity (account name/handle when signed in, editable guest profile otherwise), appearance/theme, haptics toggle, default repository, session and data controls. |
| `/login`, `/signup` | **Auth.** Standalone pages (no sidebar) with an animated product showcase; signup verifies the email with a 6-digit OTP step. |
| `/share/[id]` | **Shared chat viewer.** Read-only conversation behind a share link; handles the public, login-required and not-whitelisted states. |

## Product behaviour worth knowing

- **Chat store** (`src/lib/chat/store.ts`) — conversations persist in `localStorage`
  (`whycode.chats.v1`) via `useSyncExternalStore`. **Incognito mode** (state in
  `src/lib/chat/incognito.ts`) hides the saved list and routes sends to an ephemeral in-memory
  chat that is never persisted and is discarded on exit.
- **Identity** (`src/lib/identity.ts`) — one resolver used by the sidebar bubble, Settings and
  message avatars: the signed-in account's name/handle, or the local guest profile (`userNNN`,
  generated on first run in `src/lib/local/profile.ts`).
- **Models** (`src/lib/models/`, composer picker) — the server model plus visitor-added
  OpenAI-compatible models; the picker also hosts the live token-usage meter (provider-reported
  usage vs. the active model's context window).
- **Composer** — attachments (`src/lib/attachments.ts`: text files inlined into the question,
  screenshots via `getDisplayMedia`) and voice dictation (`src/lib/speech.ts`, Web Speech API).
- **Graphs** (`src/components/graph/graph-canvas.tsx`) — one hand-rolled SVG canvas renders plan
  connections, retrieval graph paths, repository structure trees, the rail thumbnail and the
  fullscreen viewer (pan / zoom / drag). There is no graph library.
- **Haptics** (`src/lib/haptics/`) — direct Vibration API patterns on Android, the `web-haptics`
  switch path on iOS, a Settings toggle (default on) and a self-test diagnostic.
- **Themes** — System / Light / Dark from the profile bubble or Settings; the choice persists.

## Layout

```text
src/
├── app/                  routes: /, /decisions, /graph, /changes, /people, /settings,
│                         /login, /signup, /share/[id]
├── components/
│   ├── answer/           answer panel, markdown, evidence + decision cards, refusal state
│   ├── ask/              ask workspace (chat session), hero composer, repo selector
│   ├── auth/             login/signup cards, OTP input, showcase, guest nav bubble
│   ├── chat/             conversations panel, header menus, share dialog, model picker
│   ├── decisions/        decision explorer + audit summary
│   ├── graph/            shared graph canvas + fullscreen viewer
│   ├── share/            read-only shared-chat viewer
│   ├── insights-rail.tsx right rail (Ask a why, graph bubble, Repository card)
│   ├── app-shell.tsx     sidebar + rail layout, mobile top bar and drawer
│   └── ui/               Base UI primitives (edit sparingly)
└── lib/
    ├── api/              typed contract + mock/http transports
    ├── auth/             session store + auth API
    ├── chat/             conversation store + incognito state
    ├── shares/           share-link API (http + mock)
    ├── models/           model catalog + usage
    ├── modes/            Why?/Plan mode store
    ├── mock/             offline fixtures (one bundle per repository)
    └── haptics/ identity.ts attachments.ts speech.ts graph.ts …
```

## Mock data disclaimer

`src/lib/mock/` is hand-written sample data that demonstrates the *shape* of answers, decisions
and people for a few well-known repositories (`encode/httpx`, `encode/starlette`,
`tiangolo/fastapi`). It is illustrative only and is **not** a source of truth about those
projects. When `NEXT_PUBLIC_API_MODE=http`, it is not used.
