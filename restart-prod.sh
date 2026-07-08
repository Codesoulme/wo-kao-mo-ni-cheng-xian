#!/usr/bin/env bash
# 沉浸版 Phase-Release: 一键重建生产包 + 重启 prod server
# 用法：从项目根跑 bash restart-prod.sh
# 行为：
#   1) 杀掉 3100 上的旧 prod server
#   2) npm run build（产生新的 .next/standalone）
#   3) 用 bun 启新的 standalone server 到 3100，日志写 prod.log
#   4) 校验 HTTP 200 + /api/ai-config 返回 configured=true
# 隧道 cloudflared 进程不动（它监听 origin，origin 换新进程它照跑）

set -e

PROJECT_DIR="E:/aigame2_publish"
PORT=3100
LOG="$PROJECT_DIR/prod.log"

echo "[1/4] 停掉旧 prod server（如果在跑）..."
# Windows 下用 netstat 找 3100 端口占用的 PID
for p in $(netstat -ano | grep ":$PORT " | grep LISTENING | awk '{print $NF}' | sort -u); do
  echo "  killing 3100-owner PID $p"
  taskkill //F //PID $p 2>&1 | head -1 || true
done
# 兜底：把所有 bun.exe 都杀了（本机就我们用 bun 跑 standalone）
for p in $(tasklist 2>/dev/null | grep -i "bun.exe" | awk '{print $2}'); do
  echo "  killing bun PID $p"
  taskkill //F //PID $p 2>&1 | head -1 || true
done
sleep 2
# 清理可能锁着的 standalone 目录（bun 有时不完全释放）
rm -rf "$PROJECT_DIR/.next/standalone" 2>/dev/null || true

echo "[2/4] 生产构建（约 30~60 秒）..."
cd "$PROJECT_DIR"
env SKIP_AUTH=1 npm run build 2>&1 | tail -20
if [ ! -f "$PROJECT_DIR/.next/standalone/server.js" ]; then
  echo "!! build 失败：找不到 .next/standalone/server.js"
  exit 1
fi

echo "[3/4] 启动 prod server（后台，日志: $LOG）..."
cd "$PROJECT_DIR"
env SKIP_AUTH=1 PORT=$PORT HOSTNAME=0.0.0.0 nohup bun .next/standalone/server.js > "$LOG" 2>&1 &
SERVER_PID=$!
echo "  prod pid: $SERVER_PID"

echo "[4/4] 等待就绪 + 校验..."
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 2
  code=$(curl -s -o /dev/null -w "%{http_code}" -m 3 http://localhost:$PORT/ 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    echo "  HTTP 200 (第 $i 次尝试)"
    break
  fi
done

api=$(curl -s -m 5 http://localhost:$PORT/api/ai-config 2>&1)
echo "  /api/ai-config → $api"

if echo "$api" | grep -q '"configured":true'; then
  echo ""
  echo "✅ 重启完成。隧道:"
  echo "   https://landscape-existence-discussion-migration.trycloudflare.com"
  echo "   手机上把 APK 完全退出后再打开即可看到最新版。"
else
  echo ""
  echo "⚠️  prod server 起来了但 /api/ai-config 异常，检查 $LOG"
  tail -20 "$LOG"
fi
