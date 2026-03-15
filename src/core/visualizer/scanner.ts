// ============================================================
// Project Scanner
// Recursively scans project files, extracts imports, exports,
// routes, components, and builds a full dependency graph.
// ============================================================

import fs from "fs/promises";
import path from "path";

// ── Types ─────────────────────────────────────────────────

export interface ProjectFile {
  /** Relative path from project root */
  path: string;
  /** File extension without dot */
  ext: string;
  /** File size in bytes */
  size: number;
  /** Auto-detected role */
  role: FileRole;
  /** Short description of what this file does */
  description: string;
  /** Imports this file makes (relative paths resolved) */
  imports: string[];
  /** Named exports from this file */
  exports: string[];
  /** API routes defined in this file */
  routes: RouteInfo[];
  /** Component names defined (React, Vue, Svelte) */
  components: string[];
  /** Category for grouping in the UI */
  category: FileCategory;
  /** Lines of code */
  lines: number;
  /** First 25 lines of file content */
  preview: string;
  /** Whether this file has a matching test file */
  hasTests: boolean;
}

export type FileRole =
  | "page"
  | "component"
  | "layout"
  | "api-route"
  | "middleware"
  | "hook"
  | "utility"
  | "model"
  | "service"
  | "config"
  | "style"
  | "test"
  | "asset"
  | "entry"
  | "store"
  | "type"
  | "unknown";

export type FileCategory =
  | "pages"
  | "components"
  | "api"
  | "data"
  | "config"
  | "styles"
  | "tests"
  | "assets"
  | "utilities"
  | "types";

export interface RouteInfo {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "ALL";
  path: string;
  handler: string;
}

export interface DependencyEdge {
  from: string;
  to: string;
  type: "import" | "dynamic-import" | "route";
}

export interface ProjectGraph {
  files: ProjectFile[];
  edges: DependencyEdge[];
  framework: string;
  totalFiles: number;
  totalLines: number;
  languages: Record<string, number>;
  entryPoints: string[];
  apiRoutes: RouteInfo[];
  circularDeps: string[][];
  orphanFiles: string[];
  healthScore: {
    grade: string;
    score: number;
    details: {
      avgFileSize: number;
      testRatio: number;
      circularCount: number;
      orphanCount: number;
      maxComplexity: number;
    };
  };
  apiDocs: {
    method: string;
    path: string;
    handler: string;
    params: string[];
    description: string;
  }[];
  scanTimestamp: number;
}

// ── Ignore Patterns ───────────────────────────────────────

const IGNORE_DIRS = new Set([
  "node_modules", ".git", ".next", ".nuxt", ".svelte-kit",
  "dist", "build", ".output", "__pycache__", ".venv", "venv",
  ".forge", ".github", ".vscode", "coverage", ".turbo",
  "android", "ios", ".dart_tool", ".idea",
]);

const IGNORE_FILES = new Set([
  ".DS_Store", "Thumbs.db", "package-lock.json", "yarn.lock",
  "pnpm-lock.yaml", ".gitignore", ".eslintcache",
]);

const CODE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "vue", "svelte",
  "py", "dart",
  "css", "scss", "less", "sass",
  "json", "yaml", "yml", "toml",
  "html",
]);

// ── Scanner ───────────────────────────────────────────────

