import chalk from "chalk";
import ora, { type Ora } from "ora";
import readline from "readline";
import inquirer from "inquirer";
import type {
  Plan,
  Story,
  ForgeConfig,
  QueuedChange,
} from "../../types/plan.js";
import { Orchestrator } from "../orchestrator/index.js";
import { Worker, type WorkerProgressCallback, type WorkerUsage } from "../worker/index.js";
import { GitManager } from "../git/index.js";
import { stateManager } from "../../state/index.js";
import { playSound } from "../utils/sound.js";

// ============================================================
// Autonomous Pipeline
// Runs plan > design > build > review with no human gates
// (except a review gate after build).
// Shows live progress with elapsed timer.
// Type messages anytime — queued and handled between stories.
// Independent stories are built in parallel.
// ============================================================

export interface AutoPipelineOptions {
  workingDir?: string;
  sandbox?: boolean;
  allowedDomains?: string[];
  quiet?: boolean;
  mute?: boolean;
  deploy?: boolean;
  skipDesign?: boolean;
}

export class AutoPipeline {
  private orchestrator: Orchestrator;
  private worker: Worker;
  private git: GitManager;
  private config: ForgeConfig;
  private plan: Plan | null = null;
  private options: AutoPipelineOptions;
  private chatQueue: QueuedChange[] = [];
  private rl: readline.Interface | null = null;
  private startTime: number = 0;
  private totalUsage: WorkerUsage = { inputTokens: 0, outputTokens: 0, costUsd: 0, durationMs: 0 };

  constructor(config: ForgeConfig, options: AutoPipelineOptions = {}) {
    this.config = config;
    this.options = options;
    this.orchestrator = new Orchestrator(config);
    this.worker = new Worker(config, {
      sandbox: options.sandbox ?? true,
      workingDir: options.workingDir,
      allowedDomains: options.allowedDomains,
    });
    this.git = new GitManager();
  }

  // ── Full Autonomous Sprint ─────────────────────────────────

  async run(description: string): Promise<{ success: boolean; plan: Plan | null; errors: string[] }> {
    const errors: string[] = [];
    this.startTime = Date.now();

    console.log(chalk.bold("\n  forge") + chalk.dim(" auto"));
    console.log(chalk.dim(`  sandbox ${this.options.sandbox !== false ? "on" : "off"} · type a message anytime to queue feedback\n`));

    this.startChatListener();
    await this.git.ensureRepo();
    await this.git.ensureMainBranch();

    // ── Plan ───────────────────────────────────────────────
    const planSpinner = ora({ text: `${this.elapsed()} Planning...`, indent: 2 }).start();
    try {
      this.plan = await this.orchestrator.generatePlan(description);
      planSpinner.succeed(`${this.elapsed()} Plan ready`);
      this.displayPlan(this.plan);
      await stateManager.savePlan(this.plan);
      await stateManager.updatePhase("plan");
      await this.git.commitState("Sprint plan");
      await this.git.tag("forge/v0.0-plan");
    } catch (err) {
      planSpinner.fail(`${this.elapsed()} Planning failed`);
      const msg = err instanceof Error ? err.message : String(err);
      console.log(chalk.red(`\n  ${msg}`));
      if (err instanceof Error && err.stack) {
        console.log(chalk.dim(`  ${err.stack.split("\n").slice(1, 3).join("\n  ")}`));
      }
      this.stopChatListener();
      return { success: false, plan: null, errors: [`Plan: ${msg}`] };
    }

    this.showInputHint();

    // ── Design ─────────────────────────────────────────────
    if (this.options.skipDesign) {
      // Mark all UI stories as design-approved so build can proceed
      for (const story of this.getAllStories(this.plan)) {
        if (story.status === "planned") {
          story.designApproved = false;
          story.status = "planned";
        }
      }
      console.log(chalk.dim(`\n  Design skipped (--skip-design)\n`));
    } else {
      try { await this.runDesignPhase(this.plan); }
      catch (err) { errors.push(`Design: ${err instanceof Error ? err.message : err}`); }
    }

    // ── Build ──────────────────────────────────────────────
    try { await this.runBuildPhase(this.plan); }
    catch (err) { errors.push(`Build: ${err instanceof Error ? err.message : err}`); }

    // ── README ─────────────────────────────────────────────
    try { await this.generateReadme(this.plan); }
    catch (err) { errors.push(`README: ${err instanceof Error ? err.message : err}`); }

    // ── Review Gate ────────────────────────────────────────
    const gateAction = await this.reviewGate();

    if (gateAction === "abort") {
      this.stopChatListener();
      this.printSummary(errors);
      await stateManager.updatePhase("done");
      return { success: false, plan: this.plan, errors: [...errors, "Aborted by user"] };
    }

    // ── Review ─────────────────────────────────────────────
    if (gateAction !== "skip") {
      try { await this.runReviewPhase(this.plan); }
      catch (err) { errors.push(`Review: ${err instanceof Error ? err.message : err}`); }
    }

    // ── Deploy (optional) ──────────────────────────────────
    if (this.options.deploy) {
      try { await this.runDeployPhase(this.plan); }
      catch (err) { errors.push(`Deploy: ${err instanceof Error ? err.message : err}`); }
    }

    this.stopChatListener();
    this.printSummary(errors);
    await stateManager.updatePhase("done");

    const allStories = this.getAllStories(this.plan);
    const failedCount = allStories.filter((s) => s.status === "blocked").length;
    return { success: errors.length === 0 && failedCount === 0, plan: this.plan, errors };
  }

