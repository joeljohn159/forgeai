// ============================================================
// forge start — Start the dev server for the current project
// Auto-detects framework from forge.config.json or project files
// Works cross-platform (macOS, Linux, Windows)
// ============================================================

import chalk from "chalk";
import { spawn } from "child_process";
import { existsSync, readFileSync } from "fs";
import path from "path";
import { stateManager } from "../../state/index.js";
import { getAdapter, refreshAdapters } from "../../core/adapters/index.js";

export async function startCommand() {
  console.log(chalk.bold("\n  forge") + chalk.dim(" start\n"));

  let devCommand: string | null = null;
  let label = "Project";

  // Try forge config first
  const config = await stateManager.getConfig();
  if (config) {
    try {
      await refreshAdapters();
      const adapter = getAdapter(config.framework);
      devCommand = adapter.devCommand;
      label = adapter.id === "generic" ? "Custom stack" : adapter.name;
    } catch {
      // Adapter loading failed — fall through to auto-detect
    }
  }

  // Always verify the command actually exists in package.json scripts
  // Adapters may return "npm run dev" as default even when no dev script exists
  const detected = detectDevCommand();
  if (detected) {
    devCommand = detected;
  } else if (devCommand) {
    // Adapter gave us a command — verify it if it's an npm script
    const npmMatch = devCommand.match(/^npm run (\S+)$/);
    if (npmMatch) {
      const scriptName = npmMatch[1];
      const pkgPath = path.join(process.cwd(), "package.json");
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (!pkg.scripts?.[scriptName]) {
          // Script doesn't exist — show available scripts
          devCommand = null;
        }
      } catch {
        devCommand = null;
      }
    }
  }

  if (!config && detected) {
    label = detectProjectType();
  }

  if (!devCommand) {
    console.log(chalk.red("  Could not detect how to start this project.\n"));

    // Show available scripts if package.json exists
    const pkgPath = path.join(process.cwd(), "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        const scripts = Object.keys(pkg.scripts || {});
        if (scripts.length > 0) {
          console.log(chalk.dim("  Available scripts in package.json:"));
          for (const s of scripts) {
            console.log(chalk.white(`    npm run ${s}`));
          }
          console.log("");
          return;
        }
      } catch { /* ignore */ }
    }

    console.log(chalk.dim("  Expected one of:"));
    console.log(chalk.dim("    - package.json with dev/start/serve script"));
    console.log(chalk.dim("    - manage.py (Django)"));
    console.log(chalk.dim("    - Cargo.toml (Rust)"));
    console.log(chalk.dim("    - go.mod (Go)"));
    console.log(chalk.dim("    - pubspec.yaml (Flutter)\n"));
    return;
  }

  console.log(chalk.dim(`  ${label} dev server`));
  console.log(chalk.dim(`  Running: ${devCommand}\n`));

  // Use shell on all platforms for consistent command resolution
  const child = spawn(devCommand, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: true,
  });

  child.on("error", (err) => {
    console.log(chalk.red(`\n  Failed to start: ${err.message}`));
    console.log(chalk.dim(`  Try running manually: ${devCommand}\n`));
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.log(chalk.red(`\n  Dev server exited with code ${code}\n`));
    }
  });
}

function detectDevCommand(): string | null {
  const pkgPath = path.join(process.cwd(), "package.json");

  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
      const scripts = pkg.scripts || {};

      if (scripts.dev) return "npm run dev";
      if (scripts.start) return "npm start";
      if (scripts.serve) return "npm run serve";
    } catch {
      // Malformed package.json — continue detection
    }
  }

  // Python / Django
  if (existsSync(path.join(process.cwd(), "manage.py"))) {
    return "python manage.py runserver";
  }

  // Rust
  if (existsSync(path.join(process.cwd(), "Cargo.toml"))) {
    return "cargo run";
  }

  // Go
  if (existsSync(path.join(process.cwd(), "go.mod"))) {
    return "go run .";
  }

  // Flutter
  if (existsSync(path.join(process.cwd(), "pubspec.yaml"))) {
    return "flutter run";
  }

  // Ruby / Rails
  if (existsSync(path.join(process.cwd(), "Gemfile"))) {
    if (existsSync(path.join(process.cwd(), "bin", "rails"))) {
      return "bundle exec rails server";
    }
    return "bundle exec ruby app.rb";
  }

  return null;
}

function detectProjectType(): string {
  if (existsSync(path.join(process.cwd(), "next.config.ts")) || existsSync(path.join(process.cwd(), "next.config.js")) || existsSync(path.join(process.cwd(), "next.config.mjs"))) return "Next.js";
  if (existsSync(path.join(process.cwd(), "nuxt.config.ts"))) return "Nuxt";
  if (existsSync(path.join(process.cwd(), "svelte.config.js"))) return "SvelteKit";
  if (existsSync(path.join(process.cwd(), "manage.py"))) return "Django";
  if (existsSync(path.join(process.cwd(), "Cargo.toml"))) return "Rust";
  if (existsSync(path.join(process.cwd(), "go.mod"))) return "Go";
  if (existsSync(path.join(process.cwd(), "pubspec.yaml"))) return "Flutter";
  return "Project";
}
