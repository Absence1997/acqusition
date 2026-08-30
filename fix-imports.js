// fix-imports.js
// One-time script to convert all "#alias/..." subpath imports under src/
// into plain relative imports, to work around Jest's known bugs with
// resolving package.json "imports" subpaths under --experimental-vm-modules.
//
// Usage (from your project root):
//   node fix-imports.js
//
// This only rewrites files under ./src. It reads the alias map directly
// from your package.json "imports" field, so it stays in sync automatically.
// Run "npm run dev" and "npm run test" afterward to confirm nothing broke.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, dirname, relative, resolve } from 'path';
import { fileURLToPath } from 'url';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const srcDir = join(projectRoot, 'src');

const pkg = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));
const importsMap = pkg.imports || {};

// Build a list of { prefix, target } from package.json "imports", e.g.
// "#config/*": "./src/config/*"  ->  { prefix: '#config/', target: './src/config/' }
const aliasEntries = Object.entries(importsMap).map(([key, value]) => ({
  prefix: key.replace(/\*$/, ''),
  target: value.replace(/\*$/, ''),
}));

function resolveAlias(specifier) {
  for (const { prefix, target } of aliasEntries) {
    if (specifier.startsWith(prefix)) {
      const rest = specifier.slice(prefix.length);
      return resolve(projectRoot, target + rest);
    }
  }
  return null;
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, files);
    } else if (entry.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

const importRegex = /from\s+['"](#[^'"]+)['"]/g;

let totalChanged = 0;
let totalFiles = 0;

for (const file of walk(srcDir)) {
  const content = readFileSync(file, 'utf8');
  let changed = false;

  const newContent = content.replace(importRegex, (match, specifier) => {
    const resolvedAbsPath = resolveAlias(specifier);
    if (!resolvedAbsPath) return match; // unknown alias, leave untouched

    let relPath = relative(dirname(file), resolvedAbsPath).replace(/\\/g, '/');
    if (!relPath.startsWith('.')) relPath = './' + relPath;

    changed = true;
    totalChanged++;
    return `from '${relPath}'`;
  });

  if (changed) {
    writeFileSync(file, newContent, 'utf8');
    totalFiles++;
    console.log(`Updated: ${relative(projectRoot, file)}`);
  }
}

console.log(`\nDone. Rewrote ${totalChanged} import(s) across ${totalFiles} file(s).`);
