// ============================================================
// forge review — Run QA review on completed stories
// ============================================================

import chalk from "chalk";
import { stateManager } from "../../state/index.js";
import { Pipeline } from "../../core/pipeline/index.js";

export async function reviewCommand(options?: { story?: string }) {
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

  const reviewable = plan.epics
    .flatMap((e) => e.stories)
    .filter((s) => s.status === "reviewing");

  if (reviewable.length === 0) {
    console.log(
      chalk.yellow("\n  No stories ready for review. Run: forge build\n")
    );
    return;
  }

  const pipeline = new Pipeline(config);
  await pipeline.runReviewPhase(plan);
}
