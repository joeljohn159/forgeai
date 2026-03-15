// ============================================================
// Adapter Registry — Factory for framework adapters
// ============================================================

import type { FrameworkAdapter } from "./base.js";
import { nextjsAdapter } from "./nextjs.js";
import { reactViteAdapter } from "./react-vite.js";
import { djangoAdapter } from "./django.js";
import { genericAdapter } from "./generic.js";

const adapters: Record<string, FrameworkAdapter> = {
  nextjs: nextjsAdapter,
  react: reactViteAdapter,
  django: djangoAdapter,
  generic: genericAdapter,
};

/** Get the adapter for a framework. Throws if unknown. */
export function getAdapter(framework: string): FrameworkAdapter {
  const adapter = adapters[framework];
  if (!adapter) {
    throw new Error(
      `Unknown framework "${framework}". Supported: ${Object.keys(adapters).join(", ")}`
    );
  }
  return adapter;
}

/** List all supported frameworks */
export function listAdapters(): FrameworkAdapter[] {
  return Object.values(adapters);
}

export type { FrameworkAdapter } from "./base.js";
