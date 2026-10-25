# Why-Code frontend

The **Next.js evidence explorer** (project plan, Component 6). It makes the
GraphRAG answer service understandable in under 90 seconds: ask a "why"
question, read the answer, open every citation, and trace the graph path that
supports it.

Built with **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS v4**,
**shadcn/ui** (Base UI primitives), and **React Flow** for graph paths.

## Quick start

```bash
cd frontend
npm install
cp .env.example .env.local   # optional; defaults are fine
npm run dev                  # http://localhost:3000
```

The app runs **without a backend**. By default it uses the bundled fixtures in
`src/lib/mock/` (`NEXT_PUBLIC_API_MODE=mock`), which is how the UI is developed
while the retrieval service (Component 5) is still being built.

### Pointing at the live backend

```bash
# .env.local
NEXT_PUBLIC_API_MODE=http
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

No component changes are needed: the UI depends on the `WhyCodeClient`
interface, and the transport is chosen once in `src/lib/api/index.ts`.

| Environment variable | Default | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_API_MODE` | `mock` | `mock` fixtures or `http` live service |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Answer-service base URL |
| `NEXT_PUBLIC_REPO` | `encode/httpx` | Repository selected on first load (changeable in the app) |

## Scripts

```bash
npm run dev        # dev server (Turbopack)
npm run build      # production build
npm run start      # serve the production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit
```

## Screens

The app is chat-shaped: a question is the primary interaction, and the
explorer views are reached from inside an answer rather than from a menu.

| Route | Screen | Notes |
| --- | --- | --- |
| `/` | **Ask (chat)** | Centred entrance with a **required repository selector** and example questions. Asking docks the composer to the bottom, shows a thinking state, then streams the answer into the conversation. Answers carry Evidence / Changes / Graph path / Decisions tabs, plus the refusal state. |
| `/dashboard` | **Dashboard** | Overview of the repository in context: active decisions, code changes, contributors and pull requests, with recent decisions/changes and one-click example questions. Reached by clicking the Why-Code logo or name in the sidebar. |
| `/profile` | **Profile** | Your local display name, active repository, appearance (Light/System/Dark), activity stats and chat-history controls. |
| `/settings` | **Settings** | Appearance with Light / Dark / System (default) theme options, the answer-service configuration in use, and local-data controls. |
| `/changes` | **Code changes** | What changed, the reasoning behind it, and the pull request that carried it (author, reviewers, participants). |
| `/people` | **People** | Contributors with their roles and contribution counts. |
| `/people/[login]` | **Person profile** | One person's code changes (with reasoning), authored PRs, reviews and participation. |
| `/decisions` | **Decision timeline** | Origin → revision/reversal, with the current status. |
| `/graph` | **Graph path** | React Flow diagram of a decision's path, plus a list alternative. |

The **left sidebar** is chat history (`New chat` plus every conversation,
stored in `localStorage`) with the local profile menu pinned to the bottom; on
mobile it lives behind the menu button in the top bar. It is **resizable**: drag
the 1px rule on its right edge, or focus the separator and use the arrow keys
(`Shift` for larger steps, `Home`/`End` for the limits). Double-click resets it.
The width persists per browser. It also **collapses** to a 72px icon rail from
the button in its header or the top bar; the collapsed state persists too.

The top bar holds the **repository selector**. Changing it updates every view —
the entrance examples, the composer, answers, the explorer pages and the
dashboard — and is remembered across reloads. The selector is a themed menu
(not a native `<select>`), so it follows the dark/light theme like the rest of
the app. It also offers **Add repository** for a manual `owner/name` slug. Added
repositories are stored in the browser and marked *not indexed* until the
ingestion service knows about them; the app shows that state instead of asking
the mock adapter for evidence it does not have.

