<p align="center">
  <img src="https://img.shields.io/npm/v/forgecraft?style=flat-square&color=000" alt="npm version" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-000?style=flat-square" alt="node version" />
  <img src="https://img.shields.io/github/license/joeljohn159/forgeai?style=flat-square&color=000" alt="license" />
  <img src="https://img.shields.io/badge/frameworks-Next.js%20%7C%20React%20%7C%20Django%20%7C%20Any-000?style=flat-square" alt="frameworks" />
</p>

<h1 align="center">ForgeAI</h1>

<p align="center">
  <strong>One command. No prompts. Come back to a full app pushed to GitHub.</strong><br/>
  Autonomous AI that plans, builds, reviews, and deploys software — zero human intervention.<br/>Give it a sentence before lunch. Come back to a production-ready app.
</p>

<br/>

```
$ forge auto "a personal finance tracker with budget categories, expense logging, and monthly reports"

  forge auto
  sandbox on · type a message anytime to queue feedback

  [0:03] Plan ready

  Personal Finance Tracker · nextjs
  12 stories across 4 epics

  Layout & Navigation
    [full] App shell with sidebar navigation
    [full] Dashboard landing page
  Expense Management
    [full] Add expense form with categories
    [full] Expense list with filters
    [ui]   Category management page
  Budget Tracking
    [full] Budget setup per category
    [ui]   Budget vs actual progress bars
    [full] Budget alerts and notifications
  Reports
    [ui]   Monthly expense breakdown chart
    [ui]   Category pie chart
    [full] Export to CSV
    [full] Date range selector

  Build · 12 stories

  [0:15] [1/12] App shell with sidebar navigation · 8 files  2.1k in / 18.4k out
  [0:48] [2/12] Dashboard landing page · 4 files              1.8k in / 12.1k out
  [1:22] parallel: Add expense form, Category management
  [2:01] [3/12] Add expense form with categories · 6 files    2.4k in / 21.0k out
  [2:01] [4/12] Category management page · 3 files            1.2k in / 9.8k out
  ...

  [14:02] Pushed to GitHub
  ─────────────────────────────────
  Done in 14m 23s · 12/12 stories
  28.4k in / 198.2k out
```

<br/>

---

<br/>

## The Problem

Every AI coding tool today works the same way: you type into a chat, the AI writes some code, you paste it in, something breaks, you go back and forth. There is no structure, no planning, no design phase, no review. You are the project manager, the QA engineer, and the glue holding it all together.

ForgeAI replaces that entire loop.

<br/>

## How It Works

ForgeAI runs a complete software development pipeline autonomously. One command, six phases, zero copy-pasting.

```
 PLAN            DESIGN           BUILD            REVIEW           PUSH            SHIP
 ────            ──────           ─────            ──────           ────            ────
 Break into      Generate         Implement        QA check         Auto-push       Tag, merge,
 epics &         Storybook        each story       each story,      commits &       deploy
 stories         previews         with full        auto-fix         tags to
                                  CLI power        minor issues     GitHub

 Orchestrator    Worker           Worker           Worker           Git             Git
 Agent           (design mode)    (build mode)     (review mode)    Manager         Manager
```

Each phase has a clear input, a clear output, and a gate between them. Stories that don't depend on each other build **in parallel**. After everything completes, the project is **automatically pushed to GitHub** (if a remote is configured). The whole thing runs on `main` with per-story commits and tags for easy rollback.

<br/>

## Quick Start

```bash
# Prerequisites: Node 18+, Claude Code CLI (logged in)

# Install globally
npm install -g forgecraft

# Create a new project directory
mkdir my-app && cd my-app

# Initialize (choose Next.js, React+Vite, Django, or any stack)
forge init

# Build something
forge auto "a task management app with projects, due dates, and team assignment"

# Full auto — skip all prompts
forge auto "an API with Express and MongoDB" --yes

# Attach references — drag & drop files into the terminal
forge auto "build this app" /path/to/mockup.png /path/to/spec.pdf
#  Attachments:
#    [Image1] mockup.png
#    [Document1] spec.pdf

# Start the dev server
forge start

# If interrupted, resume where you left off
forge resume

# Fix a bug (drag & drop screenshots or use --image)
forge fix "the sidebar overlaps on mobile" --image screenshot.png

# Push to GitHub manually (auto-push happens after forge auto)
forge push
```

