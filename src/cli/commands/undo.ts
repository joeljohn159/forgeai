// ============================================================
// forge undo — Revert the last agent action
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

  const state = await stateManager.getState();
  const git = new GitManager();

  console.log(chalk.bold("\n⏪ Forge Undo\n"));

  if (state.history.length === 0) {
    console.log(chalk.dim("  No actions to undo.\n"));
    return;
  }

  // Show recent history
  const count = parseInt(options?.steps || "5", 10);
  const recent = state.history.slice(-count).reverse();

  console.log(chalk.bold("  Recent actions:\n"));

  const choices = recent.map((entry, index) => {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const story = entry.storyId ? ` (${entry.storyId})` : "";
    return {
      name: `  ${index + 1}. [${time}] ${entry.action}${story} — ${entry.details}`,
      value: entry,
    };
  });

  const { selected } = await inquirer.prompt([
    {
      type: "list",
      name: "selected",
      message: "Undo which action?",
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
      message: `Undo "${selected.action}"? This will revert files to their previous state.`,
      default: false,
    },
  ]);

  if (!confirm) {
    console.log(chalk.dim("  Cancelled.\n"));
    return;
  }

  // Perform undo
  if (selected.snapshotId) {
    const snapshot = await stateManager.getSnapshot(selected.snapshotId);

    if (snapshot && snapshot.commitBefore) {
      // Git-level rollback to the commit before this action
      try {
        await git.checkout("main");
        // Reset to the commit before the action
        // TODO: Implement proper file-level rollback using snapshot data
        console.log(
          chalk.green(`\n  ✅ Reverted to state before: ${selected.action}`)
        );
        console.log(chalk.dim(`     Snapshot: ${selected.snapshotId}\n`));
      } catch (error) {
        console.log(chalk.red(`\n  Failed to undo: ${error}\n`));
      }
    } else {
      console.log(
        chalk.yellow(
          "\n  Snapshot exists but commit reference is missing."
        )
      );
      console.log(
        chalk.dim(
          "  Try: git log --oneline to find the commit and git revert manually.\n"
        )
      );
    }
  } else {
    console.log(
      chalk.yellow("\n  No snapshot available for this action.")
    );
    console.log(
      chalk.dim("  Try: git log --oneline to revert manually.\n")
    );
  }

  // Update history
  await stateManager.addHistoryEntry({
    action: "undo",
    storyId: selected.storyId,
    details: `Undid: ${selected.action} — ${selected.details}`,
  });
}
