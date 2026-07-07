# 沉浸版 Phase-Release: Vercel 部署清单

主公已选 Vercel 部署 + Postgres。这份文档给主公或后续接手者。

## 1. 部署平台

- **GitHub 仓**：`Codesoulme/wo-kao-mo-ni-cheng-xian`
- **部署平台**：Vercel
- **绑定方式**：Vercel 导入 GitHub 仓 → 监听 `main` 分支 push → 自动 build + 部署

## 2. Vercel 配置（一次性）

### Framework Preset
- 选 **Next.js**（Vercel 自动识别 `package.json`）

### Build Command
- 默认 `npm run build` 即可（项目里定义为 `next build && node scripts/copy-standalone-assets.mjs`）

### Node.js Version
- 选 **20.x**（Next.js 16 需要）

### Root Directory
- 留空（默认 `./`）

## 3. 环境变量（必填）

主公在 Vercel 后台 → Settings → Environment Variables 添加：

| Key | Value | 说明 |
|---|---|---|
| `DATABASE_URL` | `postgres://...` | 主公选 Postgres 时填这个；用 Vercel Postgres 时选 "Connected" 自动注入 |
| `MINIMAX_API_KEY` | `eyJ...` | 主公在 minimax 控制台创建 |
| `ADMIN_TOKEN` | 强随机字符串 | 防滥用；dev 默认放行，生产必须有 |

> ⚠️ **绝不要把真实 key 提交到 GitHub**。`.env` / `*.local` 必须在 `.gitignore`。

## 4. 持久化数据

主公已选路 1（Postgres）。Vercel Storage：
- 进入 Vercel 后台 → Storage → Create Database → Postgres
- 选 Region（建议离主公玩家近）
- 创建后会自动注入 `POSTGRES_PRISMA_URL` 和 `POSTGRES_URL_NON_POOLING`
- 主公手动把 `POSTGRES_PRISMA_URL` → `DATABASE_URL`（项目代码读 `DATABASE_URL`）

## 5. 部署验证

主公推代码到 main → Vercel 自动 build → 拿到 URL（如 `https://wo-kao-mo-ni-cheng-xian.vercel.app`）。

主公打开 URL：
1. 应看到 StartScreen
2. 点开始游戏 → 选角色创建
3. 推进一年 → **看到 narrative**（说明 MINIMAX_API_KEY 配置成功）
4. 推完一次 + 刷新页面 → 角色状态保留（说明 Postgres 配置成功）

## 6. 客户端打包（Capacitor APK）

主公部署成功后告诉我 URL，我改 `capacitor.config.ts` 的 `server.url`，跑：

```bash
npx cap sync
cd android && ./gradlew assembleDebug
```

产物：`android/app/build/outputs/apk/debug/app-debug.apk`

主公把这个 APK 发到 TAP 上架 / 朋友手机里直接装。

## 7. 失败排查

| 症状 | 排查 |
|---|---|
| Vercel build 失败：找不到 `prisma generate` | 加 Vercel 后台 → Build Command 改成 `prisma generate && npm run build` |
| 推进一次报 401 | ADMIN_TOKEN 没设或前端没带 → 检查 Vercel env |
| 推进一次报 "AI 配置不完整" | MINIMAX_API_KEY 没读到 → 检查 Vercel env `MINIMAX_API_KEY` 是否真的设了 |
| 推进一次报 "HTTP 401 from minimax" | API key 失效 / 余额不足 |
| 推进一次报 "process.env.MINIMAX_API_KEY 未设置" | 主公服务器 `.xianxia-ai-config` 里写 `apiKey: "env:MINIMAX_API_KEY"`，不是写明文 key |

## 8. 本地 dev（不需要 Postgres）

主公本地写代码时，可以用 SQLite 文件：

```bash
# .env.local
DATABASE_URL="file:./dev.db"
```

schema 文件里 Prisma 会自动检测 provider=postgresql 与 SQLite url 的不兼容——本地需要临时改回：

```bash
# 临时切 SQLite 本地玩
# 编辑 prisma/schema.prisma 把 provider 改成 sqlite
# 然后跑 prisma generate
# 注意：commit 前必须改回 postgresql
```

或者主公直接用 Neon / Supabase 免费层开发——主公 SQLite 数据库本地玩到哪都行，**别 commit SQLite 改动到 main**。

## 9. 后续

- 当前 API key 是主公的（短时间承担得起）。真上线时应做 **每日配额** + **后端 token 限额**
- 加缓存（同 prompt 5 分钟内复用 → 减少 token 消耗）
- 接 TAP 内购增值

---

主公部署成功后，告诉我 URL，我立刻改 `capacitor.config.ts` 出 APK。