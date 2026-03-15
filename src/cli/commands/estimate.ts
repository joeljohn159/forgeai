import chalk from "chalk";
import { stateManager } from "../../state/index.js";
import { estimateCost, formatCostEstimate } from "../../core/utils/cost.js";
import fs from "fs/promises";
import path from "path";
import type { ForgeConfig, Plan } from "../../types/plan.js";

export async function estimateCommand() {
  console.log(chalk.bold("\n  forge") + chalk.dim(" estimate\n"));

  // Load config
  const configPath = path.join(process.cwd(), "forge.config.json");
  let config: ForgeConfig;
  try {
    const raw = await fs.readFile(configPath, "utf-8");
    config = JSON.parse(raw);
  } catch {
    console.log(chalk.red("  No forge.config.json found. Run: forge init\n"));
    return;
  }

  // Load plan
  const plan: Plan | null = await stateManager.getPlan();
  if (!plan) {
    console.log(chalk.red("  No sprint plan found. Run: forge plan\n"));
    return;
  }

  const estimate = estimateCost(plan, config.model);
  console.log(formatCostEstimate(estimate));
  console.log("");
}
