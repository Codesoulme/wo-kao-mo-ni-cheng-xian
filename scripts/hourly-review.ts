/**
 * 每小时代码审查脚本
 * 检查点：AI 导向设计原则、潜在 bug、代码质量、优化空间
 */

import { execSync } from 'child_process';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const LOG_PATH = join(ROOT, 'logs', 'hourly-review.log');

function now() {
  return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

function log(level: string, message: string) {
  const line = `[${now()}] [${level}] ${message}`;
  console.log(line);
  // 简单追加到日志（无日志目录则创建）
  try {
    const fs = require('fs');
    fs.mkdirSync(join(ROOT, 'logs'), { recursive: true });
    fs.appendFileSync(LOG_PATH, line + '\n');
  } catch {}
}

interface Finding {
  file: string;
  line?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
}

const findings: Finding[] = [];

function addFinding(file: string, message: string, severity: Finding['severity'], line?: number) {
  findings.push({ file, message, severity, line });
}

function runLint() {
  try {
    execSync('npx eslint src --ext .ts,.tsx', { cwd: ROOT, stdio: 'pipe' });
    log('info', 'ESLint 检查通过');
  } catch (e: any) {
    const stderr = e?.stderr?.toString() || e?.stdout?.toString() || String(e);
    addFinding('ESLint', `Lint 未通过：${stderr.slice(0, 200)}`, 'error');
    log('error', `ESLint 未通过：${stderr.slice(0, 200)}`);
  }
}

function checkHardcodedButtons(path: string) {
  // 检查是否硬编码按钮、属性、公式
  const content = readFileSync(path, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // 检测中文界面硬编码按钮（允许组件内部，但需警惕）
    if (/className=.*Button.*text=/.test(line) && /开始|推进|突破|修炼/.test(line)) {
      addFinding(path, `疑似硬编码按钮文案，应让 AI 动态生成 actionProjection`, 'warning', idx + 1);
    }
  });
}

function checkInternalKeys(path: string) {
  const content = readFileSync(path, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // 检测玩家可见文本中是否泄露内部 key
    if (/cultivationExp|heartDemon|spiritStones/.test(line) && /label|text|title|description/.test(line)) {
      addFinding(path, `玩家可见文本中疑似包含内部 key：${line.trim().slice(0, 80)}`, 'warning', idx + 1);
    }
  });
}

function checkAiDrivenPrinciple(path: string) {
  const content = readFileSync(path, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    // 检测死硬数值公式
    if (/hp\s*[=+\-*\/]\s*\d+|attack\s*[=+\-*\/]\s*\d+/.test(line) && !line.includes('//')) {
      addFinding(path, `检测到硬编码数值公式，应通过 engine/AI 驱动：${line.trim().slice(0, 80)}`, 'warning', idx + 1);
    }
  });
}

function walkDir(dir: string, callback: (file: string) => void) {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkDir(full, callback);
    } else if (/\.(ts|tsx)$/.test(full)) {
      callback(full);
    }
  }
}

function runReview() {
  log('info', '开始每小时代码审查');
  runLint();

  walkDir(join(ROOT, 'src'), (file) => {
    try {
      checkHardcodedButtons(file);
      checkInternalKeys(file);
      checkAiDrivenPrinciple(file);
    } catch {}
  });

  // 汇总
  const errors = findings.filter(f => f.severity === 'error');
  const warnings = findings.filter(f => f.severity === 'warning');
  const infos = findings.filter(f => f.severity === 'info');

  log('info', `审查完成：error=${errors.length}, warning=${warnings.length}, info=${infos.length}`);

  if (errors.length > 0) {
    errors.forEach(f => log('error', `${f.file}${f.line ? `:${f.line}` : ''} - ${f.message}`));
  }
  if (warnings.length > 0) {
    warnings.forEach(f => log('warning', `${f.file}${f.line ? `:${f.line}` : ''} - ${f.message}`));
  }
  if (findings.length === 0) {
    log('info', '未发现明显问题');
  }
}

runReview();

// 每小时执行一次
setInterval(runReview, 60 * 60 * 1000);
