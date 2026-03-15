// ============================================================
// forge design — Generate and review design previews
// ============================================================

import chalk from "chalk";
import fs from "fs/promises";
import path from "path";
import ora from "ora";
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

  // ── Design Import ───────────────────────────────────────
  if (options?.import) {
    await importDesigns(options.import);
    return;
  }

  const pipeline = new Pipeline(config);
  await pipeline.runDesignPhase(plan);
}

/** Import design files (screenshots, mockups) as references */
async function importDesigns(importPath: string): Promise<void> {
  const spinner = ora({ text: "Importing designs...", indent: 2 }).start();

  const absPath = path.resolve(importPath);

  // Check if path exists
  try {
    const stat = await fs.stat(absPath);

    let files: string[] = [];

    if (stat.isDirectory()) {
      // Import all image files from directory
      const entries = await fs.readdir(absPath);
      const imageExts = [".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif"];
      files = entries
        .filter((f) => imageExts.includes(path.extname(f).toLowerCase()))
        .map((f) => path.join(absPath, f));
    } else {
      // Single file
      files = [absPath];
    }

    if (files.length === 0) {
      spinner.warn("No image files found (png, jpg, svg, webp, gif)");
      return;
    }

    // Copy to .forge/designs/references/
    await stateManager.saveDesignReferences(files);

    spinner.succeed(`Imported ${files.length} design reference${files.length > 1 ? "s" : ""}`);

    console.log("");
    for (const file of files) {
      console.log(chalk.dim(`    ${path.basename(file)}`));
    }
    console.log("");

    console.log(
      chalk.dim("  These references will be used in the design and build phases.")
    );
    console.log(
      chalk.dim("  The AI agent will read them and match the visual style.\n")
    );
  } catch {
    spinner.fail(`Path not found: ${absPath}`);
  }
}
