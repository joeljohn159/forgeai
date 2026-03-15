// ============================================================
// forge clean — Reset forge state
// ============================================================

import chalk from "chalk";
import fs from "fs/promises";
import path from "path";
import inquirer from "inquirer";

export async function cleanCommand(options: { force?: boolean; snapshots?: boolean }) {
  const forgeDir = path.join(process.cwd(), ".forge");

  try {
    await fs.access(forgeDir);
  } catch {
    console.log(chalk.red("\n  No .forge/ directory found. Nothing to clean.\n"));
    return;
  }

  if (options.snapshots) {
    // Only clean snapshots
    const snapshotsDir = path.join(forgeDir, "snapshots");
    try {
      const files = await fs.readdir(snapshotsDir);
      if (files.length === 0) {
        console.log(chalk.dim("\n  No snapshots to clean.\n"));
        return;
      }
      for (const file of files) {
        await fs.unlink(path.join(snapshotsDir, file));
      }
      console.log(chalk.green(`\n  Cleaned ${files.length} snapshots.\n`));
    } catch {
      console.log(chalk.dim("\n  No snapshots directory found.\n"));
    }
    return;
  }

  // Full clean
  console.log(chalk.bold("\n  forge clean\n"));
  console.log(chalk.dim("  This will remove:"));
  console.log(chalk.dim("    .forge/plan.json       — Sprint plan"));
  console.log(chalk.dim("    .forge/state.json      — Sprint state"));
  console.log(chalk.dim("    .forge/snapshots/      — All snapshots"));
  console.log(chalk.dim("    .forge/designs/        — Design metadata"));
  console.log(chalk.dim("\n  forge.config.json will be kept.\n"));

  if (!options.force) {
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: "Reset sprint state? This cannot be undone.",
        default: false,
      },
    ]);
    if (!confirm) {
      console.log(chalk.dim("  Cancelled.\n"));
      return;
    }
  }

  // Remove plan, state, snapshots, designs
  const toRemove = ["plan.json", "state.json"];
  for (const file of toRemove) {
    try {
      await fs.unlink(path.join(forgeDir, file));
    } catch {
      // File doesn't exist, skip
    }
  }

  const dirsToClean = ["snapshots", "designs"];
  for (const dir of dirsToClean) {
    const dirPath = path.join(forgeDir, dir);
    try {
      await fs.rm(dirPath, { recursive: true });
      await fs.mkdir(dirPath, { recursive: true });
    } catch {
      // Directory doesn't exist, skip
    }
  }

  // Write fresh state
  await fs.writeFile(
    path.join(forgeDir, "state.json"),
    JSON.stringify({
      currentPhase: "init",
      currentStory: null,
      workerMode: null,
      queue: [],
      history: [],
    }, null, 2)
  );

  console.log(chalk.green("  Sprint state reset. Config preserved.\n"));
  console.log(chalk.dim('  Start fresh: forge plan "description"\n'));
}