  // ── Elapsed Timer ─────────────────────────────────────────

  private elapsed(): string {
    const sec = Math.floor((Date.now() - this.startTime) / 1000);
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return chalk.dim(`[${m}:${s.toString().padStart(2, "0")}]`);
  }

  // ── Progress Helper with Timer ────────────────────────────

  private makeProgress(
    spinner: Ora,
    storyTitle: string
  ): { onProgress: WorkerProgressCallback; stop: () => void } {
    if (this.options.quiet) {
      return { onProgress: () => {}, stop: () => {} };
    }

    let lastDetail = "";

    const update = () => {
      if (!spinner.isSpinning) return;
      const prefix = this.elapsed();
      spinner.text = `${prefix} ${storyTitle}${lastDetail ? " " + chalk.dim(lastDetail) : ""}`;
    };

    // Tick every second so the timer stays fresh even when the agent is thinking
    const interval = setInterval(update, 1000);

    const onProgress: WorkerProgressCallback = (event) => {
      switch (event.type) {
        case "tool_use":
          lastDetail = event.content;
          break;
        case "tool_running":
          if (event.elapsed && event.elapsed > 3) {
            lastDetail = `${event.tool} (${Math.round(event.elapsed!)}s)`;
          }
          break;
        case "tool_done":
          lastDetail = event.content.slice(0, 80);
          break;
      }
      update();
    };

    return {
      onProgress,
      stop: () => clearInterval(interval),
    };
  }

  // ── Input Hint ────────────────────────────────────────────

  private showInputHint(): void {
    if (process.stdout.isTTY && !this.options.quiet) {
      process.stdout.write(chalk.dim("  > "));
    }
  }

  // ── Dependency Grouping ───────────────────────────────────

  private groupByDependency(stories: Story[]): Story[][] {
    const batches: Story[][] = [];
    const completed = new Set<string>();
    const remaining = [...stories];

    while (remaining.length > 0) {
      const batch = remaining.filter((s) =>
        s.dependencies.every((dep) => completed.has(dep))
      );

      if (batch.length === 0) {
        // Remaining stories have circular or unresolvable deps — run sequentially
        batches.push(...remaining.map((s) => [s]));
        break;
      }

      batches.push(batch);
      for (const s of batch) {
        completed.add(s.id);
        remaining.splice(remaining.indexOf(s), 1);
      }
    }

    return batches;
  }

  // ── Design Phase (parallel) ───────────────────────────────

