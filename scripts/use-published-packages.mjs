/**
 * Run this script ONCE after the first successful npm publish to switch
 * all app/example package.json files from `workspace:*` to the actual
 * published npm version ranges.
 *
 * Usage: node scripts/use-published-packages.mjs
 *
 * After running, commit the changes and simplify each vercel.json to:
 *   {
 *     "installCommand": "npm install -g pnpm@10.12.1 && pnpm install --no-frozen-lockfile",
 *     "buildCommand": "pnpm run build"
 *   }
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');

// Targets: apps and examples (not packages themselves)
const targets = [
  'apps/provenancekit-app/package.json',
  'apps/provenancekit-api/package.json',
  'examples/chat/package.json',
  'examples/canvas/package.json',
];

// Resolve published version for each workspace package
function getPublishedVersion(packageName) {
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
      if (!version.startsWith('workspace:')) continue;

      const published = getPublishedVersion(name);
      if (!published) continue;

      console.log(`  ${target}: ${name}  ${version} → ${published}`);
      deps[name] = published;
      changed = true;
    }
  }

  if (changed) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`✓ Updated ${target}`);
  } else {
    console.log(`– ${target}: no workspace:* deps found`);
  }
}

console.log('\nDone. Now run: pnpm install');
console.log('Then simplify each vercel.json installCommand/buildCommand (see script header).');
