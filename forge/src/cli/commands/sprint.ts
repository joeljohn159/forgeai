// ============================================================
// forge sprint — Full pipeline: plan → design → build → review
// ============================================================

import chalk from "chalk";
import inquirer from "inquirer";
import { stateManager } from "../../state/index.js";
import { Pipeline } from "../../core/pipeline/index.js";

export async function sprintCommand(description?: string) {
  const config = await stateManager.getConfig();
  if (!config) {
    console.log(chalk.red("\n  Forge not initialized. Run: forge init\n"));
    return;
  }

  if (!description) {
    const { desc } = await inquirer.prompt([
      {
        type: "input",
        name: "desc",
        message: "What do you want to build?",
        validate: (input: string) =>
          input.length > 10 || "Please provide a more detailed description",
      },
    ]);
    description = desc;
  }

  const pipeline = new Pipeline(config);
  await pipeline.runSprint(description!);
}
