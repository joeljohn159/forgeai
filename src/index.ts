// ============================================================
// Forge — AI Development Orchestration Framework
//
// Programmatic API for use as a library.
// For CLI usage, see src/cli/index.ts
// ============================================================

export { Orchestrator } from "./core/orchestrator/index.js";
export { Worker } from "./core/worker/index.js";
export { Pipeline } from "./core/pipeline/index.js";
export { AutoPipeline } from "./core/pipeline/auto.js";
export { GitManager } from "./core/git/index.js";
export { stateManager } from "./state/index.js";

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
