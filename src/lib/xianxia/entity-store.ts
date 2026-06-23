// 实体库：从历史 narrative 里提取 NPC/地点/物品，存 Character.entityEntriesJson
// 作用：让 AI 续写时复用已有实体（不重发明名字/物件）；让 fallback 生成时也能用
// 算法：简易 NER —— 基于中文常见姓氏+称谓+物品后缀模式匹配

import type { Character } from '@prisma/client';

export type EntityType = 'npc' | 'place' | 'item';

export type EntityEntry = {
  type: EntityType;
  name: string;                  // 标准名（去前后缀）
  rawName?: string;              // 原文里出现的形式
  firstAppearedAge: number;
  lastUsedAge: number;
  useCount: number;
  attributes: Record<string, string>;   // 关系/职业/地点/物品描述等
  sourceSnippet: string;         // 出处一句话引用
};

const MAX_ENTITIES = 30;

// 常见中文姓氏
const SURNAMES = ['茅', '于', '王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴', '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗', '梁', '宋', '郑', '谢', '韩', '唐', '冯', '于', '董', '萧', '程', '曹', '袁', '邓', '许', '傅', '沈', '曾', '彭', '吕', '苏', '卢', '蒋', '蔡', '贾', '丁', '魏', '薛', '叶', '阎', '余', '潘', '杜', '戴', '夏', '钟', '汪', '田', '任', '姜', '范', '方', '石', '姚', '谭', '廖', '邹', '熊', '金', '陆', '郝', '孔', '白', '崔', '康', '毛', '邱', '秦', '江', '史', '顾', '侯', '邵', '孟', '龙', '万', '段', '雷', '钱', '汤', '尹', '黎', '易', '常', '武', '乔', '贺', '赖', '龚', '文'];

// 称谓词（人名后缀）
const NPC_TITLES = ['氏', '翁', '老翁', '翁', '父', '母', '公', '婆', '爷', '奶', '哥', '姐', '弟', '妹', '兄', '嫂', '郎', '娘', '君', '侠', '人', '客', '夫', '妇', '壮', '妇', '儿', '女', '掌柜', '师', '师兄', '师姐', '师兄', '师姐', '师尊', '老祖', '前辈', '道友', '小友', '姑娘', '公子', '先生', '前辈', '后生', '晚辈', '散修', '女修', '真人', '道长'];

// 物品/地名后缀
const ITEM_SUFFIXES = ['佩', '符', '剑', '刀', '枪', '珠', '玉', '环', '镯', '镜', '甲', '衣', '袍', '靴', '帽', '簪', '钗', '丹', '丸', '散', '汤', '酒', '茶', '草', '参', '芝', '芝', '丹砂', '布', '帕', '笛', '箫', '琴', '书', '卷', '石', '矿', '木', '笛', '伞', '灯', '盏', '炉', '鼎', '阵盘', '旗', '鼓', '槌', '珠', '环', '簪', '钗', '鞋'];
const PLACE_SUFFIXES = ['村', '镇', '城', '县', '山', '峰', '岭', '谷', '河', '湖', '海', '州', '府', '阁', '宫', '殿', '院', '寺', '观', '堂', '铺', '店', '楼', '坊', '桥', '路', '街', '巷', '院', '居', '洞', '府', '境', '域', '林', '圃', '田', '场', '庄', '屋', '家', '屋'];

function extractNpcs(text: string, age: number): EntityEntry[] {
  const found: Map<string, EntityEntry> = new Map();
  // 匹配姓氏+称谓 2-3 字
  const re = new RegExp(`[${SURNAMES.join('')}][\\u4e00-\\u9fa5]{0,2}(?:${NPC_TITLES.join('|')})?`, 'g');
  for (const m of text.matchAll(re)) {
    const name = m[0];
    if (name.length < 2 || name.length > 5) continue;
    // 过滤常见误判词
    if (/[，,。.、;：:]/.test(name)) continue;
    // 排除明显是动词/名词的（如"前去"、"上街"）
    if (/^(前去|上街|下山|回屋|出门|进屋|回到|来到|走出|走进|推门|关窗|开门|看着|听完|听完|说罢|笑罢|哭罢|听完|抱起|放下|拿起|摸出|拿出|掏出|取出)$/.test(name)) continue;
    // 已有的
    const existing = found.get(name);
    if (existing) existing.useCount++;
    else found.set(name, { type: 'npc', name, rawName: name, firstAppearedAge: age, lastUsedAge: age, useCount: 1, attributes: {}, sourceSnippet: text.slice(Math.max(0, m.index! - 8), m.index! + 16) });
  }
  return Array.from(found.values());
}

