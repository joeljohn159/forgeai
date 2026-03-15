// ============================================================
// forge history — Show version timeline and checkpoints
// ============================================================

import chalk from "chalk";
import { stateManager } from "../../state/index.js";
import { GitManager } from "../../core/git/index.js";

export async function historyCommand() {
  const config = await stateManager.getConfig();
  if (!config) {
    console.log(chalk.red("\n  Forge not initialized. Run: forge init\n"));
    return;
  }

  const git = new GitManager();
  const state = await stateManager.getState();
  const plan = await stateManager.getPlan();

  console.log(chalk.bold("\n  Forge History\n"));

  // ── Checkpoints (tags) ──────────────────────────────────
  const tags = await git.listTags();
  if (tags.length > 0) {
    console.log(chalk.bold("  Checkpoints\n"));
    for (const tag of [...tags].reverse()) {
      const label = tag.replace("forge/", "");
      console.log(`    ${chalk.cyan(tag)}  ${chalk.dim(label)}`);
    }
    console.log("");
  }

  // ── Activity log (commits) ──────────────────────────────
  console.log(chalk.bold("  Activity\n"));

  const log = await git.getForgeLog(30);
  if (log.length === 0) {
    console.log(chalk.dim("    No activity yet.\n"));
  } else {
    for (const entry of log) {
      const date = new Date(entry.date);
      const timeStr = date.toLocaleDateString() + " " + date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const hash = entry.hash.slice(0, 7);

      // Color by commit type
      let msgColor = chalk.white;
      if (entry.message.startsWith("feat:")) msgColor = chalk.green;
      else if (entry.message.startsWith("fix:")) msgColor = chalk.yellow;
      else if (entry.message.startsWith("forge:")) msgColor = chalk.cyan;
      else if (entry.message.startsWith("docs:")) msgColor = chalk.blue;
      else if (entry.message.startsWith("ci:")) msgColor = chalk.magenta;

      // Check for tags at this commit
      const commitTags = await git.getTagsAtCommit(entry.hash);
      const tagStr = commitTags.length > 0
        ? " " + commitTags.map((t) => chalk.cyan(`[${t}]`)).join(" ")
        : "";

      console.log(
        chalk.dim(`    ${hash}`) +
        `  ${msgColor(entry.message)}` +
        tagStr +
        chalk.dim(`  ${timeStr}`)
      );
    }
    console.log("");
  }

  // ── Sprint state ────────────────────────────────────────
  if (plan) {
    const allStories = plan.epics.flatMap((e) => e.stories);
    const done = allStories.filter((s) => s.status === "done").length;
    const blocked = allStories.filter((s) => s.status === "blocked").length;
    const total = allStories.length;

    console.log(chalk.bold("  Sprint\n"));
    console.log(chalk.dim(`    Phase: ${state.currentPhase}`));
    console.log(chalk.dim(`    Stories: ${done}/${total} done${blocked > 0 ? `, ${blocked} blocked` : ""}`));
    console.log(chalk.dim(`    History entries: ${state.history.length}`));
    console.log("");
  }

  // ── Hint ────────────────────────────────────────────────
  if (tags.length > 0) {
    console.log(chalk.dim(`  Tip: ${chalk.white("forge checkout <tag>")} to jump to a checkpoint\n`));
  }
}

// ============================================================
// forge checkout — Jump to a specific version
// ============================================================

export async function checkoutCommand(version: string) {
  const git = new GitManager();

  // Try as a forge tag first
  const tags = await git.listTags();
  const match = tags.find((t) => t === version || t === `forge/${version}`);

  if (match) {
    await git.checkoutTag(match);
    console.log(chalk.green(`\n  Checked out ${match}\n`));
    console.log(chalk.dim("  You are in detached HEAD state."));
    console.log(chalk.dim("  To go back: " + chalk.white("git checkout main") + "\n"));
    return;
  }

  // Try as a commit hash
  try {
    await git.checkout(version);
    console.log(chalk.green(`\n  Checked out ${version}\n`));
  } catch {
    console.log(chalk.red(`\n  Version "${version}" not found.`));
    console.log(chalk.dim("  Run: " + chalk.white("forge history") + " to see available versions.\n"));
  }
}
