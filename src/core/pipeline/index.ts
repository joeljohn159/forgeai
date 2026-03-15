import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import type {
  Plan,
  Story,
  ForgeConfig,
  QueuedChange,
} from "../../types/plan.js";
import { Orchestrator } from "../orchestrator/index.js";
import { Worker, type WorkerProgressCallback } from "../worker/index.js";
import { GitManager } from "../git/index.js";
import { getAdapter } from "../adapters/index.js";
import { stateManager } from "../../state/index.js";

// ============================================================
// Pipeline Engine
// Manages the phase flow: plan > design > build > review
// with human review gates between each phase.
// Builds on main — no feature branches. Per-story commits + tags.
// ============================================================

const MAX_REGEN_ATTEMPTS = 5;

export class Pipeline {
  private orchestrator: Orchestrator;
  private worker: Worker;
  private git: GitManager;
  private config: ForgeConfig;
  private plan: Plan | null = null;
  private changeQueue: QueuedChange[] = [];

  constructor(config: ForgeConfig) {
    this.config = config;
    this.orchestrator = new Orchestrator(config);
    this.worker = new Worker(config, {});
    this.git = new GitManager();
  }

  // ── Full Sprint (all phases) ──────────────────────────────

  async runSprint(description: string): Promise<void> {
    console.log(chalk.bold("\n  forge") + chalk.dim(" sprint\n"));

    await this.git.ensureRepo();
    await this.git.ensureMainBranch();

    // Phase 1: Plan
    this.plan = await this.runPlanPhase(description);
    if (!this.plan) return;

    // Phase 2: Design (skip if framework doesn't support it)
    const adapter = getAdapter(this.config.framework);
    if (adapter.designSupport) {
      await this.runDesignPhase(this.plan);
    } else {
      console.log(chalk.dim(`\n  Design skipped (${adapter.name} — no Storybook support)\n`));
    }

    // Phase 3: Build
    await this.runBuildPhase(this.plan);

    // Phase 4: Review
    await this.runReviewPhase(this.plan);

    // Done
    console.log(chalk.dim("\n  ─────────────────────────────────"));
    console.log(chalk.bold("  Sprint complete\n"));
    console.log(chalk.dim("  Run your app and test it."));
    console.log(chalk.dim('  Use ' + chalk.white('forge fix "description"') + ' to make changes.'));
    console.log(chalk.dim("  Use " + chalk.white("forge undo") + " to revert.\n"));
  }

  // ── Phase 1: Plan ────────────────────────────────────────

