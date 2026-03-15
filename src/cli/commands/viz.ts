import chalk from "chalk";
import ora from "ora";
import { generateVisualization } from "../../core/visualizer/index.js";

export async function vizCommand(targetPath: string | undefined, options: { output?: string; open?: boolean }) {
  console.log(chalk.bold("\n  forge") + chalk.dim(" viz\n"));

  const spinner = ora({ text: "Scanning project...", indent: 2 }).start();

  try {
    const shouldOpen = options.open !== false;
    const { outputPath, graph } = await generateVisualization({
      workingDir: targetPath || undefined,
      outputPath: options.output,
      open: shouldOpen,
    });

    spinner.succeed(
      `Scanned ${graph.totalFiles} files (${formatLines(graph.totalLines)} lines)`
    );

    // Summary
    const categories: Record<string, number> = {};
    for (const f of graph.files) {
      categories[f.category] = (categories[f.category] || 0) + 1;
    }

    console.log(chalk.dim(`\n  Framework: ${graph.framework}`));
    console.log(chalk.dim(`  Languages: ${Object.keys(graph.languages).join(", ")}`));

    if (graph.apiRoutes.length > 0) {
      console.log(chalk.dim(`  API routes: ${graph.apiRoutes.length}`));
    }

    console.log(chalk.dim(`\n  Dashboard: ${outputPath}`));

    if (shouldOpen) {
      console.log(chalk.green("  Opened in browser\n"));
    } else {
      console.log(chalk.dim("  Open the file in your browser to view.\n"));
    }
  } catch (err) {
    spinner.fail("Failed to generate visualization");
    console.log(chalk.red(`  ${err instanceof Error ? err.message : err}\n`));
  }
}

function formatLines(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}
