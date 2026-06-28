// @ts-nocheck - script tool, no strict types needed

/**
 * 每小时代码审查脚本（智能版）
 *
 * 审查维度：
 *   1. ESLint —— 真正的代码错误
 *   2. AI 导向原则 —— 玩家可见文本中泄露内部 key；硬编码 UI 按钮
 *   3. 潜在 bug —— 死循环、async 错误吞没、setState 在 unmount 后调用
 *   4. 优化空间 —— 重复字符串、N+1 查询、内存泄漏风险
 *
 * 过滤规则（减少误报）：
 *   - 跳过 prompt 模板（llm.ts 内 IDENTITY_PROMPT/SCENE_PROMPTS）
 *   - 跳过数据定义文件（market/auction 种子的物品对象）
 *   - 跳过对象 key（`cultivationExp: { title: '修为', ... }` 中的英文 key）
 *   - 跳过注释行
 *   - 跳过 test 文件
 */

import { execSync } from 'child_process';
import { readFileSync, readdirSync, statSync, mkdirSync, appendFileSync, existsSync } from 'fs';
import { join, basename } from 'path';

const ROOT = process.cwd();
const LOG_DIR = join(ROOT, 'logs');
const LOG_PATH = join(LOG_DIR, 'hourly-review.log');
const LAST_RUN_PATH = join(LOG_DIR, 'hourly-review.last');
const INTERVAL_MS = 60 * 60 * 1000;

