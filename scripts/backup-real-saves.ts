// scripts/backup-real-saves.ts
// AI-73: 备份真实存档（schema migration 前必跑）
// 用法：bun scripts/backup-real-saves.ts
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = process.env.DATABASE_URL?.replace(/^file:/, '') || 'prisma/dev.db';
if (!existsSync(SOURCE)) {
  console.error(`[backup] 数据库文件不存在: ${SOURCE}`);
  process.exit(1);
}

const STAMP = new Date().toISOString().replace(/[:.]/g, '-');
const BACKUP_DIR = 'logs/backups';
if (!existsSync(BACKUP_DIR)) mkdirSync(BACKUP_DIR, { recursive: true });
const TARGET = join(BACKUP_DIR, `dev-${STAMP}.db`);

try {
  copyFileSync(SOURCE, TARGET);
  console.log(JSON.stringify({ ok: true, source: SOURCE, target: TARGET, stamp: STAMP }));
} catch (err) {
  console.error('[backup] 备份失败：', err);
  process.exit(1);
}