@echo off
:: ============================================================================
:: 修仙沉浸开发一键启动（Launch Xiuzhen Dev）
:: ----------------------------------------------------------------------------
:: 修仙用户点桌面图标，一次性拉起：
::   1. 修仙 dev server（最小化不抢焦点，跑 bun run dev）
::   2. 等待端口 3100 起来
::   3. 修仙浏览器预览 http://localhost:3100（自动弹）
::   4. 修仙 Claude TUI（主窗抢焦点）
::
:: 用法：
::   - 双击桌面 "修仙沉浸.lnk"
::   - 命令行：cmd /c "E:\aigame2_publish\scripts\launch-xiuzhen.cmd"
::
:: 端口说明：
::   修仙 dev 改跑 3100 端口。3000 端口曾被 Windows TCP 残留 socket 占着
::   （netstat 显示 PID 16196 但 tasklist / wmic 都找不到对应进程，
::   taskkill /F 也无效），修仙 dev 起在 3000 会 EADDRINUSE 卡死。
::   修仙浏览器预览、dev 脚本、launcher 探活都同步切到 3100。
:: ============================================================================
setlocal
chcp 65001 >nul

set "PROJECT=E:\aigame2_publish"
set "WT=%LOCALAPPDATA%\Microsoft\WindowsApps\wt.exe"
set "PORT=3100"

:: ---------- 修仙 1. 杀旧 dev（防止重复占端口）----------
echo [修仙启动器] 清理旧 dev server...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT%" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%P >nul 2>&1
)
timeout /t 1 >nul

:: ---------- 修仙 2. dev server（独立最小化 cmd）----------
echo [修仙启动器] 启动修仙 dev server（最小化）...
start "修仙 dev server" /min cmd /k "cd /d "%PROJECT%" && bun run dev"

:: ---------- 修仙 3. 探活端口 3100 ----------
echo [修仙启动器] 等 Next.js 编译...
set /a TRIES=0
:WAIT_PORT
set /a TRIES+=1
if !TRIES! GTR 90 (
    echo [修仙启动器] 超时未等到 %PORT% 端口，请查看 dev 窗日志
    goto SKIP_BROWSER
)
powershell -NoProfile -Command "try{$c=New-Object System.Net.Sockets.TcpClient;$c.ConnectAsync('127.0.0.1',%PORT%).Wait(2000)|Out-Null;if($c.Connected){$c.Close();exit 0}else{exit 1}}catch{exit 1}" >nul 2>&1
if errorlevel 1 (
    timeout /t 1 >nul
    goto WAIT_PORT
)
echo [修仙启动器] Next.js ready, opening browser preview...
start "" "http://localhost:%PORT%"
goto CLAUDE

:SKIP_BROWSER
echo [修仙启动器] 跳过浏览器预览（dev 未就绪）

:CLAUDE
:: ---------- 修仙 4. Claude TUI（主窗抢焦点）----------
echo [修仙启动器] Starting Claude TUI...
start "" "%WT%" -d "%PROJECT%" --title "Claude [修仙沉浸]" cmd /k "claude"

echo [修仙启动器] done. Claude TUI 是主交互窗。
endlocal
