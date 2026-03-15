import type { FrameworkAdapter } from "./base.js";

export const nextjsAdapter: FrameworkAdapter = {
  id: "nextjs",
  name: "Next.js",
  language: "typescript",
  scaffoldCommands: [
    "npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias '@/*' --use-npm --no-turbopack",
  ],
  buildCommand: "npm run build",
  lintCommand: "npm run lint",
  typecheckCommand: "npx tsc --noEmit",
  devCommand: "npm run dev",
  devPort: 3000,
  designSupport: true,
  packageManager: "npm",
  requiredFiles: ["package.json", "tsconfig.json", "next.config.ts", "tailwind.config.ts"],

  buildPromptAdditions: `
FOR NEXT.JS:
- Use App Router (not Pages Router)
- Server Components by default — only use "use client" when genuinely needed
- Server Actions for mutations
- Proper metadata and SEO in layout.tsx
- Dynamic imports for heavy components
- Use next/image for all images with width, height, alt
- Use next/link for all internal navigation
- Use next/font for custom fonts (no Google Fonts CDN)

ASSETS & SEO (REQUIRED):
- Create favicon.ico, icon.svg, and apple-touch-icon.png in public/
- Create og.png (1200x630 placeholder) for Open Graph sharing
- Add complete metadata in layout.tsx: title, description, Open Graph tags, Twitter cards
- Create robots.txt, sitemap.xml, and manifest.json in public/
- Ensure every page has a unique <title> and meta description
`.trim(),

  designPromptAdditions: `
NEXT.JS DESIGN:
- Components use shadcn/ui + Tailwind CSS
- Use CSF3 format for Storybook stories
- Include viewport decorators for mobile (375px) and desktop (1440px)
`.trim(),

  fileStructure: `
src/
├── app/
│   ├── layout.tsx          # Root layout with metadata
│   ├── page.tsx             # Home page
│   ├── globals.css          # Global styles + Tailwind
│   └── [route]/
│       └── page.tsx         # Route pages
├── components/
│   ├── ui/                  # shadcn/ui components
│   └── [feature]/           # Feature-specific components
├── lib/
│   └── utils.ts             # Shared utilities
└── types/
    └── index.ts             # TypeScript types
public/
├── favicon.ico
├── og.png
├── robots.txt
└── sitemap.xml
`.trim(),
};