  private async runDesignPhase(plan: Plan): Promise<void> {
    const uiStories = this.getStoriesByType(plan, ["ui", "fullstack"]);
    if (uiStories.length === 0) return;

    console.log(chalk.bold(`\n  Design`) + chalk.dim(` · ${uiStories.length} stories\n`));

    // All design stories are independent — run in parallel
    if (uiStories.length > 1) {
      await Promise.all(
        uiStories.map((story, i) =>
          this.designSingleStory(story, plan, i + 1, uiStories.length)
        )
      );
    } else {
      await this.designSingleStory(uiStories[0], plan, 1, 1);
    }

    await stateManager.savePlan(plan);
    await stateManager.updatePhase("design");
    await this.git.commitState("Designs complete");
    await this.git.tag("forge/v0.1-designs");

    await this.processChatQueue();
    this.showInputHint();
  }

  private async designSingleStory(
    story: Story,
    plan: Plan,
    index: number,
    total: number
  ): Promise<void> {
    const label = `[${index}/${total}] ${story.title}`;
    const spinner = ora({ text: `${this.elapsed()} ${label}`, indent: 2 }).start();
    const progress = this.makeProgress(spinner, label);

    try {
      const prompt = this.orchestrator.craftWorkerPrompt(story, "design", { plan });
      const result = await this.worker.run("design", prompt, {
        onProgress: progress.onProgress,
      });

      this.addUsage(result.usage);
      const tokens = chalk.dim(
        `${this.formatTokens(result.usage.inputTokens)} in / ${this.formatTokens(result.usage.outputTokens)} out`
      );

      if (result.success) {
        spinner.succeed(`${this.elapsed()} ${label} ${tokens}`);
      } else {
        spinner.warn(`${this.elapsed()} ${label}` + chalk.dim(" skipped") + ` ${tokens}`);
      }
      story.designApproved = true;
      story.status = "design-approved";
    } finally {
      progress.stop();
    }
  }

  // ── Build Phase (parallel by dependency) ──────────────────

  private async runBuildPhase(plan: Plan): Promise<void> {
    const buildable = this.getAllStories(plan).filter(
      (s) => s.status === "design-approved" || s.status === "planned"
    );
    if (buildable.length === 0) return;

    console.log(chalk.bold(`\n  Build`) + chalk.dim(` · ${buildable.length} stories\n`));

    const batches = this.groupByDependency(buildable);
    let storyIndex = 0;

    for (const batch of batches) {
      if (batch.length === 1) {
        storyIndex++;
        await this.buildSingleStory(batch[0], plan, storyIndex, buildable.length, false);
      } else {
        // Parallel batch — stories run concurrently on the current branch
        console.log(chalk.dim(`  ${this.elapsed()} parallel: ${batch.map((s) => s.title).join(", ")}`));

        const promises = batch.map((story) => {
          storyIndex++;
          return this.buildSingleStory(story, plan, storyIndex, buildable.length, true);
        });
        await Promise.all(promises);

        // Commit all parallel changes together
        const builtTitles = batch
          .filter((s) => s.status === "reviewing")
          .map((s) => s.title);
        if (builtTitles.length > 0) {
          await this.git.commitAll(`feat: ${builtTitles.join(", ")}`);
        }
      }

      await stateManager.savePlan(plan);
      await this.processChatQueue();
      this.showInputHint();
    }

    await stateManager.updatePhase("build");
  }

  private async buildSingleStory(
    story: Story,
    plan: Plan,
    index: number,
    total: number,
    parallel: boolean
  ): Promise<void> {
    const label = `[${index}/${total}] ${story.title}`;
    const spinner = ora({ text: `${this.elapsed()} ${label}`, indent: 2 }).start();
    const progress = this.makeProgress(spinner, label);

    try {
      story.status = "building";

      const prompt = this.orchestrator.craftWorkerPrompt(story, "build", {
        plan,
        designMeta: story.designApproved ? { storyId: story.id } : undefined,
      });

      const result = await this.worker.run("build", prompt, {
        onProgress: progress.onProgress,
      });

      this.addUsage(result.usage);
      const tokens = chalk.dim(
        `${this.formatTokens(result.usage.inputTokens)} in / ${this.formatTokens(result.usage.outputTokens)} out`
      );

      if (result.success) {
        if (!parallel) {
          await this.git.commitAll(`feat: ${story.title}`);
        }
        story.status = "reviewing";
        spinner.succeed(
          `${this.elapsed()} ${label}` +
            chalk.dim(` · ${result.filesCreated.length} files`) +
            ` ${tokens}`
        );
      } else {
        story.status = "blocked";
        spinner.fail(`${this.elapsed()} ${label} ${tokens}`);
        for (const error of result.errors) {
          console.log(chalk.red(`    ${error}`));
        }
      }
    } finally {
      progress.stop();
    }
  }

