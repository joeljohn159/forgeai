// ============================================================
// forge status — Show current sprint state and progress
// ============================================================

import chalk from "chalk";
import { stateManager } from "../../state/index.js";
import { GitManager } from "../../core/git/index.js";

const STATUS_ICONS: Record<string, string> = {
  planned: "📋",
  designing: "🎨",
  "design-approved": "✅",
  building: "🔧",
  reviewing: "🔍",
  done: "✅",
  blocked: "🚫",
};

export async function statusCommand() {
  const config = await stateManager.getConfig();
  if (!config) {
    console.log(chalk.red("\n  Forge not initialized. Run: forge init\n"));
    return;
  }

  const plan = await stateManager.getPlan();
  const state = await stateManager.getState();
  const git = new GitManager();

  console.log(chalk.bold("\n⚡ Forge Status\n"));

  // ── Project info ────────────────────────────────────────
  if (plan) {
    console.log(chalk.bold(`  Project: ${plan.project}`));
    console.log(chalk.dim(`  Framework: ${plan.framework}`));
    console.log(chalk.dim(`  Phase: ${state.currentPhase}`));

    const currentBranch = await git.getCurrentBranch();
    console.log(chalk.dim(`  Branch: ${currentBranch}`));
    console.log("");

    // ── Sprint progress ───────────────────────────────────
    const allStories = plan.epics.flatMap((e) => e.stories);
    const done = allStories.filter((s) => s.status === "done").length;
    const total = allStories.length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    const barWidth = 30;
    const filled = Math.round((percent / 100) * barWidth);
    const bar =
      chalk.green("█".repeat(filled)) +
      chalk.dim("░".repeat(barWidth - filled));

    console.log(`  Progress: ${bar} ${percent}% (${done}/${total} stories)`);
    console.log("");

    // ── Stories by status ─────────────────────────────────
    for (const epic of plan.epics) {
      console.log(chalk.bold(`  ${epic.title}`));
      for (const story of epic.stories) {
        const icon = STATUS_ICONS[story.status] || "❓";
        const statusText =
          story.status === "done"
            ? chalk.green(story.status)
            : story.status === "building" || story.status === "reviewing"
              ? chalk.yellow(story.status)
              : story.status === "blocked"
                ? chalk.red(story.status)
                : chalk.dim(story.status);

        const branchInfo = story.branch
          ? chalk.dim(` (${story.branch})`)
          : "";

        console.log(
          `    ${icon} ${story.title} — ${statusText}${branchInfo}`
        );
      }
      console.log("");
    }

    // ── Queued changes ────────────────────────────────────
    if (state.queue.length > 0) {
      console.log(chalk.bold("  Queued Changes:"));
      for (const change of state.queue) {
        console.log(chalk.yellow(`    📝 ${change.message}`));
      }
      console.log("");
    }

    // ── Tags ──────────────────────────────────────────────
    const tags = await git.listTags();
    if (tags.length > 0) {
      console.log(chalk.bold("  Checkpoints:"));
      for (const tag of tags) {
        console.log(chalk.dim(`    🏷️  ${tag}`));
      }
      console.log("");
    }
  } else {
    console.log(chalk.dim("  No sprint plan yet."));
    console.log(
      chalk.dim(
        '  Run: ' + chalk.white('forge plan "describe your app"') + "\n"
      )
    );
  }
}
