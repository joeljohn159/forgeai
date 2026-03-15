// ============================================================
// forge export — Export sprint plan as markdown
// ============================================================

import chalk from "chalk";
import fs from "fs/promises";
import { stateManager } from "../../state/index.js";
import type { Story } from "../../types/plan.js";

const STATUS_LABEL: Record<string, string> = {
  planned: "[ ]",
  designing: "[~]",
  "design-approved": "[~]",
  building: "[~]",
  reviewing: "[~]",
  done: "[x]",
  blocked: "[!]",
};

export async function exportCommand(options: { output?: string }) {
  const plan = await stateManager.getPlan();
  if (!plan) {
    console.log(chalk.red("\n  No sprint plan found. Run: forge plan\n"));
    return;
  }

  const allStories = plan.epics.flatMap((e) => e.stories);
  const done = allStories.filter((s) => s.status === "done").length;

  let md = `# ${plan.project}\n\n`;
  md += `> ${plan.description}\n\n`;
  md += `**Framework:** ${plan.framework}  \n`;
  md += `**Created:** ${plan.created}  \n`;
  md += `**Progress:** ${done}/${allStories.length} stories complete\n\n`;
  md += `---\n\n`;

  for (const epic of plan.epics) {
    const epicDone = epic.stories.filter((s) => s.status === "done").length;
    md += `## ${epic.title} (${epicDone}/${epic.stories.length})\n\n`;

    for (const story of epic.stories) {
      const check = STATUS_LABEL[story.status] || "[ ]";
      const type = story.type === "ui" ? "UI" : story.type === "backend" ? "API" : "Full";
      md += `- ${check} **${story.title}** \`${type}\`\n`;
      md += `  ${story.description}\n`;

      if (story.dependencies.length > 0) {
        const depNames = story.dependencies.map((depId) => {
          const dep = allStories.find((s) => s.id === depId);
          return dep ? dep.title : depId;
        });
        md += `  *Depends on: ${depNames.join(", ")}*\n`;
      }
      if (story.tags.length > 0) {
        md += `  Tags: ${story.tags.join(", ")}\n`;
      }
      md += `\n`;
    }
  }

  md += `---\n\n`;
  md += `*Exported from [ForgeAI](https://github.com/joeljohn159/forgeai)*\n`;

  const outputPath = options.output || "sprint-plan.md";

  await fs.writeFile(outputPath, md);
  console.log(chalk.green(`\n  Exported to ${outputPath}\n`));
}