That's it. Come back in 15 minutes to a working app with proper types, responsive design, SEO metadata, favicons, and a README — already pushed to your repo.

<br/>

## Features

### Structured Pipeline, Not a Chat
Every project goes through Plan, Design, Build, Review, Push. Each phase has specialized prompts, tool permissions, and quality gates. The AI doesn't just write code — it writes code that builds, lints, and type-checks before moving on.

### Two-Agent Architecture
Instead of one monolithic agent or a swarm of disconnected ones, ForgeAI uses two:

- **Orchestrator** — The tech lead. Plans the sprint, crafts detailed prompts for each story, routes your feedback, reviews output. Never touches code.
- **Worker** — The engineer. Same agent, four modes (`design`, `build`, `review`, `fix`), each with different system prompts and tool permissions. Preserves context across the entire build.

### Parallel Execution
Stories are grouped by dependency. Independent stories build concurrently using `Promise.all`, cutting total build time significantly. A 12-story app that takes 45 minutes sequentially finishes in ~15 minutes.

### Live Feedback Loop
Type a message at any point during the build. It gets queued and processed at the next safe point between stories. The Orchestrator classifies your input and routes it:

```
"make the header sticky"              → Worker fix mode
"redesign the settings page"          → Worker design mode → build mode
"the API returns 404 on /expenses"    → Worker fix mode (debug)
"add a dark mode toggle"              → New story added to sprint
"what's the database schema?"         → Orchestrator answers directly
```

### Drag & Drop Attachments
Drag files directly into the terminal to attach mockups, specs, or screenshots. Forge detects the file paths, classifies them, and passes them to the agents as context.

```bash
# Drag & drop images and documents right into your prompt
forge auto "build this landing page" /Users/me/mockup.png /Users/me/requirements.pdf

  Attachments:
    [Image1] mockup.png
    [Document1] requirements.pdf

# Also works with forge fix
forge fix "match this design" /Users/me/screenshot.png
```

Supports images (`.png`, `.jpg`, `.svg`, `.webp`), documents (`.pdf`, `.doc`, `.txt`, `.md`, `.csv`, `.json`, `.yaml`), and design files (`.figma`, `.sketch`). Files are copied to `.forge/attachments/` so agents can reference them.

### Zero-Prompt Mode (`--yes`)
Skip every confirmation dialog — Claude Code permission prompts, review gates, resume confirmations. Fully hands-free.

```bash
forge auto "a blog with auth" --yes
forge auto "a dashboard" -y --skip-design --quiet
forge resume -y
```

### Screenshot-Based Bug Fixing
Pass a screenshot to `forge fix` and Claude reads the image to understand the visual issue:

```bash
forge fix "the button is cut off on mobile" --image screenshot.png
```

### Auto-Push to GitHub
After `forge auto` or `forge resume` completes, commits and tags are automatically pushed to your GitHub remote. No manual `git push` needed. If the push fails, a warning is shown and you can retry with `forge push`.

### Safety Caps
Each worker mode has a maximum turn limit (`design: 30`, `build: 50`, `review: 20`, `fix: 15`). If an agent gets stuck in a loop, it stops gracefully instead of burning through your usage.

### Review Gate
After the build phase completes, ForgeAI pauses and plays a notification sound. You choose: continue to review, skip review, or abort. You're always in control.

### Production Defaults
Every project gets the things most AI tools forget:
- `favicon.ico`, `icon.svg`, `apple-touch-icon.png`
- Open Graph image (`og.png`) for social sharing
- Complete metadata — title, description, OG tags, Twitter cards
- `robots.txt`, `sitemap.xml`, `manifest.json`
- `next/image` for all images
- Auto-generated `README.md` based on what was actually built

