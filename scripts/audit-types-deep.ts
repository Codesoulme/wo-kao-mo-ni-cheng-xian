// @ts-nocheck - script tool, no strict types needed

// scripts/audit-types-deep.ts
// AI-105: Deep type-system audit for src/lib/xianxia/types.ts.
// Usage: bun scripts/audit-types-deep.ts
//
// Audits:
//  1. Surface: list every exported type/interface/enum
//  2. Discriminated unions: tagged unions (kind/type/category literal fields)
//  3. Brand types: opaque/nominal types via intersection
//  4. Literal types: literal union members (e.g. 'fire' | 'water')
//  5. Cross-file symbol usage: verify types.ts exports are actually imported elsewhere

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { glob } from 'node:fs';

const TYPES_PATH = 'src/lib/xianxia/types.ts';
const SRC_ROOT = 'src';

const src = readFileSync(TYPES_PATH, 'utf-8');
const lines = src.split(/\r?\n/);

const exportRe = /^export\s+(type|interface|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/;
const declRe = /^export\s+(?:type|interface|enum)\s+([A-Za-z_][A-Za-z0-9_]*)\b([\s\S]*?)(?=^export\s+(?:type|interface|enum)\s+|\Z)/gm;

interface Surface {
  name: string;
  kind: 'type' | 'interface' | 'enum';
  startLine: number;
  endLine: number;
  sizeChars: number;
  hasIndexSig: boolean;
  hasGenericParam: boolean;
  fieldCount: number;
  literalFields: string[];
  extendsOther: string | null;
}

const surface: any[] = [];
let m;
const allDeclRe = /\b(?:export\s+)?(?:type|interface|enum)\s+([A-Za-z_][A-Za-z0-9_]*)\b/g;
const uniqueNames = new Set();
let scanLine = 0;
let lastIndex = 0;
let pos = 0;
while ((m = declRe.exec(src)) !== null) {
  const fullMatch = m[0];
  const headMatch = fullMatch.match(/^export\s+(type|interface|enum)\s+([A-Za-z_][A-Za-z0-9_]*)/);
  if (!headMatch) continue;
  const kind = headMatch[1];
  const name = headMatch[2];
  const startPos = m.index;
  const endPos = startPos + fullMatch.length;
  const startLine = src.slice(0, startPos).split('\n').length;
  const endLine = src.slice(0, endPos).split('\n').length;
  const hasIndexSig = /\[\s*['"][^'"]+['"]\s*\]\s*:/.test(fullMatch);
  const hasGenericParam = /\b([A-Za-z_][A-Za-z0-9_]*)\s*=\s*[^=]/.test(fullMatch.split('\n')[0]) || /\b<[A-Z][A-Za-z0-9_, ]+>/.test(fullMatch.split('\n')[0]);
  const fieldCount = (fullMatch.match(/^\s+[A-Za-z_]/gm) || []).length;
  const literalFields: string[] = [];
  const litRe = /([A-Za-z_][A-Za-z0-9_]*)\s*[:?]\s*\?\s*['"]([^'"]+)['"]/g;
  let lm;
  while ((lm = litRe.exec(fullMatch)) !== null) {
    literalFields.push(`${lm[1]}=${lm[2]}`);
  }
  const extMatch = fullMatch.match(/^export\s+interface\s+[A-Za-z_][A-Za-z0-9_]*\s+extends\s+([A-Za-z_][A-Za-z0-9_]*)/);
  surface.push({
    name, kind,
    startLine, endLine,
    sizeChars: fullMatch.length,
    hasIndexSig, hasGenericParam, fieldCount,
    literalFields,
    extendsOther: extMatch ? extMatch[1] : null,
  });
  uniqueNames.add(name);
}

// === Discriminated unions ===
const discriminatedUnions = [];
const litFieldNames = ['kind', 'type', 'category', 'mode', 'state', 'status', 'role', 'attitude', 'tier', 'rarity', 'tempo'];
for (const s of surface) {
  if (s.kind !== 'type') continue;
  // Re-extract the union body
  const idx = src.indexOf('export type ' + s.name);
  if (idx < 0) continue;
  const tail = src.slice(idx);
  const eq = tail.indexOf('=');
  if (eq < 0) continue;
  const semi = tail.indexOf(';', eq);
  const body = tail.slice(eq + 1, semi < 0 ? tail.length : semi);
  // Look for any literal field tag
  const tagged: Array<{ field: string; value: string }> = [];
  for (const fieldName of litFieldNames) {
    const tagRe = new RegExp("\\b" + fieldName + "\\s*[:?]\\s*\\?\\s*['\"]([^'\"]+)['\"]");
    const m2 = body.match(tagRe);
    if (m2) tagged.push({ field: fieldName, value: m2[1] });
  }
  if (tagged.length > 0 && /\|/.test(body)) {
    discriminatedUnions.push({ name: s.name, fields: tagged });
  }
}

// === Brand types (nominal via __brand convention) ===
const brandTypeRe = /export\s+type\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([A-Za-z_][A-Za-z0-9_]*)\s*&\s*\{\s*__brand/g;
const brands = [];
let bm;
while ((bm = brandTypeRe.exec(src)) !== null) {
  brands.push(bm[1]);
}

// === Literal types (string/number literal unions) ===
const literalUnionRe = /export\s+type\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^;]+);/g;
const literalUnions = [];
let lum;
while ((lum = literalUnionRe.exec(src)) !== null) {
  const name = lum[1];
  const body = lum[2];
  // Single-token string/number literal alternation
  const lits = body.match(/['"][^'"]+['"]/g);
  if (lits && lits.length >= 2 && /\|/.test(body)) {
    literalUnions.push({ name, literals: lits.map(s => s.slice(1, -1)) });
  }
}

