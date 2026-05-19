/**
 * Creates dist/ from root legacy files when npm build has not been run yet.
 * For the TypeScript/React pipeline, use: npm install && npm run build
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');

const copies = [
  ['code.js', 'code.js'],
  ['ui.html', 'ui.html'],
];

fs.mkdirSync(distDir, { recursive: true });

for (const [from, to] of copies) {
  const src = path.join(root, from);
  const dest = path.join(distDir, to);
  if (!fs.existsSync(src)) {
    throw new Error(`Missing ${from} — run "npm run build" after installing Node.js.`);
  }
  fs.copyFileSync(src, dest);
  console.log(`Copied ${from} → dist/${to}`);
}

console.log('');
console.log('dist/ is ready for Figma (legacy bootstrap).');
console.log('For src/ TypeScript + React UI, install Node.js and run: npm install && npm run build');
