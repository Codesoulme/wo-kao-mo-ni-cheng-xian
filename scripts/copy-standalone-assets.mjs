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

// 沉浸版 Phase-Release: 复制 .env.local + .xianxia-ai-config 到 standalone 目录
// 玩家无配置时 fallback 读 process.env.MINIMAX_M3_KEY（来自 .env.local）
const envLocalSrc = path.join(root, '.env.local');
const envLocalDst = path.join(standaloneDir, '.env.local');
if (existsSync(envLocalSrc)) {
  await cp(envLocalSrc, envLocalDst, { recursive: false });
  console.log('[copy-standalone-assets] .env.local copied.');
}
const aiConfigSrc = path.join(root, '.xianxia-ai-config');
const aiConfigDst = path.join(standaloneDir, '.xianxia-ai-config');
if (existsSync(aiConfigSrc)) {
  await cp(aiConfigSrc, aiConfigDst, { recursive: false });
  console.log('[copy-standalone-assets] .xianxia-ai-config copied.');
}
console.log('[copy-standalone-assets] standalone assets copied.');