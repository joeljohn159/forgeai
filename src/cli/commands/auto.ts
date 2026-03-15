// ============================================================
// forge auto — Fully autonomous "Lead Agent" mode
// ============================================================

import chalk from "chalk";
import inquirer from "inquirer";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import path from "path";
import { stateManager } from "../../state/index.js";
import { AutoPipeline } from "../../core/pipeline/auto.js";
import { loadAndValidateConfig } from "../../core/utils/config.js";
import { getAdapter } from "../../core/adapters/index.js";
import {
  parseAttachments,
  stageAttachments,
  formatAttachmentList,
  type Attachment,
} from "../../core/utils/attachments.js";

function checkClaudeAuth(): { ok: boolean; reason: string } {
  try {
    const finder = process.platform === "win32" ? "where" : "which";
    execSync(`${finder} claude`, { stdio: "ignore" });
  } catch {
    return { ok: false, reason: "Claude Code CLI is not installed." };
  }

  const claudeDir = path.join(homedir(), ".claude");
  if (!existsSync(claudeDir)) {
    return { ok: false, reason: "Claude Code is installed but not logged in." };
  }

  return { ok: true, reason: "" };
}

export async function autoCommand(
  description: string | undefined,
  options: {
    sandbox?: boolean;
    yes?: boolean;
    quiet?: boolean;
    allowNetwork?: string;
    mute?: boolean;
    deploy?: boolean;
    skipDesign?: boolean;
  }
) {
  // Auth check
  const auth = checkClaudeAuth();
  if (!auth.ok) {
    console.log(chalk.red(`\n  ${auth.reason}\n`));
    console.log(chalk.bold("  Forge requires Claude Code to run.\n"));
    console.log(chalk.dim("  Who can use it:"));
    console.log(chalk.dim("    Anyone with a Claude Max, Team, or Enterprise subscription.\n"));
    console.log(chalk.dim("  Setup:"));
    console.log(chalk.dim("    1. npm install -g @anthropic-ai/claude-code"));
    console.log(chalk.dim("    2. claude login"));
    console.log(chalk.dim('    3. forge auto "your app idea"\n'));
    console.log(chalk.dim("  Diagnose: forge doctor\n"));
    return;
  }

  // Config validation
  const rawConfig = await stateManager.getConfig();
  if (!rawConfig) {
    console.log(chalk.red("\n  Forge not initialized. Run: forge init\n"));
    return;
  }
  const config = loadAndValidateConfig(rawConfig);
  if (!config) return;

  // Auto-skip design for frameworks that don't support it
  const adapter = getAdapter(config.framework);
  const skipDesign = options.skipDesign || !adapter.designSupport;

  if (!description) {
    console.log(chalk.dim("  Tip: drag & drop files here to attach references\n"));
    const { desc } = await inquirer.prompt([
      {
        type: "input",
        name: "desc",
        message: "What do you want to build?",
        validate: (input: string) =>
          input.length > 10 || "Please provide a more detailed description",
      },
    ]);
    description = desc;
  }

  // Parse attachments from description (drag-and-drop file paths)
  const parsed = parseAttachments(description!);
  let attachments: Attachment[] = [];

  if (parsed.attachments.length > 0) {
    attachments = parsed.attachments;
    description = parsed.description;

    // Stage files to .forge/attachments/
    stageAttachments(attachments);

    // Show clean attachment list
    console.log(chalk.dim("\n  Attachments:"));
    console.log(chalk.cyan(formatAttachmentList(attachments)));
    console.log("");
  }

  const allowedDomains = options.allowNetwork
    ? options.allowNetwork.split(",").map((d) => d.trim())
    : undefined;

  const pipeline = new AutoPipeline(config, {
    sandbox: options.sandbox !== false,
    yes: options.yes ?? false,
    quiet: options.quiet ?? false,
    mute: options.mute ?? false,
    deploy: options.deploy ?? false,
    skipDesign,
    allowedDomains,
    attachments,
  });

  const result = await pipeline.run(description!);

  if (!result.success) {
    process.exitCode = 1;
  }
}
