// ============================================================
// forge build — Build stories sequentially
// ============================================================

import chalk from "chalk";
import { stateManager } from "../../state/index.js";
import { Pipeline } from "../../core/pipeline/index.js";

export async function buildCommand(options?: { story?: string }) {
  const config = await stateManager.getConfig();
  if (!config) {
    console.log(chalk.red("\n  Forge not initialized. Run: forge init\n"));
    return;
  }

  const plan = await stateManager.getPlan();
  if (!plan) {
    console.log(
      chalk.red('\n  No sprint plan found. Run: forge plan "description"\n')
    );
    return;
  }

  // If building a specific story, filter the plan
  if (options?.story) {
    const story = plan.epics
      .flatMap((e) => e.stories)
      .find((s) => s.id === options.story);

    if (!story) {
      console.log(chalk.red(`\n  Story "${options.story}" not found.\n`));
      return;
    }

    if (story.status === "done") {
      console.log(chalk.yellow(`\n  Story "${story.title}" is already done.\n`));
      return;
    }
  }

  const pipeline = new Pipeline(config);
  await pipeline.runBuildPhase(plan);
}
