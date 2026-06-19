# 《我靠模拟成仙》

一款 **AI 驱动的修仙人生模拟 RPG**。

玩家从凡人开局，经历灵根觉醒、入门修行、秘境奇遇、坊市交易、拍卖争夺、因果牵挂、战斗破境、心魔劫难，最终可能飞升、坐化、入魔、立宗或留下传承。

## 文档入口

- [设计文档](docs/DESIGN.md)`r`n- [差距分析与补强优先级](docs/GAP_ANALYSIS.md)
- [文档目录说明](docs/README.md)
- [技术文档基准 v1.0](docs/baseline/technical-design-v1.0-2026-06-17.txt)
- [旧 README 快照](docs/baseline-backups/README.baseline.20260619-154219.md)

## 当前能力

- 游戏内 AI 配置与测试连接
- AI 生成出生、年份事件、选择结果、玩家干扰反馈
- 引擎校验属性、境界、突破、寿元、心魔、物品、装备、战斗
- 未了因果、角色意图、长期记忆
- 战斗、战利品、储物袋、装备、功法、丹药
- 坊市、拍卖、秘境、炼丹、阵法、灵宠
- 修炼速度来源展示与状态/线索/史册 UI

## 本仓库包含

- 游戏前端与交互代码：`src/`
- 游戏静态资源：`public/`
- 数据模型：`prisma/`
- Next.js / Tailwind / ESLint / TypeScript 配置

## 本仓库不包含

- 本地环境变量 `.env`
- 本地 AI 配置 `.xianxia-ai-config`
- 本地数据库与构建产物
- `node_modules/`、`.next/` 等依赖与缓存目录

## 本地运行

```bash
npm install
npm run dev
```

如果使用数据库功能，需要配置 `DATABASE_URL` 并执行 Prisma 初始化。
