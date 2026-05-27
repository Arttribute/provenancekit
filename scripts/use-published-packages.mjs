/**
 * Sync deployable app/example package.json files to published @provenancekit/*
 * package versions.
 *
 * Usage:
 *   node scripts/use-published-packages.mjs
 *   node scripts/use-published-packages.mjs --source=workspace --wait
 *
 * This is intentionally idempotent and safe to run after every successful
 * package release. Vercel deploys these apps with npm from their subfolders,
 * so the apps cannot rely on workspace:* dependencies at deploy time.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const args = new Set(process.argv.slice(2));
const source = [...args].find((arg) => arg.startsWith('--source='))?.split('=')[1] ?? 'npm';
const waitForNpm = args.has('--wait');

// Targets: deployable apps/examples (not internal packages themselves).
// Keep provenancekit-api on workspace deps for monorepo builds; it is not one
// of the npm-installed Vercel frontend projects that hit ETARGET.
const targets = [
  'apps/provenancekit-app/package.json',
  'examples/chat/package.json',
  'examples/canvas/package.json',
];

const packageDirs = [
  'packages/eaa-types',
  'packages/provenancekit-sdk',
  'packages/provenancekit-storage',
  'packages/provenancekit-extensions',
  'packages/provenancekit-privacy',
  'packages/provenancekit-payments',
  'packages/provenancekit-git',
  'packages/provenancekit-media',
  'packages/provenancekit-indexer',
  'packages/provenancekit-ui',
  'packages/provenancekit-contracts',
];

const workspaceVersions = new Map();
for (const dir of packageDirs) {
  const pkgPath = path.join(root, dir, 'package.json');
  if (!fs.existsSync(pkgPath)) continue;
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  workspaceVersions.set(pkg.name, pkg.version);
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function assertPublished(packageName, version) {
  const spec = `${packageName}@${version}`;
  const attempts = waitForNpm ? 24 : 1;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const result = execSync(`npm view ${spec} version`, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (result === version) return;
    } catch {
      // retry below
    }
    if (attempt < attempts) {
      console.log(`  waiting for ${spec} to be visible on npm (${attempt}/${attempts})`);
      sleep(5000);
    }
  }
  throw new Error(`${spec} is not visible on npm yet`);
}

// Resolve published version for each workspace package
function getPublishedVersion(packageName) {
  if (source === 'workspace') {
    const version = workspaceVersions.get(packageName);
    if (!version) {
      console.warn(`  ⚠ No workspace package found for ${packageName} — skipping`);
      return null;
    }
    assertPublished(packageName, version);
    return `^${version}`;
  }

  try {
    const result = execSync(`npm view ${packageName} version`, { encoding: 'utf-8' }).trim();
    return `^${result}`;
  } catch {
    console.warn(`  ⚠ Could not fetch published version for ${packageName} — skipping`);
    return null;
  }
}

for (const target of targets) {
  const pkgPath = path.join(root, target);
  if (!fs.existsSync(pkgPath)) continue;

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  let changed = false;

  for (const depField of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const deps = pkg[depField];
    if (!deps) continue;

    for (const [name, version] of Object.entries(deps)) {
      if (!name.startsWith('@provenancekit/')) continue;

      const published = getPublishedVersion(name);
      if (!published) continue;
      if (version === published) continue;

      console.log(`  ${target}: ${name}  ${version} → ${published}`);
      deps[name] = published;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`✓ Updated ${target}`);
  } else {
    console.log(`– ${target}: already up to date`);
  }
}

console.log('\nDone. Now run: pnpm install --lockfile-only');