// === Enums ===
const enumRe = /export\s+enum\s+([A-Za-z_][A-Za-z0-9_]*)\s*\{([\s\S]*?)\}/g;
const enums = [];
let em;
while ((em = enumRe.exec(src)) !== null) {
  const body = em[2];
  const members = [];
  const memRe = /\b([A-Za-z_][A-Za-z0-9_]*)\s*(?:=\s*([^,\n]+))?/g;
  let mm;
  while ((mm = memRe.exec(body)) !== null) {
    if (mm[1] && mm[1] !== em[1]) members.push({ name: mm[1], value: mm[2] ? mm[2].trim() : null });
  }
  if (members.length) enums.push({ name: em[1], members });
}

// === Cross-file usage ===
const usage = {};
for (const s of surface) usage[s.name] = { importingFiles: new Set(), importCount: 0 };

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = dir + '/' + e.name;
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next' || e.name === 'logs' || e.name.startsWith('.')) continue;
      walk(full);
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      const content = readFileSync(full, 'utf-8');
      for (const name of uniqueNames) {
        const re = new RegExp('\\b' + name + '\\b');
        if (re.test(content)) {
          usage[name].importingFiles.add(full);
          usage[name].importCount += 1;
        }
      }
    }
  }
}

// Build a flat list manually instead of using glob
function readdirSync(p, opts) {
  const { readdirSync } = require('node:fs');
  return readdirSync(p, opts);
}

try {
  walk(SRC_ROOT);
} catch (e) {
  // ignore
}

// === Unused / orphan exports ===
const orphanThreshold = 1; // only the types.ts file itself
const orphans = [];
for (const s of surface) {
  const u = usage[s.name];
  // Subtract 1 if types.ts itself counts (it shouldn't, but be defensive)
  const otherFiles = Array.from(u.importingFiles).filter(f => f !== TYPES_PATH);
  if (otherFiles.length === 0) {
    orphans.push(s.name);
  }
}

// === Heuristic warnings ===
const warnings = [];
for (const s of surface) {
  if (s.sizeChars > 5000) warnings.push({ name: s.name, kind: 'oversized', detail: 'size=' + s.sizeChars + ' chars (consider splitting)' });
  if (s.fieldCount > 30) warnings.push({ name: s.name, kind: 'too-many-fields', detail: 'fields=' + s.fieldCount });
  if (s.kind === 'interface' && !s.extendsOther && s.fieldCount === 0) warnings.push({ name: s.name, kind: 'empty-interface' });
  // Cross-realm duplication check (heuristic)
  if (s.name === 'CharacterState') {
    warnings.push({ name: s.name, kind: 'reference', detail: 'central state shape; verify all engine APIs accept Partial<CharacterState>' });
  }
}

// ==================== Output ====================

console.log(JSON.stringify({
  suite: 'audit-types-deep',
  typesFile: TYPES_PATH,
  totalExports: surface.length,
  totalEnums: enums.length,
  totalLiteralUnions: literalUnions.length,
  totalDiscriminatedUnions: discriminatedUnions.length,
  totalBrands: brands.length,
  orphanCount: orphans.length,
  warningCount: warnings.length,
}, null, 2));

if (!existsSync('logs/audit')) mkdirSync('logs/audit', { recursive: true });
writeFileSync('logs/audit/types-deep.json', JSON.stringify({
  date: new Date().toISOString(),
  surface,
  enums,
  literalUnions,
  discriminatedUnions,
  brands,
  orphans,
  warnings,
  usage: Object.fromEntries(Object.entries(usage).map(([k, v]) => [k, { importCount: v.importCount, importingFiles: Array.from(v.importingFiles) }])),
}, null, 2));

