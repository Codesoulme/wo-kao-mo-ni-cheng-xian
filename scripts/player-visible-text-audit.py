"""AI-28: 玩家可见文案审计脚本（v2：精确化）
只检测 JSX 文本节点、toast 文案、narrative 字段、placeholder、label、title 等真正玩家可见位置。
"""
import re
from pathlib import Path

ROOT = Path('.')

# ========== 玩家可见字符串提取规则 ==========
# JSX 文本节点：> 中文文本 <
# toast 文案：toast.success/warning('中文')
# placeholder / title / aria-label
# narrative 字段：narrative: '...'

PLAYER_VISIBLE_PATTERNS = [
    # JSX 文本
    r'>\s*([^<>{}]+?)\s*<',
    # toast.*(...)
    r'toast\.\w+\(\s*["\']([^"\']+)["\']',
    r'toast\(\s*["\']([^"\']+)["\']',
    # placeholder
    r'placeholder\s*=\s*["\']([^"\']+)["\']',
    # title=
    r'title\s*=\s*["\']([^"\']+)["\']',
    # aria-label
    r'aria-label\s*=\s*["\']([^"\']+)["\']',
    # alt=
    r'alt\s*=\s*["\']([^"\']+)["\']',
    # description: 字段（toast 子项）
    r'description\s*:\s*["\']([^"\']+)["\']',
    # Button text
    r'>\s*([^<>{}]*?)\s*</Button>',
]

# ========== 待审计的"系统感 / 漏底 / 元数据"词 ==========
P0_PATTERNS = [
    r'\bTODO\b', r'\bFIXME\b', r'\bXXX\b',
    r'\bundefined\b', r'\bNaN\b',
    r'\[object\s+Object\]',
]

P0_KEY_PATTERNS = [
    # 内部英文 key（不是 character.cultivationExp 这种属性访问，而是纯 key 文本）
    r'\bheartDemon\b', r'\bcultivationExp\b', r'\bstorageCapacity\b',
    r'\bactiveStatuses\b', r'\bsoulStrength\b', r'\bphysicalFoundation\b',
    r'\bcombatSession\b', r'\bpendingThreads\b',
    r'\brealmName\b', r'\brealmLevel\b', r'\bsoulRealm\b',
    r'\bspiritStones\b', r'\brecentBlueprint\b',
    r'\bGameState\b', r'\bCharacterState\b',
]

P1_PATTERNS = [
    r'加载中', r'\bLoading\b',
    r'系统提示', r'系统通知',
    r'崩溃', r'出错', r'异常',
    r'请求超时', r'响应超时',
    r'\bJSON\b',
    r'\bAPI\s+[Bb]ase\b',
]

# AIConfigDialog 是技术配置页面，允许 "API / 接口 / Key" 等词（玩家是开发者身份）
TECHNICAL_FILE_WHITELIST = {
    'AIConfigDialog.tsx',
}


# ========== 提取玩家可见字符串 ==========
def extract_player_visible(src: str, file_name: str) -> list[tuple[int, str]]:
    """返回 (行号, 玩家可见字符串) 列表"""
    out = []
    for pat in PLAYER_VISIBLE_PATTERNS:
        for m in re.finditer(pat, src, re.MULTILINE):
            text = m.group(1).strip()
            if not text or len(text) < 2:
                continue
            # 跳过纯符号 / 标点
            if re.fullmatch(r'[\s\W]+', text):
                continue
            # 跳过纯数字 / 数字组合
            if re.fullmatch(r'\d+', text):
                continue
            # 跳过纯 css class
            if 'className' in text or 'flex' in text or 'grid' in text:
                continue
            # 跳过 import / type 段
            line_no = src[:m.start()].count('\n') + 1
            line = src.split('\n')[line_no-1]
            if line.strip().startswith('//') or line.strip().startswith('/*') or line.strip().startswith('*'):
                continue
            if 'import ' in line or 'export ' in line:
                continue
            out.append((line_no, text))
    return out


