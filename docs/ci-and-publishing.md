# CI & npm Publishing Pattern

A reference guide for the pnpm monorepo CI and automated npm publishing setup used in ProvenanceKit. Copy this pattern to new projects.

---

## Overview

The system has two GitHub Actions workflows:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push to `main`/`experiment`, PRs to `main` | Build + test every package |
| `release.yml` | Push to `main` only | Auto-version + publish to npm |

Publishing is handled by **Changesets** (`@changesets/cli`). The release workflow auto-generates a patch changeset when package source files changed since the last git tag but no changeset exists. This means you never need to manually run `changeset` for routine work — only for minor/major bumps.

---

## Directory Structure

```
repo-root/
├── .changeset/
│   ├── config.json          # Changesets config
│   └── README.md
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
├── packages/
│   ├── package-a/
│   │   ├── package.json     # has publishConfig.access = "public"
│   │   └── tsup.config.ts
│   └── ...
├── apps/                    # private apps — listed in changeset ignore
├── examples/                # private examples — listed in changeset ignore
├── package.json             # root (private: true)
└── pnpm-workspace.yaml
```

---

## Required GitHub Secrets

| Secret | What it is | Where to get it |
|--------|-----------|-----------------|
| `NPM_TOKEN` | npm automation token | npmjs.com → Access Tokens → Automation |
| `GH_PAT` | GitHub Personal Access Token | GitHub → Settings → Developer Settings → Fine-grained PAT |

**GH_PAT permissions needed:**
- `contents: write` — push version bump commits
- `pull-requests: write` — open the "chore: version packages" PR

> Without `GH_PAT`, `changesets/action` uses `GITHUB_TOKEN` which cannot trigger other workflows (the version PR won't re-run CI). Use a PAT to avoid this.

---

## Workflows in Detail

### `ci.yml` — Build and Test

```yaml
name: CI

on:
  push:
    branches:
      - main
      - experiment        # add any feature branches you want CI on
  pull_request:
    branches:
      - main

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true   # cancel redundant runs on force-push

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 10.12.1          # pin to same version as packageManager field

      - uses: actions/setup-node@v4
        with:
          node-version: 22

      - id: pnpm-cache
        run: echo "store=$(pnpm store path)" >> $GITHUB_OUTPUT

      - uses: actions/cache@v4
        with:
          path: ${{ steps.pnpm-cache.outputs.store }}
          key: pnpm-store-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: pnpm-store-${{ runner.os }}-

      # Remove this step if you don't use Foundry/Solidity
      - uses: foundry-rs/foundry-toolchain@v1

      - run: pnpm install --no-frozen-lockfile
      - run: pnpm --filter './packages/*' run build
      - run: pnpm --filter './packages/*' run test
```

**Key decisions:**
- `--no-frozen-lockfile`: avoids failures when the lockfile hasn't been committed after adding deps. Use `--frozen-lockfile` in stricter projects.
- `--filter './packages/*'`: only builds/tests publishable packages. Apps and examples are excluded.
- `cancel-in-progress: true`: avoids wasting minutes on stale runs.

---

### `release.yml` — Auto Version + Publish

This is the interesting one. It runs on every push to `main` and does three things in order:

1. Build all packages
2. **Auto-generate a patch changeset** if package files changed but no changeset exists
3. Run `changesets/action` which either:
   - Opens/updates a "chore: version packages" PR (when changesets exist), or
   - Publishes to npm and creates GitHub releases (when that PR is merged)

#### The auto-patch logic

```bash
# Skip if this IS the version commit (avoid infinite loop)
COMMIT_MSG=$(git log -1 --pretty=%B)
if echo "$COMMIT_MSG" | grep -q "chore: version packages"; then
  exit 0
fi

# Skip if a changeset was already written manually
EXISTING=$(ls .changeset/*.md 2>/dev/null | grep -v README | wc -l)
if [ "$EXISTING" -gt "0" ]; then
  exit 0
fi

# Check if any packages/ files changed since the last git tag
LAST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || git rev-list --max-parents=0 HEAD)
CHANGED=$(git diff --name-only "$LAST_TAG" HEAD -- packages/ | grep -v 'node_modules' | head -1)

if [ -z "$CHANGED" ]; then
  exit 0
fi
```

Then a Node.js inline script maps changed file paths to package names and writes a `.changeset/auto-<random>.md` file covering only the packages that actually changed.

**Why this matters:** Without this, any push to `main` that doesn't include a hand-written changeset would be silently skipped by `changesets/action`. This auto-patch ensures every package change results in a release.

#### The dir-to-package map (adapt for your project)

```js
const dirToPackage = {
  'packages/eaa-types':               '@yourscope/eaa-types',
  'packages/your-package':            '@yourscope/your-package',
  // ...one entry per publishable package
};
```

This must be kept in sync with your actual packages. If you add a package and forget to add it here, it won't be auto-patched.

#### Changeset action step

```yaml
- uses: changesets/action@v1
  with:
    publish: pnpm release          # runs: pnpm build && changeset publish
    title: "chore: version packages"
    commit: "chore: version packages"
  env:
    GITHUB_TOKEN: ${{ secrets.GH_PAT }}
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

`pnpm release` (root package.json script) = `pnpm build && changeset publish`.

---

## Package Configuration

Every publishable package needs these fields in `package.json`:

```json
{
  "name": "@yourscope/package-name",
  "version": "0.0.1",
  "main": "dist/index.cjs",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "files": ["dist"],
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "require": "./dist/index.cjs",
      "import": "./dist/index.mjs"
    }
  },
  "publishConfig": {
    "access": "public"
  }
}
```

**`publishConfig.access: "public"`** is required for scoped packages (`@scope/name`) on npm free tier. Without it, npm defaults to private and the publish fails.

---

## Build: tsup

Each package uses `tsup` for dual ESM + CJS output with TypeScript declarations:

```ts
// tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: "dist",
  outExtension({ format }) {
    return { js: format === "esm" ? ".mjs" : ".cjs" };
  },
});
```

Output: `dist/index.mjs` (ESM), `dist/index.cjs` (CJS), `dist/index.d.ts` (types).

---

## Changeset Config

```json
// .changeset/config.json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.2/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": [
    "your-private-api",
    "your-private-app",
    "@yourscope/example-something"
  ]
}
```

**Key fields:**
- `access: "public"` — default publish access for all packages
- `updateInternalDependencies: "patch"` — when package A depends on package B and B gets a patch bump, A's dependency range is automatically updated
- `ignore` — list every private app/example by its `name` field from their `package.json`. These are never versioned or published.

---

## Root package.json Scripts

```json
{
  "scripts": {
    "build": "pnpm -r --filter './packages/*' run build",
    "test": "pnpm -r --filter './packages/*' run test",
    "changeset": "changeset",
    "version-packages": "changeset version",
    "release": "pnpm build && changeset publish"
  },
  "packageManager": "pnpm@10.12.1",
  "devDependencies": {
    "@changesets/cli": "^2.29.4"
  }
}
```

- `release` is called by `changesets/action` in CI — it rebuilds everything then publishes.
- `version-packages` is for local use when you want to manually bump versions.

---

## pnpm Workspace + Dev Override Pattern

Apps reference published packages by version range, but in development you want the local workspace copies. Solve this with `pnpm.overrides` in the **root** `package.json`:

```json
// root package.json
"pnpm": {
  "overrides": {
    "@yourscope/sdk": "workspace:*",
    "@yourscope/ui": "workspace:*"
  }
}
```

And in app `package.json` use a real version range:

```json
// apps/your-app/package.json
"dependencies": {
  "@yourscope/sdk": "^0.1.0"
}
```

**Result:**
- `pnpm install` from repo root → overrides kick in → local workspace packages used
- `npm install` from app directory (e.g. Vercel build) → no overrides → published npm version used

Never use `workspace:*` directly in app `package.json` — `npm` doesn't understand it and Vercel builds will fail.

---

## The Full Release Flow

```
Developer pushes to main
        │
        ▼