export async function scanProject(rootDir: string): Promise<ProjectGraph> {
  const files: ProjectFile[] = [];
  const edges: DependencyEdge[] = [];
  const languages: Record<string, number> = {};

  await walkDir(rootDir, rootDir, files);

  // Build import edges
  for (const file of files) {
    for (const imp of file.imports) {
      edges.push({ from: file.path, to: imp, type: "import" });
    }
  }

  // Aggregate
  const totalLines = files.reduce((sum, f) => sum + f.lines, 0);
  for (const file of files) {
    const lang = extToLanguage(file.ext);
    languages[lang] = (languages[lang] || 0) + file.lines;
  }

  const entryPoints = files
    .filter((f) => f.role === "entry" || f.role === "page")
    .map((f) => f.path);

  const apiRoutes = files.flatMap((f) => f.routes);

  // Detect framework
  const framework = detectFramework(files);

  // Analyze project structure
  const circularDeps = detectCircularDeps(files, edges);
  const orphans = findOrphanFiles(files, edges);
  matchTestFiles(files);
  const apiDocs = extractApiDocs(files);
  const healthScore = computeHealthScore(files, edges, circularDeps, orphans);

  return {
    files,
    edges,
    framework,
    totalFiles: files.length,
    totalLines,
    languages,
    entryPoints,
    apiRoutes,
    circularDeps,
    orphanFiles: orphans,
    healthScore,
    apiDocs,
    scanTimestamp: Date.now(),
  };
}

// ── Analysis Functions ────────────────────────────────────

