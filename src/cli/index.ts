#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { initCommand } from "./commands/init.js";
import { planCommand } from "./commands/plan.js";
import { designCommand } from "./commands/design.js";
import { buildCommand } from "./commands/build.js";
import { reviewCommand } from "./commands/review.js";
import { sprintCommand } from "./commands/sprint.js";
import { statusCommand } from "./commands/status.js";
import { fixCommand } from "./commands/fix.js";
import { undoCommand } from "./commands/undo.js";
import { autoCommand } from "./commands/auto.js";
import { historyCommand, checkoutCommand } from "./commands/history.js";

const program = new Command();

program
  .name("forge")
  .description(
    chalk.bold("Forge") +
      " — AI Development Orchestration Framework\n" +
      "  Structured multi-agent pipeline: plan → design → build → review"
  )
  .version("0.2.0");

// ── Commands ──────────────────────────────────────────────

program
  .command("init")
  .description("Initialize Forge in the current project")
  .option("-f, --framework <framework>", "Framework (nextjs, react, django)")
  .option("--no-storybook", "Skip Storybook setup")
  .action(initCommand);

program
  .command("plan [description]")
  .description("Generate a sprint plan from a project description")
  .option("--regen", "Regenerate plan from scratch")
  .action(planCommand);

program
  .command("design")
  .description("Generate and review design previews in Storybook")
  .option("-s, --story <storyId>", "Design a specific story only")
  .option("--import <path>", "Import design references (screenshots, mockups)")
  .action(designCommand);

program
  .command("build")
  .description("Build stories sequentially with the Worker agent")
  .option("-s, --story <storyId>", "Build a specific story only")
  .action(buildCommand);

program
  .command("review")
  .description("Run QA review on completed stories")
  .option("-s, --story <storyId>", "Review a specific story only")
  .action(reviewCommand);

program
  .command("sprint [description]")
  .description("Run the full pipeline: plan → design → build → review")
  .action(sprintCommand);

program
  .command("status")
  .description("Show current sprint state and progress")
  .action(statusCommand);

program
  .command("fix <description>")
  .description("Fix a bug or make a small change")
  .action(fixCommand);

program
  .command("undo")
  .description("Revert the last agent action")
  .option("-n, --steps <number>", "Number of commits to show", "10")
  .action(undoCommand);

program
  .command("auto [description]")
  .description("Fully autonomous mode — Lead Agent runs the entire sprint")
  .option("--no-sandbox", "Disable sandbox (not recommended)")
  .option("-q, --quiet", "Hide live agent output, show spinners only")
  .option("--allow-network <domains>", "Comma-separated allowed network domains")
  .option("--mute", "Suppress notification sounds")
  .option("--deploy", "Configure GitHub Pages deployment after build")
  .option("--skip-design", "Skip design phase (faster, no Storybook previews)")
  .action(autoCommand);

program
  .command("history")
  .description("Show version timeline, checkpoints, and activity log")
  .action(historyCommand);

program
  .command("checkout <version>")
  .description("Jump to a specific version or checkpoint")
  .action(checkoutCommand);

// ── Parse ─────────────────────────────────────────────────

program.parse();
