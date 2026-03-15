import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  Plan,
  Story,
  SprintState,
  ForgeConfig,
  OrchestratorDecision,
  WorkerMode,
} from "../../types/plan.js";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "./prompts.js";
import { stateManager } from "../../state/index.js";

// ============================================================
// Orchestrator Agent
// The project manager. Never writes code.
// Plans, routes, reviews, and crafts prompts for the Worker.
// ============================================================

export class Orchestrator {
  private config: ForgeConfig;
  private plan: Plan | null = null;

  constructor(config: ForgeConfig) {
    this.config = config;
  }

  // ── Plan Generation ───────────────────────────────────────

  async generatePlan(description: string): Promise<Plan> {
    const prompt = `
      The user wants to build the following application:
      "${description}"

      Framework: ${this.config.framework}

      Break this down into epics and stories. Each story should be:
      - Small enough to build in one agent session
      - Independently testable
      - Ordered by dependency (foundation first)

      Story types:
      - "ui" = has a visual component (needs design phase)
      - "backend" = API/database only (skip design phase)
      - "fullstack" = both UI and backend

      Return ONLY valid JSON with this structure:
      {
        "project": "project name",
        "framework": "nextjs",
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
    const rawPlan = JSON.parse(this.cleanJson(resultText));

    // Hydrate with default status fields
    const plan: Plan = {
      ...rawPlan,
      created: new Date().toISOString(),
      epics: rawPlan.epics.map((epic: any) => ({
        ...epic,
        status: "planned" as const,
        stories: epic.stories.map((story: any) => ({
          ...story,
          status: "planned" as const,
          branch: null,
          designApproved: false,
          tags: [],
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

      The user said: "${message}"

      Classify this input and decide what to do.
      Return ONLY valid JSON with this structure:
      {
        "action": "route-to-worker" | "add-story" | "reprioritize" | "answer" | "queue-change",
        "workerMode": "design" | "build" | "review" | "fix" (if routing to worker),
        "response": "your response to the user" (if answering directly),
        "prompt": "detailed prompt for the worker" (if routing to worker),
        "story": { ... } (if adding a new story)
      }

      Routing rules:
      - Visual tweak (color, spacing, font) → route-to-worker, mode: fix
      - Layout/UX redesign → route-to-worker, mode: design
      - Bug fix → route-to-worker, mode: fix
      - New feature → add-story
      - Content change (text, labels) → route-to-worker, mode: fix
      - Question → answer directly
      - If worker is currently active → queue-change (apply after current task)
    `;

    const resultText = await this.runQuery(routingPrompt, { maxTurns: 1 });
    return JSON.parse(this.cleanJson(resultText));
  }

  // ── Prompt Crafting ───────────────────────────────────────
  // The Orchestrator's most important job: crafting detailed
  // prompts for the Worker so it knows exactly what to do.

  craftWorkerPrompt(
    story: Story,
    mode: WorkerMode,
    context: {
      plan: Plan;
      designMeta?: any;
      existingFiles?: string[];
    }
  ): string {
    switch (mode) {
      case "design":
        return this.craftDesignPrompt(story, context);
      case "build":
        return this.craftBuildPrompt(story, context);
      case "review":
        return this.craftReviewPrompt(story, context);
      case "fix":
        return this.craftFixPrompt(story, context);
    }
  }

  private craftDesignPrompt(
    story: Story,
    context: { plan: Plan }
  ): string {
    return `
      You are designing the UI for: "${story.title}"

      Description: ${story.description}
      App: ${context.plan.project} (${context.plan.framework})
      Full app context: ${context.plan.description}

      Create a Storybook story file that renders this component/page.
      The file should be at: stories/${story.id}.stories.tsx

      Requirements:
      - Must be responsive (mobile-first: 375px, then 768px, then 1440px)
      - Use shadcn/ui components and Tailwind CSS
      - Include realistic placeholder data (not lorem ipsum)
      - Show default, loading, empty, and error states as separate stories
      - Use a distinctive, professional design (not generic AI aesthetics)
      - Choose fonts and colors that match the app's purpose

      DO NOT write the actual app code. Only the Storybook preview.
    `;
  }

  private craftBuildPrompt(
    story: Story,
    context: { plan: Plan; designMeta?: any; existingFiles?: string[] }
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
      App: ${context.plan.project} (${context.plan.framework})
      ${designRef}
      ${existingRef}

      Technical requirements:
      - TypeScript with strict types
      - Follow existing code patterns in the project
      - Small, focused components/functions
      - Proper error handling
      - Responsive design (mobile-first)

      SEO & Assets checklist:
      - favicon.ico + icon.svg + apple-touch-icon.png in public/
      - og.png (1200x630) for social sharing
      - Complete metadata in layout.tsx (title, description, OG tags, Twitter cards)
      - robots.txt, sitemap.xml, manifest.json in public/
      - Use next/image for all images with width, height, alt

      After writing code:
      1. Run: npm run build (fix any errors)
      2. Run: npm run lint (fix any warnings)
      3. Run: npm run typecheck (fix any type errors)

      If any command fails, read the error, fix it, and re-run.
      Do NOT leave broken code.
    `;
  }

  private craftReviewPrompt(
    story: Story,
    context: { plan: Plan; designMeta?: any }
  ): string {
    return `
      Review the code for: "${story.title}"

      Check:
      1. Does the implementation match the story description?
      ${context.designMeta ? "2. Does it match the approved design?" : ""}
      3. TypeScript strict mode — no any types, no ts-ignore
      4. Responsive design — works on mobile and desktop
      5. Error handling — graceful failures, loading states
      6. Accessibility — semantic HTML, ARIA labels
      7. No debug logs, no commented-out code, no TODOs

      Run:
      - npm run build
      - npm run lint
      - npm run typecheck
      - npm run test (if tests exist)

      If you find issues:
      - Minor (formatting, missing type): fix them directly
      - Major (broken logic, missing feature): list them and do NOT fix

      Return a summary of what you found and what you fixed.
    `;
  }

  private craftFixPrompt(
    story: Story,
    context: { plan: Plan }
  ): string {
    return `
      Fix an issue in: "${story.title}"

      Make the smallest possible change. Do not refactor.
      After fixing, run build/lint/typecheck to verify.
    `;
  }

  // ── SDK Query Helper ──────────────────────────────────────
  // The Claude Agent SDK yields SDKMessage objects, not raw API messages.
  // - SDKAssistantMessage: { type: 'assistant', message: BetaMessage }
  // - SDKResultSuccess:    { type: 'result', subtype: 'success', result: string }
  // - SDKResultError:      { type: 'result', subtype: 'error_*', errors: string[] }

  private async runQuery(
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
      // SDKResultMessage carries the final text
      if (msg.type === "result") {
        if ("result" in msg && typeof msg.result === "string") {
          resultText = msg.result;
        } else if ("errors" in msg && Array.isArray(msg.errors)) {
          throw new Error(`Agent error: ${msg.errors.join(", ")}`);
        }
      }

      // SDKAssistantMessage — extract text from BetaMessage content blocks
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

  // ── Helpers ───────────────────────────────────────────────

  private cleanJson(text: string): string {
    // Strip markdown code fences if present
    return text
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();
  }
}
