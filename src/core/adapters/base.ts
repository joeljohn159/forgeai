// ============================================================
// Framework Adapter — Base interface
// Each adapter knows how to scaffold, build, lint, and run
// a project in its framework.
// ============================================================

export interface FrameworkAdapter {
  /** Framework identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Language used */
  language: "typescript" | "python" | "dart" | "javascript";

  /** Commands to scaffold a new project (run in order) */
  scaffoldCommands: string[];

  /** Command to build the project */
  buildCommand: string;

  /** Command to lint the project */
  lintCommand: string;

  /** Command to type-check */
  typecheckCommand: string;

  /** Command to start dev server */
  devCommand: string;

  /** Port for dev server */
  devPort: number;

  /** Whether Storybook design phase is supported */
  designSupport: boolean;

  /** Extra system prompt instructions for the Worker build mode */
  buildPromptAdditions: string;

  /** Extra system prompt instructions for the Worker design mode */
  designPromptAdditions: string;

  /** Description of the expected project file structure */
  fileStructure: string;

  /** Package manager to use */
  packageManager: "npm" | "pip" | "poetry" | "pub" | "pnpm" | "yarn";

  /** Test command */
  testCommand?: string;

  /** Test framework name */
  testFramework?: string;

  /** Files that should always exist after scaffold */
  requiredFiles: string[];
}
