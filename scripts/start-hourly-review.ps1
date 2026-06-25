#!/usr/bin/env pwsh
# 启动每小时代码审查守护脚本
# 用法： powershell -File scripts/start-hourly-review.ps1

$ErrorActionPreference = "Continue"
$cwd = Split-Path -Parent $PSScriptRoot
Set-Location $cwd

# 使用 tsx / bun 运行脚本
if (Get-Command bun -ErrorAction SilentlyContinue) {
    bun run scripts/hourly-review.ts
} elseif (Get-Command tsx -ErrorAction SilentlyContinue) {
    npx tsx scripts/hourly-review.ts
} else {
    Write-Host "请先安装 bun 或 tsx 来运行 TypeScript 脚本" -ForegroundColor Red
    exit 1
}
