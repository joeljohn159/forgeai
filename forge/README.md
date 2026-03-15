# ⚡ Forge

**AI Development Orchestration Framework**

Forge transforms AI-assisted development from a flat chat loop into a structured, multi-agent Agile pipeline. Plan, design, build, and review software with AI agents — with human oversight at every stage.

## Why Forge?

| Without Forge | With Forge |
|---|---|
| "Build me a login page" → "No, change that" → "Not like that" | Structured pipeline: plan → design → build → review |
| One agent, you manage everything | Orchestrator + Worker, automated coordination |
| Code first, fix later | See designs before any code is written |
| Manual Git branch juggling | Automated branch-per-story strategy |
| Generic AI-looking output | Curated design references, mobile-first |
| No project tracking | Sprint state tracked in Git |

## Quick Start

```bash
# Install
npm install -g forge-ai

# Initialize in your project
forge init

# Run a full sprint
forge sprint "Build a church finance app with donation tracking, 
              budget management, and financial reports"
```

## How It Works

```
You describe what you want
        │
        ▼
   📋 PLAN ──────── Orchestrator breaks it into epics & stories
        │            You review and approve the plan
        ▼
   🎨 DESIGN ────── Worker generates Storybook previews
        │            You review designs in the browser
        │            Mobile + desktop, iterate until happy
        ▼
   🔧 BUILD ─────── Worker implements each story on its own branch
        │            Full Claude Code power: writes, runs, self-heals
        ▼
   🔍 REVIEW ────── Worker reviews code quality, runs tests
        │            Auto-fixes minor issues, merges to main
        ▼
   🎉 SHIP ──────── Working app on localhost, tagged in Git
```

## Commands

| Command | Description |
|---|---|
| `forge init` | Set up Forge in your project |
| `forge plan "description"` | Generate a sprint plan |
| `forge design` | Generate & review design previews |
| `forge build` | Build stories one by one |
| `forge review` | Run QA review on built stories |
| `forge sprint "description"` | Run the full pipeline |
| `forge status` | Show sprint progress |
| `forge fix "description"` | Fix a bug or make a change |
| `forge undo` | Revert the last action |

## The Two-Agent Model

Forge uses two agents instead of many, minimizing context loss:

**Orchestrator** — The project manager. Plans, routes, reviews. Never writes code.

**Worker** — The engineer. Same agent, four modes:

| Mode | What it does |
|---|---|
| `design` | Generates Storybook component previews |
| `build` | Implements features with full CLI power |
| `review` | Checks quality, runs tests |
| `fix` | Debugs and patches issues |

## Talk to the Orchestrator Anytime

Mid-sprint, just type what you need:

```bash
> make the button green          # → Worker fix mode (visual tweak)
> redesign the dashboard         # → Worker design mode (new mockup)
> login page shows blank screen  # → Worker fix mode (debug)
> add recurring donations        # → New story added to sprint
> what database schema are we using?  # → Orchestrator answers directly
```

Changes are queued and applied at safe points between stories.

## State Management

All state lives in `.forge/` inside your repo:

```
.forge/
├── plan.json       # Epics, stories, status
├── state.json      # Current phase, queue, history
├── snapshots/      # Pre-action snapshots for undo
└── designs/        # Design approval metadata
```

Since it's in Git, it's versioned, backed up, and synced for free.

## Git Strategy

Every story gets its own branch. Every milestone gets a tag:

```
main ────●────●────●────●──── HEAD
         │    │    │    │
         │    │    │    └── forge/v0.4-dashboard
         │    │    └── forge/v0.3-auth-api
         │    └── forge/v0.2-auth-signup
         └── forge/v0.1-designs
```

## Requirements

- Node.js 18+
- Claude Code CLI (authenticated)
- Git

## Roadmap

- **v0.1** — Core pipeline, 2-agent model, Next.js support
- **v0.2** — Undo/history, GitHub sync, design import
- **v0.3** — React/Django adapters, Git map visualization
- **v1.0** — Parallel agents, plugin system, CI/CD integration

## License

MIT
