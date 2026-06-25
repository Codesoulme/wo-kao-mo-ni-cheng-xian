// Cron endpoint: 定时触发代码审查
// 由前端 /api/system/tick 路由每 60 分钟触发一次
// 或者通过外部 cron job 调用

import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { readFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join } from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ROOT = process.cwd();
const LOG_DIR = join(ROOT, 'logs');
const LOG_PATH = join(LOG_DIR, 'hourly-review.log');
const INTERVAL_MS = 60 * 60 * 1000;

export async function POST() {
  // 防止外部频繁触发：检查上次运行时间
  const lastRunPath = join(LOG_DIR, 'hourly-review.last');
  if (existsSync(lastRunPath)) {
    try {
      const lines = readFileSync(lastRunPath, 'utf-8').trim().split('\n').filter(Boolean);
      const last = new Date(lines[lines.length - 1]).getTime();
      if (Date.now() - last < INTERVAL_MS - 60 * 1000) {
        // 距上次不到 59 分钟，跳过
        return NextResponse.json({
          success: true,
          skipped: true,
          reason: 'too_soon',
          lastRun: new Date(last).toISOString(),
        });
      }
    } catch {}
  }

  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_PATH, `[${new Date().toISOString()}] [info] Cron triggered review\n`);

    // 后台执行审查脚本（不阻塞响应）
    const child = execSync('bun run scripts/hourly-review.ts', {
      cwd: ROOT,
      stdio: 'pipe',
      timeout: 60_000,
    });

    return NextResponse.json({
      success: true,
      output: child.toString().slice(-1000),
    });
  } catch (e: any) {
    const out = (e?.stdout?.toString() || e?.stderr?.toString() || String(e)).slice(-1000);
    return NextResponse.json({ success: false, error: out }, { status: 500 });
  }
}

export async function GET() {
  // 状态查询：返回上次审查时间和摘要
  const lastRunPath = join(LOG_DIR, 'hourly-review.last');
  const last = existsSync(lastRunPath)
    ? readFileSync(lastRunPath, 'utf-8').trim().split('\n').filter(Boolean).slice(-1)[0]
    : null;

  return NextResponse.json({
    lastRun: last,
    nextRecommendedRun: last ? new Date(new Date(last).getTime() + INTERVAL_MS).toISOString() : new Date().toISOString(),
  });
}