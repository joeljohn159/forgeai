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
  private cachedBranch: string | null = null;
  private repoVerified = false;

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
    this.cachedBranch = branch;
  }

  async merge(branch: string): Promise<void> {
    await this.git.merge([branch, "--no-ff"]);
  }

  async deleteBranch(branch: string): Promise<void> {
    await this.git.deleteLocalBranch(branch, true);
  }

  async getCurrentBranch(): Promise<string> {
    if (this.cachedBranch) return this.cachedBranch;
    try {
      const status = await this.git.status();
      if (status.current) {
        this.cachedBranch = status.current;
        return this.cachedBranch;
      }
    } catch {
      // Don't cache on error — let next call retry
    }
    return "main";
  }

  async listBranches(): Promise<string[]> {
    const result = await this.git.branchLocal();
    return result.all;
  }

  // ── Commit Operations ─────────────────────────────────────

  async commitAll(message: string): Promise<void> {
    // Use git add + commit in one flow; skip status check — let commit fail silently if nothing staged
    await this.git.add(".");
    try {
      await this.git.commit(message);
    } catch (err: any) {
      // "nothing to commit" is not an error
      if (!err?.message?.includes("nothing to commit")) throw err;
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
    try {
      await this.git.addTag(name);
    } catch {
      // Tag already exists — force replace it
      await this.git.raw(["tag", "-f", name]);
    }
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

  /** Diff between any two refs (tags, commits, branches) */
  async getDiff2(ref1: string, ref2: string): Promise<string> {
    return this.git.diff([ref1, ref2]);
  }

  async getLog(count: number = 10): Promise<any[]> {
    const log = await this.git.log({ maxCount: count });
    return log.all as any[];
  }

  /** Get the current HEAD commit hash */
  async getHead(): Promise<string> {
    const log = await this.git.log({ maxCount: 1 });
    return log.latest?.hash || "";
  }

  /** Revert a specific commit (creates a new revert commit) */
  async revertCommit(hash: string): Promise<void> {
    await this.git.raw(["revert", "--no-edit", hash]);
  }

  /** Get forge-related commits (feat:, fix:, forge:, docs:, ci:) */
  async getForgeLog(count: number = 20): Promise<Array<{ hash: string; date: string; message: string }>> {
    const log = await this.git.log({ maxCount: count });
    return (log.all as any[]).map((entry) => ({
      hash: entry.hash,
      date: entry.date,
      message: entry.message,
    }));
  }

  /** Get tags pointing at a specific commit */
  async getTagsAtCommit(hash: string): Promise<string[]> {
    try {
      const result = await this.git.raw(["tag", "--points-at", hash]);
      return result.trim().split("\n").filter(Boolean);
    } catch {
      return [];
    }
  }

  // ── Push Operations ─────────────────────────────────────

  /** Check if a remote named 'origin' exists */
  async hasRemote(): Promise<boolean> {
    try {
      const remotes = await this.git.getRemotes();
      return remotes.some((r) => r.name === "origin");
    } catch {
      return false;
    }
  }

  /** Push current branch to origin */
  async push(): Promise<void> {
    const branch = await this.getCurrentBranch();
    await this.git.push("origin", branch, ["--set-upstream"]);
  }

  /** Push tags to origin */
  async pushTags(): Promise<void> {
    await this.git.pushTags("origin");
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
    if (this.repoVerified) return;

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

    this.repoVerified = true;
  }

  async ensureMainBranch(): Promise<void> {
    const current = await this.getCurrentBranch();
    if (current !== "main") {
      // Only check branches if we're not already on main
      const branches = await this.listBranches();
      if (!branches.includes("main")) {
        await this.git.branch(["-M", "main"]);
        this.cachedBranch = "main";
      }
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