function detectCircularDeps(files: ProjectFile[], edges: DependencyEdge[]): string[][] {
  const adj: Record<string, string[]> = {};
  for (const e of edges) {
    if (!adj[e.from]) adj[e.from] = [];
    adj[e.from].push(e.to);
  }

  const cycles: string[][] = [];
  const visited = new Set<string>();
  const stack = new Set<string>();
  const pathArr: string[] = [];

  function dfs(node: string) {
    if (cycles.length >= 50) return;
    if (stack.has(node)) {
      const idx = pathArr.indexOf(node);
      if (idx !== -1) cycles.push(pathArr.slice(idx));
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    stack.add(node);
    pathArr.push(node);

    // Normalize adjacency lookups
    const neighbors = adj[node] || [];
    for (const next of neighbors) {
      // Try to resolve to actual file path
      const resolved = files.find(f => {
        const fN = f.path.replace(/\.(ts|tsx|js|jsx)$/, '');
        const nN = next.replace(/\.(ts|tsx|js|jsx)$/, '');
        return fN === nN || fN.endsWith('/' + nN) || nN.endsWith('/' + fN);
      });
      dfs(resolved ? resolved.path : next);
    }

    pathArr.pop();
    stack.delete(node);
  }

  for (const f of files) {
    dfs(f.path);
  }

  return cycles;
}

function findOrphanFiles(files: ProjectFile[], edges: DependencyEdge[]): string[] {
  const hasOutgoing = new Set(edges.map(e => e.from));
  const hasIncoming = new Set<string>();

  for (const e of edges) {
    // Try to match "to" against actual file paths
    for (const f of files) {
      const fN = f.path.replace(/\.(ts|tsx|js|jsx)$/, '');
      const eN = e.to.replace(/\.(ts|tsx|js|jsx)$/, '');
      if (fN === eN || fN.endsWith('/' + eN) || eN.endsWith('/' + fN)) {
        hasIncoming.add(f.path);
        break;
      }
    }
  }

  return files
    .filter(f => !hasOutgoing.has(f.path) && !hasIncoming.has(f.path))
    .filter(f => f.role !== 'config' && f.role !== 'asset' && f.role !== 'style') // exclude non-code files
    .map(f => f.path);
}

function matchTestFiles(files: ProjectFile[]): void {
  const testFiles = files.filter(f => f.role === 'test');
  const testTargets = new Set<string>();

  for (const tf of testFiles) {
    // Extract target name: "Button.test.tsx" -> "Button"
    const name = path.basename(tf.path)
      .replace(/\.(test|spec)\.(ts|tsx|js|jsx|py)$/, '');
    testTargets.add(name);
  }

  for (const f of files) {
    if (f.role === 'test') continue;
    const name = path.basename(f.path).replace(/\.(ts|tsx|js|jsx|py|dart|vue|svelte)$/, '');
    f.hasTests = testTargets.has(name);
  }
}

function extractApiDocs(files: ProjectFile[]): ProjectGraph['apiDocs'] {
  const docs: ProjectGraph['apiDocs'] = [];
  for (const f of files) {
    for (const r of f.routes) {
      const params = (r.path.match(/:(\w+)/g) || []).map(p => p.slice(1));
      docs.push({
        method: r.method,
        path: r.path,
        handler: r.handler,
        params,
        description: f.description,
      });
    }
  }
  return docs;
}

function computeHealthScore(
  files: ProjectFile[],
  edges: DependencyEdge[],
  circularDeps: string[][],
  orphans: string[]
): ProjectGraph['healthScore'] {
  const totalFiles = files.length;
  if (totalFiles === 0) {
    return { grade: 'N/A', score: 0, details: { avgFileSize: 0, testRatio: 0, circularCount: 0, orphanCount: 0, maxComplexity: 0 } };
  }

  const avgFileSize = files.reduce((s, f) => s + f.lines, 0) / totalFiles;
  const testFileCount = files.filter(f => f.role === 'test').length;
  const nonTestFiles = files.filter(f => f.role !== 'test' && f.role !== 'config' && f.role !== 'style' && f.role !== 'asset').length;
  const testRatio = nonTestFiles > 0 ? testFileCount / nonTestFiles : 0;
  const circularCount = circularDeps.length;
  const orphanCount = orphans.length;

  // Max file complexity (lines * imports)
  const maxComplexity = Math.max(...files.map(f => {
    const deps = edges.filter(e => e.from === f.path).length;
    return f.lines + deps * 20;
  }), 0);

  // Score calculation (0-100)
  let score = 100;

  // Penalize large average file size (>200 lines = penalty)
  if (avgFileSize > 200) score -= Math.min(20, (avgFileSize - 200) / 20);

  // Reward test coverage (0 tests = -25, >50% = full)
  score -= Math.max(0, 25 - testRatio * 50);

  // Penalize circular deps (-5 each, max -20)
  score -= Math.min(20, circularCount * 5);

  // Penalize orphans (-2 each, max -15)
  score -= Math.min(15, orphanCount * 2);

  // Penalize very complex files
  if (maxComplexity > 500) score -= Math.min(10, (maxComplexity - 500) / 100);

  score = Math.max(0, Math.min(100, Math.round(score)));

  let grade: string;
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';

  return {
    grade,
    score,
    details: {
      avgFileSize: Math.round(avgFileSize),
      testRatio: Math.round(testRatio * 100) / 100,
      circularCount,
      orphanCount,
      maxComplexity: Math.round(maxComplexity),
    },
  };
}

// ── Directory Walker ──────────────────────────────────────

async function walkDir(
  dir: string,
  rootDir: string,
  files: ProjectFile[]
): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, "/");

    if (entry.isDirectory()) {
      if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
        await walkDir(fullPath, rootDir, files);
      }
      continue;
    }

    if (IGNORE_FILES.has(entry.name)) continue;

    const ext = entry.name.split(".").pop()?.toLowerCase() || "";
    if (!CODE_EXTENSIONS.has(ext)) continue;

    try {
      const stat = await fs.stat(fullPath);
      // Skip very large files (likely generated)
      if (stat.size > 500_000) continue;

      const content = await fs.readFile(fullPath, "utf-8");
      const lines = content.split("\n").length;
      const preview = content.split("\n").slice(0, 25).join("\n");

      const imports = extractImports(content, relativePath, ext);
      const exports = extractExports(content, ext);
      const routes = extractRoutes(content, relativePath, ext);
      const components = extractComponents(content, ext);
      const role = detectRole(relativePath, content, ext);
      const category = roleToCategory(role);
      const description = generateDescription(relativePath, role, content, ext, components, routes, exports);

      files.push({
        path: relativePath,
        ext,
        size: stat.size,
        role,
        description,
        imports,
        exports,
        routes,
        components,
        category,
        lines,
        preview,
        hasTests: false,
      });
    } catch {
      // Skip unreadable files
    }
  }
}

// ── Import Extraction ─────────────────────────────────────

