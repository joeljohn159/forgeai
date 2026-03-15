// ============================================================
// Project Visualizer
// Scans the project and generates an interactive HTML dashboard
// ============================================================

import fs from "fs/promises";
import path from "path";
import { scanProject, type ProjectGraph } from "./scanner.js";
import { generateDashboardHTML } from "./template.js";

export { type ProjectGraph, type ProjectFile } from "./scanner.js";

export interface VisualizerOptions {
  workingDir?: string;
  outputPath?: string;
  open?: boolean;
}

export async function generateVisualization(
  options: VisualizerOptions = {}
): Promise<{ outputPath: string; graph: ProjectGraph }> {
  const workingDir = options.workingDir || process.cwd();
  const outputPath = options.outputPath || path.join(workingDir, ".forge", "project-map.html");

  // Scan project
  const graph = await scanProject(workingDir);

  // Load previous snapshot for diff mode
  let prevGraph: ProjectGraph | null = null;
  const snapshotPath = path.join(workingDir, ".forge", "viz-snapshot.json");
  try {
    const raw = await fs.readFile(snapshotPath, "utf-8");
    prevGraph = JSON.parse(raw);
  } catch {
    // No previous snapshot
  }

  // Detect project name
  let projectName = path.basename(workingDir);
  try {
    const pkgPath = path.join(workingDir, "package.json");
    const pkg = JSON.parse(await fs.readFile(pkgPath, "utf-8"));
    if (pkg.name) projectName = pkg.name;
  } catch {
    try {
      const pubPath = path.join(workingDir, "pubspec.yaml");
      const content = await fs.readFile(pubPath, "utf-8");
      const nameMatch = content.match(/^name:\s*(.+)/m);
      if (nameMatch) projectName = nameMatch[1].trim();
    } catch {
      // Use directory name
    }
  }

  // Generate HTML
  const resolvedRoot = path.resolve(workingDir);
  const html = generateDashboardHTML(graph, projectName, prevGraph, resolvedRoot);

  // Write to .forge/ directory
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, html);

  // Save current snapshot (strip preview to save space)
  const snapshot = JSON.parse(JSON.stringify(graph));
  for (const f of snapshot.files) delete f.preview;
  await fs.writeFile(snapshotPath, JSON.stringify(snapshot));

  // Open in browser
  if (options.open !== false) {
    await openBrowser(outputPath);
  }

  return { outputPath, graph };
}

async function openBrowser(filePath: string): Promise<void> {
  const { exec } = await import("child_process");

  const url = `file://${path.resolve(filePath)}`;

  const platform = process.platform;
  let cmd: string;

  if (platform === "darwin") {
    cmd = `open "${url}"`;
  } else if (platform === "win32") {
    cmd = `start "" "${url}"`;
  } else {
    cmd = `xdg-open "${url}"`;
  }

  exec(cmd, (err) => {
    // Silently ignore — browser open is best-effort
    if (err) {
      // Fallback: just print the path
    }
  });
}