### Multi-Framework Support
ForgeAI isn't locked to one framework. Each adapter knows how to scaffold, build, lint, and run a project in its stack:

| Framework | Language | Design Phase | Status |
|-----------|----------|-------------|--------|
| **Next.js** | TypeScript | Storybook | Stable |
| **React + Vite** | TypeScript | Storybook | Stable |
| **Django** | Python | Skipped | Stable |
| **Any Stack** | Auto-detect | Skipped | Stable |

The **"Other"** option in `forge init` enables a generic adapter that works with any tech stack — Express, Vue, Svelte, Go, Rust, FastAPI, Flutter, Rails, and more. The agent auto-detects your project's language, package manager, build commands, and file structure from existing config files. If starting from scratch, it scaffolds using the standard tooling for the detected stack.

```bash
# Works with anything
forge auto "a REST API with Express, Prisma, and PostgreSQL"
forge auto "a CLI tool in Rust that converts images to WebP"
forge auto "a FastAPI backend with SQLAlchemy and JWT auth"
```

Worker prompts automatically adapt to the framework — Next.js gets App Router instructions, Vite gets SPA routing, Django gets migration commands, and generic projects get smart auto-detection.

### Project Visualizer (`forge viz`)
Generate a self-contained interactive HTML dashboard for any project. No external dependencies — everything is inlined. Works offline, shareable as a single file.

**Dashboard includes:**

- **Overview** — Code health score (A-F grade), project summary, file distribution, language breakdown, complexity hotspots, most-used modules, circular dependency detection, orphan file detection, test coverage map
- **Architecture** — Layered diagram showing how files flow from entry points through presentation, components, state, API, core logic, and config
- **System Map** — SVG-based architecture diagram with component boxes, directional arrows, import counts, dashed boundary zones, zoom/pan, keyboard navigation, minimap, and PNG export
- **Files** — Full file list with test coverage indicators (green/red dots), sortable by category
- **API Docs** — Auto-generated endpoint documentation from detected routes, grouped by base path with parameter extraction
- **Diff Mode** — Compare current scan vs previous (added/removed/changed files, line deltas, health score change). Snapshots saved automatically to `.forge/viz-snapshot.json`
- **File Detail** — Click any file to see stats, exports, routes, dependencies, dependents, first 25 lines of code preview with line numbers, and an "Open in VS Code" button that reuses your existing window
- **Search** — Press `/` to fuzzy-search files across the sidebar

### Sprint Resume
If a build gets interrupted (auth expires, network drops, you close the terminal), your progress is saved. Run `forge resume` to pick up exactly where you left off. Blocked stories can be retried.

### Optional GitHub Pages Deploy
Pass `--deploy` and ForgeAI configures `next.config` for static export and creates a GitHub Actions workflow for automatic deployment.

<br/>

## Commands

### Autonomous Mode (recommended)

```bash
forge auto "description"              # Full autonomous pipeline (auto-pushes to GitHub)
forge auto "description" --yes        # Skip all prompts (fully hands-free)
forge auto "description" --skip-design  # Skip Storybook previews (faster)
forge auto "description" --deploy     # Add GitHub Pages deployment
forge auto "description" --mute       # No notification sounds
forge auto "description" --quiet      # Spinners only, no tool details
forge auto "desc" file.png spec.pdf   # Attach reference files (drag & drop)
```

### Step-by-Step Mode

```bash
forge init                            # Initialize ForgeAI in current directory
forge plan "description"              # Generate sprint plan
forge design                          # Generate Storybook design previews
forge build                           # Build stories sequentially
forge review                          # Run QA review on built stories
forge sprint "description"            # Run full pipeline with human gates
```

### Run & Deploy

```bash
forge start                           # Start the dev server (auto-detects framework)
forge push                            # Push commits + tags to GitHub
```

### Visualizer & Insights

