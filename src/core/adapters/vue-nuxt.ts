import type { FrameworkAdapter } from "./base.js";

export const vueNuxtAdapter: FrameworkAdapter = {
  id: "vue",
  name: "Vue 3 + Nuxt 3",
  language: "typescript",
  scaffoldCommands: [
    "npx nuxi@latest init . --force --packageManager npm",
    "npm install",
    "npm install -D @nuxtjs/tailwindcss",
  ],
  buildCommand: "npm run build",
  lintCommand: "npm run lint",
  typecheckCommand: "npx nuxi typecheck",
  devCommand: "npm run dev",
  devPort: 3000,
  designSupport: true,
  packageManager: "npm",
  requiredFiles: ["package.json", "nuxt.config.ts", "app.vue"],
  testCommand: "npx vitest run",
  testFramework: "Vitest",

  buildPromptAdditions: `
FOR VUE 3 + NUXT 3:
- Use Composition API with <script setup lang="ts"> — NO Options API
- Use Nuxt 3 auto-imports (ref, computed, watch, useState, useFetch are available globally)
- File-based routing in pages/ directory
- Server API routes in server/api/ directory
- Layouts in layouts/ directory, components in components/ (auto-imported)
- Use useFetch() or useAsyncData() for data fetching (SSR-compatible)
- Use useState() for shared reactive state across components
- Use definePageMeta() for page-level config (layout, middleware)
- Use Nuxt modules in nuxt.config.ts (e.g., @nuxtjs/tailwindcss)
- Use VueUse composables where appropriate (npm install @vueuse/nuxt)

NUXT-SPECIFIC:
- Server routes: export default defineEventHandler() in server/api/
- Middleware: defineNuxtRouteMiddleware() in middleware/
- Plugins: defineNuxtPlugin() in plugins/
- Use runtimeConfig in nuxt.config.ts for environment variables
- Use <NuxtLink> for navigation, <NuxtPage> for route rendering
- Use <NuxtLayout> for layout system

STYLING:
- Tailwind CSS via @nuxtjs/tailwindcss module
- Scoped styles with <style scoped> when needed
- CSS variables for theming

ASSETS & SEO:
- Use useHead() or useSeoMeta() for page-level meta tags
- Put static assets in public/
- favicon.ico, og.png in public/
- Use Nuxt Image module for optimized images if needed
`.trim(),

  designPromptAdditions: `
VUE + NUXT DESIGN:
- Components use Composition API with <script setup>
- Tailwind CSS for styling
- Use CSF3 format for Storybook stories
- Include viewport decorators for mobile (375px) and desktop (1440px)
- Use Vue-specific Storybook renderer (@storybook/vue3)
`.trim(),

  fileStructure: `
app.vue                        # Root app component
nuxt.config.ts                 # Nuxt configuration
pages/
├── index.vue                  # Home page (/)
├── about.vue                  # /about
└── [slug].vue                 # Dynamic routes
components/
├── ui/                        # Reusable UI components
└── [feature]/                 # Feature-specific components
composables/
└── use[Name].ts               # Custom composables
layouts/
└── default.vue                # Default layout
server/
├── api/
│   └── [endpoint].ts          # API routes
└── middleware/
    └── [name].ts              # Server middleware
middleware/
└── auth.ts                    # Route middleware
plugins/
└── [name].ts                  # Nuxt plugins
public/
├── favicon.ico
├── og.png
└── robots.txt
assets/
└── css/
    └── main.css               # Global styles
`.trim(),
};
