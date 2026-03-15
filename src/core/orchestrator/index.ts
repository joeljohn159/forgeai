import { query } from "@anthropic-ai/claude-agent-sdk";
import chalk from "chalk";
import type {
  Plan,
  Story,
  SprintState,
  ForgeConfig,
  OrchestratorDecision,
  WorkerMode,
} from "../../types/plan.js";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "./prompts.js";
import { getAdapter } from "../adapters/index.js";
import { playSound } from "../utils/sound.js";

// ============================================================
// Orchestrator Agent
// The project manager. Never writes code.
// Plans, routes, reviews, and crafts prompts for the Worker.
// Framework-aware via adapter system.
// ============================================================

export class Orchestrator {
  private config: ForgeConfig;
  private plan: Plan | null = null;

  constructor(config: ForgeConfig) {
    this.config = config;
  }

  // ── Plan Generation ───────────────────────────────────────

  async generatePlan(description: string): Promise<Plan> {
    const adapter = getAdapter(this.config.framework);

    const prompt = `
      The user wants to build the following application:
      "${description}"

      Framework: ${adapter.name} (${this.config.framework})
      Language: ${adapter.language}
      Design support: ${adapter.designSupport ? "yes (Storybook)" : "no"}

      Break this down into epics and stories. Each story should be:
      - Small enough to build in one agent session
      - Independently testable
      - Ordered by dependency (foundation first)

      Story types:
      - "ui" = has a visual component ${adapter.designSupport ? "(needs design phase)" : "(no design phase for this framework)"}
      - "backend" = API/database only (skip design phase)
      - "fullstack" = both UI and backend

      Return ONLY valid JSON with this structure:
      {
        "project": "project name",
        "framework": "${this.config.framework}",
        "description": "brief description",
        "epics": [
          {
            "id": "epic-id",
            "title": "Epic Title",
            "stories": [
              {
                "id": "story-id",
                "title": "Story Title",
                "description": "What to build",
                "type": "ui" | "backend" | "fullstack",
                "priority": 1,
                "dependencies": ["other-story-id"]
              }
            ]
          }
        ]
      }

      No explanation, just the JSON.
    `;

    const resultText = await this.runQuery(prompt, { maxTurns: 3 });

    let rawPlan: any;
    try {
      rawPlan = JSON.parse(this.cleanJson(resultText));
    } catch {
      throw new Error(
        "Failed to parse plan. The AI returned invalid JSON. Try again with a clearer description."
      );
    }

    // Validate required fields
    if (!rawPlan.epics || !Array.isArray(rawPlan.epics)) {
      throw new Error("Invalid plan: missing epics array. Try regenerating.");
    }

    // Hydrate with default status fields
    const plan: Plan = {
      project: rawPlan.project || "Untitled",
      framework: rawPlan.framework || this.config.framework,
      description: rawPlan.description || description,
      created: new Date().toISOString(),
      epics: rawPlan.epics.map((epic: any) => ({
        id: epic.id || `epic-${Date.now()}`,
        title: epic.title || "Untitled Epic",
        status: "planned" as const,
        stories: (epic.stories || []).map((story: any) => ({
          id: story.id || `story-${Date.now()}`,
          title: story.title || "Untitled Story",
          description: story.description || "",
          type: story.type || "fullstack",
          status: "planned" as const,
          branch: null,
          designApproved: false,
          tags: [],
          priority: story.priority || 1,
          dependencies: story.dependencies || [],
        })),
      })),
    };

    this.plan = plan;
    return plan;
  }

  // ── User Input Routing ────────────────────────────────────

  async routeUserInput(
    message: string,
    currentState: SprintState
  ): Promise<OrchestratorDecision> {
    const routingPrompt = `
      Current sprint state:
      - Phase: ${currentState.currentPhase}
      - Current story: ${currentState.currentStory || "none"}
      - Worker mode: ${currentState.workerMode || "idle"}
      - Framework: ${this.config.framework}

      The user said: "${message}"

      Classify this input and decide what to do.
      Return ONLY valid JSON with this structure:
      {
        "action": "route-to-worker" | "add-story" | "reprioritize" | "answer" | "queue-change",
        "workerMode": "design" | "build" | "review" | "fix" (if routing to worker),
        "response": "your response to the user" (if answering directly),
        "prompt": "detailed prompt for the worker" (if routing to worker),
        "story": { "title": "...", "description": "...", "type": "..." } (if adding a new story)
      }

      Routing rules:
      - Visual tweak (color, spacing, font) → route-to-worker, mode: fix
      - Layout/UX redesign → route-to-worker, mode: design
      - Bug fix → route-to-worker, mode: fix
      - New feature → add-story (include title, description, type)
      - Content change (text, labels) → route-to-worker, mode: fix
      - Question → answer directly
      - If worker is currently active → queue-change (apply after current task)
    `;

    const resultText = await this.runQuery(routingPrompt, { maxTurns: 1 });
    try {
      return JSON.parse(this.cleanJson(resultText));
    } catch {
      // Fallback: treat as a question if JSON parse fails
      return { action: "answer", response: resultText };
    }
  }

  // ── Prompt Crafting ───────────────────────────────────────

  craftWorkerPrompt(
    story: Story,
    mode: WorkerMode,
    context: {
      plan: Plan;
      designMeta?: any;
      existingFiles?: string[];
    }
  ): string {
    const adapter = getAdapter(this.config.framework);

    switch (mode) {
      case "design":
        return this.craftDesignPrompt(story, context, adapter);
      case "build":
        return this.craftBuildPrompt(story, context, adapter);
      case "review":
        return this.craftReviewPrompt(story, context, adapter);
      case "fix":
        return this.craftFixPrompt(story, context, adapter);
    }
  }

