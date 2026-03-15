// ============================================================
// Custom Adapter Plugin Loader
// Loads user-defined adapters from .forge/adapters/*.js
// ============================================================

import fs from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";
import type { FrameworkAdapter } from "./base.js";

const ADAPTERS_DIR = ".forge/adapters";

/**
 * Load custom adapters from .forge/adapters/ directory.
 * Each .js file should default-export a FrameworkAdapter object.
 *
 * Example .forge/adapters/rails.js:
 *   export default {
 *     id: "rails",
 *     name: "Ruby on Rails",
 *     language: "javascript", // closest available
 *     scaffoldCommands: ["rails new . --api"],
 *     buildCommand: "bundle exec rails assets:precompile",
 *     lintCommand: "bundle exec rubocop",
 *     typecheckCommand: "bundle exec srb tc",
 *     devCommand: "bin/rails server",
 *     devPort: 3000,
 *     designSupport: false,
 *     packageManager: "npm",
 *     requiredFiles: ["Gemfile", "config/routes.rb"],
 *     buildPromptAdditions: "FOR RAILS: Use Rails 7+ conventions...",
 *     designPromptAdditions: "",
 *     fileStructure: "app/\\n├── controllers/\\n├── models/\\n...",
 *   };
 */
export async function loadCustomAdapters(
  workingDir?: string
): Promise<Record<string, FrameworkAdapter>> {
  const result: Record<string, FrameworkAdapter> = {};
  const dir = path.join(workingDir || process.cwd(), ADAPTERS_DIR);

  try {
    await fs.access(dir);
  } catch {
    return result; // No custom adapters directory — that's fine
  }

  let files: string[];
  try {
    files = await fs.readdir(dir);
  } catch {
    return result;
  }

  const jsFiles = files.filter(
    (f) => f.endsWith(".js") || f.endsWith(".mjs")
  );

  for (const file of jsFiles) {
    try {
      const filePath = path.join(dir, file);
      const fileUrl = pathToFileURL(filePath).href;
      const mod = await import(fileUrl);
      const adapter = mod.default ?? mod;

      if (!validateAdapter(adapter)) {
        console.warn(`  Warning: ${file} is not a valid adapter (missing required fields). Skipping.`);
        continue;
      }

      result[adapter.id] = adapter;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  Warning: Failed to load adapter ${file}: ${msg}`);
    }
  }

  return result;
}

function validateAdapter(a: any): a is FrameworkAdapter {
  if (typeof a !== "object" || a === null) return false;

  const requiredStrings = [
    "id", "name", "language",
    "buildCommand", "lintCommand", "typecheckCommand",
    "devCommand", "buildPromptAdditions", "designPromptAdditions", "fileStructure",
  ];
  for (const key of requiredStrings) {
    if (typeof a[key] !== "string") return false;
  }

  const requiredArrays = ["scaffoldCommands", "requiredFiles"];
  for (const key of requiredArrays) {
    if (!Array.isArray(a[key])) return false;
  }

  return true;
}
