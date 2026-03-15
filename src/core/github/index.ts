import { spawnSync } from "child_process";
import type { Plan, Story } from "../../types/plan.js";

// ============================================================
// GitHub Sync
// Creates and updates GitHub Issues for sprint stories.
// Uses the `gh` CLI — no extra dependencies.
// ============================================================

export class GitHubSync {
  private repo: string;

  constructor(repo: string) {
    this.repo = repo;
  }

  /** Check if `gh` CLI is installed and authenticated */
  static isAvailable(): boolean {
    const result = spawnSync("gh", ["auth", "status"], { stdio: "ignore" });
    return result.status === 0;
  }

  /** Create GitHub labels for forge story tracking */
  async ensureLabels(): Promise<void> {
    const labels = [
      { name: "forge", color: "000000", description: "Managed by ForgeAI" },
      { name: "type:ui", color: "7057ff", description: "UI component" },
      { name: "type:backend", color: "0075ca", description: "Backend/API" },
      { name: "type:fullstack", color: "008672", description: "Full stack" },
      { name: "status:planned", color: "d4c5f9", description: "Planned" },
      { name: "status:in-progress", color: "fbca04", description: "Building" },
      { name: "status:review", color: "f9d0c4", description: "In review" },
      { name: "status:done", color: "0e8a16", description: "Complete" },
      { name: "status:blocked", color: "e11d48", description: "Blocked" },
    ];

    for (const label of labels) {
      spawnSync("gh", [
        "label", "create", label.name,
        "--repo", this.repo,
        "--color", label.color,
        "--description", label.description,
        "--force",
      ], { stdio: "ignore" });
    }
  }

  /** Sync all stories in a plan to GitHub Issues */
  async syncPlan(plan: Plan): Promise<{ created: number; updated: number }> {
    let created = 0;
    let updated = 0;

    for (const epic of plan.epics) {
      for (const story of epic.stories) {
        const result = await this.syncStory(story, epic.title);
        if (result === "created") created++;
        else if (result === "updated") updated++;
      }
    }

    return { created, updated };
  }

  /** Sync a single story to a GitHub Issue */
  private async syncStory(
    story: Story,
    epicTitle: string
  ): Promise<"created" | "updated" | "skipped"> {
    const title = `[${epicTitle}] ${story.title}`;
    const labels = this.getLabels(story);
    const body = [
      `**Story ID:** \`${story.id}\``,
      `**Type:** ${story.type}`,
      `**Priority:** ${story.priority}`,
      `**Status:** ${story.status}`,
      "",
      story.description,
      "",
      "---",
      "_Managed by [ForgeAI](https://github.com/joeljohn159/forgeai)_",
    ].join("\n");

    // Search for existing issue by story ID in body
    const searchResult = spawnSync("gh", [
      "issue", "list",
      "--repo", this.repo,
      "--search", story.id,
      "--label", "forge",
      "--json", "number",
      "--jq", ".[0].number",
      "--state", "all",
    ], { encoding: "utf-8" });

    const existingNumber = searchResult.stdout?.trim();

    if (existingNumber && /^\d+$/.test(existingNumber)) {
      // Update existing issue
      const args = [
        "issue", "edit", existingNumber,
        "--repo", this.repo,
        "--title", title,
        "--body", body,
      ];

      // Update labels
      for (const label of labels) {
        args.push("--add-label", label);
      }

      spawnSync("gh", args, { stdio: "ignore" });

      // Close if done
      if (story.status === "done") {
        spawnSync("gh", [
          "issue", "close", existingNumber,
          "--repo", this.repo,
        ], { stdio: "ignore" });
      }

      return "updated";
    }

    // Create new issue
    const createArgs = [
      "issue", "create",
      "--repo", this.repo,
      "--title", title,
      "--body", body,
    ];

    for (const label of labels) {
      createArgs.push("--label", label);
    }

    const createResult = spawnSync("gh", createArgs, { stdio: "ignore" });

    if (createResult.status === 0) {
      return "created";
    }

    return "skipped";
  }

  /** Map story status to GitHub labels */
  private getLabels(story: Story): string[] {
    const labels = ["forge", `type:${story.type}`];

    switch (story.status) {
      case "planned":
      case "designing":
      case "design-approved":
        labels.push("status:planned");
        break;
      case "building":
        labels.push("status:in-progress");
        break;
      case "reviewing":
        labels.push("status:review");
        break;
      case "done":
        labels.push("status:done");
        break;
      case "blocked":
        labels.push("status:blocked");
        break;
    }

    return labels;
  }
}
