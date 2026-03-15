# Forge — AI Development Orchestration Framework

## Architecture Document v1.0

**Status:** Draft
**Date:** March 14, 2026
**Author:** Auto-generated from design session

---

## 1. Overview

Forge is an npm package that transforms AI-assisted development from a flat chat loop into a structured, multi-agent Agile pipeline. It uses the Claude Agent SDK to orchestrate intelligent agents that plan, design, build, and review software — with human oversight at every stage.

### Core Value Proposition

> "See what you're getting before any code is written. Then watch agents build it — on branches, with reviews, one story at a time."

### What Makes Forge Different

| Traditional AI Coding | Forge |
|---|---|
| One agent, one conversation | Orchestrator + Worker (specialized modes) |
| No process | Agile pipeline with stage gates |
| You manage Git manually | Automated branch-per-story strategy |
| Code first, fix later | Design preview before any code |
| Generic AI-looking output | Curated design references, mobile-first |
| You prompt everything | Orchestrator prompts the Worker for you |
| No project tracking | Sprint state tracked in Git |

---

## 2. Architecture

### 2.1 System Diagram

```
CLI (commander + inquirer + ora + chalk)
 │
 ├── Orchestrator Agent (claude-agent-sdk)
 │   └── Plans, routes user requests, reviews output
 │   └── Persistent session with project context
 │   └── Classifies user input and queues changes
 │
 ├── Worker Agent (claude-agent-sdk)
 │   └── Single agent, multiple modes:
 │       ├── design   → Generates Storybook previews
 │       ├── build    → Writes production code
 │       ├── review   → Checks quality, runs tests
 │       └── fix      → Debugs and patches issues
 │
 ├── Git Manager (simple-git)
 │   └── Branch per story (feature/story-id)
 │   └── Tag per milestone (forge/v0.1-plan, forge/v0.2-designs)
 │   └── Snapshot before each agent action
 │
 ├── State Manager
 │   └── .forge/plan.json     (epics, stories, status)
 │   └── .forge/state.json    (current phase, queue, history)
 │   └── .forge/snapshots/    (pre-action file snapshots)
 │   └── .forge/designs/      (approved design metadata)
 │
 └── Preview (Storybook)
     └── Auto-generated .stories.tsx files
     └── User reviews in browser at localhost:6006
     └── Mobile + Desktop viewports
```

### 2.2 Two-Agent Model

Instead of four separate agents with context loss at every handoff, Forge uses two agents:

**Orchestrator** — The project manager. Never writes code. Handles:
- Breaking requirements into epics/stories
- Crafting detailed prompts for the Worker
- Routing user requests to the correct Worker mode
- Reviewing Worker output
- Managing sprint state

**Worker** — The engineer. Same Claude engine, different modes:

| Mode | System Prompt Focus | Allowed Tools | Purpose |
|---|---|---|---|
| `design` | UI/UX designer, Storybook expert | Read, Write | Generate component previews |
| `build` | Senior fullstack developer | Read, Write, Edit, Bash | Implement features |
| `review` | QA engineer, code reviewer | Read, Bash | Check quality, run tests |
| `fix` | Debugger, problem solver | Read, Write, Edit, Bash | Fix bugs and issues |

The Worker's system prompt and tool permissions change per mode, but it's the same `query()` call. This preserves context better than separate agents.

---

## 3. Pipeline

### 3.1 Phase Flow

```
UNDERSTAND → PLAN → DESIGN → BUILD → REVIEW → SHIP
                       │        │        │
                  [USER GATE] [USER GATE] [USER GATE]
```

Each gate pauses execution for human review. Changes are queued and applied at safe points between stories — never injected mid-execution.

### 3.2 Phase Details

**Phase 0: Understand**
- Orchestrator interviews the user (framework, features, preferences)
- User can upload reference images or designs
- Output: Project context object stored in `.forge/state.json`

**Phase 1: Plan**
- Orchestrator breaks requirements into epics and stories
- Each story gets: id, title, description, type (ui/backend/fullstack), priority
- User reviews, edits, approves
- Output: `.forge/plan.json`
- Git: `git tag forge/v0.0-plan`

