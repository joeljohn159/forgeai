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
import { GitHubSync } from "../github/index.js";
import { buildAttachmentPrompt, type Attachment } from "../utils/attachments.js";

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
  yes?: boolean;
  allowedDomains?: string[];
  quiet?: boolean;
  mute?: boolean;
  deploy?: boolean;
  skipDesign?: boolean;
  attachments?: Attachment[];
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
  private shuttingDown = false;
  private activeSpinner: Ora | null = null;
  private tagCounter = 1;

  constructor(config: ForgeConfig, options: AutoPipelineOptions = {}) {
    this.config = config;
    this.options = options;
    this.orchestrator = new Orchestrator(config);
    this.worker = new Worker(
      config,
      {
        sandbox: options.sandbox ?? true,
        yes: options.yes ?? false,
        workingDir: options.workingDir,
        allowedDomains: options.allowedDomains,
      },
      options.mute,
    );
    this.git = new GitManager();
    this.setupGracefulShutdown();
  }

  // ── Graceful Shutdown ────────────────────────────────────

  private setupGracefulShutdown(): void {
    const handler = async () => {
      if (this.shuttingDown) return;
      this.shuttingDown = true;

      // Stop spinner so shutdown message is visible
      if (this.activeSpinner?.isSpinning) {
        this.activeSpinner.stop();
      }

      console.log(chalk.yellow("\n\n  Interrupted — saving progress..."));

      try {
        if (this.plan) {
          await stateManager.savePlan(this.plan);
          await this.git.commitAll("forge: save progress (interrupted)");
          console.log(chalk.dim("  Progress saved. Resume with: forge resume\n"));
        }
      } catch {
        console.log(chalk.dim("  Could not save progress.\n"));
      }

      this.stopChatListener();
      process.exit(130);
    };

    process.on("SIGINT", handler);
    // SIGTERM is unreliable on Windows — only register on Unix
    if (process.platform !== "win32") {
      process.on("SIGTERM", handler);
    }
  }

  // ── Resume an interrupted sprint ──────────────────────────

  async resume(existingPlan: Plan): Promise<{ success: boolean; plan: Plan; errors: string[] }> {
    const errors: string[] = [];
    this.startTime = Date.now();
    this.plan = existingPlan;

    console.log(chalk.bold("\n  forge") + chalk.dim(" resume"));
    console.log(chalk.dim(`  Continuing from last checkpoint\n`));

    this.startChatListener();
    await this.git.ensureRepo();
    await this.git.ensureMainBranch();

    const allStories = this.getAllStories(this.plan);
    const needsDesign = allStories.some(
      (s) => s.status === "planned" && (s.type === "ui" || s.type === "fullstack")
    );
    const needsBuild = allStories.some(
      (s) => s.status === "planned" || s.status === "design-approved"
    );
    const needsReview = allStories.some((s) => s.status === "reviewing");

    if (!needsDesign && !needsBuild && !needsReview) {
      console.log(chalk.green("  Nothing to resume — all stories are complete or blocked.\n"));
      this.stopChatListener();
      return { success: true, plan: this.plan, errors };
    }

    // Design (only stories not yet designed)
    if (needsDesign && !this.options.skipDesign) {
      try { await this.runDesignPhase(this.plan); }
      catch (err) {
        await this.saveProgressOnError("design");
        errors.push(`Design: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Build (only stories not yet built)
    if (needsBuild) {
      try { await this.runBuildPhase(this.plan); }
      catch (err) {
        await this.saveProgressOnError("build");
        errors.push(`Build: ${err instanceof Error ? err.message : err}`);
      }
    }

    // Review (only stories awaiting review)
    if (needsReview || needsBuild) {
      const gateAction = await this.reviewGate();
      if (gateAction === "abort") {
        this.stopChatListener();
        this.printSummary(errors);
        return { success: false, plan: this.plan, errors: [...errors, "Aborted"] };
      }
      if (gateAction !== "skip") {
        try { await this.runReviewPhase(this.plan); }
        catch (err) {
          await this.saveProgressOnError("review");
          errors.push(`Review: ${err instanceof Error ? err.message : err}`);
        }
      }
    }

    // Auto-push on resume too
    await this.autoPush();

    this.stopChatListener();
    this.printSummary(errors);
    await stateManager.updatePhase("done");

    const failedCount = allStories.filter((s) => s.status === "blocked").length;
    return { success: errors.length === 0 && failedCount === 0, plan: this.plan, errors };
  }

  // ── Full Autonomous Sprint ─────────────────────────────────

  async run(description: string): Promise<{ success: boolean; plan: Plan | null; errors: string[] }> {
    const errors: string[] = [];
    this.startTime = Date.now();

    console.log(chalk.bold("\n  forge") + chalk.dim(" auto"));
    const flags = [
      `sandbox ${this.options.sandbox !== false ? "on" : "off"}`,
      ...(this.options.yes ? ["auto-approve on"] : []),
    ].join(" · ");
    console.log(chalk.dim(`  ${flags} · type a message anytime to queue feedback\n`));

    this.startChatListener();

    await this.git.ensureRepo();
    await this.git.ensureMainBranch();

    // ── Plan ───────────────────────────────────────────────
    const planSpinner = ora({ text: `${this.elapsed()} Planning...`, indent: 2 }).start();
    this.activeSpinner = planSpinner;
    try {
      const attachmentContext = buildAttachmentPrompt(this.options.attachments || []);
      this.plan = await this.orchestrator.generatePlan(description + attachmentContext);
      planSpinner.succeed(`${this.elapsed()} Plan ready`);
      this.activeSpinner = null;
      this.displayPlan(this.plan);
      await stateManager.savePlan(this.plan);
      await stateManager.updatePhase("plan");
      await this.git.commitState("Sprint plan");
      await this.git.tag("forge/v0.0-plan");

      // Sync to GitHub Issues if enabled
      await this.syncToGitHub(this.plan);
    } catch (err) {
      planSpinner.fail(`${this.elapsed()} Planning failed`);
      this.activeSpinner = null;
      const msg = err instanceof Error ? err.message : String(err);
      console.log(chalk.red(`\n  ${msg}\n`));
      if (!msg.includes("Possible fixes")) {
        console.log(chalk.dim("  Possible fixes:"));
        console.log(chalk.dim("    1. Run: claude login"));
        console.log(chalk.dim("    2. Check your internet connection"));
        console.log(chalk.dim("    3. Run: forge doctor\n"));
      }
      this.stopChatListener();
      return { success: false, plan: null, errors: [`Plan: ${msg}`] };
    }

    this.showInputHint();

    // ── Design ─────────────────────────────────────────────
    if (this.options.skipDesign) {
      // Mark all stories as ready for build (skip design = treat as approved)
      for (const story of this.getAllStories(this.plan)) {
        if (story.status === "planned") {
          story.designApproved = true;
        }
      }
      console.log(chalk.dim(`\n  Design skipped (--skip-design)\n`));
    } else {
      try { await this.runDesignPhase(this.plan); }
      catch (err) {
        await this.saveProgressOnError("design");
        errors.push(`Design: ${err instanceof Error ? err.message : err}`);
      }
    }

    // ── Build ──────────────────────────────────────────────
    try { await this.runBuildPhase(this.plan); }
    catch (err) {
      await this.saveProgressOnError("build");
      errors.push(`Build: ${err instanceof Error ? err.message : err}`);
    }

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
      catch (err) {
        await this.saveProgressOnError("review");
        errors.push(`Review: ${err instanceof Error ? err.message : err}`);
      }
    }

    // ── Deploy (optional) ──────────────────────────────────
    if (this.options.deploy) {
      try { await this.runDeployPhase(this.plan); }
      catch (err) { errors.push(`Deploy: ${err instanceof Error ? err.message : err}`); }
    }

    // ── Auto-push to GitHub ───────────────────────────────
    await this.autoPush();

    this.stopChatListener();
    this.printSummary(errors);
    await stateManager.updatePhase("done");

    const allStories = this.getAllStories(this.plan);
    const failedCount = allStories.filter((s) => s.status === "blocked").length;
    return { success: errors.length === 0 && failedCount === 0, plan: this.plan, errors };
  }

  /** Save current progress when a phase fails — prevents data loss */
  private async saveProgressOnError(phase: string): Promise<void> {
    try {
      if (this.plan) {
        await stateManager.savePlan(this.plan);
        await stateManager.updatePhase(phase as any);
        await this.git.commitAll(`forge: save progress (${phase} interrupted)`);
        console.log(chalk.dim(`  Progress saved. Resume with: forge resume\n`));
      }
    } catch {
      // Best-effort — don't let save failure mask the original error
    }
  }

  // ── Elapsed Timer ─────────────────────────────────────────

  private elapsed(): string {
    const sec = Math.floor((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(sec / 60);
    const seconds = sec % 60;
    return chalk.dim(`[${minutes}:${seconds.toString().padStart(2, "0")}]`);
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
      const detail = lastDetail ? " " + chalk.dim(lastDetail) : "";
      spinner.text = `${prefix} ${storyTitle}${detail}`;
    };

    // Tick every 5 seconds — keeps timer fresh without excessive terminal redraws
    const interval = setInterval(update, 5000);

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
      // Stop spinner briefly so the hint is visible
      const wasSpinning = this.activeSpinner?.isSpinning ?? false;
      const spinnerText = this.activeSpinner?.text ?? "";
      if (wasSpinning) this.activeSpinner!.stop();

      process.stdout.write(chalk.dim("\n  ─ type a message and press enter ─\n  > "));

      if (wasSpinning && this.activeSpinner) {
        this.activeSpinner.start(spinnerText);
      }
    }
  }

  // ── Dependency Grouping ───────────────────────────────────

  private groupByDependency(stories: Story[]): Story[][] {
    const batches: Story[][] = [];
    const completed = new Set<string>();
    const remaining = new Set(stories.map((s) => s.id));
    const storyMap = new Map(stories.map((s) => [s.id, s]));

    // Also treat already-done stories as completed deps
    if (this.plan) {
      for (const s of this.getAllStories(this.plan)) {
        if (s.status === "done" || s.status === "reviewing") {
          completed.add(s.id);
        }
      }
    }

    let iterations = 0;
    const maxIterations = stories.length + 1; // Safety: prevent infinite loop on circular deps

    while (remaining.size > 0 && iterations < maxIterations) {
      iterations++;

      const batch: Story[] = [];
      for (const id of remaining) {
        const story = storyMap.get(id)!;
        const depsReady = story.dependencies.every(
          (dep) => completed.has(dep) || !remaining.has(dep) // dep done or not in buildable set
        );
        if (depsReady) {
          batch.push(story);
        }
      }

      if (batch.length === 0) {
        // Circular deps — break the cycle by running remaining stories sequentially
        for (const id of remaining) {
          batches.push([storyMap.get(id)!]);
        }
        break;
      }

      batches.push(batch);
      for (const s of batch) {
        completed.add(s.id);
        remaining.delete(s.id);
      }
    }

    return batches;
  }

  // ── Design Phase (parallel) ───────────────────────────────

  private async runDesignPhase(plan: Plan): Promise<void> {
    const uiStories = this.getStoriesByType(plan, ["ui", "fullstack"]).filter(
      (s) => s.status === "planned"
    );
    if (uiStories.length === 0) return;

    console.log(chalk.bold(`\n  Design`) + chalk.dim(` · ${uiStories.length} stories\n`));

    // Design stories are independent — run in parallel
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
    this.activeSpinner = spinner;
    const progress = this.makeProgress(spinner, label);

    try {
      story.status = "designing";

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
        story.designApproved = true;
        story.status = "design-approved";
      } else {
        spinner.warn(`${this.elapsed()} ${label}` + chalk.dim(" skipped") + ` ${tokens}`);
        // Still mark as design-approved so build can proceed
        story.designApproved = false;
        story.status = "design-approved";
      }
    } finally {
      progress.stop();
      this.activeSpinner = null;
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
        // Parallel batch — stories run concurrently
        console.log(chalk.dim(`  ${this.elapsed()} parallel: ${batch.map((s) => s.title).join(", ")}`));

        // Capture indices before async work
        const indexedBatch = batch.map((story) => {
          storyIndex++;
          return { story, index: storyIndex };
        });

        // Run in parallel but do NOT let parallel builds commit individually
        await Promise.all(
          indexedBatch.map(({ story, index }) =>
            this.buildSingleStory(story, plan, index, buildable.length, true)
          )
        );

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
    this.activeSpinner = spinner;
    const progress = this.makeProgress(spinner, label);

    try {
      // Snapshot before building (capture current HEAD for undo)
      const headBefore = await this.git.getHead();
      await stateManager.saveSnapshot({
        action: "build",
        storyId: story.id,
        branch: "main",
        commitBefore: headBefore,
      });

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
        // Show max-turns warning prominently
        if (result.errors.some((e) => e.includes("safety cap"))) {
          console.log(chalk.yellow(`    Tip: Story may be too large. Try splitting it into smaller stories.`));
        }
      }
    } finally {
      progress.stop();
      this.activeSpinner = null;
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
    this.activeSpinner = spinner;
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
      this.activeSpinner = null;
    }
  }

  // ── Review Gate ───────────────────────────────────────────

  private async reviewGate(): Promise<"continue" | "skip" | "abort"> {
    if (this.options.yes) return "continue";
    if (!process.stdout.isTTY) return "continue";

    // Notify user that build is done
    if (!this.options.mute) {
      playSound();
    }

    // Stop spinner and chat listener so inquirer can take over stdin cleanly
    if (this.activeSpinner?.isSpinning) {
      this.activeSpinner.stop();
      this.activeSpinner = null;
    }
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
      this.activeSpinner = spinner;
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
        this.activeSpinner = null;
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
    _plan: Plan,
    reviewSummary: string,
    spinner: Ora,
    label: string
  ): Promise<boolean> {
    const fixPrompt = `
      The review found these issues:
      ${reviewSummary}

      Fix them. Make minimal changes. Then re-run build/lint/typecheck to verify.
    `;

    const fixProgress = this.makeProgress(spinner, label + chalk.dim(" fix"));
    try {
      const result = await this.worker.run("fix", fixPrompt, {
        onProgress: fixProgress.onProgress,
      });

      if (result.success) {
        await this.git.commitAll(`fix: review issues in ${story.title}`);
        return true;
      }
      return false;
    } finally {
      fixProgress.stop();
    }
  }

  // ── Deploy Phase (optional) ───────────────────────────────

  private async runDeployPhase(plan: Plan): Promise<void> {
    console.log(chalk.bold(`\n  Deploy`) + chalk.dim(` · GitHub Pages\n`));

    const label = "GitHub Pages";
    const spinner = ora({ text: `${this.elapsed()} Configuring ${label}`, indent: 2 }).start();
    this.activeSpinner = spinner;
    const progress = this.makeProgress(spinner, label);

    try {
      const framework = plan.framework || "Next.js";
      const prompt = `
        Set up GitHub Pages deployment for this ${framework} project.

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
      this.activeSpinner = null;
    }
  }

  // ── Chat Queue ────────────────────────────────────────────

  private startChatListener(): void {
    if (!process.stdin.isTTY) return;
    if (this.rl) return; // Already listening

    this.rl = readline.createInterface({
      input: process.stdin,
      terminal: false,
    });

    this.rl.on("line", (line) => {
      const msg = line.trim();
      if (!msg) return;

      this.chatQueue.push({
        type: "content-change",
        message: msg,
        queuedAt: new Date().toISOString(),
      });

      const count = this.chatQueue.length;

      // Pause the active spinner so our output doesn't collide
      const wasSpinning = this.activeSpinner?.isSpinning ?? false;
      const spinnerText = this.activeSpinner?.text ?? "";
      if (wasSpinning) this.activeSpinner!.stop();

      // Clear the current line and show confirmation
      if (process.stdout.isTTY) {
        process.stdout.write(`\r\x1b[K`);
      }
      console.log(
        chalk.green(`  [queued${count > 1 ? ` #${count}` : ""}]`) +
          chalk.dim(` ${msg}`)
      );
      console.log(chalk.dim("  > "));

      // Resume spinner if it was running
      if (wasSpinning && this.activeSpinner) {
        this.activeSpinner.start(spinnerText);
      }
    });
  }

  private stopChatListener(): void {
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
  }

  private async processChatQueue(): Promise<void> {
    if (this.chatQueue.length === 0) return;

    // Stop spinner while processing queue messages
    if (this.activeSpinner?.isSpinning) {
      this.activeSpinner.stop();
    }

    console.log(chalk.dim(`\n  Processing ${this.chatQueue.length} queued message${this.chatQueue.length > 1 ? "s" : ""}...\n`));

    const messages = [...this.chatQueue];
    this.chatQueue = [];

    for (const change of messages) {
      try {
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
        } else if (decision.action === "add-story" && this.plan) {
          const newStory: Story = {
            id: `story-${Date.now()}`,
            title: decision.story?.title || change.message,
            description: decision.story?.description || change.message,
            type: (decision.story?.type as any) || "fullstack",
            status: "planned",
            branch: null,
            designApproved: false,
            tags: [],
            priority: 99,
            dependencies: [],
          };
          // Add to last epic
          if (this.plan.epics.length > 0) {
            this.plan.epics[this.plan.epics.length - 1].stories.push(newStory);
            console.log(chalk.dim(`  + Story added: ${newStory.title}`));
          }
        }
      } catch (err) {
        console.log(chalk.dim(`  Could not process: ${change.message}`));
      }
    }
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

  // ── GitHub Sync ────────────────────────────────────────────

  private async syncToGitHub(plan: Plan): Promise<void> {
    if (!this.config.githubSync || !this.config.githubRepo) return;
    if (!GitHubSync.isAvailable()) return;

    try {
      const gh = new GitHubSync(this.config.githubRepo);
      await gh.ensureLabels();
      const { created, updated } = await gh.syncPlan(plan);
      if (created > 0 || updated > 0) {
        console.log(chalk.dim(`  GitHub: ${created} issues created, ${updated} updated`));
      }
    } catch {
      // Silently skip — GitHub sync is best-effort
    }
  }

  // ── Auto-Push ───────────────────────────────────────────

  private async autoPush(): Promise<void> {
    const hasRemote = await this.git.hasRemote();
    if (!hasRemote) return; // No remote configured — skip silently

    const spinner = ora({ text: `${this.elapsed()} Pushing to GitHub...`, indent: 2 }).start();
    this.activeSpinner = spinner;

    try {
      await this.git.push();
      await this.git.pushTags();
      spinner.succeed(`${this.elapsed()} Pushed to GitHub`);
    } catch {
      spinner.warn(`${this.elapsed()} Push failed` + chalk.dim(" — run forge push to retry"));
    } finally {
      this.activeSpinner = null;
    }
  }

  // ── Helpers ───────────────────────────────────────────────

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
