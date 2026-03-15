import chalk from "chalk";
import ora from "ora";
import { Worker } from "../../core/worker/index.js";
import { GitManager } from "../../core/git/index.js";
import { stateManager } from "../../state/index.js";
import { getAdapter, refreshAdapters } from "../../core/adapters/index.js";
import type { ForgeConfig, Plan } from "../../types/plan.js";
import fs from "fs/promises";
import path from "path";

export async function testCommand(options: { story?: string }) {
  console.log(chalk.bold("\n  forge") + chalk.dim(" test\n"));

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

  await refreshAdapters();
  let adapter: any = null;
  try { adapter = getAdapter(config.framework); } catch { /* ignore */ }

  const worker = new Worker(config, { sandbox: false, yes: true });
  const git = new GitManager();

  // Get stories to test
  const allStories = plan.epics.flatMap((e) => e.stories);
  let testable = allStories.filter(
    (s) => s.status === "reviewing" || s.status === "testing" || s.status === "done"
  );

  if (options.story) {
    testable = testable.filter((s) => s.id === options.story);
    if (testable.length === 0) {
      console.log(chalk.red(`  Story "${options.story}" not found or not built yet.\n`));
      return;
    }
  }

  if (testable.length === 0) {
    console.log(chalk.yellow("  No built stories to test. Run: forge build\n"));
    return;
  }

  console.log(chalk.dim(`  ${testable.length} stories to test\n`));

  for (let i = 0; i < testable.length; i++) {
    const story = testable[i];
    const label = `[${i + 1}/${testable.length}] ${story.title}`;
    const spinner = ora({ text: label, indent: 2 }).start();

    const isGeneric = !adapter || adapter.id === "generic";
    const testInfo = isGeneric
      ? "Detect the test framework from config files. Install test dependencies if needed."
      : `Test framework: ${adapter.testFramework || "Vitest"}\nTest command: ${adapter.testCommand || "npm test"}`;

    const prompt = `
      Generate tests for: "${story.title}"
      Description: ${story.description}
      App: ${plan.project} (${plan.framework})

      ${testInfo}

      1. Read the source files to understand what was built
      2. Create test files co-located with the source
      3. Write meaningful tests (happy path, errors, edge cases)
      4. Run the test suite — all tests must pass
    `;

    const result = await worker.run("test", prompt);

    if (result.success) {
      await git.commitAll(`test: ${story.title}`);
      spinner.succeed(`${label}` + chalk.dim(` · ${result.filesCreated.length} test files`));
    } else {
      spinner.warn(`${label}` + chalk.dim(" tests incomplete"));
      for (const err of result.errors) {
        console.log(chalk.red(`    ${err}`));
      }
    }
  }

  console.log(chalk.green("\n  Test generation complete.\n"));
}
