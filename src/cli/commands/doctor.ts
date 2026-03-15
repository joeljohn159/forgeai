// ============================================================
// forge doctor — Diagnose setup issues
// ============================================================

import chalk from "chalk";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import path from "path";
import { stateManager } from "../../state/index.js";
import { listAdapters } from "../../core/adapters/index.js";

interface Check {
  name: string;
  status: "pass" | "fail" | "warn";
  detail: string;
  fix?: string;
}

function checkCommand(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function getVersion(cmd: string): string {
  try {
    return execSync(`${cmd} --version`, { encoding: "utf-8" }).trim().split("\n")[0];
  } catch {
    return "unknown";
  }
}

export async function doctorCommand() {
  console.log(chalk.bold("\n  forge doctor\n"));

  const checks: Check[] = [];

  // 1. Node.js
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1));
  checks.push({
    name: "Node.js",
    status: nodeMajor >= 18 ? "pass" : "fail",
    detail: nodeVersion,
    fix: nodeMajor < 18 ? "Upgrade to Node.js 18+: https://nodejs.org" : undefined,
  });

  // 2. Git
  const hasGit = checkCommand("git");
  checks.push({
    name: "Git",
    status: hasGit ? "pass" : "fail",
    detail: hasGit ? getVersion("git") : "not found",
    fix: !hasGit ? "Install git: https://git-scm.com" : undefined,
  });

  // 3. Claude Code CLI
  const hasClaude = checkCommand("claude");
  checks.push({
    name: "Claude Code CLI",
    status: hasClaude ? "pass" : "fail",
    detail: hasClaude ? "installed" : "not found",
    fix: !hasClaude ? "npm install -g @anthropic-ai/claude-code" : undefined,
  });

  // 4. Claude auth
  const claudeDir = path.join(homedir(), ".claude");
  const hasAuth = existsSync(claudeDir);
  checks.push({
    name: "Claude auth",
    status: hasClaude && hasAuth ? "pass" : hasClaude ? "fail" : "warn",
    detail: hasAuth ? "logged in" : "not logged in",
    fix: !hasAuth ? "claude login" : undefined,
  });

  // 5. Forge initialized
  const config = await stateManager.getConfig();
  checks.push({
    name: "Forge project",
    status: config ? "pass" : "warn",
    detail: config ? `${config.framework} · ${config.model}` : "not initialized in this directory",
    fix: !config ? "forge init" : undefined,
  });

  // 6. Sprint plan
  const plan = await stateManager.getPlan();
  checks.push({
    name: "Sprint plan",
    status: plan ? "pass" : "warn",
    detail: plan
      ? `${plan.project} · ${plan.epics.flatMap((e) => e.stories).length} stories`
      : "no plan",
    fix: !plan ? 'forge plan "description"' : undefined,
  });

  // 7. Framework tools
  if (config) {
    const framework = config.framework;
    if (framework === "nextjs" || framework === "react") {
      const hasNpm = checkCommand("npm");
      checks.push({
        name: "npm",
        status: hasNpm ? "pass" : "fail",
        detail: hasNpm ? getVersion("npm").replace("npm ", "") : "not found",
      });
    }
    if (framework === "django") {
      const hasPython = checkCommand("python3");
      checks.push({
        name: "Python 3",
        status: hasPython ? "pass" : "fail",
        detail: hasPython ? getVersion("python3") : "not found",
        fix: !hasPython ? "Install Python 3.10+: https://python.org" : undefined,
      });
    }
  }

  // 8. GitHub CLI (optional)
  const hasGh = checkCommand("gh");
  checks.push({
    name: "GitHub CLI",
    status: hasGh ? "pass" : "warn",
    detail: hasGh ? "installed" : "not installed (optional, for GitHub sync)",
    fix: !hasGh ? "https://cli.github.com (optional)" : undefined,
  });

  // Display results
  let hasFailure = false;
  for (const check of checks) {
    const icon = check.status === "pass" ? chalk.green("OK")
      : check.status === "fail" ? chalk.red("FAIL")
      : chalk.yellow("WARN");
    console.log(`  ${icon}  ${chalk.bold(check.name)} ${chalk.dim(check.detail)}`);
    if (check.fix) {
      console.log(chalk.dim(`       fix: ${check.fix}`));
    }
    if (check.status === "fail") hasFailure = true;
  }

  console.log("");

  // Supported frameworks
  console.log(chalk.dim("  Supported frameworks:"));
  for (const adapter of listAdapters()) {
    console.log(chalk.dim(`    ${adapter.name} (${adapter.language})`));
  }
  console.log("");

  if (hasFailure) {
    console.log(chalk.red("  Some checks failed. Fix the issues above before running Forge.\n"));
  } else {
    console.log(chalk.green("  All checks passed. Forge is ready.\n"));
  }
}
