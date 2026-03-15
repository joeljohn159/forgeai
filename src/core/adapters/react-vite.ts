import type { FrameworkAdapter } from "./base.js";

export const reactViteAdapter: FrameworkAdapter = {
  id: "react",
  name: "React + Vite",
  language: "typescript",
  scaffoldCommands: [
    "npm create vite@latest . -- --template react-ts",
    "npm install",
    "npm install -D tailwindcss @tailwindcss/vite",
    "npm install react-router-dom",
  ],
  buildCommand: "npm run build",
  lintCommand: "npm run lint",
  typecheckCommand: "npx tsc --noEmit",
  devCommand: "npm run dev",
  devPort: 5173,
  designSupport: true,
  packageManager: "npm",
  requiredFiles: ["package.json", "tsconfig.json", "vite.config.ts", "index.html"],

  buildPromptAdditions: `
FOR REACT + VITE:
- Use React Router v6 with createBrowserRouter for routing
- Functional components only — no class components
- Use TypeScript strict mode throughout
- Tailwind CSS for styling (configured via @tailwindcss/vite plugin)
- Use React.lazy() and Suspense for code splitting
- State management: React context + useReducer for simple state, or Zustand if complex
- No SSR — this is a client-side SPA
- Put entry point in src/main.tsx, root component in src/App.tsx
- Environment variables: import.meta.env.VITE_* prefix

VITE CONFIG:
- Configure in vite.config.ts
- Add @tailwindcss/vite plugin
- Set resolve aliases: "@/" -> "./src/"

ASSETS & SEO:
- favicon.ico and icon.svg in public/
- og.png (1200x630) in public/
- Update index.html with proper <title>, meta description, og tags
- robots.txt in public/
`.trim(),

  designPromptAdditions: `
REACT + VITE DESIGN:
- Components use Tailwind CSS utility classes
- Use CSF3 format for Storybook stories
- No Next.js-specific features (no next/image, next/link, etc.)
- Use standard <img>, <a> tags or react-router <Link>
`.trim(),

  fileStructure: `
src/
├── main.tsx                 # Entry point
├── App.tsx                  # Root component with router
├── index.css                # Global styles + Tailwind
├── components/
│   ├── ui/                  # Reusable UI components
│   └── [feature]/           # Feature-specific components
├── pages/
│   └── [PageName].tsx       # Route pages
├── hooks/
│   └── use[Hook].ts         # Custom hooks
├── lib/
│   └── utils.ts             # Shared utilities
└── types/
    └── index.ts             # TypeScript types
public/
├── favicon.ico
├── og.png
└── robots.txt
`.trim(),
};