**Phase 2: Design**
- Worker (design mode) generates Storybook stories for each UI story
- Local Storybook server starts at localhost:6006
- User reviews mobile + desktop viewports
- User provides feedback → Worker revises → repeat until approved
- Non-UI stories (database, API) skip this phase
- Output: `.storybook/stories/` + `.forge/designs/`
- Git: `git tag forge/v0.1-designs`

**Phase 3: Build**
- Sequential, one story at a time
- For each story:
  1. Git: create `feature/{story-id}` branch
  2. Orchestrator crafts detailed prompt with approved design + story context
  3. Worker (build mode) implements with full CLI power
  4. Worker runs build/lint/typecheck, self-heals on errors
  5. Git: commit to feature branch
- Output: Working code on feature branches

**Phase 4: Review**
- For each completed story:
  1. Worker (review mode) checks code quality, tests, design match
  2. Auto-fixes minor issues
  3. If major issues: sends back to build phase
  4. If passes: merge to main
- Git: `git tag forge/v0.{n}-story-{id}`

**Phase 5: Human Check**
- App runs on localhost
- User tests the full application
- Can trigger fixes: `forge fix "description"`
- Can start next sprint: `forge next`

### 3.3 User Input Routing

When the user types something mid-sprint, the Orchestrator classifies and routes:

| User Input Type | Route To | Example |
|---|---|---|
| Visual tweak | Worker (fix mode) | "make the button green" |
| Layout/UX redesign | Worker (design mode) → Worker (build mode) | "redesign the dashboard" |
| Bug report | Worker (fix mode, debug) | "login page shows blank" |
| New feature | Orchestrator (plan) → full pipeline | "add recurring donations" |
| Content change | Worker (fix mode) | "change 'Donate' to 'Give'" |
| Question | Orchestrator (answers directly) | "what stack are we using?" |

Changes are **queued** during active agent work and applied at the next safe point (between stories or at stage gates).

---

## 4. Tech Stack

### 4.1 Core Dependencies

| Package | Purpose | Why This One |
|---|---|---|
| `@anthropic-ai/claude-agent-sdk` | AI agent engine | Official SDK, full Claude Code power |
| `commander` | CLI framework | Lightweight, widely adopted |
| `inquirer` | Interactive prompts | Rich input types, battle-tested |
| `ora` | Terminal spinners | Clean loading states |
| `chalk` | Terminal colors | Readable output |
| `simple-git` | Git operations | Programmatic branch/tag/merge |
| `storybook` | Design previews | Industry standard, zero custom code |
| `typescript` | Language | Type safety across agents |
| `tsup` | Bundler | Fast TypeScript builds |

### 4.2 Peer Dependencies (user's project)

Forge v1 supports **Next.js** only. Framework adapters for React, Django, Flutter, etc. come later.

| Package | Required Version |
|---|---|
| `next` | >= 14 |
| `react` | >= 18 |
| `tailwindcss` | >= 3 |
| `@storybook/react` | >= 8 |

### 4.3 Project Structure

