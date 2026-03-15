// ============================================================
// forge auto — Fully autonomous "Lead Agent" mode
// Runs plan > design > build > review with no human gates
// (except a review gate after build).
// Agent operates in a sandboxed environment for safety.
// Users can type messages anytime — queued and handled between stories.
// ============================================================

import chalk from "chalk";
import inquirer from "inquirer";
import { stateManager } from "../../state/index.js";
import { AutoPipeline } from "../../core/pipeline/auto.js";

export async function autoCommand(
  description: string | undefined,
  options: {
    sandbox?: boolean;
    quiet?: boolean;
    allowNetwork?: string;
    mute?: boolean;
    deploy?: boolean;
  }
) {
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

  const allowedDomains = options.allowNetwork
    ? options.allowNetwork.split(",").map((d) => d.trim())
    : undefined;

  const pipeline = new AutoPipeline(config, {
    sandbox: options.sandbox !== false,
    quiet: options.quiet ?? false,
    mute: options.mute ?? false,
    deploy: options.deploy ?? false,
    allowedDomains,
  });

  const result = await pipeline.run(description!);

  if (!result.success) {
    process.exitCode = 1;
  }
}
