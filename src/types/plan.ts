// ============================================================
// Plan Types — Epics, Stories, Sprint structure
// ============================================================

export type StoryStatus =
  | "planned"
  | "designing"
  | "design-approved"
  | "building"
  | "testing"
  | "reviewing"
  | "done"
  | "blocked";

export type StoryType = "ui" | "backend" | "fullstack";

export interface Story {
  id: string;
  title: string;
  description: string;
  type: StoryType;
  status: StoryStatus;
  branch: string | null;
  designApproved: boolean;
  tags: string[];
  priority: number;
  dependencies: string[]; // story IDs this depends on
}

export interface Epic {
  id: string;
  title: string;
  status: "planned" | "in-progress" | "done";
  stories: Story[];
}

export interface Plan {
  project: string;
  framework: string;
  description: string;
  created: string;
  epics: Epic[];
}

// ============================================================
// State Types — Runtime pipeline state
// ============================================================

export type Phase = "init" | "plan" | "design" | "build" | "test" | "review" | "done";

export type WorkerMode = "design" | "build" | "test" | "review" | "fix";

export interface QueuedChange {
  type: "visual-tweak" | "redesign" | "bug-fix" | "new-feature" | "content-change";
  message: string;
  queuedAt: string;
}

export interface HistoryEntry {
  action: string;
  storyId: string | null;
  timestamp: string;
  snapshotId: string | null;
  details: string;
}

export interface SprintState {
  currentPhase: Phase;
  currentStory: string | null;
  workerMode: WorkerMode | null;
  queue: QueuedChange[];
  history: HistoryEntry[];
}

// ============================================================
// Config Types — User and project configuration
// ============================================================

export interface ForgeConfig {
  framework: string; // "nextjs" | "react" | "django" — extensible via adapters
  model: "sonnet" | "opus" | "haiku";
  designPreview: "storybook" | "html";
  githubSync: boolean;
  githubRepo: string | null;
  autoCommit: boolean;
  storybook: {
    port: number;
  };
}

// ============================================================
// Agent Types — Orchestrator and Worker configs
// ============================================================

export interface AgentConfig {
  systemPrompt: string;
  model: string;
  allowedTools: string[];
  workingDir: string;
  maxTurns?: number;
}

export interface OrchestratorDecision {
  action:
    | "route-to-worker"
    | "add-story"
    | "reprioritize"
    | "answer"
    | "queue-change";
  workerMode?: WorkerMode;
  story?: Partial<Story>;
  response?: string;
  queuedChange?: QueuedChange;
  prompt?: string; // crafted prompt for the Worker
}

// ============================================================
// Snapshot Types — For undo/rollback
// ============================================================

export interface FileSnapshot {
  path: string;
  hash: string;
}

export interface Snapshot {
  id: string;
  action: string;
  storyId: string | null;
  timestamp: string;
  files: FileSnapshot[];
  branch: string;
  commitBefore: string;
}

// ============================================================
// Design Types — Design metadata
// ============================================================

export interface DesignMeta {
  storyId: string;
  approved: boolean;
  approvedAt: string | null;
  feedback: string[];
  storybookPath: string | null;
  referenceImages: string[];
  viewports: {
    mobile: boolean;
    desktop: boolean;
  };
}
