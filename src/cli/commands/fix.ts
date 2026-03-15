// ============================================================
// forge fix "description" — Fix a bug or make a small change
// Works on main. No branch switching.
// Supports --image flag to attach a screenshot for context.
// ============================================================

import chalk from "chalk";
import ora from "ora";
import { existsSync } from "fs";
import { stateManager } from "../../state/index.js";
import { Orchestrator } from "../../core/orchestrator/index.js";
import { Worker } from "../../core/worker/index.js";
import { GitManager } from "../../core/git/index.js";
import {
  parseAttachments,
  stageAttachments,
  formatAttachmentList,
  buildAttachmentPrompt,
} from "../../core/utils/attachments.js";

export async function fixCommand(description: string, options?: { image?: string }) {
  const config = await stateManager.getConfig();
  if (!config) {
    console.log(chalk.red("\n  Forge not initialized. Run: forge init\n"));
    return;
  }

  if (!description || description.trim().length === 0) {
    console.log(chalk.red("\n  Please describe the fix: forge fix \"description\"\n"));
    return;
  }

  // Validate image path if provided
  if (options?.image && !existsSync(options.image)) {
    console.log(chalk.red(`\n  Image not found: ${options.image}\n`));
    return;
  }

  // Parse attachments from description (drag-and-drop file paths)
  const parsed = parseAttachments(description);
  if (parsed.attachments.length > 0) {
    description = parsed.description;
    stageAttachments(parsed.attachments);
  }

  console.log(chalk.bold("\n  forge fix\n"));
  console.log(chalk.dim(`  "${description}"`));
  if (options?.image) {
    console.log(chalk.dim(`  image: ${options.image}`));
  }
  if (parsed.attachments.length > 0) {
    console.log(chalk.dim("\n  Attachments:"));
    console.log(chalk.cyan(formatAttachmentList(parsed.attachments)));
  }
  console.log("");

  const orchestrator = new Orchestrator(config);
  const worker = new Worker(config, {});
  const git = new GitManager();
  const state = await stateManager.getState();

  // ── Orchestrator classifies the request ─────────────────
  const spinner = ora({ text: "Analyzing request...", indent: 2 }).start();

  let decision;
  try {
    decision = await orchestrator.routeUserInput(description, state);
  } catch (err) {
    spinner.fail("Failed to analyze request");
    console.log(chalk.red(`  ${err instanceof Error ? err.message : err}`));
    return;
  }

  switch (decision.action) {
    case "route-to-worker": {
      const mode = decision.workerMode || "fix";
      spinner.text = `Worker (${mode}) applying fix...`;

      // Snapshot before fixing
      const headBefore = await git.getHead();
      await stateManager.saveSnapshot({
        action: "fix",
        storyId: state.currentStory,
        branch: "main",
        commitBefore: headBefore,
      });

      // Build prompt — include image/attachment references
      let fixPrompt = decision.prompt || description;
      if (options?.image) {
        fixPrompt += `\n\nA screenshot has been saved at: ${options.image}\nRead this image file to see the visual issue the user is referring to.`;
      }
      if (parsed.attachments.length > 0) {
        fixPrompt += "\n" + buildAttachmentPrompt(parsed.attachments);
      }

      const result = await worker.run(mode, fixPrompt, {
        onProgress: (event) => {
          if (event.type === "tool_use") {
            spinner.text = event.content;
          }
        },
      });

      if (result.success) {
        await git.commitAll(`fix: ${description}`);
        spinner.succeed("Fix applied");

        for (const file of result.filesModified) {
          console.log(chalk.dim(`    modified: ${file}`));
        }
        for (const file of result.filesCreated) {
          console.log(chalk.dim(`    created: ${file}`));
        }
      } else {
        spinner.fail("Fix failed");
        for (const error of result.errors) {
          console.log(chalk.red(`    ${error}`));
        }
      }

      await stateManager.addHistoryEntry({
        action: "fix",
        storyId: null,
        details: description,
      });
      break;
    }

    case "add-story": {
      spinner.succeed("New feature detected");

      const plan = await stateManager.getPlan();
      if (plan && plan.epics.length > 0) {
        const newStory = {
          id: `story-${Date.now()}`,
          title: decision.story?.title || description,
          description: decision.story?.description || description,
          type: (decision.story?.type as any) || "fullstack",
          status: "planned" as const,
          branch: null,
          designApproved: false,
          tags: [],
          priority: 99,
          dependencies: [],
        };

        // Add to last epic
        plan.epics[plan.epics.length - 1].stories.push(newStory);
        await stateManager.savePlan(plan);
        await git.commitAll(`forge: add story "${newStory.title}"`);

        console.log(chalk.green(`  Added: ${newStory.title}`));
        console.log(chalk.dim(`  Run ${chalk.white("forge build")} or ${chalk.white("forge auto")} to build it.\n`));
      } else {
        console.log(chalk.yellow("  No plan found. Run forge plan first to create a sprint plan.\n"));
      }
      break;
    }

    case "answer": {
      spinner.stop();
      console.log(`  ${decision.response}\n`);
      break;
    }

    case "queue-change": {
      spinner.succeed("Change queued (Worker is busy)");
      console.log(chalk.dim("  Will apply after the current task completes.\n"));
      break;
    }

    default: {
      spinner.fail("Could not process request");
      break;
    }
  }
}
