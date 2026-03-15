# Changelog

All notable changes to ForgeAI are documented here.

## [1.0.0] - 2026-03-15

### Added
- **`forge doctor`** — diagnose setup issues: checks Node, Git, Claude CLI, auth, framework tools, GitHub CLI
- **`forge diff <v1> [v2]`** — show colorized diff between any two versions, tags, or commits with summary stats
- **`forge clean`** — reset sprint state (plan, snapshots, designs) while preserving config; `--snapshots` flag for partial clean
- **`forge export`** — export sprint plan as formatted markdown with checkboxes, dependencies, and progress
- **Config validation** — validates `forge.config.json` on every command with clear error messages and fix suggestions
- **Graceful shutdown** — SIGINT/SIGTERM handler saves plan state and commits progress before exit; shows `forge resume` hint
- **`add-story` in `forge fix`** — when the Orchestrator detects a new feature request, it now actually adds the story to the plan (was a TODO stub)

### Changed
- **Pipeline rewrite** — step-by-step Pipeline no longer creates feature branches (was causing merge conflicts); builds on main with per-story commits, matching the AutoPipeline strategy
- **Framework-aware Orchestrator** — plan generation prompt now includes framework name, language, design support status; example JSON uses the actual configured framework
- **JSON validation** — plan generation now validates the response has required fields (epics array) and provides clear error messages on malformed JSON
- **Routing fallback** — `routeUserInput` returns a text answer instead of crashing when the AI returns non-JSON
- **Regen depth limit** — `runPlanPhase` recursion capped at 5 attempts to prevent stack overflow
- **Design phase skip** — Pipeline auto-skips design for frameworks without Storybook support (Django)
- **Review error handling** — Pipeline review phase now catches errors per-story instead of crashing the entire phase
- **Worker constructor** — all callers updated to use the new `(config, sandboxOpts, mute)` signature
- **Removed peerDependencies** — `next` and `@storybook/react` removed from package.json (this is a CLI tool, not a library that depends on frameworks)
- **18 total commands** — up from 14 in v0.3
- **Version bumped** to 1.0.0

### Fixed
- Worker constructor mismatch: Pipeline was calling `new Worker(config)` but Worker requires 2-3 args — runtime crash
- `forge fix` created feature branches and merge conflicts — now works on main
- `forge fix` "add-story" action showed success message but never actually added the story to the plan
- Orchestrator plan prompt hardcoded `"framework": "nextjs"` in example JSON
- Pipeline review phase had no error handling — one failed review crashed all subsequent reviews
- `forge init` showed "Coming in v0.4" for Flutter — updated to generic "coming soon"
- Unused `processingQueue` property removed from AutoPipeline

## [0.3.0] - 2026-03-14

### Added
- **React + Vite adapter** — `forge init` now supports React + Vite (TypeScript SPA with Tailwind, React Router, Vite)
- **Django adapter** — `forge init` now supports Django (Python + DRF + django-cors-headers)
- **Framework adapter system** — pluggable adapter architecture in `src/core/adapters/` so adding new frameworks is straightforward
- **`forge map`** — terminal sprint visualization showing stories as a tree with status icons, dependency arrows, progress bar, and git tags
- **`forge resume`** — resume an interrupted sprint from where it left off, with option to retry blocked stories
- **Token expiry handling** — Worker and Orchestrator detect auth/token errors (401, expired session), notify the user, and automatically retry after re-authentication (up to 3 attempts, 30s between retries)
- **Chat queue improvements** — readline no longer conflicts with ora spinners, shows `[queued #N]` confirmation with count, re-shows input hint after each queued message
- **Progress save on error** — pipeline saves plan state and commits before failing, so no work is lost on crashes or auth expiry
- **Framework-aware prompts** — Worker build/review/fix prompts now include framework-specific instructions (Next.js App Router, Vite config, Django migrations, etc.)

### Changed
- **State Manager caching** — in-memory cache with mtime validation avoids redundant disk reads; directory creation cache skips repeated `mkdir` calls
- **Worker memory optimization** — removed `messages[]` array from WorkerResult (was storing every SDK message in memory); only tracks files, errors, usage, summary
- **Git operation reduction** — branch name caching, repo verification caching, `commitAll` catches "nothing to commit" instead of running a separate `status` check
- **Version bumped** to 0.3.0

### Fixed
- readline `output: process.stdout` was interfering with ora spinners — now uses `terminal: false`
- Git `ensureMainBranch` was listing all branches even when already on main

## [0.2.0] - 2026-03-13

### Added
- **Autonomous mode** (`forge auto`) — fully autonomous pipeline with no human gates (except review gate after build)
- **Parallel story execution** — stories grouped by dependency, independent stories built concurrently with `Promise.all`
- **`forge undo`** — interactive commit selection with `git revert`, conflict handling, story status reset
- **`forge history`** — version timeline with checkpoints, color-coded activity log
- **`forge checkout`** — jump to any forge tag or commit hash
- **Design import** (`forge design --import <path>`) — import screenshots/mockups as design references
- **GitHub Issues sync** — `GitHubSync` class creates/updates GitHub Issues with labels from sprint plan
- **Safety caps** — per-mode turn limits (design: 30, build: 50, review: 20, fix: 15) prevent agent loops
- **Review gate** — pause after build phase with notification sound, user chooses: continue/skip/abort
- **Live elapsed timer** — `[M:SS]` prefix on all spinner text, 1s interval keeps ticking during agent thinking
- **Sound notifications** — macOS `afplay`, Linux `paplay`, fallback terminal bell
- **Auto-generated README** — Worker generates README.md based on plan + actual code after build
- **GitHub Pages deploy** (`--deploy` flag) — configures next.config for static export + GitHub Actions workflow
- **`--skip-design`** flag — skip Storybook design phase for faster builds
- **`--mute`** flag — suppress notification sounds
- **`--quiet`** flag — spinners only, hide tool details
- **Auth check** — verifies Claude Code CLI is installed and logged in before running
- **SEO/assets in prompts** — favicon, og.png, metadata, robots.txt, sitemap.xml, manifest.json

### Changed
- Git strategy: build on `main` with per-story commits + tags (no more feature branches in auto mode — prevents merge conflicts)
- Token usage display: uses `=` not `+=` for SDK cumulative totals

### Fixed
- Merge conflicts during autonomous mode caused by multiple branches adding same config files
- Token usage double-counting from SDK result messages
- Agent infinite loops (now capped by `MODE_MAX_TURNS`)

## [0.1.0] - 2026-03-12

### Added
- Initial release
- Two-agent architecture: Orchestrator (plans, routes, reviews) + Worker (design, build, review, fix modes)
- Step-by-step pipeline: `forge plan` → `forge design` → `forge build` → `forge review`
- `forge sprint` — full pipeline with human gates between phases
- `forge init` — initialize project with framework/model selection
- `forge status` — show sprint progress
- `forge fix` — targeted bug fixes and small changes
- Next.js support with App Router, Tailwind CSS, shadcn/ui
- Storybook design previews with CSF3 format
- Git integration with per-story commits, tags, and snapshots
- `.forge/` directory for state management (plan.json, state.json, snapshots/)
