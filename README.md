# 我靠模拟成仙

一个修仙题材模拟 RPG 项目。

## 本仓库包含
- 游戏前端与交互代码：`src/`
- 游戏公共资源：`public/`
- 数据模型：`prisma/`
- Next.js / Tailwind / ESLint / TypeScript 配置

## 本仓库不包含
- 本地环境变量 `.env`
- 本地数据库 `db/`
- AI 工作日志、临时结果、截图、上传/下载目录
- 构建产物与依赖目录

## 本地运行

```bash
npm install
npm run dev
```

如使用数据库功能，请自行配置 `DATABASE_URL` 并执行 Prisma 初始化。
