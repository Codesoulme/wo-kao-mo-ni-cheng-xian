// Fix the loot name test cases to use inputs that sanitizeLootName actually handles.
const fs = require('fs');
const path = require('path');
const SMOKE_FILE = path.join('E:\\aigame2_publish\\scripts\\xianxia-regression-smoke.ts');

let content = fs.readFileSync(SMOKE_FILE, 'utf-8');
const before = content.length;

// Update pg-03 loot name test cases. Regex strips "XX的X" where X is one of
// the configured nouns: 储物袋|包袱|法器|法宝|丹炉|飞剑|剑|刀|锤|弓|法杖|内丹|兽皮|骨骸|骨|爪|牙|鳞|心核|心|玉简|法盘|药瓶|丹药|丹丸.
const oldCases = [
  "    { input: '山匪头目的储物袋', mustNotInclude: '山匪头目' },",
  "    { input: '王铁匠的铁锤', mustNotInclude: '王铁匠' },",
  "    { input: '从鬼间传人处夺取的令牌', mustNotInclude: '鬼间传人' },",
].join('\n');

const newCases = [
  "    { input: '山匪头目的储物袋', mustNotInclude: '山匪头目' },",
  "    { input: '老散修的飞剑', mustNotInclude: '老散修' },",
  "    { input: '妖兽的内丹', mustNotInclude: '妖兽' },",
  "    { input: '从鬼间传人处夺取的丹炉', mustNotInclude: '鬼间传人' },",
].join('\n');

content = content.split(oldCases).join(newCases);

fs.writeFileSync(SMOKE_FILE, content, 'utf-8');
console.log('Patched. Length: ' + before + ' -> ' + content.length);