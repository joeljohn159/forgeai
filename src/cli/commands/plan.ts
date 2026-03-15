// ============================================================
// forge plan — Generate sprint plan
// ============================================================

import chalk from "chalk";
import inquirer from "inquirer";
import { stateManager } from "../../state/index.js";
import { Orchestrator } from "../../core/orchestrator/index.js";
import { Pipeline } from "../../core/pipeline/index.js";

export async function planCommand(
  description?: string,
  options?: { regen?: boolean }
) {
  const config = await stateManager.getConfig();
  if (!config) {
    console.log(
      chalk.red("\n  Forge not initialized. Run: forge init\n")
    );
    return;
  }

  if (!description) {
    const { desc } = await inquirer.prompt([
      {
        type: "input",
        name: "desc",
        message: "Describe your application:",
        validate: (input: string) =>
          input.length > 10 || "Please provide a more detailed description",
      },
    ]);
    description = desc;
  }

  const pipeline = new Pipeline(config);
  await pipeline.runPlanPhase(description!);
}
