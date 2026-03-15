import fs from "fs/promises";
import path from "path";
import type {
  Plan,
  SprintState,
  Phase,
  ForgeConfig,
  Snapshot,
} from "../types/plan.js";

// ============================================================
// State Manager
// Reads/writes .forge/ JSON files. Source of truth for the sprint.
// ============================================================

const FORGE_DIR = ".forge";
const PLAN_FILE = "plan.json";
const STATE_FILE = "state.json";
const CONFIG_FILE = "forge.config.json";
const SNAPSHOTS_DIR = "snapshots";

class StateManager {
  private basePath: string;
  private cache: Map<string, { data: any; mtime: number }> = new Map();
  private dirCreated: Set<string> = new Set();

  constructor(basePath: string = process.cwd()) {
    this.basePath = basePath;
  }

  /** Clear all caches (call when basePath changes) */
  clearCache(): void {
    this.cache.clear();
    this.dirCreated.clear();
  }

  // ── Paths ─────────────────────────────────────────────────

  private forgePath(...parts: string[]): string {
    return path.join(this.basePath, FORGE_DIR, ...parts);
  }

  private rootPath(...parts: string[]): string {
    return path.join(this.basePath, ...parts);
  }

  // ── Plan ──────────────────────────────────────────────────

  async savePlan(plan: Plan): Promise<void> {
    await this.writeJson(this.forgePath(PLAN_FILE), plan);
  }

  async getPlan(): Promise<Plan | null> {
    return this.readJson<Plan>(this.forgePath(PLAN_FILE));
  }

  async hasPlan(): Promise<boolean> {
    return this.fileExists(this.forgePath(PLAN_FILE));
  }

  // ── State ─────────────────────────────────────────────────

  async getState(): Promise<SprintState> {
    const state = await this.readJson<SprintState>(
      this.forgePath(STATE_FILE)
    );
    return (
      state || {
        currentPhase: "init",
        currentStory: null,
        workerMode: null,
        queue: [],
        history: [],
      }
    );
  }

  async updatePhase(phase: Phase): Promise<void> {
    const state = await this.getState();
    state.currentPhase = phase;
    await this.writeJson(this.forgePath(STATE_FILE), state);
  }

  async updateState(updates: Partial<SprintState>): Promise<void> {
    const state = await this.getState();
    Object.assign(state, updates);
    await this.writeJson(this.forgePath(STATE_FILE), state);
  }

  async addHistoryEntry(entry: {
    action: string;
    storyId: string | null;
    details: string;
    snapshotId?: string;
  }): Promise<void> {
    const state = await this.getState();
    state.history.push({
      ...entry,
      timestamp: new Date().toISOString(),
      snapshotId: entry.snapshotId || null,
    });
    await this.writeJson(this.forgePath(STATE_FILE), state);
  }

  // ── Config ────────────────────────────────────────────────

  async getConfig(): Promise<ForgeConfig | null> {
    return this.readJson<ForgeConfig>(this.rootPath(CONFIG_FILE));
  }

  async isInitialized(): Promise<boolean> {
    return this.fileExists(this.rootPath(CONFIG_FILE));
  }

  // ── Snapshots ─────────────────────────────────────────────

  async saveSnapshot(data: {
    action: string;
    storyId: string | null;
    branch: string;
    commitBefore?: string;
  }): Promise<string> {
    const state = await this.getState();
    const id = String(state.history.length + 1).padStart(3, "0");

    const snapshot: Snapshot = {
      id,
      action: data.action,
      storyId: data.storyId,
      timestamp: new Date().toISOString(),
      files: [],
      branch: data.branch,
      commitBefore: data.commitBefore || "",
    };

    await this.writeJson(
      this.forgePath(SNAPSHOTS_DIR, `${id}-pre-${data.action}-${data.storyId || "global"}.json`),
      snapshot
    );

    await this.addHistoryEntry({
      action: data.action,
      storyId: data.storyId,
      details: `Snapshot taken before ${data.action}`,
      snapshotId: id,
    });

    return id;
  }

  async getSnapshot(id: string): Promise<Snapshot | null> {
    const dir = this.forgePath(SNAPSHOTS_DIR);
    const files = await fs.readdir(dir).catch(() => []);
    const match = files.find((f) => f.startsWith(id));
    if (!match) return null;
    return this.readJson<Snapshot>(path.join(dir, match));
  }

  async listSnapshots(): Promise<Snapshot[]> {
    const dir = this.forgePath(SNAPSHOTS_DIR);
    const files = await fs.readdir(dir).catch(() => []);
    const snapshots: Snapshot[] = [];
    for (const file of files.filter((f) => f.endsWith(".json"))) {
      const snapshot = await this.readJson<Snapshot>(path.join(dir, file));
      if (snapshot) snapshots.push(snapshot);
    }
    return snapshots.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  // ── Design References ──────────────────────────────────────

  async saveDesignReferences(files: string[]): Promise<void> {
    const refDir = this.forgePath("designs", "references");
    await fs.mkdir(refDir, { recursive: true });

    const manifest: Array<{ original: string; saved: string }> = [];
    for (const file of files) {
      const basename = path.basename(file);
      const dest = path.join(refDir, basename);
      await fs.copyFile(file, dest);
      manifest.push({ original: file, saved: dest });
    }

    await this.writeJson(this.forgePath("designs", "references.json"), manifest);
  }

  async getDesignReferences(): Promise<string[]> {
    const manifest = await this.readJson<Array<{ saved: string }>>(
      this.forgePath("designs", "references.json")
    );
    return manifest?.map((r) => r.saved) || [];
  }

  // ── Helpers ───────────────────────────────────────────────

  private async readJson<T>(filePath: string): Promise<T | null> {
    try {
      const stat = await fs.stat(filePath);
      const mtime = stat.mtimeMs;

      // Return cached if file hasn't changed
      const cached = this.cache.get(filePath);
      if (cached && cached.mtime === mtime) {
        return cached.data as T;
      }

      const content = await fs.readFile(filePath, "utf-8");
      const data = JSON.parse(content) as T;
      this.cache.set(filePath, { data, mtime });
      return data;
    } catch (err: any) {
      // File not found is expected — return null
      if (err?.code === "ENOENT") return null;
      // JSON parse error — file is corrupted, return null
      if (err instanceof SyntaxError) return null;
      // Permission or other system errors — propagate so caller knows
      throw err;
    }
  }

  private async writeJson(filePath: string, data: any): Promise<void> {
    const dir = path.dirname(filePath);
    // Only mkdir if we haven't already created this directory
    if (!this.dirCreated.has(dir)) {
      await fs.mkdir(dir, { recursive: true });
      this.dirCreated.add(dir);
    }
    const json = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, json);
    // Update cache immediately — avoid re-reading what we just wrote
    const stat = await fs.stat(filePath);
    this.cache.set(filePath, { data, mtime: stat.mtimeMs });
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

// Singleton
export const stateManager = new StateManager();
