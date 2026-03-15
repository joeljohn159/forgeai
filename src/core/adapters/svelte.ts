import type { FrameworkAdapter } from "./base.js";

export const svelteAdapter: FrameworkAdapter = {
  id: "svelte",
  name: "SvelteKit",
  language: "typescript",
  scaffoldCommands: [
    "npx sv create . --template minimal --types ts --no-add-ons --no-install",
    "npm install",
    "npm install -D tailwindcss @tailwindcss/vite",
  ],
  buildCommand: "npm run build",
  lintCommand: "npm run check",
  typecheckCommand: "npx svelte-check --tsconfig ./tsconfig.json",
  devCommand: "npm run dev",
  devPort: 5173,
  designSupport: true,
  packageManager: "npm",
  requiredFiles: ["package.json", "svelte.config.js", "vite.config.ts"],
  testCommand: "npx vitest run",
  testFramework: "Vitest",

  buildPromptAdditions: `
FOR SVELTEKIT:
- Use Svelte 5 runes syntax: $state(), $derived(), $effect(), $props()
- Do NOT use legacy Svelte 4 syntax (no export let, no $: reactive, no on:click)
- File-based routing in src/routes/ directory
- +page.svelte for pages, +layout.svelte for layouts
- +page.server.ts for server-side load functions
- +server.ts for API endpoints
- Use form actions for mutations (+page.server.ts actions)
- Components in src/lib/components/
- Shared utilities in src/lib/
- Use $lib/ alias for imports from src/lib/

SVELTEKIT-SPECIFIC:
- Load functions: export const load = async ({ fetch, params }) => { ... }
- Form actions: export const actions = { default: async ({ request }) => { ... } }
- Hooks: src/hooks.server.ts for server hooks, src/hooks.client.ts for client
- Error pages: +error.svelte
- Use goto() for programmatic navigation
- Use enhance for progressive form enhancement: <form use:enhance>
- Environment variables: $env/static/private, $env/static/public

SVELTE 5 RUNES (REQUIRED):
- State: let count = $state(0)
- Derived: let doubled = $derived(count * 2)
- Effects: $effect(() => { console.log(count) })
- Props: let { name, age = 25 } = $props()
- Bindable: let { value = $bindable() } = $props()
- Event handlers: onclick={handler} (NOT on:click)
- Snippets: {#snippet name()}...{/snippet} and {@render name()}

STYLING:
- Tailwind CSS via @tailwindcss/vite plugin in vite.config.ts
- Scoped styles by default in <style> blocks
- Global styles in src/app.css

ASSETS & SEO:
- Static assets in static/ directory
- favicon.ico, og.png in static/
- Use svelte:head for per-page meta tags
- robots.txt in static/
`.trim(),

  designPromptAdditions: `
SVELTEKIT DESIGN:
- Use Svelte 5 runes syntax in all components
- Tailwind CSS for styling
- Use CSF3 format for Storybook stories
- Use @storybook/svelte renderer
- Include viewport decorators for mobile (375px) and desktop (1440px)
`.trim(),

  fileStructure: `
src/
├── app.html                   # HTML template
├── app.css                    # Global styles + Tailwind
├── routes/
│   ├── +page.svelte           # Home page
│   ├── +layout.svelte         # Root layout
│   ├── +error.svelte          # Error page
│   └── [route]/
│       ├── +page.svelte       # Route page
│       └── +page.server.ts    # Server load function
├── lib/
│   ├── components/
│   │   ├── ui/                # Reusable UI components
│   │   └── [feature]/         # Feature-specific components
│   ├── server/
│   │   └── db.ts              # Server-only utilities
│   └── utils.ts               # Shared utilities
└── hooks.server.ts            # Server hooks
static/
├── favicon.ico
├── og.png
└── robots.txt
svelte.config.js               # Svelte configuration
vite.config.ts                 # Vite configuration
`.trim(),
};
