import { query } from "@anthropic-ai/claude-agent-sdk";
import type { WorkerMode, ForgeConfig } from "../../types/plan.js";
import {
  DESIGN_SYSTEM_PROMPT,
  BUILD_SYSTEM_PROMPT,
  REVIEW_SYSTEM_PROMPT,
  FIX_SYSTEM_PROMPT,
} from "./prompts/index.js";

// ============================================================
// Worker Agent
// Single agent, multiple modes. Does the actual work.
// ============================================================

const MODE_TOOLS: Record<WorkerMode, string[]> = {
  design: ["Read", "Write", "Glob", "LS"],
  build: ["Read", "Write", "Edit", "Bash", "Glob", "LS", "Grep"],
  review: ["Read", "Bash", "Glob", "LS", "Grep"],
  fix: ["Read", "Write", "Edit", "Bash", "Glob", "LS", "Grep"],
};

const MODE_PROMPTS: Record<WorkerMode, string> = {
  design: DESIGN_SYSTEM_PROMPT,
  build: BUILD_SYSTEM_PROMPT,
  review: REVIEW_SYSTEM_PROMPT,
  fix: FIX_SYSTEM_PROMPT,
};

const MODE_MAX_TURNS: Record<WorkerMode, number> = {
  design: 30,
  build: 50,
  review: 20,
  fix: 15,
};

export interface WorkerUsage {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
}

export interface WorkerResult {
  success: boolean;
  messages: any[];
  filesCreated: string[];
  filesModified: string[];
  errors: string[];
  summary: string;
  usage: WorkerUsage;
}

export interface WorkerProgressEvent {
  type: "tool_use" | "tool_running" | "tool_done" | "thinking" | "status";
  content: string;
  tool?: string;
  elapsed?: number;
}

export interface WorkerProgressCallback {
  (event: WorkerProgressEvent): void;
}

export interface WorkerSandboxOptions {
  sandbox?: boolean;
  workingDir?: string;
  allowedDomains?: string[];
}

export class Worker {
  private config: ForgeConfig;
  private sandboxOpts: WorkerSandboxOptions;

  constructor(config: ForgeConfig, sandboxOpts: WorkerSandboxOptions = {}) {
    this.config = config;
    this.sandboxOpts = sandboxOpts;
  }

  async run(
    mode: WorkerMode,
    prompt: string,
    options: {
      workingDir?: string;
      onProgress?: WorkerProgressCallback;
    } = {}
  ): Promise<WorkerResult> {
    const workingDir = options.workingDir || this.sandboxOpts.workingDir || process.cwd();
    const { onProgress } = options;

    const runStart = Date.now();
    const result: WorkerResult = {
      success: false,
      messages: [],
      filesCreated: [],
      filesModified: [],
      errors: [],
      summary: "",
      usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, durationMs: 0 },
    };

    const sdkOptions: Record<string, any> = {
      model: this.config.model,
      systemPrompt: MODE_PROMPTS[mode],
      allowedTools: MODE_TOOLS[mode],
      cwd: workingDir,
      maxTurns: MODE_MAX_TURNS[mode],
    };

    if (this.sandboxOpts.sandbox) {
      sdkOptions.permissionMode = "bypassPermissions";
      sdkOptions.sandbox = {
        enabled: true,
        autoAllowBashIfSandboxed: true,
        filesystem: {
          allowWrite: [workingDir],
        },
        network: {
          allowedDomains: this.sandboxOpts.allowedDomains || [
            "registry.npmjs.org",
            "api.anthropic.com",
          ],
        },
      };
    }

    try {
      for await (const msg of query({ prompt, options: sdkOptions })) {
        result.messages.push(msg);

        // Assistant message — contains tool_use and text blocks
        if (msg.type === "assistant") {
          // Accumulate usage from individual messages as fallback
          if (msg.message?.usage) {
            result.usage.inputTokens += msg.message.usage.input_tokens || 0;
            result.usage.outputTokens += msg.message.usage.output_tokens || 0;
          }
          for (const block of msg.message?.content || []) {
            if (block.type === "text") {
              onProgress?.({ type: "thinking", content: block.text.slice(0, 120) });
            }
            if (block.type === "tool_use") {
              const detail = this.describeToolUse(block);
              onProgress?.({ type: "tool_use", content: detail, tool: block.name });

              if (block.name === "Write" && block.input?.file_path) {
                result.filesCreated.push(block.input.file_path);
              }
              if (block.name === "Edit" && block.input?.file_path) {
                result.filesModified.push(block.input.file_path);
              }
            }
          }
        }

        // Tool progress — fires while a tool is still running
        if (msg.type === "tool_progress") {
          onProgress?.({
            type: "tool_running",
            content: msg.tool_name,
            tool: msg.tool_name,
            elapsed: msg.elapsed_time_seconds,
          });
        }

        // Tool use summary — human-readable summary after tool completes
        if (msg.type === "tool_use_summary") {
          onProgress?.({ type: "tool_done", content: msg.summary });
        }

        // Result — final message with usage stats
        if (msg.type === "result") {
          if ("result" in msg && typeof msg.result === "string") {
            result.summary = msg.result;
          }
          if ("errors" in msg && Array.isArray(msg.errors) && msg.errors.length > 0) {
            result.errors.push(...msg.errors);
          }
          if ("is_error" in msg && msg.is_error) {
            result.errors.push(msg.subtype || "unknown error");
          }
          // Extract token usage — SDK result gives cumulative totals, so overwrite
          if (msg.usage) {
            result.usage.inputTokens = msg.usage.input_tokens || 0;
            result.usage.outputTokens = msg.usage.output_tokens || 0;
          }
          if (typeof msg.total_cost_usd === "number") {
            result.usage.costUsd = msg.total_cost_usd;
          }
          if (typeof msg.duration_ms === "number") {
            result.usage.durationMs = msg.duration_ms;
          }
          // Handle max turns cap gracefully
          if ("is_error" in msg && msg.subtype === "error_max_turns") {
            result.errors.push(`Hit ${MODE_MAX_TURNS[mode]}-turn safety cap — story may be incomplete`);
          }
        }
      }

      result.success = result.errors.length === 0;

      if (!result.summary) {
        result.summary = "Completed without summary.";
      }
    } catch (error) {
      result.success = false;
      result.errors.push(
        error instanceof Error ? error.message : String(error)
      );
    }

    return result;
  }

  /** Turn a tool_use block into a short human-readable string */
  private describeToolUse(block: any): string {
    const name = block.name;
    const input = block.input || {};

    switch (name) {
      case "Write":
        return `Write ${this.shortPath(input.file_path)}`;
      case "Edit":
        return `Edit ${this.shortPath(input.file_path)}`;
      case "Read":
        return `Read ${this.shortPath(input.file_path)}`;
      case "Bash":
        return `Run ${(input.command || "").slice(0, 60)}`;
      case "Glob":
        return `Search ${input.pattern || ""}`;
      case "Grep":
        return `Grep ${input.pattern || ""}`;
      default:
        return name;
    }
  }

  private shortPath(p?: string): string {
    if (!p) return "";
    const parts = p.split("/");
    return parts.length > 2 ? ".../" + parts.slice(-2).join("/") : p;
  }
}
