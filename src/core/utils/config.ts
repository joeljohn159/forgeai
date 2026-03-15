// ============================================================
// Config Validation
// Validates forge.config.json before running commands.
// ============================================================

import chalk from "chalk";
import type { ForgeConfig } from "../../types/plan.js";
import { listAdapters } from "../adapters/index.js";

export interface ConfigValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateConfig(config: any): ConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!config || typeof config !== "object") {
    return { valid: false, errors: ["Config is empty or not an object"], warnings: [] };
  }

  // Framework
  const frameworks = listAdapters().map((a) => a.id);
  if (!config.framework) {
    errors.push("Missing 'framework' field");
  } else if (!frameworks.includes(config.framework)) {
    errors.push(
      `Unknown framework "${config.framework}". Supported: ${frameworks.join(", ")}`
    );
  }

  // Model
  const validModels = ["sonnet", "opus", "haiku"];
  if (!config.model) {
    errors.push("Missing 'model' field");
  } else if (!validModels.includes(config.model)) {
    warnings.push(
      `Unknown model "${config.model}". Expected: ${validModels.join(", ")}`
    );
  }

  // GitHub sync
  if (config.githubSync && !config.githubRepo) {
    warnings.push("GitHub sync enabled but no repo configured");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/** Validate config and print errors. Returns config if valid, null if not. */
export function loadAndValidateConfig(raw: any): ForgeConfig | null {
  const result = validateConfig(raw);

  if (result.warnings.length > 0) {
    for (const w of result.warnings) {
      console.log(chalk.yellow(`  warning: ${w}`));
    }
  }

  if (!result.valid) {
    for (const e of result.errors) {
      console.log(chalk.red(`  error: ${e}`));
    }
    console.log(chalk.dim("\n  Fix forge.config.json or run: forge init\n"));
    return null;
  }

  return raw as ForgeConfig;
}
