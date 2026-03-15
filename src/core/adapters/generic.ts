import type { FrameworkAdapter } from "./base.js";

export const genericAdapter: FrameworkAdapter = {
  id: "generic",
  name: "Custom Stack",
  language: "typescript", // default, but prompts tell the agent to auto-detect
  scaffoldCommands: [],
  buildCommand: "AUTO_DETECT",
  lintCommand: "AUTO_DETECT",
  typecheckCommand: "AUTO_DETECT",
  devCommand: "npm run dev",
  devPort: 3000,
  designSupport: false,
  packageManager: "npm",
  requiredFiles: [],

  buildPromptAdditions: `
CUSTOM TECH STACK — IMPORTANT:
This project uses a tech stack chosen by the user. You MUST auto-detect everything.

STEP 1 — DETECT THE STACK:
Before writing ANY code, read these files (whichever exist):
- package.json (Node.js/JS/TS projects)
- requirements.txt / pyproject.toml / Pipfile (Python projects)
- go.mod (Go projects)
- Cargo.toml (Rust projects)
- pom.xml / build.gradle (Java/Kotlin projects)
- pubspec.yaml (Flutter/Dart projects)
- Gemfile (Ruby projects)
- composer.json (PHP projects)
- Any existing source files to understand patterns

STEP 2 — FOLLOW EXISTING CONVENTIONS:
- If the project already has code, match its style exactly (naming, file structure, patterns)
- If starting from scratch, use the standard project structure for the detected tech stack
- Use the package manager the project already uses (npm, yarn, pnpm, pip, poetry, cargo, go, etc.)

STEP 3 — BUILD VERIFICATION:
- Detect the correct build/lint/test commands from the project config
- For Node.js: check package.json "scripts" for build, lint, typecheck commands
- For Python: use pytest, flake8/ruff, mypy if configured
- For Go: use go build, go vet, go test
- For Rust: use cargo build, cargo clippy, cargo test
- If no build script exists, skip the build step — do NOT fail
- If a command does not exist or is not configured, skip it gracefully

STEP 4 — SCAFFOLDING:
- If the project directory is empty, scaffold the project using the standard tooling for the stack
  (e.g., npm init, cargo init, go mod init, django-admin startproject, etc.)
- Install dependencies after scaffolding
`.trim(),

  designPromptAdditions: "",

  fileStructure: `
(auto-detected — read the project's existing files to determine structure)
`.trim(),
};