# ========== 扫描 ==========
def scan_components():
    issues = []
    files = sorted(ROOT.glob('src/components/xianxia/*.tsx'))
    for f in files:
        try:
            src = f.read_text(encoding='utf-8')
        except Exception:
            continue
        visible = extract_player_visible(src, f.name)
        for line_no, text in visible:
            # AIConfigDialog 白名单
            if f.name in TECHNICAL_FILE_WHITELIST:
                continue
            for pat in P0_PATTERNS:
                if re.search(pat, text):
                    issues.append((str(f), line_no, 'P0', re.search(pat, text).group(), text[:80]))
                    break
            for pat in P0_KEY_PATTERNS:
                if re.search(pat, text):
                    # 排除属性访问 .cultivationExp 等（这些走 ATTRIBUTE_LABEL）
                    if re.search(r'\.\w+' + pat[2:-2], text):
                        continue
                    issues.append((str(f), line_no, 'P0-key', re.search(pat, text).group(), text[:80]))
                    break
            for pat in P1_PATTERNS:
                if re.search(pat, text):
                    issues.append((str(f), line_no, 'P1', re.search(pat, text).group(), text[:80]))
                    break
    return issues


def scan_display_sanitize():
    """扫 src/lib/xianxia/display.ts：检查 sanitize 函数覆盖率"""
    issues = []
    f = ROOT / 'src/lib/xianxia/display.ts'
    if not f.exists():
        return issues
    src = f.read_text(encoding='utf-8')
    expected_funcs = [
        'sanitizeNarrativeText',
        'sanitizeLootName',
        'sanitizeBreakthroughProcessText',
        'sanitizeClueText',
        'sanitizeEventDraft',
        'attributeLabel',
        'isMeaningfulStatus',
        'isVisibleNumericEventEffect',
        'COMBAT_PROJECTION_LABELS',
        'LOADING_LABELS',
        'REALM_SECTION_LABELS',
        'IDENTITY_SECTION_LABELS',
    ]
    for fn in expected_funcs:
        if fn not in src:
            issues.append((str(f), 0, 'P1-missing', fn, f'缺少导出函数 {fn}'))
    return issues


def scan_docs():
    issues = []
    docs = sorted(ROOT.glob('docs/*.md')) + sorted(ROOT.glob('docs/**/*.md'))
    for f in docs:
        try:
            src = f.read_text(encoding='utf-8')
        except Exception:
            continue
        for kw in ['console.log', 'undefined', 'NaN']:
            if kw in src:
                for m in re.finditer(re.escape(kw), src):
                    line_no = src[:m.start()].count('\n') + 1
                    line = src.split('\n')[line_no-1]
                    if line.strip().startswith('//') or '`' in line:
                        continue
                    issues.append((str(f), line_no, 'P1-doc', kw, line[:80]))
    return issues


# ========== 主流程 ==========
def main():
    issues = []
    issues.extend(scan_components())
    issues.extend(scan_display_sanitize())
    issues.extend(scan_docs())

    p0 = [i for i in issues if i[2] == 'P0' or i[2] == 'P0-key']
    p1 = [i for i in issues if i[2].startswith('P1') or i[2] == 'P1-missing']

    print(f'AI-28 文案审计 v2 (精确化): 总 {len(issues)} 项')
    print(f'  P0 (严重): {len(p0)}')
    print(f'  P1 (中): {len(p1)}')
    print()
    print('=== P0 详单（前 30 项） ===')
    for it in p0[:30]:
        print(f'  [{it[3]}] {it[0]}:{it[1]}')
        print(f'      → {it[4]}')
    print()
    print('=== P1 详单（前 20 项） ===')
    for it in p1[:20]:
        print(f'  [{it[3]}] {it[0]}:{it[1]}')
        print(f'      → {it[4]}')

    # 写一份 markdown 报告
    out = ROOT / 'docs/PLAYER_VISIBLE_TEXT_AUDIT.md'
    with out.open('w', encoding='utf-8') as f:
        f.write('# AI-28 玩家可见文案审计报告 (2026-06-27)\n\n')
        f.write(f'总问题: {len(issues)} (P0: {len(p0)} / P1: {len(p1)})\n\n')
        f.write('## 审计范围\n\n')
        f.write('- 扫描文件：`src/components/xianxia/*.tsx` (29 个组件)\n')
        f.write('- 白名单：`AIConfigDialog.tsx`（技术配置页面，允许 "API / 接口 / Key"）\n')
        f.write('- 规则参考：`docs/UI-RULES.md`\n\n')
        f.write('## P0 详单\n\n')
        for it in p0:
            f.write(f'- **{it[3]}** `{it[0]}:{it[1]}` → {it[4]}\n')
        f.write('\n## P1 详单\n\n')
        for it in p1:
            f.write(f'- **{it[3]}** `{it[0]}:{it[1]}` → {it[4]}\n')
    print(f'\n报告已写入 {out}')


if __name__ == '__main__':
    main()