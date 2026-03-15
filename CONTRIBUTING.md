# Contributing to ForgeAI

Thanks for your interest in contributing. This guide covers everything you need to get started.

<br/>

## Getting Started

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/forgeai.git
cd forgeai

# Install dependencies
npm install

# Build
npm run build

# Link globally so you can test with the `forge` command
npm link
```

After making changes in `src/`, run `npm run build` to recompile. The linked `forge` command picks up the new build immediately.

<br/>

## Development Workflow

### Branch Naming

```
feat/short-description       # New feature
fix/short-description        # Bug fix
docs/short-description       # Documentation only
refactor/short-description   # Code restructuring (no behavior change)
```

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add parallel execution for design phase
fix: resolve merge conflicts when stories share config files
docs: update README with new CLI flags
refactor: extract buildSingleStory into reusable method
chore: bump typescript to 5.5
```

Keep the first line under 72 characters. Add a body if the change needs explanation.

### Pull Requests

1. Create a branch from `main`
2. Make your changes
3. Run `npm run build` and `npx tsc --noEmit` — both must pass with zero errors
4. Push your branch and open a PR
5. Write a clear description of what changed and why

<br/>

## Project Structure

```
src/
├── cli/                  # Commander CLI — commands and entry point
│   ├── index.ts          # CLI registration
│   └── commands/         # One file per command (auto, init, plan, build, etc.)
│
├── core/                 # Business logic — agents, pipeline, git
│   ├── orchestrator/     # Orchestrator agent (plans, routes, reviews)
│   ├── worker/           # Worker agent (design, build, review, fix modes)
│   ├── pipeline/         # Pipeline orchestration (auto.ts is the main one)
│   ├── git/              # Git operations (branch, commit, tag)
│   └── utils/            # Shared utilities (sound notifications)
│
├── state/                # State manager (.forge/ directory read/write)
└── types/                # TypeScript type definitions
```

### Key Files

| File | What it does |
|------|-------------|
| `src/core/pipeline/auto.ts` | The autonomous pipeline — timer, parallel execution, review gates, README generation, deploy |
| `src/core/worker/index.ts` | Worker agent — runs Claude Agent SDK queries with mode-specific prompts and tool permissions |
| `src/core/orchestrator/index.ts` | Orchestrator agent — generates plans, crafts prompts, routes user input |
| `src/core/worker/prompts/index.ts` | System prompts for each worker mode (design, build, review, fix) |
| `src/cli/commands/auto.ts` | CLI command for `forge auto` — auth check, flag parsing |
| `src/types/plan.ts` | All TypeScript types (Story, Plan, Config, State, etc.) |

<br/>

## What to Work On

### Good First Issues

- Add `--verbose` flag to show full agent output (not just tool summaries)
- Add story count and estimated time to the plan display
- Improve error messages when Claude Agent SDK calls fail
- Add `.forge/` to auto-generated `.gitignore` during `forge init`

### Medium Complexity

- Implement `forge history` — show a timeline of all tags and snapshots
- Implement `forge undo` — rollback using snapshots in `.forge/snapshots/`
- Add React (Vite) adapter alongside the existing Next.js adapter
- Support user-uploaded reference images in the design phase

### Larger Features

- Web dashboard for viewing sprint progress
- `forge map` — browser-based Git visualization
- Plugin system for custom framework adapters
- Multiple LLM provider support

<br/>

## Code Guidelines

### TypeScript

- Strict mode — no `any`, no `ts-ignore`, no `ts-expect-error`
- Use explicit return types on exported functions
- Prefer `interface` over `type` for object shapes
- Use `const` by default, `let` only when reassignment is needed

### Style

- Keep files under 200 lines where possible
- One export per file for core modules
- Use early returns to reduce nesting
- No commented-out code in commits

### Testing

```bash
npm run build          # Must succeed
npx tsc --noEmit       # Must have zero errors
```

We don't have a test suite yet. If you want to add one, we use [Vitest](https://vitest.dev/) (already in devDependencies). Tests in `__tests__/` directories alongside the source files they test.

<br/>

## Architecture Decisions

A few things that might not be obvious:

**Why two agents instead of four?**
Separate agents lose context at every handoff. Two agents (Orchestrator + Worker) preserve context better. The Worker switches modes via system prompt, not by spawning a new agent.

**Why build on main instead of feature branches?**
In a greenfield project, every story creates overlapping config files (package.json, tsconfig, tailwind.config, etc.). Feature branches cause merge conflicts. Building on main with per-story commits and tags gives the same rollback capability without the conflicts.

**Why skip design in auto mode?**
The design phase generates Storybook previews for human review. In autonomous mode, nobody is reviewing them. Skipping it (`--skip-design`) saves significant time without affecting build quality.

**Why per-mode turn limits?**
Without caps, agents can loop indefinitely on edge cases (e.g., a build error they can't solve). Mode-specific limits (`build: 50`, `review: 20`, `fix: 15`) let the agent work thoroughly while preventing runaway usage.

<br/>

## Reporting Issues

Open an issue on [GitHub](https://github.com/joeljohn159/forgeai/issues) with:

- What you expected to happen
- What actually happened
- Steps to reproduce
- Terminal output (if applicable)
- Node version (`node --version`)
- OS

<br/>

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