  // ── README Generation ─────────────────────────────────────

  private async generateReadme(plan: Plan): Promise<void> {
    const builtStories = this.getAllStories(plan).filter(
      (s) => s.status === "reviewing" || s.status === "done"
    );
    if (builtStories.length === 0) return;

    const label = "README.md";
    const spinner = ora({ text: `${this.elapsed()} Generating ${label}`, indent: 2 }).start();
    const progress = this.makeProgress(spinner, label);

    try {
      const storyList = builtStories
        .map((s) => `- ${s.title}: ${s.description}`)
        .join("\n");

      const prompt = `
        Generate a README.md for this project.

        Project: ${plan.project}
        Description: ${plan.description}
        Framework: ${plan.framework}

        Features built:
        ${storyList}

        Read the actual codebase to understand the project structure.

        Include these sections:
        - Project name and description
        - Key features (from the stories above)
        - Tech stack
        - Getting started (install, dev server, build)
        - Project structure (based on actual files you can see)

        Write the README.md file in the project root.
        Keep it concise and professional.
      `;

      const result = await this.worker.run("build", prompt, {
        onProgress: progress.onProgress,
      });
      this.addUsage(result.usage);

      if (result.success) {
        await this.git.commitAll("docs: generate README.md");
        spinner.succeed(`${this.elapsed()} ${label}`);
      } else {
        spinner.warn(`${this.elapsed()} ${label}` + chalk.dim(" skipped"));
      }
    } finally {
      progress.stop();
    }
  }

  // ── Review Gate ───────────────────────────────────────────

  private async reviewGate(): Promise<"continue" | "skip" | "abort"> {
    if (!process.stdout.isTTY) return "continue";

    // Notify user that build is done
    if (!this.options.mute) {
      playSound();
    }

    // Pause readline so inquirer can take over stdin
    this.stopChatListener();

    console.log("");

    const { action } = await inquirer.prompt([
      {
        type: "list",
        name: "action",
        message: `${this.elapsed()} Build complete. What next?`,
        choices: [
          { name: "Continue to review", value: "continue" },
          { name: "Skip review", value: "skip" },
          { name: "Abort", value: "abort" },
        ],
      },
    ]);

    // Resume readline
    this.startChatListener();

    return action;
  }

  // ── Review Phase ──────────────────────────────────────────

