// Fix all 'fire' spiritualRoot references in pg- smokes.
const fs = require('fs');
const path = require('path');
const SMOKE_FILE = path.join('E:\\aigame2_publish\\scripts\\xianxia-regression-smoke.ts');

let content = fs.readFileSync(SMOKE_FILE, 'utf-8');
const before = content.length;

// The smoke file uses Unicode escape sequences, e.g. \u706b\u7075\u6839 (literal characters).
// We replace 'fire' (which is not a valid SpiritualRoot enum) with 'pure' (which is).
const replacements = [
  ["spiritualRoot: 'fire', rootDetail: '火灵根'", "spiritualRoot: 'pure', rootDetail: '天灵根'"],
  ["spiritualRoot: 'fire', rootDetail: '\\u706b\\u7075\\u6839'", "spiritualRoot: 'pure', rootDetail: '\\u5929\\u7075\\u6839'"],
  ["state.spiritualRoot = 'water'", "state.spiritualRoot = 'mixed'"],
  ["spiritualRoots: ['fire']", "spiritualRoots: ['heavenly']"],
];

for (const [from, to] of replacements) {
  content = content.split(from).join(to);
}

fs.writeFileSync(SMOKE_FILE, content, 'utf-8');
console.log('Patched. Length: ' + before + ' -> ' + content.length);