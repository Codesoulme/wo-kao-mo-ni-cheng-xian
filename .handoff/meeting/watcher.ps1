# .handoff/meeting/watcher.ps1
# ?? watcher?? 30 ????????????????????
# ????????? powershell ??
#   powershell -ExecutionPolicy Bypass -File .handoff/meeting/watcher.ps1

$ErrorActionPreference = 'Stop'
$KH = 'E:\aigame2_publish\.handoff\meeting\kickoff-and-handover'
$MEETING = 'E:\aigame2_publish\.handoff\meeting'
$TASK = 'E:\aigame2_publish\.handoff\combat-labels-rollback-and-category-enum-fix'

# ???????
$WATCH = @(
    "$KH\xiaoxin-to-xiaoxia.md",
    "$KH\xiaoxia-to-xiaoxin.md",
    "$KH\decisions.md",
    "$KH\action-items.md",
    "$KH\agenda.md",
    "$MEETING\current.md",
    "$TASK\xiaoxin-plan.md",
    "$TASK\task.md"
)

# ????? mtime + size
$state = @{}
foreach ($f in $WATCH) {
    if (Test-Path $f) {
        $i = Get-Item $f
        $state[$f] = @{ mtime = $i.LastWriteTime; size = $i.Length }
    }
}

Write-Host "[watcher] ???? 30 ????????"
Write-Host "[watcher] ?? $($WATCH.Count) ???"
Write-Host "[watcher] ????: $(Get-Date -Format 'HH:mm:ss')"

while ($true) {
    Start-Sleep -Seconds 30
    $changed = @()
    foreach ($f in $WATCH) {
        if (-not (Test-Path $f)) { continue }
        $i = Get-Item $f
        $cur_mtime = $i.LastWriteTime
        $cur_size = $i.Length
        if (-not $state.ContainsKey($f)) {
            $state[$f] = @{ mtime = $cur_mtime; size = $cur_size }
            $changed += "NEW: $f"
            continue
        }
        $prev = $state[$f]
        if ($cur_mtime -ne $prev.mtime -or $cur_size -ne $prev.size) {
            $state[$f] = @{ mtime = $cur_mtime; size = $cur_size }
            $delta = $cur_size - $prev.size
            $changed += "CHANGED: $f (mtime: $($cur_mtime.ToString('HH:mm:ss')), delta: $delta bytes)"
        }
    }
    if ($changed.Count -gt 0) {
        $ts = Get-Date -Format 'HH:mm:ss'
        Write-Host ""
        Write-Host "[$ts] ??? $($changed.Count) ?????"
        foreach ($c in $changed) { Write-Host "  $c" }
        Write-Host "[$ts] -> ????????? OpenClaw ???? '?????' ???"
        # ???????????????????
        $log = "$MEETING\watcher-changes.log"
        "$ts | $($changed -join ' | ')" | Out-File -Append -FilePath $log -Encoding UTF8
    }
}
