// ============================================================
// ForgeAI v1.0 — AI Development Orchestration Framework
//
// Programmatic API for use as a library.
// For CLI usage, see src/cli/index.ts
// ============================================================

// Core agents
export { Orchestrator } from "./core/orchestrator/index.js";
export { Worker } from "./core/worker/index.js";

// Pipeline engines
export { Pipeline } from "./core/pipeline/index.js";
export { AutoPipeline } from "./core/pipeline/auto.js";

// Infrastructure
export { GitManager } from "./core/git/index.js";
export { stateManager } from "./state/index.js";

// Adapter system
export { getAdapter, listAdapters } from "./core/adapters/index.js";

// Utilities
export { validateConfig, loadAndValidateConfig } from "./core/utils/config.js";
export { playSound } from "./core/utils/sound.js";

// Types
export type {
  Plan,
  Epic,
  Story,
  StoryStatus,
  StoryType,
  SprintState,
  Phase,
  WorkerMode,
  ForgeConfig,
  OrchestratorDecision,
  QueuedChange,
  HistoryEntry,
  Snapshot,
  DesignMeta,
} from "./types/plan.js";

export type {
  WorkerResult,
  WorkerUsage,
  WorkerProgressCallback,
} from "./core/worker/index.js";

export type { FrameworkAdapter } from "./core/adapters/base.js";
export type { ConfigValidation } from "./core/utils/config.js";
