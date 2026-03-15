// ============================================================
// Adapter Registry — Factory for framework adapters
// ============================================================

import type { FrameworkAdapter } from "./base.js";
import { nextjsAdapter } from "./nextjs.js";
import { reactViteAdapter } from "./react-vite.js";
import { djangoAdapter } from "./django.js";
import { flutterAdapter } from "./flutter.js";
import { vueNuxtAdapter } from "./vue-nuxt.js";
import { svelteAdapter } from "./svelte.js";
import { genericAdapter } from "./generic.js";
import { loadCustomAdapters } from "./plugin.js";

const builtinAdapters: Record<string, FrameworkAdapter> = {
  nextjs: nextjsAdapter,
  react: reactViteAdapter,
  django: djangoAdapter,
  flutter: flutterAdapter,
  vue: vueNuxtAdapter,
  svelte: svelteAdapter,
  generic: genericAdapter,
};

// Merge built-in + user-defined adapters (user adapters win on collision)
let adapters: Record<string, FrameworkAdapter> = { ...builtinAdapters };

/** Load custom adapters from .forge/adapters/ and merge into registry */
export async function refreshAdapters(workingDir?: string): Promise<void> {
  const custom = await loadCustomAdapters(workingDir);
  adapters = { ...builtinAdapters, ...custom };
}

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
