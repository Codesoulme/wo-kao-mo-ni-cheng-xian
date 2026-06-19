import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const standaloneDir = path.join(root, '.next', 'standalone');
const staticDir = path.join(root, '.next', 'static');
const standaloneStaticDir = path.join(standaloneDir, '.next', 'static');
const publicDir = path.join(root, 'public');
const standalonePublicDir = path.join(standaloneDir, 'public');

if (!existsSync(standaloneDir)) {
  console.log('[copy-standalone-assets] .next/standalone not found, skip asset copy.');
  process.exit(0);
}

await mkdir(path.dirname(standaloneStaticDir), { recursive: true });
if (existsSync(staticDir)) {
  await cp(staticDir, standaloneStaticDir, { recursive: true, force: true });
}
if (existsSync(publicDir)) {
  await cp(publicDir, standalonePublicDir, { recursive: true, force: true });
}
console.log('[copy-standalone-assets] standalone assets copied.');