```
forge/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── README.md
├── LICENSE
│
├── src/
│   ├── index.ts                    # Package entry point
│   │
│   ├── cli/
│   │   ├── index.ts                # CLI entry point (bin)
│   │   ├── commands/
│   │   │   ├── init.ts             # forge init
│   │   │   ├── plan.ts             # forge plan
│   │   │   ├── design.ts           # forge design
│   │   │   ├── build.ts            # forge build
│   │   │   ├── review.ts           # forge review
│   │   │   ├── sprint.ts           # forge sprint (runs all phases)
│   │   │   ├── status.ts           # forge status
│   │   │   ├── fix.ts              # forge fix "description"
│   │   │   ├── undo.ts             # forge undo
│   │   │   └── map.ts              # forge map (git visualization)
│   │   └── ui/
│   │       ├── progress.ts         # Terminal progress display
│   │       ├── prompt.ts           # User input helpers
│   │       └── logger.ts           # Formatted logging
│   │
│   ├── core/
│   │   ├── orchestrator/
│   │   │   ├── index.ts            # Orchestrator agent
│   │   │   ├── planner.ts          # Sprint planning logic
│   │   │   ├── router.ts           # User input classification/routing
│   │   │   └── prompts.ts          # Orchestrator system prompts
│   │   │
│   │   ├── worker/
│   │   │   ├── index.ts            # Worker agent
│   │   │   ├── modes/
│   │   │   │   ├── design.ts       # Design mode config
│   │   │   │   ├── build.ts        # Build mode config
│   │   │   │   ├── review.ts       # Review mode config
│   │   │   │   └── fix.ts          # Fix mode config
│   │   │   └── prompts/
│   │   │       ├── design.ts       # Design system prompts
│   │   │       ├── build.ts        # Build system prompts
│   │   │       ├── review.ts       # Review system prompts
│   │   │       └── fix.ts          # Fix system prompts
│   │   │
│   │   ├── pipeline/
│   │   │   ├── index.ts            # Pipeline orchestration
│   │   │   ├── phases.ts           # Phase definitions
│   │   │   ├── gates.ts            # Human review gates
│   │   │   └── queue.ts            # Change queue (for mid-sprint input)
│   │   │
│   │   └── git/
│   │       ├── index.ts            # Git manager
│   │       ├── branches.ts         # Branch strategy
│   │       ├── snapshots.ts        # Pre-action snapshots
│   │       └── tags.ts             # Milestone tagging
│   │
│   ├── state/
│   │   ├── index.ts                # State manager
│   │   ├── plan.ts                 # Plan read/write
│   │   ├── sprint.ts               # Sprint state
│   │   └── schemas.ts              # JSON Schema validation
│   │
│   ├── preview/
│   │   ├── index.ts                # Storybook integration
│   │   ├── generator.ts            # Auto-generate .stories.tsx
│   │   └── server.ts               # Start/stop Storybook
│   │
│   ├── adapters/
│   │   ├── base.ts                 # Base adapter interface
│   │   └── nextjs/
│   │       ├── index.ts            # Next.js adapter
│   │       ├── scaffold.ts         # Project scaffolding
│   │       └── patterns.ts         # Next.js code patterns
│   │
│   └── types/
│       ├── plan.ts                 # Epic, Story, Sprint types
│       ├── agent.ts                # Agent config types
│       ├── state.ts                # State types
│       └── config.ts               # User config types
│
└── templates/
    ├── forge.config.json           # Default config template
    └── storybook/
        └── main.ts                 # Storybook config template
```

---

## 5. State Management

### 5.1 Directory Structure

```
project-root/
├── .forge/
│   ├── plan.json            # Sprint plan (epics, stories, status)
│   ├── state.json           # Current pipeline state
│   ├── config.json          # User preferences
│   ├── snapshots/
│   │   ├── 001-pre-design-login.json
│   │   ├── 002-pre-build-login.json
│   │   └── ...
│   └── designs/
│       ├── login.meta.json  # Design approval metadata
│       └── dashboard.meta.json
├── .storybook/              # Storybook config (auto-generated)
└── forge.config.json        # Project-level config
```

### 5.2 plan.json Schema

```json
{
  "project": "church-finance-app",
  "framework": "nextjs",
  "description": "A church finance application with...",
  "created": "2026-03-14T00:00:00Z",
  "epics": [
    {
      "id": "auth",
      "title": "Authentication",
      "status": "in-progress",
      "stories": [
        {
          "id": "auth-login",
          "title": "Login page UI",
          "description": "Login page with email/password and Google OAuth",
          "type": "ui",
          "status": "done",
          "branch": "feature/auth-login",
          "designApproved": true,
          "tags": ["forge/v0.3-auth-login"]
        }
      ]
    }
  ]
}
```

### 5.3 state.json Schema