function extractImports(content: string, filePath: string, ext: string): string[] {
  const imports: string[] = [];
  const dir = path.dirname(filePath);

  if (["ts", "tsx", "js", "jsx", "mjs", "cjs", "svelte", "vue"].includes(ext)) {
    // ES imports: import X from "..."
    const esImportRe = /import\s+(?:[\s\S]*?)\s+from\s+["']([^"']+)["']/g;
    let match;
    while ((match = esImportRe.exec(content)) !== null) {
      const spec = match[1];
      if (spec.startsWith(".")) {
        imports.push(resolveImportPath(dir, spec));
      }
    }

    // Side-effect imports: import "..."
    const sideRe = /import\s+["']([^"']+)["']/g;
    while ((match = sideRe.exec(content)) !== null) {
      const spec = match[1];
      if (spec.startsWith(".")) {
        imports.push(resolveImportPath(dir, spec));
      }
    }

    // Dynamic imports: import("...")
    const dynRe = /import\(\s*["']([^"']+)["']\s*\)/g;
    while ((match = dynRe.exec(content)) !== null) {
      const spec = match[1];
      if (spec.startsWith(".")) {
        imports.push(resolveImportPath(dir, spec));
      }
    }

    // require("...")
    const reqRe = /require\(\s*["']([^"']+)["']\s*\)/g;
    while ((match = reqRe.exec(content)) !== null) {
      const spec = match[1];
      if (spec.startsWith(".")) {
        imports.push(resolveImportPath(dir, spec));
      }
    }
  }

  if (ext === "py") {
    // Python: from X import Y, import X
    const pyFromRe = /from\s+(\.[\w.]*)\s+import/g;
    let match;
    while ((match = pyFromRe.exec(content)) !== null) {
      imports.push(match[1].replace(/\./g, "/"));
    }
  }

  if (ext === "dart") {
    // Dart: import 'package:...' or import '../...'
    const dartRe = /import\s+['"](?:package:[^'"]+\/)?([^'"]+)['"]/g;
    let match;
    while ((match = dartRe.exec(content)) !== null) {
      if (!match[1].startsWith("dart:")) {
        imports.push(match[1]);
      }
    }
  }

  return [...new Set(imports)];
}

function resolveImportPath(fromDir: string, specifier: string): string {
  // Remove extensions for matching
  let resolved = path.posix.join(fromDir, specifier).replace(/\\/g, "/");
  // Remove leading ./
  if (resolved.startsWith("./")) resolved = resolved.slice(2);
  return resolved;
}

// ── Export Extraction ─────────────────────────────────────

function extractExports(content: string, ext: string): string[] {
  const exports: string[] = [];

  if (["ts", "tsx", "js", "jsx", "mjs", "svelte", "vue"].includes(ext)) {
    // export function/class/const/let
    const namedRe = /export\s+(?:async\s+)?(?:function|class|const|let|var|type|interface)\s+(\w+)/g;
    let match;
    while ((match = namedRe.exec(content)) !== null) {
      exports.push(match[1]);
    }

    // export default
    if (/export\s+default/.test(content)) {
      exports.push("default");
    }
  }

  if (ext === "py") {
    // Python: class definitions and top-level functions
    const pyRe = /^(?:class|def)\s+(\w+)/gm;
    let match;
    while ((match = pyRe.exec(content)) !== null) {
      exports.push(match[1]);
    }
  }

  return exports;
}

// ── Route Extraction ──────────────────────────────────────

