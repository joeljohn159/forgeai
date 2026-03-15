// ============================================================
// CI/CD Template Generator
// Generates GitHub Actions or GitLab CI configs
// ============================================================

import type { FrameworkAdapter } from "../adapters/base.js";

export type CIProvider = "github" | "gitlab";

/** Returns the command if valid, or null if it's a placeholder like AUTO_DETECT */
function cmd(value: string | undefined): string | null {
  if (!value || value === "AUTO_DETECT") return null;
  return value;
}

/** Format a YAML run step, or empty string if command is invalid */
function yamlStep(command: string | undefined): string {
  const c = cmd(command);
  if (!c) return "";
  return `      - run: ${c}\n`;
}

export function generateGitHubActions(adapter: FrameworkAdapter): string {
  const isNode = adapter.language === "typescript" || adapter.language === "javascript";
  const isPython = adapter.language === "python";
  const isDart = adapter.language === "dart";

  if (adapter.id === "generic") {
    return `name: CI
# Generic project — customize the commands below for your stack

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # TODO: Add your setup steps (Node, Python, etc.)
      # TODO: Add your build/test commands
      - run: echo "Add your build command here"
`;
  }

  if (isNode) {
    return `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20]

    steps:
      - uses: actions/checkout@v4
      - name: Use Node.js \${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node-version }}
          cache: 'npm'
      - run: npm ci
${yamlStep(adapter.buildCommand)}${yamlStep(adapter.lintCommand)}${yamlStep(adapter.typecheckCommand)}${yamlStep(adapter.testCommand)}`;
  }

  if (isPython) {
    return `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.11", "3.12"]

    steps:
      - uses: actions/checkout@v4
      - name: Set up Python \${{ matrix.python-version }}
        uses: actions/setup-python@v5
        with:
          python-version: \${{ matrix.python-version }}
      - run: pip install -r requirements.txt
${yamlStep(adapter.lintCommand)}${yamlStep(adapter.testCommand)}`;
  }

  if (isDart) {
    return `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.x'
      - run: flutter pub get
${yamlStep(adapter.lintCommand)}${yamlStep(adapter.buildCommand)}${yamlStep(adapter.testCommand)}`;
  }

  // Unknown language fallback
  return `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
${yamlStep(adapter.buildCommand)}${yamlStep(adapter.testCommand)}`;
}

export function generateGitLabCI(adapter: FrameworkAdapter): string {
  const isNode = adapter.language === "typescript" || adapter.language === "javascript";

  if (adapter.id === "generic") {
    return `# Generic project — customize for your stack
stages:
  - build
  - test

build:
  stage: build
  script:
    - echo "Add your build command here"
`;
  }

  if (isNode) {
    const parts = [`image: node:20

stages:
  - build
  - test

cache:
  paths:
    - node_modules/

install:
  stage: build
  script:
    - npm ci`];

    if (cmd(adapter.buildCommand)) {
      parts.push(`
build:
  stage: build
  script:
    - ${adapter.buildCommand}`);
    }

    if (cmd(adapter.lintCommand)) {
      parts.push(`
lint:
  stage: test
  script:
    - ${adapter.lintCommand}`);
    }

    if (cmd(adapter.typecheckCommand)) {
      parts.push(`
typecheck:
  stage: test
  script:
    - ${adapter.typecheckCommand}`);
    }

    if (cmd(adapter.testCommand)) {
      parts.push(`
test:
  stage: test
  script:
    - ${adapter.testCommand}`);
    }

    return parts.join("\n") + "\n";
  }

  // Non-node fallback
  const parts = [`stages:
  - build
  - test`];

  if (cmd(adapter.buildCommand)) {
    parts.push(`
build:
  stage: build
  script:
    - ${adapter.buildCommand}`);
  }

  if (cmd(adapter.testCommand)) {
    parts.push(`
test:
  stage: test
  script:
    - ${adapter.testCommand}`);
  }

  return parts.join("\n") + "\n";
}
