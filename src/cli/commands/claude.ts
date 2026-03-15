// ============================================================
// forge claude — Launch Claude Code CLI in the current project
// Reuses existing session if available.
// ============================================================

import chalk from "chalk";
import { spawn } from "child_process";

export async function claudeCommand() {
  console.log(chalk.bold("\n  forge") + chalk.dim(" claude\n"));

  // Detect which command is available: claude or npx @anthropic-ai/claude-code
  const cmd = await findClaudeCLI();

  if (!cmd) {
    console.log(chalk.red("  Claude Code CLI not found.\n"));
    console.log(chalk.dim("  Install it with:"));
    console.log(chalk.white("    npm install -g @anthropic-ai/claude-code"));
    console.log(chalk.dim("  Then log in:"));
    console.log(chalk.white("    claude login\n"));
    return;
  }

  console.log(chalk.dim(`  Starting Claude Code...\n`));

  const isWindows = process.platform === "win32";
  const child = spawn(cmd.cmd, cmd.args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: isWindows,
    // On Windows, use shell mode to resolve commands from PATH
  });

  child.on("error", (err) => {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      console.log(chalk.red("\n  Claude Code CLI not found in PATH."));
      console.log(chalk.dim("  Install: npm install -g @anthropic-ai/claude-code\n"));
    } else {
      console.log(chalk.red(`\n  Failed to start Claude: ${err.message}\n`));
    }
  });

  // Don't exit the parent — let Claude take over the terminal
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.log(chalk.dim(`\n  Claude exited with code ${code}\n`));
    }
  });
}

async function findClaudeCLI(): Promise<{ cmd: string; args: string[] } | null> {
  const { execSync } = await import("child_process");
  const isWindows = process.platform === "win32";

  // Try 'claude' directly
  try {
    const whichCmd = isWindows ? "where claude" : "which claude";
    execSync(whichCmd, { stdio: "ignore" });
    return { cmd: "claude", args: [] };
  } catch {
    // Not found globally
  }

  // Try npx
  try {
    const whichCmd = isWindows ? "where npx" : "which npx";
    execSync(whichCmd, { stdio: "ignore" });
    return { cmd: "npx", args: ["@anthropic-ai/claude-code"] };
  } catch {
    // npx not available
  }

  return null;
}