```json
{
  "currentPhase": "build",
  "currentStory": "auth-signup",
  "workerMode": "build",
  "queue": [
    {
      "type": "visual-tweak",
      "message": "make the button green",
      "queuedAt": "2026-03-14T12:30:00Z"
    }
  ],
  "history": [
    {
      "action": "design-approved",
      "storyId": "auth-login",
      "timestamp": "2026-03-14T12:00:00Z",
      "snapshotId": "001"
    }
  ]
}
```

---

## 6. Agent Prompts

### 6.1 Orchestrator System Prompt (Core)

```
You are the Orchestrator — a senior tech lead managing an AI development sprint.

Your responsibilities:
1. Break user requirements into epics and stories
2. Craft detailed, specific prompts for the Worker agent
3. Route user feedback to the correct Worker mode
4. Review Worker output and decide next steps
5. Maintain project context and sprint state

When creating stories:
- Each story must be independently buildable
- UI stories need design phase; backend stories skip it
- Order stories by dependency (foundation first)
- Each story should take the Worker 1-3 tool calls to complete

When crafting Worker prompts:
- Include exact file paths to create/modify
- Reference approved designs when available
- Specify the framework patterns to follow
- Include acceptance criteria
- Never be vague — the Worker should not have to guess

When routing user feedback:
- Visual tweak (color, spacing, font) → Worker fix mode
- Layout/UX redesign → Worker design mode, then build mode
- Bug fix → Worker fix mode with debug focus
- New feature → Create new story, route through full pipeline
- Content change → Worker fix mode
- Question → Answer directly

When reviewing:
- Check if output matches the approved design
- Check if code follows project patterns
- Check if build/lint/typecheck pass
- Auto-fix minor issues, reject major ones
```

### 6.2 Worker System Prompts

**Design Mode:**
```
You are a senior UI/UX designer creating component previews.

Rules:
- Generate Storybook stories (.stories.tsx files)
- Every component MUST be responsive (mobile-first)
- Use the project's design system (shadcn/ui + Tailwind)
- Include realistic placeholder data
- Show loading, empty, and error states
- Test at 375px, 768px, and 1440px breakpoints

Design quality:
- Reference real products for design patterns (not generic AI aesthetics)
- Use distinctive typography (not Inter, not Arial)
- Commit to a cohesive color palette
- Add micro-interactions and hover states
- Generous whitespace, intentional hierarchy
```

**Build Mode:**
```
You are a senior fullstack developer implementing features.

Rules:
- Follow the approved design exactly
- Use the project's existing code patterns
- Write TypeScript with strict types
- Create small, focused components
- Add proper error handling
- Run build, lint, and typecheck after every change
- Self-heal: if a command fails, read the error and fix it
- Commit working code only

For Next.js:
- Use App Router (not Pages Router)
- Server Components by default, Client Components only when needed
- Use server actions for mutations
- Prisma for database access
```

**Review Mode:**
```
You are a QA engineer reviewing code.

Check:
- Does the implementation match the approved design?
- TypeScript strict mode compliance
- Proper error boundaries and loading states
- Responsive design (mobile + desktop)
- Accessibility (semantic HTML, ARIA labels, keyboard nav)
- No hardcoded values that should be configurable
- Clean Git diff (no debug logs, no commented code)

Run:
- npm run build
- npm run lint
- npm run typecheck
- npm run test (if tests exist)

If issues found:
- Minor (formatting, missing type): auto-fix
- Major (broken logic, missing feature): report back
```

**Fix Mode:**
```
You are a debugger and problem solver.

For visual tweaks:
- Make the smallest possible change
- Don't refactor surrounding code
- Verify the change looks correct

For bugs:
- Read error messages and stack traces carefully
- Trace the issue to root cause
- Fix the root cause, not the symptom
- Verify the fix doesn't break anything else
- Run tests after fixing
```

---

## 7. Design System & Quality

### 7.1 Design References by App Type

The Orchestrator selects appropriate design references based on the app type:

