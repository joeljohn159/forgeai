// ============================================================
// forge undo — Revert agent actions using git revert
// ============================================================

import chalk from "chalk";
import inquirer from "inquirer";
import { stateManager } from "../../state/index.js";
import { GitManager } from "../../core/git/index.js";

export async function undoCommand(options?: { steps?: string }) {
  const config = await stateManager.getConfig();
  if (!config) {
    console.log(chalk.red("\n  Forge not initialized. Run: forge init\n"));
    return;
  }

  const git = new GitManager();

  console.log(chalk.bold("\n  Forge Undo\n"));

  // Get recent forge commits
  const log = await git.getForgeLog(parseInt(options?.steps || "10", 10));
  const forgeCommits = log.filter(
    (c) =>
      c.message.startsWith("feat:") ||
      c.message.startsWith("fix:") ||
      c.message.startsWith("docs:")
  );

  if (forgeCommits.length === 0) {
    console.log(chalk.dim("  No actions to undo.\n"));
    return;
  }

  // Show commits to choose from
  const choices = forgeCommits.map((commit) => {
    const date = new Date(commit.date);
    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const hash = commit.hash.slice(0, 7);
    return {
      name: `  ${chalk.dim(hash)}  ${commit.message}  ${chalk.dim(timeStr)}`,
      value: commit,
    };
  });

  const { selected } = await inquirer.prompt([
    {
      type: "list",
      name: "selected",
      message: "Which action to undo?",
      choices: [
        ...choices,
        new inquirer.Separator(),
        { name: chalk.dim("  Cancel"), value: null },
      ],
    },
  ]);

  if (!selected) {
    console.log(chalk.dim("  Cancelled.\n"));
    return;
  }

  // Confirm
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Revert "${selected.message}"? This creates a new commit that undoes those changes.`,
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(chalk.dim("  Cancelled.\n"));
    return;
  }

  // Perform git revert
  try {
    await git.revertCommit(selected.hash);

    console.log(chalk.green(`\n  Reverted: ${selected.message}`));
    console.log(chalk.dim(`  Commit ${selected.hash.slice(0, 7)} has been undone.\n`));

    // Update forge state history
    await stateManager.addHistoryEntry({
      action: "undo",
      storyId: null,
      details: `Reverted: ${selected.message} (${selected.hash.slice(0, 7)})`,
    });

    // Update story status if it was a feat: commit
    const plan = await stateManager.getPlan();
    if (plan && selected.message.startsWith("feat:")) {
      const storyTitle = selected.message.replace("feat: ", "");
      const story = plan.epics
        .flatMap((e) => e.stories)
        .find((s) => s.title === storyTitle);

      if (story && (story.status === "reviewing" || story.status === "done")) {
        story.status = "planned";
        await stateManager.savePlan(plan);
        console.log(chalk.dim(`  Story "${story.title}" reset to planned.\n`));
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);

    if (msg.includes("conflict")) {
      console.log(chalk.red("\n  Revert has conflicts."));
      console.log(chalk.dim("  Resolve them manually, then: git revert --continue\n"));
    } else {
      console.log(chalk.red(`\n  Failed to revert: ${msg}`));
      console.log(chalk.dim("  Try manually: " + chalk.white(`git revert ${selected.hash.slice(0, 7)}`) + "\n"));
    }
  }
}