```bash
forge viz                             # Interactive project dashboard (opens in browser)
forge viz /path/to/project            # Visualize a specific project
forge viz --no-open                   # Generate without opening browser
forge viz -o report.html              # Custom output path
```

### Utilities

```bash
forge status                          # Show current sprint progress
forge map                             # Visual sprint map with status + dependencies
forge diff <v1> [v2]                  # Show changes between two versions
forge fix "description"               # Fix a bug or make a small change
forge fix "desc" --image <path>       # Fix with a screenshot for visual context
forge undo                            # Revert the last agent action
forge resume                          # Resume an interrupted sprint (auto-pushes)
forge history                         # Show version timeline and activity log
forge checkout <version>              # Jump to a specific version or checkpoint
forge export                          # Export sprint plan as markdown
forge clean                           # Reset sprint state (keeps config)
forge doctor                          # Diagnose setup issues
forge estimate                        # Estimate token usage and cost for sprint
forge cicd                            # Generate CI/CD pipeline configuration
forge template                        # Browse and use starter app templates
forge upgrade                         # Upgrade Forge to the latest version
forge test                            # Generate and run tests for built stories
```

<br/>

## Architecture

```
src/
├── cli/
│   ├── index.ts                      # CLI entry point (commander)
│   └── commands/
│       ├── auto.ts                   # forge auto — autonomous mode
│       ├── resume.ts                 # forge resume — resume interrupted sprint
│       ├── start.ts                  # forge start — start dev server
│       ├── push.ts                   # forge push — push to GitHub
│       ├── init.ts                   # forge init
│       ├── plan.ts                   # forge plan
│       ├── design.ts                 # forge design
│       ├── build.ts                  # forge build
│       ├── review.ts                 # forge review
│       ├── sprint.ts                 # forge sprint
│       ├── status.ts                 # forge status
│       ├── map.ts                    # forge map — visual sprint map
│       ├── fix.ts                    # forge fix (supports --image)
│       ├── undo.ts                   # forge undo
│       └── history.ts               # forge history + forge checkout
│
├── core/
│   ├── orchestrator/
│   │   ├── index.ts                  # Orchestrator agent — plans, routes, reviews
│   │   └── prompts.ts                # Orchestrator system prompt
│   │
│   ├── worker/
│   │   ├── index.ts                  # Worker agent — executes in 4 modes
│   │   └── prompts/
│   │       └── index.ts              # Framework-aware mode-specific prompts
│   │
│   ├── pipeline/
│   │   ├── index.ts                  # Step-by-step pipeline
│   │   └── auto.ts                   # Autonomous pipeline (parallel, timer, gates, resume, auto-push)
│   │
│   ├── adapters/
│   │   ├── base.ts                   # FrameworkAdapter interface
│   │   ├── nextjs.ts                 # Next.js adapter
│   │   ├── react-vite.ts             # React + Vite adapter
│   │   ├── django.ts                 # Django adapter
│   │   ├── generic.ts                # Generic adapter (any tech stack)
│   │   └── index.ts                  # Adapter registry + factory
│   │
│   ├── git/
│   │   └── index.ts                  # Git operations (branch, commit, tag, push)
│   │
│   ├── github/
│   │   └── index.ts                  # GitHub Issues sync (via gh CLI)
│   │
│   ├── visualizer/
│   │   ├── index.ts                  # Orchestrates scan → HTML → browser open
│   │   ├── scanner.ts                # Recursive project scanner (imports, exports, routes, deps)
│   │   └── template.ts              # Self-contained HTML dashboard generator
│   │
│   └── utils/
│       ├── attachments.ts            # Drag & drop file attachment parser
│       ├── config.ts                 # Config validation
│       └── sound.ts                  # Notification sounds (macOS/Linux/fallback)
│
├── state/
│   └── index.ts                      # State manager (.forge/ directory, cached)
│
└── types/
    └── plan.ts                       # TypeScript types for the entire system
```

<br/>

