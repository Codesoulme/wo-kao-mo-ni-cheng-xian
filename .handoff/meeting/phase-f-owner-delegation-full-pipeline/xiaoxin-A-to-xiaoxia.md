

## AI-101 bugfix 完成
- 修改文件：src/lib/xianxia/engine.ts
- 修改行号：7650、7651
- 修改前：if (betrayal > kindness + 1) return '怀恨戒备'; / if (kindness > betrayal + 1) return '心怀善意'; —— 2 betrayal vs 1 kindness 时 2 > 1+1 为 false，落入 依事缓决；同时 CJK 字符串写成 戒备 而非测试期望的 备忌。
- 修改后：if (betrayal >= kindness + 1) return '怀恨备忌'; / if (kindness >= betrayal + 1) return '心怀善意'; —— 阈值改为 >=，2:1 直接命中 wary-resentment；CJK 字符串与 smoke 期望 '\u6000\u6068\u5907\u5fcc' 对齐。保持 4 个输出值的中文标签（中性观望 / 怀恨备忌 / 心怀善意 / 依事缓决）不变。
- 验证: bun scripts/xianxia-regression-smoke.ts 全过;250/250,ai101-npc-behavior 与 ai101-npc-memory-update 均 passed。