function extractPlaces(text: string, age: number): EntityEntry[] {
  const found: Map<string, EntityEntry> = new Map();
  // X+地名的形式
  for (const suffix of PLACE_SUFFIXES) {
    const re = new RegExp(`[\\u4e00-\\u9fa5]{1,4}${suffix}`, 'g');
    for (const m of text.matchAll(re)) {
      const name = m[0];
      if (name.length < 2) continue;
      if (found.has(name)) found.get(name)!.useCount++;
      else found.set(name, { type: 'place', name, rawName: name, firstAppearedAge: age, lastUsedAge: age, useCount: 1, attributes: {}, sourceSnippet: text.slice(Math.max(0, m.index! - 8), m.index! + 16) });
    }
  }
  return Array.from(found.values());
}

function extractItems(text: string, age: number): EntityEntry[] {
  const found: Map<string, EntityEntry> = new Map();
  for (const suffix of ITEM_SUFFIXES) {
    const re = new RegExp(`[\\u4e00-\\u9fa5]{1,3}${suffix}`, 'g');
    for (const m of text.matchAll(re)) {
      const name = m[0];
      // 过滤明显是普通词（如"布衣"="衣服"）
      if (['布衣', '衣物', '身体', '衣服', '衣裳', '物品'].includes(name)) continue;
      if (name.length < 2) continue;
      if (found.has(name)) found.get(name)!.useCount++;
      else found.set(name, { type: 'item', name, rawName: name, firstAppearedAge: age, lastUsedAge: age, useCount: 1, attributes: {}, sourceSnippet: text.slice(Math.max(0, m.index! - 8), m.index! + 16) });
    }
  }
  return Array.from(found.values());
}

/**
 * 从一段 narrative 提取所有实体
 */
export function extractEntitiesFromNarrative(age: number, narrative: string): EntityEntry[] {
  return [
    ...extractNpcs(narrative, age),
    ...extractPlaces(narrative, age),
    ...extractItems(narrative, age),
  ];
}

/**
 * 把新实体合并到 character.entityEntriesJson
 * 规则：
 * 1. 同名实体合并：useCount+=1, lastUsedAge 更新
 * 2. 列表超过 MAX_ENTITIES 时按权重淘汰（useCount 低 + 久未使用优先淘汰）
 */
export function mergeEntities(character: Character, newEntries: EntityEntry[]): string {
  let arr: EntityEntry[] = [];
  try { arr = JSON.parse(character.entityEntriesJson || '[]'); } catch {}
  const map = new Map<string, EntityEntry>();
  for (const e of arr) map.set(`${e.type}:${e.name}`, e);
  for (const ne of newEntries) {
    const key = `${ne.type}:${ne.name}`;
    const existing = map.get(key);
    if (existing) {
      existing.useCount += ne.useCount;
      existing.lastUsedAge = Math.max(existing.lastUsedAge, ne.lastUsedAge);
      if (ne.sourceSnippet && existing.sourceSnippet.length < ne.sourceSnippet.length) {
        existing.sourceSnippet = ne.sourceSnippet;
      }
    } else {
      map.set(key, ne);
    }
  }
  // 排序：useCount 降序，相同 useCount 时 lastUsedAge 降序
  const merged = Array.from(map.values()).sort((a, b) => {
    if (b.useCount !== a.useCount) return b.useCount - a.useCount;
    return b.lastUsedAge - a.lastUsedAge;
  });
  // 截断
  const truncated = merged.slice(0, MAX_ENTITIES);
  return JSON.stringify(truncated);
}

/**
 * 从 character 取实体列表（按权重排序后）
 */
export function getEntityEntries(character: Character): EntityEntry[] {
  try {
    return JSON.parse(character.entityEntriesJson || '[]');
  } catch {
    return [];
  }
}

/**
 * 把实体拼成给 AI 看的"已有素材"提示
 */
export function formatEntitiesForPrompt(entities: EntityEntry[], topN: number = 12): string {
  if (!entities.length) return '';
  const top = entities.slice(0, topN);
  const npcs = top.filter(e => e.type === 'npc');
  const places = top.filter(e => e.type === 'place');
  const items = top.filter(e => e.type === 'item');
  const lines: string[] = [];
  lines.push('【已有素材库 - 请自然复用，不要凭空生造新名字】');
  lines.push('（这是之前事件里已经出现过的角色/地点/物件；续写时如要提及人物场景，优先从这里挑，避免名字错乱/物件失忆）');
  if (npcs.length) {
    lines.push(`人物（出现次数）：${npcs.map(e => `${e.name}(${e.useCount})`).join('、')}`);
  }
  if (places.length) {
    lines.push(`地点：${places.map(e => `${e.name}(${e.useCount})`).join('、')}`);
  }
  if (items.length) {
    lines.push(`物件：${items.map(e => `${e.name}(${e.useCount})`).join('、')}`);
  }
  return lines.join('\n');
}