  async runPlanPhase(description: string, attempt = 1): Promise<Plan | null> {
    if (attempt === 1) {
      console.log(chalk.bold("  Plan\n"));
    }

    const spinner = ora({ text: "Analyzing requirements...", indent: 2 }).start();

    let plan: Plan;
    try {
      plan = await this.orchestrator.generatePlan(description);
    } catch (err) {
      spinner.fail("Plan generation failed");
      console.log(chalk.red(`  ${err instanceof Error ? err.message : err}`));
      return null;
    }
    spinner.succeed("Plan generated");

    this.displayPlan(plan);

    // User gate
    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: "Action",
        choices: [
          { name: "Approve plan", value: "approve" },
          { name: "Edit (describe changes)", value: "edit" },
          { name: "Regenerate", value: "regen" },
          { name: "Cancel", value: "cancel" },
        ],
      },
    ]);

    switch (action) {
      case "approve":
        await stateManager.savePlan(plan);
        await stateManager.updatePhase("plan");
        await this.git.commitState("Sprint plan approved");
        await this.git.tag("forge/v0.0-plan");
        console.log(chalk.green("  Plan saved\n"));
        return plan;

      case "edit": {
        if (attempt >= MAX_REGEN_ATTEMPTS) {
          console.log(chalk.yellow(`  Max edit attempts (${MAX_REGEN_ATTEMPTS}) reached. Approving current plan.`));
          await stateManager.savePlan(plan);
          return plan;
        }
        const { changes } = await inquirer.prompt([
          { type: "input", name: "changes", message: "Describe changes:" },
        ]);
        console.log(chalk.dim("  Re-planning..."));
        return this.runPlanPhase(`${description}\n\nUser edits: ${changes}`, attempt + 1);
      }

      case "regen": {
        if (attempt >= MAX_REGEN_ATTEMPTS) {
          console.log(chalk.yellow(`  Max regeneration attempts (${MAX_REGEN_ATTEMPTS}) reached.`));
          return null;
        }
        return this.runPlanPhase(description, attempt + 1);
      }

      case "cancel":
        console.log(chalk.dim("  Cancelled."));
        return null;

      default:
        return null;
    }
  }

  // ── Phase 2: Design ──────────────────────────────────────

  async runDesignPhase(plan: Plan): Promise<void> {
    const uiStories = this.getStoriesByType(plan, ["ui", "fullstack"]);

    if (uiStories.length === 0) {
      console.log(chalk.dim("\n  No UI stories, skipping design.\n"));
      return;
    }

    console.log(chalk.bold(`\n  Design`) + chalk.dim(` · ${uiStories.length} stories\n`));

    for (const story of uiStories) {
      const spinner = ora({ text: story.title, indent: 4 }).start();

      const prompt = this.orchestrator.craftWorkerPrompt(story, "design", { plan });

      const result = await this.worker.run("design", prompt, {
        onProgress: (event) => {
          if (event.type === "tool_use") {
            spinner.text = event.content;
          }
        },
      });

      if (result.success) {
        spinner.succeed(story.title);
      } else {
        spinner.fail(story.title);
        console.log(chalk.red(`       ${result.errors.join(", ")}`));
        continue;
      }

      // User gate
      const adapter = getAdapter(this.config.framework);
      console.log(chalk.dim(`    Preview: http://localhost:${adapter.devPort}\n`));

      const { approval } = await inquirer.prompt([
        {
          type: "list",
          name: "approval",
          message: `Approve "${story.title}"?`,
          choices: [
            { name: "Approve", value: "approve" },
            { name: "Request changes", value: "change" },
            { name: "Skip", value: "skip" },
          ],
        },
      ]);

      if (approval === "approve") {
        story.designApproved = true;
        story.status = "design-approved";
        console.log(chalk.green(`    Approved\n`));
      } else if (approval === "change") {
        const { feedback } = await inquirer.prompt([
          { type: "input", name: "feedback", message: "Describe changes:" },
        ]);
        // Re-run design with feedback
        const fixResult = await this.worker.run("fix", `Revise design for "${story.title}": ${feedback}`);
        if (fixResult.success) {
          console.log(chalk.dim("    Revised.\n"));
        }
      }
    }

    await stateManager.savePlan(plan);
    await stateManager.updatePhase("design");
    await this.git.commitAll("forge: designs reviewed");
    await this.git.tag("forge/v0.1-designs");

    console.log(chalk.dim("  Design phase complete\n"));
  }

  // ── Phase 3: Build ───────────────────────────────────────

  async runBuildPhase(plan: Plan): Promise<void> {
    const buildableStories = this.getAllStories(plan).filter(
      (s) => s.status === "design-approved" || s.status === "planned"
    );

    if (buildableStories.length === 0) {
      console.log(chalk.dim("\n  No stories to build.\n"));
      return;
    }

    console.log(chalk.bold(`\n  Build`) + chalk.dim(` · ${buildableStories.length} stories\n`));

    for (const story of buildableStories) {
      const spinner = ora({ text: story.title, indent: 4 }).start();

      // Snapshot before building
      const headBefore = await this.git.getHead();
      await stateManager.saveSnapshot({
        action: "build",
        storyId: story.id,
        branch: "main",
        commitBefore: headBefore,
      });

      story.status = "building";
      await stateManager.savePlan(plan);

      const prompt = this.orchestrator.craftWorkerPrompt(story, "build", {
        plan,
        designMeta: story.designApproved ? { storyId: story.id } : undefined,
      });

      const result = await this.worker.run("build", prompt, {
        onProgress: (event) => {
          if (event.type === "tool_use") {
            spinner.text = event.content;
          }
        },
      });

      if (result.success) {
        await this.git.commitAll(`feat: ${story.title}`);
        story.status = "reviewing";
        spinner.succeed(story.title + chalk.dim(` · ${result.filesCreated.length} files`));
      } else {
        story.status = "blocked";
        spinner.fail(story.title);
        for (const error of result.errors) {
          console.log(chalk.red(`       ${error}`));
        }
      }

      await stateManager.savePlan(plan);
      await this.processQueue(plan);
    }

    await stateManager.updatePhase("build");
    console.log(chalk.dim("\n  Build phase complete\n"));
  }

  // ── Phase 4: Review ──────────────────────────────────────

  async runReviewPhase(plan: Plan): Promise<void> {
    const reviewableStories = this.getAllStories(plan).filter(
      (s) => s.status === "reviewing"
    );

    if (reviewableStories.length === 0) return;

    console.log(chalk.bold(`\n  Review`) + chalk.dim(` · ${reviewableStories.length} stories\n`));

    for (const story of reviewableStories) {
      const spinner = ora({ text: story.title, indent: 4 }).start();

      const prompt = this.orchestrator.craftWorkerPrompt(story, "review", {
        plan,
        designMeta: story.designApproved ? { storyId: story.id } : undefined,
      });

      let result;
      try {
        result = await this.worker.run("review", prompt);
      } catch (err) {
        spinner.fail(story.title + chalk.dim(" — review error"));
        console.log(chalk.red(`       ${err instanceof Error ? err.message : err}`));
        continue;
      }

      if (result.success) {
        const tagName = `forge/v0.${this.getNextTagNumber()}-${story.id}`;
        await this.git.tag(tagName);
        story.tags.push(tagName);
        story.status = "done";
        spinner.succeed(story.title + chalk.dim(` [${tagName}]`));
      } else {
        spinner.fail(story.title);
        console.log(chalk.dim(`       ${result.summary}`));
      }

      await stateManager.savePlan(plan);
    }

    await stateManager.updatePhase("review");
    console.log(chalk.dim("\n  Review phase complete\n"));
  }

  // ── Change Queue ─────────────────────────────────────────

  queueChange(change: QueuedChange): void {
    this.changeQueue.push(change);
    console.log(chalk.dim(`  Queued: "${change.message}"`));
  }

  private async processQueue(plan: Plan): Promise<void> {
    if (this.changeQueue.length === 0) return;

    console.log(chalk.dim(`\n  Processing ${this.changeQueue.length} queued changes...\n`));

    for (const change of this.changeQueue) {
      const decision = await this.orchestrator.routeUserInput(
        change.message,
        await stateManager.getState()
      );

      if (decision.action === "route-to-worker" && decision.prompt) {
        const mode = decision.workerMode || "fix";
        const spinner = ora({ text: change.message, indent: 4 }).start();
        const result = await this.worker.run(mode, decision.prompt);
        if (result.success) {
          await this.git.commitAll(`fix: ${change.message}`);
          spinner.succeed(change.message);
        } else {
          spinner.fail(change.message);
        }
      }
    }

    this.changeQueue = [];
  }

  // ── Helpers ──────────────────────────────────────────────

  private displayPlan(plan: Plan): void {
    console.log(chalk.bold(`\n  ${plan.project}`) + chalk.dim(` · ${plan.framework}`));
    console.log(chalk.dim(`  ${plan.description}\n`));

    for (const epic of plan.epics) {
      console.log(chalk.dim(`  ${epic.title}`));
      for (const story of epic.stories) {
        const tag = story.type === "ui" ? "ui" : story.type === "backend" ? "api" : "full";
        console.log(`    ${chalk.dim(`[${tag}]`)} ${story.id} ${chalk.dim("—")} ${story.title}`);
      }
      console.log("");
    }
  }

  private getAllStories(plan: Plan): Story[] {
    return plan.epics.flatMap((epic) => epic.stories);
  }

  private getStoriesByType(plan: Plan, types: string[]): Story[] {
    return this.getAllStories(plan).filter((s) => types.includes(s.type));
  }

  private tagCounter = 2;
  private getNextTagNumber(): number {
    return this.tagCounter++;
  }
}
