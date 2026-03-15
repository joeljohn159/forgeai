// ============================================================
// forge start — Start the dev server for the current project
// Auto-detects framework from forge.config.json
// ============================================================

import chalk from "chalk";
import { spawn } from "child_process";
import { stateManager } from "../../state/index.js";
import { getAdapter } from "../../core/adapters/index.js";

export async function startCommand() {
  const config = await stateManager.getConfig();
  if (!config) {
    console.log(chalk.red("\n  Forge not initialized. Run: forge init\n"));
    return;
  }

  const adapter = getAdapter(config.framework);
  let devCommand = adapter.devCommand;

  // For generic adapter, try to detect the dev command from package.json
  if (adapter.id === "generic") {
    try {
      const { readFileSync } = await import("fs");
      const pkg = JSON.parse(readFileSync("package.json", "utf-8"));
      if (pkg.scripts?.dev) {
        devCommand = "npm run dev";
      } else if (pkg.scripts?.start) {
        devCommand = "npm start";
      } else if (pkg.scripts?.serve) {
        devCommand = "npm run serve";
      }
    } catch {
      // No package.json — try common alternatives
      const { existsSync } = await import("fs");
      if (existsSync("manage.py")) {
        devCommand = "python manage.py runserver";
      } else if (existsSync("Cargo.toml")) {
        devCommand = "cargo run";
      } else if (existsSync("go.mod")) {
        devCommand = "go run .";
      }
    }
  }

  const [cmd, ...args] = devCommand.split(" ");

  console.log(chalk.bold("\n  forge") + chalk.dim(" start"));
  console.log(chalk.dim(`  ${adapter.id === "generic" ? "Custom stack" : adapter.name} dev server\n`));
  console.log(chalk.dim(`  Running: ${devCommand}\n`));

  const child = spawn(cmd, args, {
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
