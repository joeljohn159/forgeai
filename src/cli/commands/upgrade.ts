// ============================================================
// forge upgrade — Upgrade Forge to the latest version
// ============================================================

import chalk from "chalk";
import ora from "ora";
import { execSync } from "child_process";

export async function upgradeCommand() {
  // Get current version from package.json
  const currentVersion = getCurrentVersion();

  console.log(chalk.bold("\n  forge") + chalk.dim(" upgrade\n"));

  // Check latest version on npm
  const checkSpinner = ora({ text: "Checking for updates...", indent: 2 }).start();

  let latestVersion: string;
  try {
    latestVersion = execSync("npm view forgecraft version", { encoding: "utf-8" }).trim();
  } catch {
    checkSpinner.fail("Could not check for updates");
    console.log(chalk.dim("  Check your internet connection and try again.\n"));
    return;
  }

  if (currentVersion === latestVersion) {
    checkSpinner.succeed(`Already on latest version (${currentVersion})`);
    console.log("");
    return;
  }

  checkSpinner.succeed(`Update available: ${chalk.dim(currentVersion)} → ${chalk.green(latestVersion)}`);

  // Run the upgrade
  const upgradeSpinner = ora({ text: `Installing forgecraft@${latestVersion}...`, indent: 2 }).start();

  try {
    execSync("npm install -g forgecraft@latest", {
      stdio: "pipe",
      encoding: "utf-8",
    });
    upgradeSpinner.succeed(`Upgraded to ${chalk.green(latestVersion)}`);
    console.log(chalk.dim(`\n  Run ${chalk.white("forge --version")} to verify.\n`));
  } catch (err) {
    upgradeSpinner.fail("Upgrade failed");
    const msg = err instanceof Error ? (err as any).stderr || err.message : String(err);

    // Check for permission errors
    if (msg.includes("EACCES") || msg.includes("permission") || msg.includes("EPERM")) {
      if (process.platform === "win32") {
        console.log(chalk.dim("  Try running as Administrator:\n"));
        console.log(chalk.white("    npm install -g forgecraft@latest\n"));
      } else {
        console.log(chalk.dim("  Try running with sudo:\n"));
        console.log(chalk.white("    sudo npm install -g forgecraft@latest\n"));
      }
    } else {
      console.log(chalk.dim(`  ${msg.split("\n")[0]}\n`));
      console.log(chalk.dim("  Manual upgrade:\n"));
      console.log(chalk.white("    npm install -g forgecraft@latest\n"));
    }
  }
}

function getCurrentVersion(): string {
  try {
    // Read from the installed package
    const output = execSync("forge --version", { encoding: "utf-8" }).trim();
    return output;
  } catch {
    return "unknown";
  }
}