## State & Git

ForgeAI tracks everything in a `.forge/` directory inside your repo:

```
.forge/
├── plan.json                         # Epics, stories, status, dependencies
├── state.json                        # Current phase, queue, history
├── config.json                       # Framework, model, preferences
├── snapshots/                        # Pre-action snapshots for undo
└── designs/                          # Design approval metadata
```

Every story gets a commit. Every milestone gets a tag:

```
main ────●────●────●────●────●────●──── HEAD → pushed to origin
         │    │    │    │    │    │
         │    │    │    │    │    └── forge/v0.6-export-csv
         │    │    │    │    └── forge/v0.5-budget-alerts
         │    │    │    └── forge/v0.4-budget-setup
         │    │    └── forge/v0.3-expense-list
         │    └── forge/v0.2-add-expense
         └── forge/v0.1-designs
```

Roll back to any point with `git checkout forge/v0.3-expense-list`.

<br/>

## Requirements

| Requirement | Details |
|-------------|---------|
| **Node.js** | v18 or higher |
| **Claude Code** | Installed and logged in (`npm i -g @anthropic-ai/claude-code && claude login`) |
| **Git** | Any recent version |
| **Subscription** | Claude Max, Team, or Enterprise |

ForgeAI uses the Claude Agent SDK which authenticates through your Claude Code session. No separate API key needed.

<br/>

## Configuration

After `forge init`, your `forge.config.json` controls:

```json
{
  "framework": "nextjs",
  "model": "sonnet",
  "designPreview": "storybook",
  "autoCommit": true,
  "storybook": {
    "port": 6006
  }
}
```

<br/>

## Comparison

| | ChatGPT / Claude Chat | GitHub Copilot | Cursor | **ForgeAI** |
|---|---|---|---|---|
| Planning | Manual | None | None | **Automated sprint planning** |
| Design preview | None | None | None | **Storybook generation** |
| Build | Copy-paste | Autocomplete | Inline edit | **Full autonomous build** |
| Review | Manual | None | None | **Automated QA + auto-fix** |
| Git strategy | Manual | Manual | Manual | **Auto commits + tags + push** |
| Parallelism | N/A | N/A | N/A | **Dependency-grouped parallel** |
| Project visualization | N/A | N/A | N/A | **Interactive dashboard + health score** |
| Human oversight | Full control | None | Approve/reject | **Stage gates + live feedback** |
| Bug fix with screenshots | N/A | N/A | N/A | **forge fix --image + drag & drop** |
| SEO & assets | You remember | You remember | You remember | **Built-in defaults** |
| Multi-framework | N/A | Any | Any | **Next.js, React, Django, Any** |
| File attachments | N/A | N/A | N/A | **Drag & drop mockups/specs** |
| Resume on failure | Start over | N/A | N/A | **Auto-save + resume** |

<br/>

## Roadmap

**v0.1** — Core pipeline, two-agent architecture, Next.js support

**v0.2** — Autonomous mode, parallel execution, undo/history, GitHub sync

**v0.3** — React + Vite and Django adapters, `forge map`, `forge resume`

**v1.0** — Initial Release
- 21 CLI commands covering the full development lifecycle
- 3 framework adapters (Next.js, React + Vite, Django)
- Framework-aware prompts via pluggable adapter system
- `forge start` — auto-detect and launch dev server
- `forge push` — push commits + tags to GitHub
- `forge fix --image` — screenshot-based bug fixing
- Auto-push to GitHub after `forge auto` and `forge resume`
- Graceful shutdown with automatic progress save
- Config validation with actionable error messages
- Token expiry handling with auto-retry

**v1.1**
- **Any tech stack support** — generic adapter auto-detects language, package manager, build commands, and project structure. Works with Express, Vue, Svelte, Go, Rust, FastAPI, Rails, and more.
- **`--yes` flag** — skip all confirmation prompts for fully hands-free operation
- **Drag & drop attachments** — attach mockups, screenshots, specs, and design files by dragging into the terminal
- Published as `forgecraft` on npm