  private async runReviewPhase(plan: Plan): Promise<void> {
    const reviewable = this.getAllStories(plan).filter((s) => s.status === "reviewing");
    if (reviewable.length === 0) return;

    console.log(chalk.bold(`\n  Review`) + chalk.dim(` · ${reviewable.length} stories\n`));

    for (let i = 0; i < reviewable.length; i++) {
      const story = reviewable[i];
      const label = `[${i + 1}/${reviewable.length}] ${story.title}`;
      const spinner = ora({ text: `${this.elapsed()} ${label}`, indent: 2 }).start();
      const progress = this.makeProgress(spinner, label);

      try {
        const prompt = this.orchestrator.craftWorkerPrompt(story, "review", {
          plan,
          designMeta: story.designApproved ? { storyId: story.id } : undefined,
        });

        const result = await this.worker.run("review", prompt, {
          onProgress: progress.onProgress,
        });

        this.addUsage(result.usage);
        const tokens = chalk.dim(
          `${this.formatTokens(result.usage.inputTokens)} in / ${this.formatTokens(result.usage.outputTokens)} out`
        );

        if (result.success) {
          const tagName = `forge/v0.${this.tagCounter++}-${story.id}`;
          await this.git.tag(tagName);
          story.tags.push(tagName);
          story.status = "done";
          spinner.succeed(`${this.elapsed()} ${label}` + chalk.dim(` [${tagName}]`) + ` ${tokens}`);
        } else {
          // Auto-fix attempt
          spinner.text = `${this.elapsed()} ${label}` + chalk.dim(" fixing issues...");
          const fixed = await this.autoFix(story, plan, result.summary, spinner, label);
          if (fixed) {
            const tagName = `forge/v0.${this.tagCounter++}-${story.id}`;
            await this.git.tag(tagName);
            story.tags.push(tagName);
            story.status = "done";
            spinner.succeed(`${this.elapsed()} ${label}` + chalk.dim(` [${tagName}] fixed`));
          } else {
            story.status = "blocked";
            spinner.fail(`${this.elapsed()} ${label}` + chalk.dim(" blocked"));
          }
        }
      } finally {
        progress.stop();
      }

      await stateManager.savePlan(plan);
      await this.processChatQueue();
      this.showInputHint();
    }

    await stateManager.updatePhase("review");
  }

  // ── Auto-Fix ──────────────────────────────────────────────

  private async autoFix(
    story: Story,
    plan: Plan,
    reviewSummary: string,
    spinner: Ora,
    label: string
  ): Promise<boolean> {
    const fixPrompt = `
      The review found these issues:
      ${reviewSummary}

      Fix them. Make minimal changes. Then re-run build/lint/typecheck to verify.
    `;

    const result = await this.worker.run("fix", fixPrompt, {
      onProgress: this.makeProgress(spinner, label + chalk.dim(" fix")).onProgress,
    });

    if (result.success) {
      await this.git.commitAll(`fix: review issues in ${story.title}`);
      return true;
    }
    return false;
  }

  // ── Deploy Phase (optional) ───────────────────────────────

  private async runDeployPhase(plan: Plan): Promise<void> {
    console.log(chalk.bold(`\n  Deploy`) + chalk.dim(` · GitHub Pages\n`));

    const label = "GitHub Pages";
    const spinner = ora({ text: `${this.elapsed()} Configuring ${label}`, indent: 2 }).start();
    const progress = this.makeProgress(spinner, label);

    try {
      const prompt = `
        Set up GitHub Pages deployment for this Next.js project.

        1. Update next.config.js or next.config.ts to add: output: "export"
           (merge with existing config, do not overwrite other settings)
        2. Create .github/workflows/deploy.yml for GitHub Pages deployment
        3. The workflow should:
           - Trigger on push to main
           - Install dependencies with npm ci
           - Build with npm run build
           - Use actions/configure-pages, actions/upload-pages-artifact, actions/deploy-pages

        Do NOT run any git commands. Just create/update the configuration files.
      `;

      const result = await this.worker.run("build", prompt, {
        onProgress: progress.onProgress,
      });
      this.addUsage(result.usage);

      if (result.success) {
        await this.git.commitAll("ci: add GitHub Pages deployment");
        spinner.succeed(`${this.elapsed()} ${label} configured`);
      } else {
        spinner.warn(`${this.elapsed()} ${label}` + chalk.dim(" skipped"));
      }
    } finally {
      progress.stop();
    }
  }

  // ── Chat Queue ────────────────────────────────────────────