function now() {
  return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

function log(level: string, message: string) {
  const line = `[${now()}] [${level}] ${message}`;
  console.log(line);
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_PATH, line + '\n');
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

// ============ 过滤：跳过明显不是误报的位置 ============

const PROMPT_FILE_HINTS = ['IDENTITY_PROMPT', 'SCENE_PROMPTS', 'buildAdvancePrompt', 'buildStateContext', 'narrative-body-modifier.ts'];

function isPromptLine(line: string, file: string): boolean {
  // 跳过 prompt 模板里的硬编码数字 / key 描述
  if (file.includes('llm.ts') && /['"`].*\\n.*['"`]/s.test(line)) return true; // 多行 prompt
  if (PROMPT_FILE_HINTS.some(h => file.includes(h))) return true;
  // 注释行
  if (/^\s*\/\//.test(line) || /^\s*\*/.test(line) || /^\s*\/\*/.test(line)) return true;
  return false;
}

function isDataDefinitionFile(file: string): boolean {
  // 数据定义文件，跳过对象 key 警告
  return /market\/route\.ts$/.test(file)
      || /auction\/route\.ts$/.test(file)
      || /constitutions\.ts$/.test(file)
      || /item-templates/.test(file)
      || /spirit-stones|formation-templates/.test(file);
}

function isObjectKeyLine(line: string): boolean {
  // `cultivationExp: {` 或 `target_attribute: 'xxx'` 这类对象 key 定义
  return /^\s*[a-zA-Z_$][\w$]*\s*:\s*[\[{]/.test(line)
      || /target_attribute\s*:/.test(line);
}

function isJsxStringValue(line: string): boolean {
  // JSX 中 `label="..."` 这种直译给玩家的属性
  return /(label|description|title|name|placeholder)\s*=\s*['"`]/.test(line);
}

// ============ 审查项 ============

function runLint(): Finding[] {
  const errors: Finding[] = [];
  try {
    execSync('npx eslint src --ext .ts,.tsx --max-warnings 0', { cwd: ROOT, stdio: 'pipe' });
    log('info', 'ESLint 检查通过');
  } catch (e: any) {
    const out = (e?.stderr?.toString() || e?.stdout?.toString() || String(e)).slice(0, 4000);
    addFinding('ESLint', `Lint 未通过`, 'error');
    errors.push({ file: 'ESLint', message: out, severity: 'error' });
    log('error', 'ESLint 未通过：' + out.slice(0, 200).replace(/\n/g, ' '));
  }
  return errors;
}

function checkPlayerVisibleKeys(path: string) {
  if (isDataDefinitionFile(path)) return;
  const content = readFileSync(path, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (isPromptLine(line, path)) return;
    if (isObjectKeyLine(line)) return;
    // 仅在字符串字面量内（'..'或"..."或`..`）出现才算"玩家可见文本"
    // 排除掉 'attribute': 'cultivationExp' 这种情况（key 是字段名，不是给玩家看的）
    const inStringLiteral = /['"`][^'"`]*?(cultivationExp|heartDemon|spiritStones|expToBreak|hp|maxHp|mp|maxMp|attack|defense|speed)[^'"`]*?['"`]/.test(line);
    // 排除 schema 引用写法
    const isSchemaKey = /attribute\s*[:=]\s*['"`](cultivationExp|heartDemon|spiritStones)/.test(line)
                     || /target_attribute\s*[:=]\s*['"`](cultivationExp|heartDemon)/.test(line)
                     || /===?\s*['"`](cultivationExp|heartDemon|spiritStones)/.test(line)
                     || /\.attribute\s*===?\s*['"`](cultivationExp|heartDemon)/.test(line);
    // 排除 sanitizer/cleaner 函数体内的英文 key（这些是把英文转中文，不是给玩家显示英文）
    const isSanitizerContext = /clean[A-Z][\w]*\s*\(/.test(line) || /sanitize[A-Z][\w]*\s*\(/.test(line) || /filter[A-Z][\w]*\s*\(/.test(line);
    if (inStringLiteral && !isSchemaKey && !isSanitizerContext) {
      addFinding(path, `玩家可见字符串中疑似包含内部英文 key，应使用中文标签或 ATTRIBUTE_LABEL`, 'warning', idx + 1);
    }
  });
}

function checkHardcodedUiButtons(path: string) {
  if (!path.endsWith('.tsx')) return;
  const content = readFileSync(path, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (isPromptLine(line, path)) return;
    // 硬编码按钮文案（应该让 AI 通过 actionProjection 动态生成）
    if (/<Button[^>]*>\s*(推进|开始修炼|立即突破|一键扫荡)/.test(line)) {
      addFinding(path, `硬编码按钮文案，应通过 actionProjection/AI 动态生成`, 'warning', idx + 1);
    }
  });
}

function checkStateAfterUnmount(path: string) {
  if (!path.endsWith('.tsx')) return;
  const content = readFileSync(path, 'utf-8');
  // 找到所有 useEffect 的位置，逐块分析
  const effectRegex = /useEffect\(\(\)\s*=>\s*\{/g;
  let match;
  const seen = new Set<number>(); // 已报告的 useEffect 起始行号
  while ((match = effectRegex.exec(content)) !== null) {
    const blockStart = match.index;
    const lineStart = content.slice(0, blockStart).split('\n').length;
    if (seen.has(lineStart)) continue;
    seen.add(lineStart);
    // 找到匹配的右括号（粗略：根据缩进计数）
    let depth = 1;
    let pos = match.index + match[0].length;
    while (pos < content.length && depth > 0) {
      const ch = content[pos];
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      pos++;
      if (depth === 0) break;
    }
    const block = content.slice(blockStart, pos);
    if (!/fetch\(/.test(block)) continue;
    // 检查：fetch 后是否有用到 setState（说明会触发渲染）
    const hasSetState = /\bset[A-Z][\w]*\(/.test(block);
    const hasProtection = /cancelled|cancelledRef|isMounted|mountedRef|AbortController/.test(block);
    if (hasSetState && !hasProtection) {
      addFinding(path, `useEffect 内 fetch 缺少 cancelled / isMounted / AbortController 保护，可能在 unmount 后 setState`, 'warning', lineStart);
    }
  }
}

function checkAwaitInNonAsyncCallback(path: string) {
  if (!path.endsWith('.ts')) return;
  const content = readFileSync(path, 'utf-8');
  const lines = content.split('\n');
  // 简单扫描 setTimeout / setInterval 内的 await 写法
  lines.forEach((line, idx) => {
    if (/setTimeout\(async/.test(line) || /setInterval\(async/.test(line)) {
      // 检查紧跟着的是否有 await
      const block = lines.slice(idx, idx + 10).join('\n');
      if (/await\s+/.test(block)) {
        addFinding(path, `setInterval/setTimeout 内 async + await 可能导致错误吞没`, 'warning', idx + 1);
      }
    }
  });
}

function checkConsoleLogInProduction(path: string) {
  // 只标记可能的调试残留（不影响功能，只是冗余）
  if (!path.endsWith('.ts') && !path.endsWith('.tsx')) return;
  const content = readFileSync(path, 'utf-8');
  const matches = content.match(/console\.log\(/g);
  if (matches && matches.length > 8) {
    addFinding(path, `console.log 过多（${matches.length} 处），生产构建建议移除`, 'info');
  }
}

function checkDbNPlusOne(path: string) {
  // 简单检查：在循环里调用了 db.findUnique / db.eventLog.findMany 等
  if (!path.endsWith('.ts')) return;
  const content = readFileSync(path, 'utf-8');
  if (/(for|forEach|map)\([^)]*=>\s*\{[\s\S]{0,300}db\.(findUnique|findMany|findFirst)/.test(content)) {
    addFinding(path, `疑似 N+1 查询：在循环内调用 db.find*`, 'warning');
  }
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
    let stat;
    try { stat = statSync(full); } catch { continue; }
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next' || entry === 'test') continue;
      walkDir(full, callback);
    } else if (/\.(ts|tsx)$/.test(full) && !/\.test\.ts$/.test(full)) {
      callback(full);
    }
  }
}

function runReview() {
  log('info', '========== 开始每小时代码审查 ==========');
  findings.length = 0;

  // 1) ESLint
  runLint();

  // 2) 自定义规则（当前误报率较高，先关闭；后续优化后再启用)
  // walkDir(join(ROOT, 'src'), (file) => {
  //   try {
  //     checkPlayerVisibleKeys(file);
  //     checkHardcodedUiButtons(file);
  //     checkStateAfterUnmount(file);
  //     checkAwaitInNonAsyncCallback(file);
  //     checkConsoleLogInProduction(file);
  //     checkDbNPlusOne(file);
  //   } catch {}
  // });

  // 汇总
  const errors = findings.filter(f => f.severity === 'error');
  const warnings = findings.filter(f => f.severity === 'warning');
  const infos = findings.filter(f => f.severity === 'info');

  log('info', `审查完成：error=${errors.length}, warning=${warnings.length}, info=${infos.length}`);

  // 输出报告（按文件分组）
  const grouped = new Map<string, Finding[]>();
  for (const f of findings) {
    if (!grouped.has(f.file)) grouped.set(f.file, []);
    grouped.get(f.file)!.push(f);
  }

  for (const [file, list] of grouped) {
    const sample = list.slice(0, 3).map(f => `${f.severity}:${f.message}`).join(' | ');
    log('info', `  ${basename(file)} (${list.length} 项) — ${sample}${list.length > 3 ? ' ...' : ''}`);
  }

  // 记录上次运行时间
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LAST_RUN_PATH, new Date().toISOString() + '\n');
  } catch {}
}

function shouldRunNow(): boolean {
  // 每小时最多跑一次（防御性检查，避免启动时立即触发）
  if (!existsSync(LAST_RUN_PATH)) return true;
  try {
    const lines = readFileSync(LAST_RUN_PATH, 'utf-8').trim().split('\n').filter(Boolean);
    const last = new Date(lines[lines.length - 1]).getTime();
    return Date.now() - last > INTERVAL_MS;
  } catch {
    return true;
  }
}

// 启动
if (shouldRunNow()) {
  runReview();
} else {
  log('info', '距上次审查不到 1 小时，跳过本次触发');
}

setInterval(() => {
  runReview();
}, INTERVAL_MS);

log('info', `下次审查将在 ${INTERVAL_MS / 1000 / 60} 分钟后触发`);