  private craftDesignPrompt(
    story: Story,
    context: { plan: Plan },
    adapter: any
  ): string {
    const refsDir = ".forge/designs/references";

    return `
      You are designing the UI for: "${story.title}"

      Description: ${story.description}
      App: ${context.plan.project} (${adapter.name})
      Full app context: ${context.plan.description}

      DESIGN REFERENCES:
      Check if ${refsDir}/ exists and contains reference images.
      If so, read them and match their visual style, color palette, typography, and layout.

      Create a Storybook story file that renders this component/page.
      The file should be at: stories/${story.id}.stories.tsx

      Requirements:
      - Must be responsive (mobile-first: 375px, then 768px, then 1440px)
      - Use Tailwind CSS for styling
      - Include realistic placeholder data (not lorem ipsum)
      - Show default, loading, empty, and error states as separate stories
      - Use a distinctive, professional design (not generic AI aesthetics)
      - Choose fonts and colors that match the app's purpose

      DO NOT write the actual app code. Only the Storybook preview.
    `;
  }

  private craftBuildPrompt(
    story: Story,
    context: { plan: Plan; designMeta?: any; existingFiles?: string[] },
    adapter: any
  ): string {
    const designRef = context.designMeta
      ? `\nApproved design: Follow the design in stories/${story.id}.stories.tsx exactly.`
      : "";

    const existingRef = context.existingFiles?.length
      ? `\nExisting files to reference for patterns:\n${context.existingFiles.map((f) => `  - ${f}`).join("\n")}`
      : "";

    return `
      Implement: "${story.title}"

      Description: ${story.description}
      App: ${context.plan.project} (${adapter.name})
      ${designRef}
      ${existingRef}

      Expected project structure:
      ${adapter.fileStructure}

      Technical requirements:
      - Follow existing code patterns in the project
      - Small, focused components/functions
      - Proper error handling
      - Responsive design (mobile-first)

      After writing code:
      1. Run: ${adapter.buildCommand} (fix any errors)
      2. Run: ${adapter.lintCommand} (fix any warnings)
      3. Run: ${adapter.typecheckCommand} (fix any type errors)

      If any command fails, read the error, fix it, and re-run.
      Do NOT leave broken code.
    `;
  }

  private craftReviewPrompt(
    story: Story,
    context: { plan: Plan; designMeta?: any },
    adapter: any
  ): string {
    return `
      Review the code for: "${story.title}"

      Framework: ${adapter.name}

      Check:
      1. Does the implementation match the story description?
      ${context.designMeta ? "2. Does it match the approved design?" : ""}
      3. Code quality — no shortcuts, proper types
      4. Responsive design — works on mobile and desktop
      5. Error handling — graceful failures, loading states
      6. Accessibility — semantic HTML, ARIA labels
      7. No debug logs, no commented-out code, no TODOs

      Run:
      - ${adapter.buildCommand}
      - ${adapter.lintCommand}
      - ${adapter.typecheckCommand}

      If you find issues:
      - Minor (formatting, missing type): fix them directly
      - Major (broken logic, missing feature): list them and do NOT fix

      Return a summary of what you found and what you fixed.
    `;
  }

  private craftFixPrompt(
    story: Story,
    context: { plan: Plan },
    adapter: any
  ): string {
    return `
      Fix an issue in: "${story.title}"
      Framework: ${adapter.name}

      Make the smallest possible change. Do not refactor.
      After fixing, run ${adapter.buildCommand} and ${adapter.typecheckCommand} to verify.
    `;
  }

  // ── SDK Query Helper ──────────────────────────────────────

  private async runQuery(
    prompt: string,
    opts: { maxTurns?: number } = {}
  ): Promise<string> {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeQuery(prompt, opts);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);

        if (this.isAuthError(msg) && attempt < maxRetries) {
          playSound();
          console.log(chalk.yellow("\n  Authentication expired"));
          console.log(chalk.dim("  Run: claude login"));
          console.log(chalk.dim(`  Retrying in 30s (attempt ${attempt}/${maxRetries})...\n`));
          await new Promise((r) => setTimeout(r, 30_000));
          continue;
        }

        throw error;
      }
    }

    throw new Error("Max retries exceeded");
  }

  private async executeQuery(
    prompt: string,
    opts: { maxTurns?: number } = {}
  ): Promise<string> {
    let resultText = "";

    for await (const msg of query({
      prompt,
      options: {
        model: this.config.model,
        systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
        maxTurns: opts.maxTurns,
        allowedTools: [],
      },
    })) {
      if (msg.type === "result") {
        if ("result" in msg && typeof msg.result === "string") {
          resultText = msg.result;
        } else if ("errors" in msg && Array.isArray(msg.errors)) {
          throw new Error(`Agent error: ${msg.errors.join(", ")}`);
        }
      }

      if (msg.type === "assistant" && msg.message?.content) {
        const textBlocks = msg.message.content
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text);
        if (textBlocks.length > 0) {
          resultText = textBlocks.join("\n");
        }
      }
    }

    if (!resultText) {
      throw new Error("No response from agent");
    }

    return resultText;
  }

  private isAuthError(msg: string): boolean {
    const lower = msg.toLowerCase();
    return (
      lower.includes("401") ||
      lower.includes("unauthorized") ||
      lower.includes("auth") ||
      lower.includes("token expired") ||
      lower.includes("session expired") ||
      lower.includes("not authenticated")
    );
  }

  private cleanJson(text: string): string {
    return text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
  }
}