**v2.0** — Current
- **`forge viz`** — Interactive project visualizer with self-contained HTML dashboard
  - Code health score (A-F grade) with detailed breakdown
  - Circular dependency detection (DFS-based, capped at 50 cycles)
  - Orphan file detection (files with no imports and no dependents)
  - Test coverage map with covered/uncovered indicators
  - SVG system architecture diagram with zoom, pan, minimap, keyboard nav
  - PNG export for system map
  - Diff mode — compare scans over time (added/removed/changed files, health delta)
  - Auto-generated API documentation from detected routes
  - File preview with line numbers and "Open in VS Code" integration
  - Fully self-contained, offline-capable, shareable as a single HTML file
- **`forge test`** — auto-generate and run tests for built stories
- **`forge estimate`** — token usage and cost estimation
- **`forge cicd`** — CI/CD pipeline generation (GitHub Actions, GitLab CI)
- **`forge template`** — starter app template browser
- **`forge upgrade`** — self-update command
- 29 CLI commands total

---

## Future Plans

### v2.1 — Next Up
- **Visualizer: Live mode** — watch file system for changes and auto-refresh the dashboard in real time
- **Visualizer: Dependency graph view** — interactive force-directed graph with filtering by module, role, or category
- **Visualizer: Git blame integration** — show who last modified each file, commit recency heatmap
- **Visualizer: Bundle size analysis** — estimate production bundle size per entry point, flag heavy imports
- **Visualizer: Code duplication detection** — find similar code blocks across files, suggest consolidation
- **Test generation phase** — auto-generate unit and integration tests after build (Vitest, pytest, Flutter test)
- **Custom adapter plugin API** — drop a JS file in `.forge/adapters/` to add your own framework

### v2.2 — Planned
- **Multi-provider support** — swap Claude for OpenAI, Gemini, or local models (Ollama) per agent
- **Web dashboard** — browser-based sprint monitoring with real-time build progress, token usage charts, and story diffs
- **CI/CD integration** — GitHub Actions / GitLab CI pipeline generation, auto-run tests on PR, deploy previews
- **Cost estimation** — token budget planning before sprint starts, per-story cost breakdown, spending alerts
- **Visualizer: Performance profiling** — detect potential performance bottlenecks (large components, deep dependency chains, circular renders)
- **Visualizer: Security audit** — flag potential issues (hardcoded secrets, unsafe deps, missing auth checks)

### v3.0 — Future Vision
- **Team collaboration** — multiple users can queue feedback on the same sprint, role-based permissions (lead reviews, dev builds)
- **Monorepo support** — run separate pipelines for `packages/*` with shared dependency tracking
- **Visual regression testing** — screenshot comparison between versions, flag UI drift automatically
- **Database schema generation** — auto-generate migrations, seed data, and ERD diagrams from plan descriptions
- **Accessibility audit phase** — automated WCAG checks after build, auto-fix common a11y issues
- **i18n / localization** — generate translation keys and locale files from built UI, support RTL layouts
- **Plugin system** — community-built pipeline phases (e.g., performance audit, API docs, Docker setup)
- **Template library** — starter templates for common app types (SaaS dashboard, e-commerce, blog, landing page)
- **Visualizer: AI insights** — natural language summary of codebase ("Your API layer has 3 circular deps, 12 untested endpoints, and 4 files over 500 lines")
- **Visualizer: Multi-project comparison** — compare architecture and health across multiple repos side by side
- **Visualizer: Timeline replay** — animate how the codebase evolved over time using saved snapshots

<br/>

## Contributing

```bash
git clone https://github.com/joeljohn159/forgeai.git
cd forgeai
npm install
npm run build
npm link                              # Makes 'forge' available globally
```

Make changes in `src/`, then `npm run build` to test.

<br/>

## License

MIT

<br/>

---

<p align="center">
  Built by <a href="https://github.com/joeljohn159">Joel John</a>
</p>
