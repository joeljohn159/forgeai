// ============================================================
// forge resume — Resume an interrupted sprint
// Picks up from the last completed story and continues.
// ============================================================

import chalk from "chalk";
import inquirer from "inquirer";
import fs from "fs";
import path from "path";
import { stateManager } from "../../state/index.js";
import { AutoPipeline } from "../../core/pipeline/auto.js";
import type { Plan, Story } from "../../types/plan.js";

export async function resumeCommand(options: {
  sandbox?: boolean;
  quiet?: boolean;
  mute?: boolean;
  skipDesign?: boolean;
}) {
  // Validate working directory exists and is accessible (prevents EPERM uv_cwd)
  let workingDir: string;
  try {
    workingDir = process.cwd();
  } catch {
    // CWD was deleted (e.g., by a prior interrupted build). Fall back to home dir
    // and look for the project from the forge state files.
    const home = process.env.HOME || process.env.USERPROFILE || "/tmp";
    process.chdir(home);
    console.log(chalk.yellow("\n  Working directory no longer exists."));
    console.log(chalk.dim(`  Falling back to: ${home}`));
    console.log(chalk.dim("  Please cd to your project directory and retry.\n"));
    return;
  }

  const config = await stateManager.getConfig();
  if (!config) {
    console.log(chalk.red("\n  Forge not initialized. Run: forge init\n"));
    return;
  }

  const plan = await stateManager.getPlan();
  if (!plan) {
    console.log(chalk.red("\n  No sprint plan found. Nothing to resume.\n"));
    console.log(chalk.dim('  Start a new sprint: forge auto "description"\n'));
    return;
  }

  const state = await stateManager.getState();
  const allStories = plan.epics.flatMap((e) => e.stories);

  // Count status
  const done = allStories.filter((s) => s.status === "done").length;
  const blocked = allStories.filter((s) => s.status === "blocked").length;
  const remaining = allStories.filter(
    (s) => s.status !== "done" && s.status !== "blocked"
  );

  if (remaining.length === 0 && blocked === 0) {
    console.log(chalk.green("\n  Sprint is already complete. All stories done.\n"));
    return;
  }

  // Show current state
  console.log(chalk.bold("\n  Resuming sprint"));
  console.log(chalk.dim(`  ${plan.project} · ${plan.framework}`));
  console.log(chalk.dim(`  Phase: ${state.currentPhase}`));
  console.log(
    chalk.dim(`  Progress: ${done}/${allStories.length} done`) +
      (blocked > 0 ? chalk.red(` · ${blocked} blocked`) : "")
  );
  console.log("");

  // Show what's remaining
  if (remaining.length > 0) {
    console.log(chalk.dim("  Remaining stories:"));
    for (const story of remaining) {
      const icon = story.status === "building" ? chalk.yellow("◑") :
        story.status === "reviewing" ? chalk.magenta("◕") :
        story.status === "designing" ? chalk.blue("◐") :
        chalk.dim("○");
      console.log(`    ${icon} ${story.title} ${chalk.dim(`(${story.status})`)}`);
    }
    console.log("");
  }

  // Show blocked stories
  if (blocked > 0) {
    const blockedStories = allStories.filter((s) => s.status === "blocked");
    console.log(chalk.red("  Blocked stories:"));
    for (const story of blockedStories) {
      console.log(`    ${chalk.red("✕")} ${story.title}`);
    }
    console.log("");
  }

  // Confirm
  const { action } = await inquirer.prompt([
    {
      type: "list",
      name: "action",
      message: "What would you like to do?",
      choices: [
        { name: `Resume (${remaining.length} stories left)`, value: "resume" },
        ...(blocked > 0
          ? [{ name: `Retry blocked stories (${blocked})`, value: "retry" }]
          : []),
        { name: "Cancel", value: "cancel" },
      ],
    },
  ]);

  if (action === "cancel") {
    console.log(chalk.dim("  Cancelled.\n"));
    return;
  }

  // Reset blocked stories to "planned" if retrying
  if (action === "retry") {
    for (const story of allStories) {
      if (story.status === "blocked") {
        story.status = "planned";
      }
    }
    await stateManager.savePlan(plan);
  }

  // Reset in-progress stories (building/designing) to their previous state
  for (const story of allStories) {
    if (story.status === "building") {
      story.status = story.designApproved ? "design-approved" : "planned";
    }
    if (story.status === "designing") {
      story.status = "planned";
    }
  }
  await stateManager.savePlan(plan);

  // Run the pipeline — it will skip stories that are already done
  const pipeline = new AutoPipeline(config, {
    sandbox: options.sandbox !== false,
    quiet: options.quiet ?? false,
    mute: options.mute ?? false,
    skipDesign: options.skipDesign ?? false,
  });

  const result = await pipeline.resume(plan);

  if (!result.success) {
    process.exitCode = 1;
  }
}
