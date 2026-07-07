$payload = @'
$dir = 'E:\aigame2_publish\src\components\xianxia'
$skip = 'AIConfigDialog.tsx'

$patterns = @(
  @{ re = '\bid\b';    label = 'id' },
  @{ re = '\bID\b';    label = 'ID' },
  @{ re = "`u{914d}`u{7f6e}";       label = 'peizhi' },
  @{ re = 'config';    label = 'config' },
  @{ re = "`u{7f13}`u{5b58}";       label = 'huancun' },
  @{ re = 'cache';     label = 'cache' },
  @{ re = '\bAI\b';    label = 'AI' },
  @{ re = "`u{4eba}`u{5de5}`u{667a}`u{80fd}";    label = 'rengongzhineng' },
  @{ re = 'LLM';       label = 'LLM' },
  @{ re = "`u{547d}`u{8282}`u{70b9}";     label = 'mingjiedian' },
  @{ re = "`u{8282}`u{70b9}";       label = 'jiedian' },
  @{ re = "`u{5929}`u{9053}`u{5e72}`u{9884}";   label = 'tiandaoganyu' },
  @{ re = "`u{7cfb}`u{7edf}`u{5e72}`u{9884}";   label = 'xitongganyu' },
  @{ re = "`u{9884}`u{6f14}";       label = 'yuyan' },
  @{ re = "`u{6570}`u{636e}`u{5e93}";     label = 'shujuku' },
  @{ re = 'database';  label = 'database' },
  @{ re = "`u{63a5}`u{53e3}";       label = 'jiekou' },
  @{ re = 'API';       label = 'API' }
)

function Is-CodeContext($line) {
  $t = $line.Trim()
  if ($t -match '^(import|export|type|interface|function|const|let|var)\b') { return $true }
  if ($t -match '\bid\s*[:?=]\s*[\w"''`]') { return $true }
  if ($t -match '\bID\s*[:?=]') { return $true }
  if ($t -match 'key\s*=\s*\{') { return $true }
  if ($t -match 'htmlFor\s*=') { return $true }
  if ($t -match 'className\s*=') { return $true }
  if ($t -match 'data-\w+\s*=') { return $true }
  if ($t -match 'aria-\w+\s*=') { return $true }
  if ($t -match '^\s*//') { return $true }
  return $false
}

# Use Out-File with -Width to avoid hanging Format-Table
Get-ChildItem -Path $dir -Filter *.tsx | Where-Object { $_.Name -ne $skip } | ForEach-Object {
  $file = $_.FullName
  $name = $_.Name
  $lines = Get-Content $file
  for ($i=0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i]
    $lineNum = $i + 1
    foreach ($p in $patterns) {
      $regex = $p.re
      $label = $p.label
      $matches = [regex]::Matches($line, $regex)
      foreach ($m in $matches) {
        if (Is-CodeContext $line) { continue }
        $ctx = $line.Trim()
        if ($ctx.Length -gt 200) { $ctx = $ctx.Substring(0,200) + '...' }
        Write-Output ("[$name] L$lineNum [$label] $ctx")
      }
    }
  }
} | Out-File -FilePath 'E:\aigame2_publish\review_results.txt' -Encoding utf8
Write-Host 'Done'
'@
[System.IO.File]::WriteAllText('E:\aigame2_publish\review_script.ps1', $payload, [System.Text.UTF8Encoding]::new($false))
