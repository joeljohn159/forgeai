// ============================================================
// forge map — Terminal sprint visualization
// Shows stories as a tree with status, dependencies, and tags.
// ============================================================

import chalk from "chalk";
import { stateManager } from "../../state/index.js";
import type { Story, Plan, Epic } from "../../types/plan.js";

const STATUS_ICON: Record<string, string> = {
  planned: chalk.dim("○"),
  designing: chalk.blue("◐"),
  "design-approved": chalk.cyan("◑"),
  building: chalk.yellow("◑"),
  reviewing: chalk.magenta("◕"),
  done: chalk.green("●"),
  blocked: chalk.red("✕"),
};

const STATUS_COLOR: Record<string, (s: string) => string> = {
  planned: chalk.dim,
  designing: chalk.blue,
  "design-approved": chalk.cyan,
  building: chalk.yellow,
  reviewing: chalk.magenta,
  done: chalk.green,
  blocked: chalk.red,
};

export async function mapCommand() {
  const plan = await stateManager.getPlan();
  if (!plan) {
    console.log(chalk.red("\n  No sprint plan found. Run: forge plan\n"));
    return;
  }

  const allStories = plan.epics.flatMap((e) => e.stories);
  const done = allStories.filter((s) => s.status === "done").length;
  const total = allStories.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // Header
  console.log("");
  console.log(chalk.bold(`  ${plan.project}`) + chalk.dim(` · ${plan.framework}`));
  console.log(chalk.dim(`  ${plan.description}`));
  console.log("");

  // Progress bar
  const barWidth = 30;
  const filled = Math.round((done / total) * barWidth);
  const bar = chalk.green("█".repeat(filled)) + chalk.dim("░".repeat(barWidth - filled));
  console.log(`  ${bar} ${chalk.bold(`${pct}%`)} ${chalk.dim(`(${done}/${total} stories)`)}`);
  console.log("");

  // Sprint map
  for (const epic of plan.epics) {
    const epicDone = epic.stories.filter((s) => s.status === "done").length;
    const epicTotal = epic.stories.length;
    const epicStatus = epicDone === epicTotal ? chalk.green("done") :
      epicDone > 0 ? chalk.yellow("in progress") : chalk.dim("planned");

    console.log(`  ${chalk.bold(epic.title)} ${chalk.dim(`(${epicDone}/${epicTotal})`)} ${epicStatus}`);

    for (let i = 0; i < epic.stories.length; i++) {
      const story = epic.stories[i];
      const isLast = i === epic.stories.length - 1;
      const connector = isLast ? "└" : "├";
      const icon = STATUS_ICON[story.status] || chalk.dim("?");
      const colorFn = STATUS_COLOR[story.status] || chalk.dim;
      const typeTag = chalk.dim(`[${story.type === "ui" ? "ui" : story.type === "backend" ? "api" : "full"}]`);

      let line = `  ${chalk.dim(connector + "─")} ${icon} ${colorFn(story.title)} ${typeTag}`;

      // Show tags
      if (story.tags.length > 0) {
        line += " " + chalk.dim(story.tags[story.tags.length - 1]);
      }

      console.log(line);

      // Show dependencies
      if (story.dependencies.length > 0) {
        const depPrefix = isLast ? "   " : "  │";
        const depNames = story.dependencies
          .map((depId) => {
            const dep = allStories.find((s) => s.id === depId);
            if (!dep) return chalk.dim(depId);
            const depIcon = STATUS_ICON[dep.status] || "?";
            return `${depIcon} ${chalk.dim(dep.title)}`;
          })
          .join(", ");
        console.log(chalk.dim(`${depPrefix}  ← depends on: ${depNames}`));
      }
    }
    console.log("");
  }

  // Legend
  console.log(chalk.dim("  Legend: ") +
    `${chalk.dim("○")} planned  ` +
    `${chalk.blue("◐")} designing  ` +
    `${chalk.yellow("◑")} building  ` +
    `${chalk.magenta("◕")} reviewing  ` +
    `${chalk.green("●")} done  ` +
    `${chalk.red("✕")} blocked`
  );
  console.log("");
}