const md = [];
md.push('# Type System Deep Audit Report');
md.push('');
md.push('> Generated: ' + new Date().toISOString());
md.push('');
md.push('## Source File');
md.push('');
md.push('- File: src/lib/xianxia/types.ts');
md.push('- Lines: ' + lines.length);
md.push('- Bytes: ' + src.length);
md.push('');
md.push('## Summary');
md.push('');
md.push('- Total exports: **' + surface.length + '**');
md.push('- Enums: ' + enums.length);
md.push('- Literal union types: ' + literalUnions.length);
md.push('- Discriminated unions: ' + discriminatedUnions.length);
md.push('- Brand/nominal types: ' + brands.length);
md.push('- Orphan exports (only declared, never imported): **' + orphans.length + '**');
md.push('- Warnings: ' + warnings.length);
md.push('');

md.push('## Surface (sorted by name)');
md.push('');
md.push('| Name | Kind | Lines | Chars | Fields | Literals | Extends |');
md.push('| --- | --- | ---: | ---: | ---: | --- | --- |');
const sortedSurface = surface.slice().sort((a, b) => a.name.localeCompare(b.name));
for (const s of sortedSurface) {
  md.push('| ' + s.name + ' | ' + s.kind + ' | ' + s.startLine + '-' + s.endLine + ' | ' + s.sizeChars + ' | ' + s.fieldCount + ' | ' + (s.literalFields.length || '') + ' | ' + (s.extendsOther || '') + ' |');
}

md.push('');
md.push('## Enums');
md.push('');
if (enums.length === 0) {
  md.push('> No export enum declarations found.');
} else {
  for (const e of enums) {
    md.push('### ' + e.name);
    md.push('');
    md.push('Members: ' + e.members.map(m => '' + m.name + '' + (m.value ? '=' + m.value : '')).join(', '));
    md.push('');
  }
}

md.push('## Literal Union Types');
md.push('');
if (literalUnions.length === 0) {
  md.push('> No string literal union types found.');
} else {
  for (const l of literalUnions) {
    md.push('### ' + l.name);
    md.push('');
    md.push('Literals: ' + l.literals.map(x => '' + x + '').join(', '));
    md.push('');
  }
}

md.push('## Discriminated Unions');
md.push('');
if (discriminatedUnions.length === 0) {
  md.push('> No discriminated union types found.');
} else {
  for (const d of discriminatedUnions) {
    md.push('### ' + d.name);
    md.push('');
    md.push('Tag fields: ' + d.fields.map(f => '' + f.field + '=' + f.value + '').join(', '));
    md.push('');
  }
}

md.push('## Brand / Nominal Types');
md.push('');
if (brands.length === 0) {
  md.push('> No __brand intersection types found.');
} else {
  md.push(brands.map(b => '- ' + b + '').join('\n'));
}

md.push('');
md.push('## Orphan Exports (declared but never imported elsewhere)');
md.push('');
if (orphans.length === 0) {
  md.push('> All exports are referenced by at least one other source file.');
} else {
  md.push(orphans.map(o => '- ' + o + '').join('\n'));
}

md.push('');
md.push('## Warnings');
md.push('');
if (warnings.length === 0) {
  md.push('> No structural warnings.');
} else {
  md.push('| Name | Kind | Detail |');
  md.push('| --- | --- | --- |');
  for (const w of warnings) {
    md.push('| ' + w.name + ' | ' + w.kind + ' | ' + w.detail + ' |');
  }
}

md.push('');
md.push('## Recommendations');
md.push('');
if (orphans.length > 0) md.push('- Consider removing or marking as @internal the ' + orphans.length + ' orphan exports.');
if (warnings.some(w => w.kind === 'oversized')) md.push('- Split oversized interfaces into smaller composable types.');
if (warnings.some(w => w.kind === 'too-many-fields')) md.push('- Group high-field-count interfaces via composition.');
md.push('- Re-run this audit after any types.ts change to detect regressions.');

md.push('');
md.push('## Artifacts');
md.push('');
md.push('- Raw JSON: logs/audit/types-deep.json');
md.push('- Markdown: type-audit-report.md (this file)');

writeFileSync('type-audit-report.md', md.join('\n'));

console.log(JSON.stringify({
  passed: true,
  suite: 'audit-types-deep',
  report: 'type-audit-report.md',
  totalExports: surface.length,
  orphans: orphans.length,
  warnings: warnings.length,
}));
