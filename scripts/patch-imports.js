// Patch the import lines to include the new exports we use.
// Idempotent — safe to run multiple times.
const fs = require('fs');
const path = require('path');
const SMOKE_FILE = path.join('E:\\aigame2_publish\\scripts\\xianxia-regression-smoke.ts');

let content = fs.readFileSync(SMOKE_FILE, 'utf-8');

// engine.ts import — make sure the new exports are present
function ensureImportsIn(from, current, required) {
  const m = current.match(new RegExp("import\\s+\\{([^}]+)\\}\\s+from\\s+['\"]" + from.replace(/\./g, '\\.') + "['\"];?"));
  if (!m) return current;
  const existing = m[1].split(',').map(s => s.trim()).filter(Boolean);
  const set = new Set(existing);
  let changed = false;
  for (const r of required) {
    if (!set.has(r)) { set.add(r); changed = true; }
  }
  if (!changed) return current;
  const sorted = Array.from(set).sort();
  const newImport = "import { " + sorted.join(', ') + " } from '" + from + "';";
  return current.replace(m[0], newImport);
}

content = ensureImportsIn('../src/lib/xianxia/engine', content, [
  'computeCultivationFactors', 'computeEffectiveCultivationRate',
]);
content = ensureImportsIn('../src/lib/xianxia/display', content, [
  'sanitizeLootName', 'sanitizeBreakthroughProcessText',
]);
content = ensureImportsIn('../src/lib/xianxia/world-time', content, [
  'defaultTimeLabel', 'suggestTimeAdvance',
]);

fs.writeFileSync(SMOKE_FILE, content, 'utf-8');
console.log('Imports patched (idempotent)');