release.yml runs
        │
        ├─ Build all packages
        │
        ├─ Auto-patch step
        │   ├─ Is this the version commit? → exit 0 (prevents loop)
        │   ├─ Changeset already exists? → exit 0
        │   ├─ No package changes since last tag? → exit 0
        │   └─ Otherwise → write .changeset/auto-xxxxx.md
        │
        └─ changesets/action
            │
            ├─ Changesets found?
            │   YES → Open/update "chore: version packages" PR
            │         (bumps versions in package.json, updates CHANGELOG.md)
            │
            └─ PR merged (commit msg = "chore: version packages")?
                YES → changeset publish → npm publish + GitHub release tags
```

When the version PR is merged:
1. `changesets/action` detects no changesets remain (they were consumed by `changeset version`)
2. The commit message check in auto-patch fires → exits early
3. `changesets/action` runs `pnpm release` → publishes all bumped packages to npm

---

## Checklist: Applying to a New Project

- [ ] Copy `.github/workflows/ci.yml` and `release.yml`
- [ ] Update the `dirToPackage` map in `release.yml` to match your packages
- [ ] Copy `.changeset/config.json`, update `ignore` list for your private apps/examples
- [ ] Add `publishConfig: { access: "public" }` to every publishable package
- [ ] Add `"release": "pnpm build && changeset publish"` to root `package.json`
- [ ] Set up `NPM_TOKEN` and `GH_PAT` secrets in GitHub repo settings
- [ ] Pin `packageManager` field in root `package.json` to match the pnpm version in workflows
- [ ] Add `pnpm.overrides` for local dev if you have apps consuming the packages
- [ ] Remove Foundry step from both workflows if you don't use Solidity
