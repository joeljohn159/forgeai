import chalk from "chalk";
import inquirer from "inquirer";
import { listTemplates, getTemplate } from "../../core/templates/index.js";

export async function templateCommand(options: { list?: boolean }) {
  const templates = listTemplates();

  if (options.list) {
    console.log(chalk.bold("\n  Forge Templates\n"));
    for (const t of templates) {
      console.log(`  ${chalk.cyan(t.id.padEnd(16))} ${t.name}`);
      console.log(chalk.dim(`  ${"".padEnd(16)} ${t.description}`));
      console.log(chalk.dim(`  ${"".padEnd(16)} Frameworks: ${t.suggestedFrameworks.join(", ")}\n`));
    }
    return;
  }

  console.log(chalk.bold("\n  forge") + chalk.dim(" template\n"));

  let templateId: string;
  try {
    const answer = await inquirer.prompt([
      {
        type: "list",
        name: "templateId",
        message: "Choose a starter template:",
        choices: templates.map((t) => ({
          name: `${t.name} — ${t.description}`,
          value: t.id,
        })),
      },
    ]);
    templateId = answer.templateId;
  } catch {
    // User pressed Ctrl+C
    console.log(chalk.dim("\n  Cancelled.\n"));
    return;
  }

  const template = getTemplate(templateId);
  if (!template) {
    console.log(chalk.red("  Template not found.\n"));
    return;
  }

  console.log(chalk.green(`\n  Selected: ${template.name}`));
  console.log(chalk.dim(`  ${template.description}\n`));
  console.log(chalk.dim("  Suggested frameworks: " + template.suggestedFrameworks.join(", ")));
  console.log(chalk.bold("\n  To use this template, run:"));
  console.log(chalk.cyan(`    forge auto "${template.planDescription.split("\n")[0].trim()}"\n`));
  console.log(chalk.dim("  Or copy the full description:\n"));

  // Print the full plan description for copy-paste
  const lines = template.planDescription.split("\n");
  for (const line of lines) {
    console.log(chalk.dim(`    ${line}`));
  }
  console.log("");
}
