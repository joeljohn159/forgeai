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
import { resumeCommand } from "./commands/resume.js";
import { mapCommand } from "./commands/map.js";
import { diffCommand } from "./commands/diff.js";
import { doctorCommand } from "./commands/doctor.js";
import { cleanCommand } from "./commands/clean.js";
import { exportCommand } from "./commands/export.js";
import { historyCommand, checkoutCommand } from "./commands/history.js";
import { startCommand } from "./commands/start.js";
import { pushCommand } from "./commands/push.js";
import { upgradeCommand } from "./commands/upgrade.js";

const program = new Command();

program
  .name("forge")
  .description(
    chalk.bold("Forge") +
      " — AI Development Orchestration Framework\n" +
      "  Structured multi-agent pipeline: plan → design → build → review"
  )
  .version("1.4.0");

// ── Pipeline Commands ────────────────────────────────────

program
  .command("auto [description]")
  .description("Fully autonomous mode — plan, build, and review in one command")
  .option("--no-sandbox", "Disable sandbox (not recommended)")
  .option("-y, --yes", "Skip all confirmation prompts (auto-approve everything)")
  .option("-q, --quiet", "Hide live agent output, show spinners only")
  .option("--allow-network <domains>", "Comma-separated allowed network domains")
  .option("--mute", "Suppress notification sounds")
  .option("--deploy", "Configure GitHub Pages deployment after build")
  .option("--skip-design", "Skip design phase (faster, no Storybook previews)")
  .action(autoCommand);

program
  .command("resume")
  .description("Resume an interrupted sprint from where it left off")
  .option("--no-sandbox", "Disable sandbox")
  .option("-y, --yes", "Skip all confirmation prompts (auto-approve everything)")
  .option("-q, --quiet", "Spinners only")
  .option("--mute", "Suppress sounds")
  .option("--skip-design", "Skip design phase")
  .action(resumeCommand);

program
  .command("sprint [description]")
  .description("Run full pipeline with human gates between phases")
  .action(sprintCommand);

// ── Step-by-Step Commands ────────────────────────────────

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
  .command("start")
  .description("Start the dev server for the current project")
  .action(startCommand);

program
  .command("push")
  .description("Push project to GitHub (commits + tags)")
  .action(pushCommand);

// ── Utilities ────────────────────────────────────────────

program
  .command("status")
  .description("Show current sprint state and progress")
  .action(statusCommand);

program
  .command("map")
  .description("Visual sprint map with story status and dependencies")
  .action(mapCommand);

program
  .command("diff <v1> [v2]")
  .description("Show changes between two versions or tags")
  .action(diffCommand);

program
  .command("fix <description>")
  .description("Fix a bug or make a small change")
  .option("-i, --image <path>", "Attach a screenshot for visual context")
  .action(fixCommand);

program
  .command("undo")
  .description("Revert the last agent action")
  .option("-n, --steps <number>", "Number of commits to show", "10")
  .action(undoCommand);

program
  .command("history")
  .description("Show version timeline, checkpoints, and activity log")
  .action(historyCommand);

program
  .command("checkout <version>")
  .description("Jump to a specific version or checkpoint")
  .action(checkoutCommand);

program
  .command("export")
  .description("Export sprint plan as markdown")
  .option("-o, --output <path>", "Output file path", "sprint-plan.md")
  .action(exportCommand);

program
  .command("clean")
  .description("Reset sprint state (keeps config)")
  .option("-f, --force", "Skip confirmation prompt")
  .option("--snapshots", "Only clean snapshots")
  .action(cleanCommand);

program
  .command("doctor")
  .description("Diagnose setup issues and check system requirements")
  .action(doctorCommand);

program
  .command("upgrade")
  .description("Upgrade Forge to the latest version")
  .action(upgradeCommand);

// ── Parse ─────────────────────────────────────────────────

program.parse();
