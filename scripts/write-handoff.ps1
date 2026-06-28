# write-handoff.ps1
#
# 用途:字节级写 UTF-8 (带 BOM) 文件,解决 PowerShell heredoc 中文 + ${var} 变量替换旧病。
#
# 为什么需要这个脚本:
#   - PowerShell 5.1 的 Set-Content / Out-File 默认使用系统 ANSI 代码页 (中文 Windows = GBK/CP936),
#     写中文 .md 会双重编码损坏。
#   - even with -Encoding UTF8,PowerShell 5.1 会去掉 BOM,导致部分工具读成 GBK。
#   - heredoc (@" ... "@) 会把 ${var} 解释成变量替换,导致 shell 变量被吃。
#   - 此脚本用 .NET [System.IO.File]::WriteAllText + UTF8Encoding($true) 强制带 BOM,且不解释变量。
#
# 用法 1:直接传 Content (适合命令行短文本)
#   pwsh -File scripts/write-handoff.ps1 -Path .handoff/x.md -Content "你好世界"
#
# 用法 2:从 bash 通过 base64 stdin (推荐,适合长文本 / 含 ${var} / 含中文)
#   echo -n "你好 ${HOME} 不应被解释" | base64 | pwsh -File scripts/write-handoff.ps1 -Path .handoff/x.md -Base64Content $(cat)
#   或者:
#   B64=$(echo -n "内容" | base64)
#   pwsh -File scripts/write-handoff.ps1 -Path .handoff/x.md -Base64Content $B64
#
# 用法 3:从 Claude / agent 调 (Bash + base64)
#   CONTENT=$(cat <<'EOF'
#   你的 .md 内容(单引号 heredoc 防止 shell 解释)
#   EOF
#   )
#   B64=$(printf '%s' "$CONTENT" | base64 -w 0)
#   pwsh -File scripts/write-handoff.ps1 -Path .handoff/x.md -Base64Content "$B64"
#
# 注意:
#   - -Content 和 -Base64Content 二选一,后者优先级高
#   - 文件已存在会被覆盖
#   - 不做目录创建,父目录必须先存在

param(
    [Parameter(Mandatory = $true)]
    [string]$Path,

    [string]$Content = "",

    [string]$Base64Content = ""
)

# 参数校验
if ([string]::IsNullOrEmpty($Base64Content) -and [string]::IsNullOrEmpty($Content)) {
    Write-Error "必须提供 -Content 或 -Base64Content 之一"
    exit 1
}

# 优先用 Base64Content (避免 shell 解释 ${var})
if (-not [string]::IsNullOrEmpty($Base64Content)) {
    try {
        $bytes = [Convert]::FromBase64String($Base64Content)
        $Content = [System.Text.Encoding]::UTF8.GetString($bytes)
    }
    catch {
        Write-Error "Base64 解码失败: $_"
        exit 2
    }
}

# 强制 UTF-8 BOM
$utf8Bom = New-Object System.Text.UTF8Encoding($true)

try {
    [System.IO.File]::WriteAllText($Path, $Content, $utf8Bom)
    $size = (Get-Item -LiteralPath $Path).Length
    $first3 = ""
    if ($size -ge 3) {
        $fs = [System.IO.File]::OpenRead($Path)
        try {
            $b0 = $fs.ReadByte()
            $b1 = $fs.ReadByte()
            $b2 = $fs.ReadByte()
            $first3 = "{0:X2} {1:X2} {2:X2}" -f $b0, $b1, $b2
        }
        finally {
            $fs.Close()
        }
    }
    Write-Output "[OK] 写入 $Path ($size bytes, BOM=$first3)"
}
catch {
    Write-Error "写入失败: $_"
    exit 3
}