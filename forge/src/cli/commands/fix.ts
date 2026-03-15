// ============================================================
// forge fix "description" — Fix a bug or make a small change
// ============================================================

import chalk from "chalk";
import ora from "ora";
import { stateManager } from "../../state/index.js";
import { Orchestrator } from "../../core/orchestrator/index.js";
import { Worker } from "../../core/worker/index.js";
import { GitManager } from "../../core/git/index.js";

export async function fixCommand(description: string) {
  const config = await stateManager.getConfig();
  if (!config) {
    console.log(chalk.red("\n  Forge not initialized. Run: forge init\n"));
    return;
  }

  console.log(chalk.bold("\n🔧 Forge Fix\n"));
  console.log(chalk.dim(`  "${description}"\n`));

  const orchestrator = new Orchestrator(config);
  const worker = new Worker(config);
  const git = new GitManager();
  const state = await stateManager.getState();

  // ── Orchestrator classifies the request ─────────────────
  const spinner = ora("  Orchestrator analyzing request...").start();

  const decision = await orchestrator.routeUserInput(description, state);

  switch (decision.action) {
    case "route-to-worker": {
      const mode = decision.workerMode || "fix";
      spinner.text = `  Routing to Worker (${mode} mode)...`;

      // Take snapshot before fixing
      await stateManager.saveSnapshot({
        action: "fix",
        storyId: state.currentStory,
        branch: await git.getCurrentBranch(),
      });

      // Create a fix branch
      const branchName = `fix/${Date.now()}`;
      await git.createBranch(branchName);

      spinner.text = `  Worker (${mode}) applying fix...`;

      const result = await worker.run(mode, decision.prompt || description, {
        onProgress: (event) => {
          if (event.type === "tool_use") {
            spinner.text = `  ${event.content}`;
          }
        },
      });

      if (result.success) {
        spinner.succeed("  Fix applied successfully");

        // Commit and merge
        await git.commitAll(`fix: ${description}`);
        await git.checkout("main");
        await git.merge(branchName);
        await git.deleteBranch(branchName);

        if (result.filesModified.length > 0) {
          for (const file of result.filesModified) {
            console.log(chalk.dim(`    └── Modified: ${file}`));
          }
        }
        if (result.filesCreated.length > 0) {
          for (const file of result.filesCreated) {
            console.log(chalk.dim(`    └── Created: ${file}`));
          }
        }
      } else {
        spinner.fail("  Fix failed");
        // Rollback
        await git.checkout("main");
        await git.deleteBranch(branchName);
        for (const error of result.errors) {
          console.log(chalk.red(`    └── ${error}`));
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
      spinner.succeed("  New feature detected — adding to sprint plan");
      console.log(
        chalk.cyan(
          `\n  📝 Added story: ${decision.story?.title || description}`
        )
      );
      console.log(
        chalk.dim("  This will be built in the next sprint cycle.\n")
      );

      // TODO: Actually add to plan.json
      break;
    }

    case "answer": {
      spinner.stop();
      console.log(chalk.white(`  ${decision.response}\n`));
      break;
    }

    case "queue-change": {
      spinner.succeed("  Change queued (Worker is busy)");
      console.log(
        chalk.dim("  Will apply after the current task completes.\n")
      );
      break;
    }

    default: {
      spinner.fail("  Could not process request");
      break;
    }
  }
}
