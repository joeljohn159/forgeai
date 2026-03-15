import simpleGit, { type SimpleGit } from "simple-git";
import fs from "fs/promises";
import path from "path";

// ============================================================
// Git Manager
// Handles branch strategy, tagging, and snapshots.
// ============================================================

export class GitManager {
  private git: SimpleGit;
  private basePath: string;

  constructor(basePath: string = process.cwd()) {
    this.basePath = basePath;
    this.git = simpleGit(basePath);
  }

  // ── Branch Operations ─────────────────────────────────────

  async createBranch(name: string): Promise<void> {
    // Always commit dirty state before switching branches
    await this.stashDirtyState();

    const currentBranch = await this.getCurrentBranch();
    if (currentBranch !== "main") {
      await this.git.checkout("main");
    }
    await this.git.checkoutLocalBranch(name);
  }

  async checkout(branch: string): Promise<void> {
    await this.stashDirtyState();
    await this.git.checkout(branch);
  }

  async merge(branch: string): Promise<void> {
    await this.git.merge([branch, "--no-ff"]);
  }

  async deleteBranch(branch: string): Promise<void> {
    await this.git.deleteLocalBranch(branch, true);
  }

  async getCurrentBranch(): Promise<string> {
    const status = await this.git.status();
    return status.current || "main";
  }

  async listBranches(): Promise<string[]> {
    const result = await this.git.branchLocal();
    return result.all;
  }

  // ── Commit Operations ─────────────────────────────────────

  async commitAll(message: string): Promise<void> {
    await this.git.add(".");
    const status = await this.git.status();
    if (status.staged.length > 0) {
      await this.git.commit(message);
    }
  }

  async commitState(message: string): Promise<void> {
    await this.git.add(".forge/");
    await this.git.add("forge.config.json");

    const status = await this.git.status();
    if (status.staged.length > 0) {
      await this.git.commit(`forge: ${message}`);
    }
  }

  // ── Tag Operations ────────────────────────────────────────

  async tag(name: string): Promise<void> {
    await this.git.addTag(name);
  }

  async listTags(): Promise<string[]> {
    const result = await this.git.tags();
    return result.all.filter((t) => t.startsWith("forge/"));
  }

  async checkoutTag(tagName: string): Promise<void> {
    await this.stashDirtyState();
    await this.git.checkout(tagName);
  }

  // ── Diff & History ────────────────────────────────────────

  async getDiff(branch: string): Promise<string> {
    return this.git.diff(["main", branch]);
  }

  async getLog(count: number = 10): Promise<any[]> {
    const log = await this.git.log({ maxCount: count });
    return log.all as any[];
  }

  // ── Status ────────────────────────────────────────────────

  async isClean(): Promise<boolean> {
    const status = await this.git.status();
    return status.isClean();
  }

  async hasUncommittedChanges(): Promise<boolean> {
    const status = await this.git.status();
    return !status.isClean();
  }

  // ── Init (for new projects) ───────────────────────────────

  async ensureRepo(): Promise<void> {
    const isRepo = await this.git.checkIsRepo();
    if (!isRepo) {
      await this.git.init();
    }
    // Ensure .gitignore has common entries
    await this.ensureGitignore();

    // Initial commit if repo is empty
    const log = await this.git.log().catch(() => null);
    if (!log || log.total === 0) {
      await this.git.add(".");
      await this.git.commit("Initial commit");
    }
  }

  async ensureMainBranch(): Promise<void> {
    const branches = await this.listBranches();
    if (!branches.includes("main")) {
      await this.git.branch(["-M", "main"]);
    }
  }

  // ── Internal ──────────────────────────────────────────────

  /** Commit any uncommitted changes before branch operations */
  private async stashDirtyState(): Promise<void> {
    const status = await this.git.status();
    if (status.isClean()) return;

    await this.git.add(".");
    await this.git.commit("forge: save state before branch switch");
  }

  /** Ensure .gitignore covers build artifacts and forge internals */
  private async ensureGitignore(): Promise<void> {
    const gitignorePath = path.join(this.basePath, ".gitignore");
    const requiredEntries = [
      "node_modules/",
      ".next/",
      ".forge/snapshots/",
      "dist/",
      ".env",
      ".env.local",
    ];

    let content = "";
    try {
      content = await fs.readFile(gitignorePath, "utf-8");
    } catch {
      // File doesn't exist yet
    }

    const missing = requiredEntries.filter((e) => !content.includes(e));
    if (missing.length > 0) {
      const addition = (content ? "\n" : "") + missing.join("\n") + "\n";
      await fs.appendFile(gitignorePath, addition);
    }
  }
}
