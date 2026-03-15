// ============================================================
// forge design — Generate and review design previews
// ============================================================

import chalk from "chalk";
import { stateManager } from "../../state/index.js";
import { Pipeline } from "../../core/pipeline/index.js";

export async function designCommand(options?: {
  story?: string;
  import?: string;
}) {
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

  if (options?.import) {
    console.log(chalk.bold("\n  📁 Importing designs from: " + options.import));
    // TODO: Import user's existing designs, map to stories
    console.log(chalk.yellow("  Design import coming in v0.2\n"));
    return;
  }

  const pipeline = new Pipeline(config);
  await pipeline.runDesignPhase(plan);
}
