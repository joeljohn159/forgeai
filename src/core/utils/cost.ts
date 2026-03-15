// ============================================================
// Cost Estimation
// Estimates token usage and cost before running a sprint
// ============================================================

import type { Plan, Story } from "../../types/plan.js";

// Approximate tokens per phase per story type
const TOKENS_PER_STORY: Record<string, { input: number; output: number }> = {
  "ui-design":     { input: 8_000,  output: 12_000 },
  "ui-build":      { input: 15_000, output: 25_000 },
  "ui-test":       { input: 10_000, output: 15_000 },
  "ui-review":     { input: 12_000, output: 8_000 },
  "backend-build": { input: 12_000, output: 20_000 },
  "backend-test":  { input: 8_000,  output: 12_000 },
  "backend-review":{ input: 10_000, output: 6_000 },
  "fullstack-design":  { input: 8_000,  output: 12_000 },
  "fullstack-build":   { input: 20_000, output: 35_000 },
  "fullstack-test":    { input: 12_000, output: 18_000 },
  "fullstack-review":  { input: 15_000, output: 10_000 },
};

// Claude pricing per 1M tokens (as of 2025)
const PRICING: Record<string, { input: number; output: number }> = {
  sonnet: { input: 3.0,  output: 15.0 },
  opus:   { input: 15.0, output: 75.0 },
  haiku:  { input: 0.25, output: 1.25 },
};

export interface CostEstimate {
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCostUsd: number;
  perStory: {
    storyId: string;
    title: string;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  }[];
  model: string;
}

export function estimateCost(plan: Plan, model: string = "sonnet"): CostEstimate {
  const pricing = PRICING[model] || PRICING.sonnet;
  const stories = plan.epics.flatMap((e) => e.stories);
  const perStory: CostEstimate["perStory"] = [];

  let totalInput = 0;
  let totalOutput = 0;

  // Planning phase (orchestrator)
  totalInput += 5_000;
  totalOutput += 8_000;

  // README generation
  totalInput += 8_000;
  totalOutput += 5_000;

  for (const story of stories) {
    let storyInput = 0;
    let storyOutput = 0;

    const phases = getPhases(story);
    for (const phase of phases) {
      const key = `${story.type}-${phase}`;
      const tokens = TOKENS_PER_STORY[key];
      if (tokens) {
        storyInput += tokens.input;
        storyOutput += tokens.output;
      }
    }

    totalInput += storyInput;
    totalOutput += storyOutput;

    const storyCost =
      (storyInput / 1_000_000) * pricing.input +
      (storyOutput / 1_000_000) * pricing.output;

    perStory.push({
      storyId: story.id,
      title: story.title,
      inputTokens: storyInput,
      outputTokens: storyOutput,
      costUsd: storyCost,
    });
  }

  const totalCost =
    (totalInput / 1_000_000) * pricing.input +
    (totalOutput / 1_000_000) * pricing.output;

  return {
    totalInputTokens: totalInput,
    totalOutputTokens: totalOutput,
    estimatedCostUsd: totalCost,
    perStory,
    model,
  };
}

function getPhases(story: Story): string[] {
  switch (story.type) {
    case "ui":
      return ["design", "build", "test", "review"];
    case "backend":
      return ["build", "test", "review"];
    case "fullstack":
      return ["design", "build", "test", "review"];
    default:
      return ["build", "test", "review"];
  }
}

export function formatCostEstimate(est: CostEstimate): string {
  const lines: string[] = [];
  lines.push(`  Model: ${est.model}`);
  lines.push(`  Stories: ${est.perStory.length}`);
  lines.push("");

  for (const s of est.perStory) {
    const tokens = `${formatTokens(s.inputTokens)} in / ${formatTokens(s.outputTokens)} out`;
    lines.push(`  ${s.title}`);
    lines.push(`    ${tokens} · ~$${s.costUsd.toFixed(4)}`);
  }

  lines.push("");
  lines.push(`  Total: ${formatTokens(est.totalInputTokens)} in / ${formatTokens(est.totalOutputTokens)} out`);
  lines.push(`  Estimated cost: ~$${est.estimatedCostUsd.toFixed(2)}`);

  return lines.join("\n");
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(n);
}
