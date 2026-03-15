import chalk from "chalk";
import inquirer from "inquirer";
import fs from "fs/promises";
import path from "path";
import { getAdapter, refreshAdapters } from "../../core/adapters/index.js";
import { generateGitHubActions, generateGitLabCI, type CIProvider } from "../../core/utils/cicd.js";
import type { ForgeConfig } from "../../types/plan.js";

export async function cicdCommand(options: { provider?: string }) {
  console.log(chalk.bold("\n  forge") + chalk.dim(" cicd\n"));

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

  let provider: CIProvider = (options.provider as CIProvider) || "github";

  if (!options.provider) {
    try {
      const { selectedProvider } = await inquirer.prompt([
        {
          type: "list",
          name: "selectedProvider",
          message: "CI/CD provider:",
          choices: [
            { name: "GitHub Actions", value: "github" },
            { name: "GitLab CI", value: "gitlab" },
          ],
        },
      ]);
      provider = selectedProvider;
    } catch {
      console.log(chalk.dim("\n  Cancelled.\n"));
      return;
    }
  }

  await refreshAdapters();
  const adapter = getAdapter(config.framework);
  let content: string;
  let filePath: string;

  if (provider === "github") {
    content = generateGitHubActions(adapter);
    filePath = path.join(process.cwd(), ".github", "workflows", "ci.yml");
    await fs.mkdir(path.dirname(filePath), { recursive: true });
  } else {
    content = generateGitLabCI(adapter);
    filePath = path.join(process.cwd(), ".gitlab-ci.yml");
  }

  await fs.writeFile(filePath, content);

  const relative = path.relative(process.cwd(), filePath);
  console.log(chalk.green(`  Created: ${relative}`));
  console.log(chalk.dim(`  Framework: ${adapter.name}`));
  console.log(chalk.dim(`  Provider: ${provider === "github" ? "GitHub Actions" : "GitLab CI"}\n`));
}