| App Type | Reference Products | Design Focus |
|---|---|---|
| Finance/Banking | Stripe, Mercury, Wise | Trust, clarity, data density |
| Dashboard/Admin | Linear, Vercel, Raycast | Clean nav, information hierarchy |
| E-commerce | Shopify Admin, Gumroad | Conversion-focused, clear CTAs |
| Social/Community | Discord, Slack | Engagement, real-time feel |
| Content/Blog | Medium, Ghost, Substack | Typography, readability |
| SaaS/Productivity | Notion, Figma, Loom | Powerful but approachable |
| Healthcare/Church | Calm, Headspace adapted | Warm, trustworthy, accessible |

### 7.2 Mobile-First Rules (Hardcoded)

Every design and build MUST:
- Design for 375px first, then scale up
- Use Tailwind responsive utilities (`sm:`, `md:`, `lg:`)
- Touch targets minimum 44x44px
- No horizontal scroll on mobile
- Collapsible navigation on small screens
- Readable font sizes (minimum 16px body on mobile)

---

## 8. Git Strategy

### 8.1 Branch Model

```
main                          ← production-ready code
  ├── feature/auth-login      ← one branch per story
  ├── feature/auth-signup
  ├── feature/dashboard
  └── fix/button-color        ← hotfix branches
```

### 8.2 Tagging

```
forge/v0.0-plan               ← sprint plan approved
forge/v0.1-designs             ← all designs approved
forge/v0.2-auth-login          ← story merged to main
forge/v0.3-auth-signup
forge/v1.0-sprint-1            ← sprint complete
```

### 8.3 Snapshots

Before every agent action, Forge saves a snapshot:

```json
{
  "id": "003",
  "action": "build",
  "storyId": "auth-login",
  "timestamp": "2026-03-14T12:45:00Z",
  "files": [
    { "path": "src/app/login/page.tsx", "hash": "abc123" }
  ],
  "branch": "feature/auth-login",
  "commitBefore": "def456"
}
```

`forge undo` uses these snapshots for file-level rollback.

---

## 9. CLI Commands

| Command | Description |
|---|---|
| `forge init` | Set up Forge in current project |
| `forge plan "description"` | Generate sprint plan from description |
| `forge design` | Generate and review design previews |
| `forge build` | Build stories sequentially |
| `forge review` | Run QA review on completed stories |
| `forge sprint "description"` | Run full pipeline (plan → design → build → review) |
| `forge status` | Show current sprint state |
| `forge fix "description"` | Fix a bug or make a change |
| `forge undo` | Revert last agent action |
| `forge history` | Show all versions/checkpoints |
| `forge checkout <version>` | Jump to a specific version |

---

## 10. Roadmap

### v0.1 — MVP
- [x] CLI scaffold with all commands
- [x] Orchestrator agent (plan + route)
- [x] Worker agent (design + build + review + fix modes)
- [x] Git manager (branches + tags + snapshots)
- [x] State manager (.forge/ with JSON)
- [x] Storybook integration for design previews
- [x] Next.js adapter only
- [x] Sequential execution

### v0.2 — Polish
- [ ] `forge undo` with file-level rollback
- [ ] `forge history` with version timeline
- [ ] GitHub Issues/Projects sync
- [ ] Better terminal UI (split progress + input)
- [ ] User-uploaded reference images in design phase

### v0.3 — Expand
- [ ] React (Vite) adapter
- [ ] Django adapter
- [ ] `forge map` — Git visualization in browser
- [ ] Dashboard web UI

### v1.0 — Production
- [ ] Parallel agent execution (optional)
- [ ] Multiple LLM provider support
- [ ] Plugin system for custom adapters
- [ ] CI/CD integration
- [ ] Team collaboration features

---

## 11. Open Decisions

| Decision | Options | Current Choice | Rationale |
|---|---|---|---|
| Package name | forge, relay, cadence, architect | TBD | Need user input |
| Config format | JSON vs YAML | JSON | Programmatic reliability |
| Design preview | Storybook vs custom server | Storybook | Industry standard, zero custom code |
| First framework | Next.js vs React | Next.js | Most complete fullstack framework |
| Agent model | Sonnet vs Opus | Configurable | Let user choose cost vs quality |

---

*End of Architecture Document*