The Ask entrance and the thinking state use the installed
[`aurora-hero`](https://www.vengenceui.com/components/aurora-hero) registry
component as the background (the component file is kept as published). When an
answer lands, its opening paragraph is revealed with the installed
[`stagger-text`](https://www.vengenceui.com/components/stagger-text) word
animation, and the conversation scrolls to the start of that answer so the
reveal is visible.

Two sheets are mounted app-wide and open from anywhere:

- **Evidence panel** — source type, author, date, excerpt/body, raw payload, GitHub link.
- **Pull-request panel** — state, body, author, reviewers, participants as a
  tooltip avatar stack (`shared-tooltip-avatars`) with roles and contribution
  counts, commits and changed files.

Every view is **deep-linkable**: `/?q=…`, `/?chat=<id>`, `/graph?decision=…`,
`/people/<login>`. An answer is never a dead end — a refusal always shows the
nearest candidates and suggests next questions.

### Attributing a change

A `CodeChange` is the unit that answers *"what changed, and why?"*. It carries the
before/after excerpt, the extracted decision (claim, status, confidence,
evidence), and the `PullRequestRef` it came from. That reference carries the PR
author, its reviewers, and every participant with their role — so the same card
can show authorship and review without a second request.

## Layout

```
src/
  app/                 routes: /, /dashboard, /profile, /changes, /people, /people/[login], /decisions, /graph
  components/
    answer/            answer panel, markdown, citation card, decision card, refusal
    ask/               ask workspace (chat session), composer, repo selector, examples
    chat/              sidebar (history + profile), user menu, thinking indicator
    changes/           code change card (change + reasoning + people)
    decisions/         decision timeline
    evidence/          app-wide evidence sheet + provider
    graph/             React Flow graph path view + explorer
    people/            avatars, chips, cards, profile view
    profile/           local profile & settings view
    pull-request/      app-wide pull-request sheet + provider
    ui/                shadcn/ui components (generated — edit sparingly)
    app-shell.tsx      resizable sidebar rail, mobile sheet, repo menu in the top bar
    providers.tsx      theme, tooltip, evidence/PR panels and toast providers
  hooks/
    use-mounted.ts     client-only flag, without a state-setting effect
  lib/
    active-repo.ts     server-side read of the selected repository (cookie)
    api/               typed contract, transports, graph-path normaliser
    chat/store.ts      conversation history (localStorage, useSyncExternalStore)
    local/profile.ts   local user profile (name, active repository)
    local/sidebar.ts   persisted sidebar width
    mock/              illustrative fixtures (used when API_MODE=mock)
      repos/           one complete bundle per repository
    labels.ts          label + colour vocabulary for statuses, change kinds, node types
    format.ts          date / latency / relative-time formatting
design-system/why-code/MASTER.md   persisted design system (see below)
```

### Avatars

Avatars are deterministic **initials**, not images. Sample fixtures have no
avatar URLs, and initials keep the UI readable offline without shipping other
people's photos into a demo. The pull-request participant stack renders the
same initials through the `shared-tooltip-avatars` component as inline SVG data
URLs (`initialsAvatarDataUrl`), so it stays offline-safe. To use real images,
add `avatar_url` to `PersonRef` and render it in
`components/people/person-avatar.tsx` (with `images.remotePatterns` configured
for `avatars.githubusercontent.com`).

### API contract

`src/lib/api/types.ts` mirrors the plan's `/api/v1/ask` schemas
(`AnswerResponse`, `Citation`, `GraphPath`, `Decision`, `RefusalInfo`) and adds
the UI-driven types (`CodeChange`, `PullRequestRef`, `PullRequestDetail`,
`PersonSummary`, `PersonProfile`). `coerceGraphPath` accepts both a bare label
list and a structured `{ nodes, edges }` object, so the UI tolerates either
backend shape.

Four methods are **provisional** — the plan does not document them yet, so they
target the paths below. If the backend differs, only
`src/lib/api/http-transport.ts` changes:

| Method | Provisional endpoint |
| --- | --- |
| `listDecisions` | `GET /api/v1/decisions?repo=` |
| `listPeople` | `GET /api/v1/people?repo=` |
| `getPerson` | `GET /api/v1/people/{login}?repo=` |
| `listChanges` | `GET /api/v1/changes?repo=[&limit=]` |
| `getPullRequest` | `GET /api/v1/pull-requests/{number}?repo=` |

## Design system

The visual direction was generated with the `ui-ux-pro-max` skill and persisted
at `design-system/why-code/MASTER.md`:

- **Dark-first** Cursor-style palette — `#181818` chrome, `#1f1f1f` content
  surface, `#cccccc` text and VS Code's `#0078d4` action blue (the exact
  "Dark Modern" token set); light theme is one click away in the sidebar
  profile menu or on the profile page.
- **JetBrains Mono** headings, **IBM Plex Sans** body.
- Subtle motion (fade/rise) that respects `prefers-reduced-motion`.
- Colour is never the only signal — every badge carries a text label, and the
  graph has an equivalent ordered list for keyboard/screen-reader users.

## Mock data disclaimer

`src/lib/mock/` is hand-written sample data that demonstrates the *shape* of an
answer. It is illustrative only and is **not** a source of truth about any of
the upstream projects. When `NEXT_PUBLIC_API_MODE=http`, it is not used.

Each repository offered by the selector has a complete bundle under
`src/lib/mock/repos/`:

| Repository | Bundle | Topics |
| --- | --- | --- |
| `encode/httpx` | `httpx.ts` | retries, `trust_env`, timeout sentinel |
| `encode/starlette` | `starlette.ts` | middleware order, `Mount` routing, lifespan |
| `tiangolo/fastapi` | `fastapi.ts` | dependency caching, `response_model`, lifespan |

A bundle holds its example questions, keyword-matched answers (plus a refusal),
evidence, decisions, threads, graph paths, pull requests and code changes.
People and contribution counts are **derived** from the pull requests and
changes at module load, so they stay consistent when you edit the fixtures.
