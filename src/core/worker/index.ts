import { query } from "@anthropic-ai/claude-agent-sdk";
import chalk from "chalk";
import type { WorkerMode, ForgeConfig } from "../../types/plan.js";
import {
  getDesignPrompt,
  getBuildPrompt,
  getReviewPrompt,
  getFixPrompt,
} from "./prompts/index.js";
import { playSound } from "../utils/sound.js";

// ============================================================
// Worker Agent
// Single agent, multiple modes. Does the actual work.
// Framework-aware prompts via adapter system.
// ============================================================

const MODE_TOOLS: Record<WorkerMode, string[]> = {
  design: ["Read", "Write", "Glob", "LS"],
  build: ["Read", "Write", "Edit", "Bash", "Glob", "LS", "Grep"],
  review: ["Read", "Bash", "Glob", "LS", "Grep"],
  fix: ["Read", "Write", "Edit", "Bash", "Glob", "LS", "Grep"],
};

function getModePrompt(mode: WorkerMode, framework?: string): string {
  switch (mode) {
    case "design": return getDesignPrompt(framework);
    case "build":  return getBuildPrompt(framework);
    case "review": return getReviewPrompt(framework);
    case "fix":    return getFixPrompt(framework);
  }
}

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
  yes?: boolean;
  workingDir?: string;
  allowedDomains?: string[];
}

const MAX_AUTH_RETRIES = 3;
const AUTH_RETRY_DELAY_MS = 30_000; // 30s between retries

export class Worker {
  private config: ForgeConfig;
  private sandboxOpts: WorkerSandboxOptions;
  private mute: boolean;

  constructor(config: ForgeConfig, sandboxOpts: WorkerSandboxOptions = {}, mute = false) {
    this.config = config;
    this.sandboxOpts = sandboxOpts;
    this.mute = mute;
  }

  async run(
    mode: WorkerMode,
    prompt: string,
    options: {
      workingDir?: string;
      onProgress?: WorkerProgressCallback;
    } = {}
  ): Promise<WorkerResult> {
    // Retry loop for auth/token errors
    for (let attempt = 1; attempt <= MAX_AUTH_RETRIES; attempt++) {
      const result = await this.executeQuery(mode, prompt, options);

      // Check if it's a recoverable auth error
      if (!result.success && this.isAuthError(result.errors)) {
        if (attempt < MAX_AUTH_RETRIES) {
          this.notifyAuthError(attempt);
          await this.waitForReauth();
          // Clear auth errors before retrying — keep other errors
          result.errors = result.errors.filter((e) => !this.isAuthErrorMsg(e));
          continue;
        }
        // Final attempt failed — add help text
        result.errors.push(
          "Authentication failed after retries. Run: claude login"
        );
      }

      return result;
    }

    // Should never reach here, but TypeScript needs it
    return {
      success: false,
      filesCreated: [],
      filesModified: [],
      errors: ["Max retries exceeded"],
      summary: "",
      usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, durationMs: 0 },
    };
  }

  private async executeQuery(
    mode: WorkerMode,
    prompt: string,
    options: {
      workingDir?: string;
      onProgress?: WorkerProgressCallback;
    } = {}
  ): Promise<WorkerResult> {
    let workingDir = options.workingDir || this.sandboxOpts.workingDir;
    if (!workingDir) {
      try {
        workingDir = process.cwd();
      } catch {
        // CWD was deleted (EPERM uv_cwd) — use the sandbox working dir or fail gracefully
        return {
          success: false,
          filesCreated: [],
          filesModified: [],
          errors: ["Working directory no longer exists. Please cd to your project and retry."],
          summary: "",
          usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, durationMs: 0 },
        };
      }
    }
    const { onProgress } = options;

    const result: WorkerResult = {
      success: false,
      filesCreated: [],
      filesModified: [],
      errors: [],
      summary: "",
      usage: { inputTokens: 0, outputTokens: 0, costUsd: 0, durationMs: 0 },
    };

    const sdkOptions: Record<string, any> = {
      model: this.config.model,
      systemPrompt: getModePrompt(mode, this.config.framework),
      allowedTools: MODE_TOOLS[mode],
      cwd: workingDir,
      maxTurns: MODE_MAX_TURNS[mode],
    };

    if (this.sandboxOpts.yes && !this.sandboxOpts.sandbox) {
      sdkOptions.permissionMode = "bypassPermissions";
    }

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
          // Check for errors — handle empty strings and objects
          const hasError = "is_error" in msg && msg.is_error;
          const errors = "errors" in msg && Array.isArray(msg.errors) ? msg.errors : [];
          const subtype = "subtype" in msg ? String(msg.subtype || "") : "";

          if (errors.length > 0) {
            for (const e of errors) {
              const eStr = typeof e === "string" ? e : JSON.stringify(e);
              if (eStr && eStr.length > 0) result.errors.push(eStr);
            }
          }
          if (hasError && result.errors.length === 0) {
            result.errors.push(
              subtype || "Claude encountered an error. Run: claude login"
            );
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
      const msg = error instanceof Error ? error.message : String(error);
      result.success = false;
      result.errors.push(msg);
    }

    return result;
  }

  // ── Auth Error Detection ──────────────────────────────────

  private isAuthErrorMsg(msg: string): boolean {
    const lower = msg.toLowerCase();
    return (
      lower.includes("401") ||
      lower.includes("unauthorized") ||
      lower.includes("auth") ||
      lower.includes("token expired") ||
      lower.includes("session expired") ||
      lower.includes("not authenticated") ||
      lower.includes("login required") ||
      lower.includes("credential")
    );
  }

  private isAuthError(errors: string[]): boolean {
    return errors.some((e) => this.isAuthErrorMsg(e));
  }

  private notifyAuthError(attempt: number): void {
    if (!this.mute) playSound();
    console.log("");
    console.log(chalk.yellow("  ⚠ Authentication expired"));
    console.log(chalk.dim("  Your Claude session token has expired."));
    console.log(chalk.dim("  Please re-authenticate:"));
    console.log(chalk.white("    claude login"));
    console.log(chalk.dim(`\n  Waiting to retry (attempt ${attempt}/${MAX_AUTH_RETRIES})...`));
    console.log(chalk.dim("  Forge will resume automatically once auth is renewed.\n"));
  }

  private waitForReauth(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, AUTH_RETRY_DELAY_MS));
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
    const parts = p.split(/[/\\]/);
    return parts.length > 2 ? ".../" + parts.slice(-2).join("/") : p;
  }
}
