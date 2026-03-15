// ============================================================
// forge push — Push project to GitHub remote
// Pushes commits and tags to origin.
// ============================================================

import chalk from "chalk";
import ora from "ora";
import { stateManager } from "../../state/index.js";
import { GitManager } from "../../core/git/index.js";

export async function pushCommand() {
  const config = await stateManager.getConfig();
  if (!config) {
    console.log(chalk.red("\n  Forge not initialized. Run: forge init\n"));
    return;
  }

  const git = new GitManager();

  // Check remote exists
  const hasRemote = await git.hasRemote();
  if (!hasRemote) {
    console.log(chalk.red("\n  No remote 'origin' found."));
    console.log(chalk.dim("  Add one with: git remote add origin <url>\n"));
    return;
  }

  const spinner = ora({ text: "Pushing to origin...", indent: 2 }).start();

  try {
    // Commit any uncommitted changes first
    const hasChanges = await git.hasUncommittedChanges();
    if (hasChanges) {
      await git.commitAll("forge: save progress before push");
      spinner.text = "Committed uncommitted changes, pushing...";
    }

    // Push commits
    await git.push();
    spinner.text = "Pushing tags...";

    // Push tags
    await git.pushTags();

    spinner.succeed("Pushed to origin (commits + tags)");

    const branch = await git.getCurrentBranch();
    console.log(chalk.dim(`  Branch: ${branch}\n`));
  } catch (err) {
    spinner.fail("Push failed");
    const msg = err instanceof Error ? err.message : String(err);
    console.log(chalk.red(`  ${msg}\n`));
    console.log(chalk.dim("  Make sure you have push access and the remote is configured.\n"));
  }
}