  private startChatListener(): void {
    if (!process.stdin.isTTY) return;

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: "",
    });

    this.rl.on("line", (line) => {
      const msg = line.trim();
      if (!msg) return;

      this.chatQueue.push({
        type: "content-change",
        message: msg,
        queuedAt: new Date().toISOString(),
      });
      console.log(chalk.dim(`  [queued] ${msg}`));
    });
  }

  private stopChatListener(): void {
    this.rl?.close();
    this.rl = null;
  }

  private async processChatQueue(): Promise<void> {
    if (this.chatQueue.length === 0) return;

    console.log(chalk.dim(`\n  Processing ${this.chatQueue.length} queued message${this.chatQueue.length > 1 ? "s" : ""}...\n`));

    for (const change of this.chatQueue) {
      const state = await stateManager.getState();
      const decision = await this.orchestrator.routeUserInput(change.message, state);

      if (decision.action === "answer" && decision.response) {
        console.log(chalk.white(`  > ${change.message}`));
        console.log(chalk.dim(`    ${decision.response}\n`));
      } else if (decision.action === "route-to-worker" && decision.prompt) {
        const mode = decision.workerMode || "fix";
        const spinner = ora({ text: change.message, indent: 2 }).start();
        const result = await this.worker.run(mode, decision.prompt);
        if (result.success) {
          await this.git.commitAll(`fix: ${change.message}`);
          spinner.succeed(change.message);
        } else {
          spinner.fail(change.message);
        }
      } else if (decision.action === "add-story") {
        console.log(chalk.dim(`  + Story added: ${change.message}`));
      }
    }

    this.chatQueue = [];
  }

  // ── Summary ───────────────────────────────────────────────

  private printSummary(errors: string[]): void {
    const elapsedSec = (Date.now() - this.startTime) / 1000;
    const elapsed = elapsedSec >= 60
      ? `${Math.floor(elapsedSec / 60)}m ${Math.round(elapsedSec % 60)}s`
      : `${Math.round(elapsedSec)}s`;

    const allStories = this.getAllStories(this.plan!);
    const done = allStories.filter((s) => s.status === "done").length;
    const blocked = allStories.filter((s) => s.status === "blocked").length;
    const total = allStories.length;

    if (!this.options.mute) {
      playSound();
    }

    console.log(chalk.dim("\n  ─────────────────────────────────"));
    console.log(chalk.bold("  Done") + chalk.dim(` in ${elapsed} · ${done}/${total} stories`));

    // Token usage
    const u = this.totalUsage;
    if (u.inputTokens > 0 || u.outputTokens > 0) {
      console.log(chalk.dim(
        `  ${this.formatTokens(u.inputTokens)} in / ${this.formatTokens(u.outputTokens)} out` +
        (u.costUsd > 0 ? ` · ${this.formatCost(u.costUsd)}` : "")
      ));
    }

    if (blocked > 0) {
      console.log(chalk.yellow(`  ${blocked} blocked`) + chalk.dim(" — " + chalk.white("forge status")));
    }

    for (const e of errors) {
      console.log(chalk.dim(`  ! ${e}`));
    }

    console.log("");
  }

  // ── Usage Tracking ────────────────────────────────────────

  private addUsage(usage: WorkerUsage): void {
    this.totalUsage.inputTokens += usage.inputTokens;
    this.totalUsage.outputTokens += usage.outputTokens;
    this.totalUsage.costUsd += usage.costUsd;
    this.totalUsage.durationMs += usage.durationMs;
  }

  private formatTokens(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
    return String(n);
  }

  private formatCost(usd: number): string {
    return "$" + usd.toFixed(4);
  }

  // ── Helpers ───────────────────────────────────────────────

  private tagCounter = 2;

  private displayPlan(plan: Plan): void {
    console.log(chalk.bold(`\n  ${plan.project}`) + chalk.dim(` · ${plan.framework}`));
    const total = this.getAllStories(plan).length;
    console.log(chalk.dim(`  ${total} stories across ${plan.epics.length} epics\n`));

    for (const epic of plan.epics) {
      console.log(chalk.dim(`  ${epic.title}`));
      for (const story of epic.stories) {
        const tag = story.type === "ui" ? "ui" : story.type === "backend" ? "api" : "full";
        console.log(`    ${chalk.dim(`[${tag}]`)} ${story.title}`);
      }
    }
    console.log("");
  }

  private getAllStories(plan: Plan): Story[] {
    return plan.epics.flatMap((e) => e.stories);
  }

  private getStoriesByType(plan: Plan, types: string[]): Story[] {
    return this.getAllStories(plan).filter((s) => types.includes(s.type));
  }
}
