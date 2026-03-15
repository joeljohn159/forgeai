import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import type { ForgeConfig } from "../../types/plan.js";

const DEFAULT_CONFIG: ForgeConfig = {
  framework: "nextjs",
  model: "sonnet",
  designPreview: "storybook",
  githubSync: false,
  githubRepo: null,
  autoCommit: true,
  storybook: {
    port: 6006,
  },
};

export async function initCommand(options: {
  framework?: string;
  storybook?: boolean;
}) {
  console.log(
    chalk.bold("\n⚡ Forge") + " — Initializing project\n"
  );

  // ── Check if already initialized ────────────────────────
  const forgeDir = path.join(process.cwd(), ".forge");
  const exists = await fs
    .access(forgeDir)
    .then(() => true)
    .catch(() => false);

  if (exists) {
    console.log(
      chalk.yellow("  .forge/ directory already exists. Reinitialize? ")
    );
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: "Overwrite existing Forge config?",
        default: false,
      },
    ]);
    if (!confirm) {
      console.log(chalk.dim("  Aborted."));
      return;
    }
  }

  // ── Gather preferences ──────────────────────────────────
  const answers = await inquirer.prompt([
    {
      type: "list",
      name: "framework",
      message: "What framework are you using?",
      choices: [
        { name: "Next.js (TypeScript + Tailwind + App Router)", value: "nextjs" },
        { name: "React + Vite (TypeScript SPA)", value: "react" },
        { name: "Django (Python + DRF)", value: "django" },
        { name: "Flutter (coming soon)", value: "flutter", disabled: true },
      ],
      default: options.framework || "nextjs",
    },
    {
      type: "list",
      name: "model",
      message: "Which Claude model should agents use?",
      choices: [
        { name: "Sonnet (fast, cost-effective)", value: "sonnet" },
        { name: "Opus (highest quality, slower)", value: "opus" },
        { name: "Haiku (fastest, basic tasks)", value: "haiku" },
      ],
      default: "sonnet",
    },
    {
      type: "confirm",
      name: "githubSync",
      message: "Sync sprint board to GitHub Issues/Projects?",
      default: false,
    },
  ]);

  let githubRepo: string | null = null;
  if (answers.githubSync) {
    const { repo } = await inquirer.prompt([
      {
        type: "input",
        name: "repo",
        message: "GitHub repo (owner/repo):",
        validate: (input: string) =>
          input.includes("/") || "Use format: owner/repo",
      },
    ]);
    githubRepo = repo;
  }

  // ── Create .forge directory ─────────────────────────────
  const spinner = ora("Creating .forge directory...").start();

  const config: ForgeConfig = {
    ...DEFAULT_CONFIG,
    framework: answers.framework,
    model: answers.model,
    githubSync: answers.githubSync,
    githubRepo,
  };

  try {
    // Create directories
    await fs.mkdir(forgeDir, { recursive: true });
    await fs.mkdir(path.join(forgeDir, "snapshots"), { recursive: true });
    await fs.mkdir(path.join(forgeDir, "designs"), { recursive: true });

    // Write config
    await fs.writeFile(
      path.join(process.cwd(), "forge.config.json"),
      JSON.stringify(config, null, 2)
    );

    // Write initial state
    await fs.writeFile(
      path.join(forgeDir, "state.json"),
      JSON.stringify(
        {
          currentPhase: "init",
          currentStory: null,
          workerMode: null,
          queue: [],
          history: [],
        },
        null,
        2
      )
    );

    // Add .forge/snapshots to .gitignore (snapshots can be large)
    const gitignorePath = path.join(process.cwd(), ".gitignore");
    const gitignoreExists = await fs
      .access(gitignorePath)
      .then(() => true)
      .catch(() => false);

    if (gitignoreExists) {
      const content = await fs.readFile(gitignorePath, "utf-8");
      if (!content.includes(".forge/snapshots")) {
        await fs.appendFile(gitignorePath, "\n# Forge snapshots\n.forge/snapshots/\n");
      }
    }

    spinner.succeed("Created .forge/ directory");

    // ── Summary ─────────────────────────────────────────────
    console.log(
      chalk.green("\n  ✅ Forge initialized!\n")
    );
    console.log("  Created:");
    console.log(chalk.dim("    .forge/state.json        — Sprint state"));
    console.log(chalk.dim("    .forge/snapshots/        — Action snapshots"));
    console.log(chalk.dim("    .forge/designs/          — Design metadata"));
    console.log(chalk.dim("    forge.config.json        — Project config"));

    if (answers.githubSync) {
      console.log(
        chalk.cyan(
          `\n  🔗 GitHub sync enabled for ${githubRepo}`
        )
      );
    } else {
      console.log(
        chalk.dim(
          "\n  💡 Tip: Run " +
            chalk.white("forge init --github") +
            " later to enable GitHub sync"
        )
      );
    }

    console.log(
      chalk.bold(
        "\n  Next step: " +
          chalk.cyan('forge plan "describe your app"') +
          "\n"
      )
    );
  } catch (error) {
    spinner.fail("Failed to initialize Forge");
    console.error(chalk.red(`  ${error}`));
    process.exit(1);
  }
}
