import { parseJSON } from './src/lib/xianxia/llm/response-parser.ts';

// 场景 1: 被 max_tokens 截断的 JSON,narrative 没闭合
const truncatedJSON = '{"title":"入山","narrative":"少年入了灵鹫山,拜了老道,老道传他一本残破的功法,教他坐';
console.log('=== 场景 1: narrative 被截断 ===');
try {
  const r = parseJSON(truncatedJSON);
  console.log('narrative:', JSON.stringify(r.narrative));
  console.log('长度:', r.narrative?.length);
} catch (e) { console.log('错误:', e.message); }

// 场景 2: 完整 JSON
const completeJSON = '{"title":"入山","narrative":"少年入了灵鹫山","memory":"记得师父面容"}';
console.log('\n=== 场景 2: 完整 JSON ===');
try {
  const r = parseJSON(completeJSON);
  console.log('narrative:', JSON.stringify(r.narrative));
} catch (e) { console.log('错误:', e.message); }

// 场景 3: narrative 完整但后续字段截断
const partialJSON = '{"title":"入山","narrative":"少年入了灵鹫山,拜师学艺","memory":"记得';
console.log('\n=== 场景 3: memory 被截断,narrative 完整 ===');
try {
  const r = parseJSON(partialJSON);
  console.log('narrative:', JSON.stringify(r.narrative));
  console.log('memory:', JSON.stringify(r.memory));
} catch (e) { console.log('错误:', e.message); }
