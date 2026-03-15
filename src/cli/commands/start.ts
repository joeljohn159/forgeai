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
  const [cmd, ...args] = adapter.devCommand.split(" ");

  console.log(chalk.bold("\n  forge") + chalk.dim(" start"));
  console.log(chalk.dim(`  ${adapter.name} dev server on port ${adapter.devPort}\n`));
  console.log(chalk.dim(`  Running: ${adapter.devCommand}\n`));

  const child = spawn(cmd, args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: true,
  });

  child.on("error", (err) => {
    console.log(chalk.red(`\n  Failed to start: ${err.message}`));
    console.log(chalk.dim(`  Try running manually: ${adapter.devCommand}\n`));
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.log(chalk.red(`\n  Dev server exited with code ${code}\n`));
    }
  });
}