function extractRoutes(content: string, filePath: string, ext: string): RouteInfo[] {
  const routes: RouteInfo[] = [];

  // Next.js App Router API routes (route.ts)
  if (filePath.includes("api/") && (filePath.endsWith("route.ts") || filePath.endsWith("route.js"))) {
    const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;
    for (const method of methods) {
      const re = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`);
      if (re.test(content)) {
        const routePath = "/" + filePath
          .replace(/^src\/app\//, "")
          .replace(/\/route\.(ts|js)$/, "")
          .replace(/\[(\w+)\]/g, ":$1");
        routes.push({ method, path: routePath, handler: filePath });
      }
    }
  }

  // Nuxt server routes (server/api/*.ts)
  if (filePath.startsWith("server/api/") && ["ts", "js"].includes(ext)) {
    const routePath = "/" + filePath
      .replace(/^server\//, "")
      .replace(/\.(ts|js)$/, "")
      .replace(/\[(\w+)\]/g, ":$1");
    routes.push({ method: "ALL", path: routePath, handler: filePath });
  }

  // SvelteKit API routes (+server.ts)
  if (filePath.endsWith("+server.ts") || filePath.endsWith("+server.js")) {
    const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;
    for (const method of methods) {
      const re = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`);
      if (re.test(content)) {
        const routePath = "/" + filePath
          .replace(/^src\/routes\//, "")
          .replace(/\/\+server\.(ts|js)$/, "")
          .replace(/\[(\w+)\]/g, ":$1");
        routes.push({ method, path: routePath, handler: filePath });
      }
    }
  }

  // Express-style: app.get("/path", handler)
  const expressRe = /(?:app|router)\.(get|post|put|delete|patch|all)\(\s*["']([^"']+)["']/gi;
  let match;
  while ((match = expressRe.exec(content)) !== null) {
    routes.push({
      method: match[1].toUpperCase() as RouteInfo["method"],
      path: match[2],
      handler: filePath,
    });
  }

  // Django urls (path("...", view))
  if (ext === "py" && filePath.includes("urls")) {
    const djangoRe = /path\(\s*["']([^"']+)["']\s*,\s*(\w+)/g;
    while ((match = djangoRe.exec(content)) !== null) {
      routes.push({ method: "ALL", path: "/" + match[1], handler: match[2] });
    }
  }

  return routes;
}

// ── Component Extraction ──────────────────────────────────

function extractComponents(content: string, ext: string): string[] {
  const components: string[] = [];

  if (["tsx", "jsx"].includes(ext)) {
    // React: export function ComponentName or export default function
    const fnRe = /export\s+(?:default\s+)?function\s+([A-Z]\w+)/g;
    let match;
    while ((match = fnRe.exec(content)) !== null) {
      components.push(match[1]);
    }
    // const ComponentName = () =>
    const arrowRe = /(?:export\s+)?(?:const|let)\s+([A-Z]\w+)\s*=\s*(?:\([^)]*\)|[^=])\s*=>/g;
    while ((match = arrowRe.exec(content)) !== null) {
      components.push(match[1]);
    }
  }

  if (ext === "vue") {
    // Vue SFC — the component name is typically the filename
    components.push("VueComponent");
  }

  if (ext === "svelte") {
    components.push("SvelteComponent");
  }

  if (ext === "dart") {
    // Flutter widgets
    const dartRe = /class\s+(\w+)\s+extends\s+(?:Stateless|Stateful)Widget/g;
    let match;
    while ((match = dartRe.exec(content)) !== null) {
      components.push(match[1]);
    }
  }

  return [...new Set(components)];
}

// ── Role Detection ────────────────────────────────────────

function detectRole(filePath: string, content: string, ext: string): FileRole {
  const lowerPath = filePath.toLowerCase();
  const fileName = path.basename(filePath);

  // Config files
  if (["json", "yaml", "yml", "toml"].includes(ext) || fileName.startsWith(".")) {
    return "config";
  }
  if (lowerPath.includes("config") || lowerPath.includes("tsconfig") || lowerPath.endsWith(".config.ts") || lowerPath.endsWith(".config.js")) {
    return "config";
  }

  // Tests
  if (lowerPath.includes(".test.") || lowerPath.includes(".spec.") || lowerPath.includes("__tests__") || lowerPath.startsWith("test/") || lowerPath.startsWith("tests/")) {
    return "test";
  }

  // Styles
  if (["css", "scss", "less", "sass"].includes(ext)) {
    return "style";
  }

  // Types
  if (lowerPath.includes("types") || lowerPath.endsWith(".d.ts")) {
    return "type";
  }

  // API routes
  if (lowerPath.includes("/api/") || lowerPath.includes("route.ts") || lowerPath.includes("+server.")) {
    return "api-route";
  }

  // Pages
  if (lowerPath.includes("/pages/") || lowerPath.includes("/routes/") || lowerPath.includes("+page.")) {
    return "page";
  }

  // Layouts
  if (lowerPath.includes("layout") || lowerPath.includes("+layout.")) {
    return "layout";
  }

  // Middleware
  if (lowerPath.includes("middleware") || lowerPath.includes("hooks")) {
    return "middleware";
  }

  // Entry points
  if (fileName === "main.ts" || fileName === "main.tsx" || fileName === "main.dart" || fileName === "index.ts" || fileName === "app.tsx" || fileName === "app.vue" || fileName === "manage.py") {
    return "entry";
  }

  // Hooks / composables
  if (lowerPath.includes("/hooks/") || lowerPath.includes("/composables/") || fileName.startsWith("use")) {
    return "hook";
  }

  // Models / schemas
  if (lowerPath.includes("/models/") || lowerPath.includes("schema") || lowerPath.includes("prisma")) {
    return "model";
  }

  // Services / repositories
  if (lowerPath.includes("/services/") || lowerPath.includes("/repositories/") || lowerPath.includes("/lib/") || lowerPath.includes("/server/")) {
    return "service";
  }

  // Store / state
  if (lowerPath.includes("/store/") || lowerPath.includes("/providers/") || lowerPath.includes("context")) {
    return "store";
  }

  // Components
  if (lowerPath.includes("/components/") || lowerPath.includes("/widgets/") || lowerPath.includes("/ui/")) {
    return "component";
  }

  // TSX/JSX with PascalCase = likely a component
  if (["tsx", "jsx"].includes(ext) && /^[A-Z]/.test(fileName)) {
    return "component";
  }

  // Commands (CLI)
  if (lowerPath.includes("/commands/") || lowerPath.includes("/cmd/")) {
    return "utility";
  }

  // Utilities
  if (lowerPath.includes("/utils/") || lowerPath.includes("/helpers/") || lowerPath.includes("/lib/")) {
    return "utility";
  }

  // Any TS/JS/PY/Dart source file defaults to utility rather than unknown
  if (["ts", "tsx", "js", "jsx", "py", "dart"].includes(ext)) {
    return "utility";
  }

  return "unknown";
}

function roleToCategory(role: FileRole): FileCategory {
  switch (role) {
    case "page":
    case "layout":
    case "entry":
      return "pages";
    case "component":
      return "components";
    case "api-route":
    case "middleware":
      return "api";
    case "model":
    case "service":
    case "store":
    case "hook":
      return "data";
    case "config":
      return "config";
    case "style":
      return "styles";
    case "test":
      return "tests";
    case "asset":
      return "assets";
    case "type":
      return "types";
    case "utility":
      return "utilities";
    default:
      return "utilities";
  }
}

// ── Description Generation ────────────────────────────────

function generateDescription(
  filePath: string,
  role: FileRole,
  content: string,
  ext: string,
  components: string[],
  routes: RouteInfo[],
  exports: string[]
): string {
  const fileName = path.basename(filePath);

  // Config files
  if (role === "config") {
    if (fileName === "package.json") return "Project dependencies and scripts";
    if (fileName === "tsconfig.json") return "TypeScript compiler configuration";
    if (fileName.includes("tailwind")) return "Tailwind CSS theme and plugin configuration";
    if (fileName.includes("next.config")) return "Next.js framework configuration";
    if (fileName.includes("nuxt.config")) return "Nuxt 3 framework configuration";
    if (fileName.includes("svelte.config")) return "SvelteKit framework configuration";
    if (fileName.includes("vite.config")) return "Vite bundler configuration";
    if (fileName === "pubspec.yaml") return "Dart/Flutter dependencies";
    if (fileName === "requirements.txt") return "Python dependencies";
    return "Configuration file";
  }

  // Tests
  if (role === "test") {
    const testTarget = fileName.replace(/\.(test|spec)\.(ts|tsx|js|jsx)$/, "");
    return `Tests for ${testTarget}`;
  }

  // Styles
  if (role === "style") {
    if (fileName.includes("global") || fileName === "app.css") return "Global styles and CSS variables";
    return `Styles for ${fileName.replace(/\.(css|scss|less)$/, "")}`;
  }

  // API routes
  if (routes.length > 0) {
    const methods = routes.map((r) => `${r.method} ${r.path}`).join(", ");
    return `API endpoint: ${methods}`;
  }

  // Components
  if (components.length > 0) {
    return `${components[0]} component${components.length > 1 ? ` (+${components.length - 1} more)` : ""}`;
  }

  // Pages
  if (role === "page") {
    const route = filePath
      .replace(/^src\/(app|routes|pages)\//, "/")
      .replace(/\/?(page|index|\+page)\.(tsx?|jsx?|vue|svelte)$/, "")
      .replace(/\[(\w+)\]/g, ":$1") || "/";
    return `Page: ${route}`;
  }

  // Layout
  if (role === "layout") return "Layout wrapper — shared UI shell for child routes";

  // Entry
  if (role === "entry") return "Application entry point";

  // Hooks
  if (role === "hook") {
    const hookName = exports.find((e) => e.startsWith("use")) || fileName.replace(/\.(ts|js)$/, "");
    return `Custom hook: ${hookName}`;
  }

  // Models
  if (role === "model") {
    const modelNames = exports.filter((e) => e !== "default").slice(0, 3).join(", ");
    return modelNames ? `Data model: ${modelNames}` : "Data model definitions";
  }

  // Services
  if (role === "service") {
    return `Service: ${fileName.replace(/\.(ts|js|py)$/, "")}`;
  }

  // Store
  if (role === "store") return "State management / data store";

  // Middleware
  if (role === "middleware") return "Request middleware / interceptor";

  // Types
  if (role === "type") {
    const typeNames = exports.filter((e) => e !== "default").slice(0, 3).join(", ");
    return typeNames ? `Type definitions: ${typeNames}` : "Type definitions";
  }

  // Utilities
  if (role === "utility") {
    const utilNames = exports.filter((e) => e !== "default").slice(0, 3).join(", ");
    return utilNames ? `Utilities: ${utilNames}` : "Utility functions";
  }

  // Generic
  return `${fileName.replace(/\.(ts|tsx|js|jsx|py|dart)$/, "")} module`;
}

// ── Framework Detection ───────────────────────────────────

function detectFramework(files: ProjectFile[]): string {
  const paths = new Set(files.map((f) => f.path));

  if (paths.has("next.config.ts") || paths.has("next.config.js") || paths.has("next.config.mjs")) return "Next.js";
  if (paths.has("nuxt.config.ts") || paths.has("nuxt.config.js")) return "Nuxt 3";
  if (paths.has("svelte.config.js") || paths.has("svelte.config.ts")) return "SvelteKit";
  if (paths.has("pubspec.yaml")) return "Flutter";
  if (paths.has("manage.py")) return "Django";
  if (paths.has("vite.config.ts") || paths.has("vite.config.js")) return "Vite";
  if (paths.has("Cargo.toml")) return "Rust";
  if (paths.has("go.mod")) return "Go";

  return "Unknown";
}

function extToLanguage(ext: string): string {
  switch (ext) {
    case "ts":
    case "tsx":
      return "TypeScript";
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
      return "JavaScript";
    case "py":
      return "Python";
    case "dart":
      return "Dart";
    case "vue":
      return "Vue";
    case "svelte":
      return "Svelte";
    case "css":
    case "scss":
    case "less":
    case "sass":
      return "CSS";
    case "html":
      return "HTML";
    case "json":
      return "JSON";
    case "yaml":
    case "yml":
      return "YAML";
    case "md":
    case "mdx":
      return "Markdown";
    default:
      return ext.toUpperCase();
  }
}
