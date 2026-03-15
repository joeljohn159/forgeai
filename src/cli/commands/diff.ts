// ============================================================
// forge diff <v1> [v2] — Show changes between versions
// ============================================================

import chalk from "chalk";
import { GitManager } from "../../core/git/index.js";

export async function diffCommand(v1: string, v2?: string) {
  const git = new GitManager();

  // Resolve tag names — allow shorthand like "v0.3" or full "forge/v0.3-story"
  const resolveRef = async (ref: string): Promise<string> => {
    // Try exact ref first
    const tags = await git.listTags();

    // Exact match
    if (tags.includes(ref)) return ref;

    // Try with forge/ prefix
    const prefixed = `forge/${ref}`;
    if (tags.includes(prefixed)) return prefixed;

    // Partial match
    const match = tags.find((t) => t.includes(ref));
    if (match) return match;

    // Assume it's a commit hash
    return ref;
  };

  const ref1 = await resolveRef(v1);
  const ref2 = v2 ? await resolveRef(v2) : "HEAD";

  console.log(chalk.bold("\n  forge diff"));
  console.log(chalk.dim(`  ${ref1} → ${ref2}\n`));

  try {
    const diff = await git.getDiff2(ref1, ref2);

    if (!diff.trim()) {
      console.log(chalk.dim("  No differences found.\n"));
      return;
    }

    // Parse and colorize diff
    const lines = diff.split("\n");
    for (const line of lines) {
      if (line.startsWith("diff --git")) {
        console.log(chalk.bold(chalk.white(`  ${line}`)));
      } else if (line.startsWith("+++") || line.startsWith("---")) {
        console.log(chalk.dim(`  ${line}`));
      } else if (line.startsWith("+")) {
        console.log(chalk.green(`  ${line}`));
      } else if (line.startsWith("-")) {
        console.log(chalk.red(`  ${line}`));
      } else if (line.startsWith("@@")) {
        console.log(chalk.cyan(`  ${line}`));
      } else {
        console.log(chalk.dim(`  ${line}`));
      }
    }

    // Summary
    const filesChanged = lines.filter((l) => l.startsWith("diff --git")).length;
    const additions = lines.filter((l) => l.startsWith("+") && !l.startsWith("+++")).length;
    const deletions = lines.filter((l) => l.startsWith("-") && !l.startsWith("---")).length;
    console.log("");
    console.log(chalk.dim(`  ${filesChanged} files changed, `) +
      chalk.green(`${additions} additions`) +
      chalk.dim(", ") +
      chalk.red(`${deletions} deletions`) +
      "\n"
    );
  } catch (err) {
    console.log(chalk.red(`  Could not compute diff: ${err instanceof Error ? err.message : err}`));
    console.log(chalk.dim("  Make sure both references exist (use forge history to see tags).\n"));
  }
}
