<#
Runs an ExtendScript file inside the running After Effects and prints its result.

  powershell -File ae_run.ps1 -Script jsx/probe_project.jsx [-DataFile input.json] [-Timeout 120]

- Prepends jsx/lib.jsx (helpers + result writer) and wraps the script in try/catch.
- Injects the JSON input as the JS literal DATA (ExtendScript has no JSON.parse).
- Waits for the script's result file and prints it (a toSource() object: done / warnings / errors / ...).
- Lints for object keys that are ExtendScript reserved words (e.g. {in: 1}): a syntax error makes
  After Effects show a modal dialog that blocks every later script until someone clicks OK.
#>
param(
    [Parameter(Mandatory = $true)][string]$Script,
    [string]$DataFile = "",
    [int]$Timeout = 120,
    [string]$Project = ""
)
$ErrorActionPreference = "Stop"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not (Test-Path $Script)) { $Script = Join-Path $here $Script }
if (-not (Test-Path $Script)) { Write-Output "ERROR: script not found: $Script"; exit 1 }

$body = Get-Content $Script -Raw -Encoding UTF8
$reserved = 'in|for|if|do|new|var|case|class|const|default|delete|function|return|switch|this|throw|try|typeof|void|while|with|catch|finally|instanceof|export|import|super|enum|extends|null|true|false'
$bad = [regex]::Matches($body, "[\{,]\s*($reserved)\s*:")
if ($bad.Count -gt 0) {
    Write-Output ("ERROR: reserved word used as an object key: " + (($bad | ForEach-Object { $_.Value.Trim() }) -join ", ") + ". Quote it or rename it; AE would block on a syntax-error dialog.")
    exit 1
}

# ES3 "future reserved words" (final, int, char, goto...) are legal in modern JS, so Node's check passes,
# but ExtendScript refuses them as identifiers with a blocking dialog. Look for them in code only.
$code = [regex]::Replace($body, '"(?:\\.|[^"\\\n])*"|''(?:\\.|[^''\\\n])*''|(?<=[=(,:!&|?;{}]\s*)/(?![/*])(?:\\.|\[(?:\\.|[^\]\n])*\]|[^/\\\n])+/[gimy]*|//[^\n]*|/\*[\s\S]*?\*/', '')
$es3 = 'abstract|boolean|byte|char|double|final|float|goto|implements|int|interface|long|native|package|private|protected|public|short|static|synchronized|throws|transient|volatile'
$bad3 = [regex]::Matches($code, "(?<![\.\w$])($es3)(?![\w$])")
$chain = [regex]::Matches($code, '\?[^?:;{}\n]+:[^?:;{}\n,()]+\?')
if ($chain.Count -gt 0) {
    Write-Output ("ERROR: chained ternary (a ? b : c ? d : e) - ExtendScript evaluates it wrongly. Use if/else: " + (($chain | Select-Object -First 3 | ForEach-Object { $_.Value.Trim() }) -join " | "))
    exit 1
}
if ($bad3.Count -gt 0) {
    Write-Output ("ERROR: ExtendScript reserved word used as a name: " + (($bad3 | ForEach-Object { $_.Value } | Select-Object -Unique) -join ", ") + ". Rename it; AE would block on a syntax-error dialog.")
    exit 1
}

$data = "{}"
if ($DataFile) {
    if (-not (Test-Path $DataFile)) { Write-Output "ERROR: data file not found: $DataFile"; exit 1 }
    $data = (Get-Content $DataFile -Raw -Encoding UTF8).Trim()
    if (-not $data) { $data = "{}" }
}

$outDir = Join-Path $env:TEMP "ae_skill"
New-Item -ItemType Directory -Force $outDir | Out-Null
$stamp = (Get-Date -Format "HHmmssfff") + "_" + (Get-Random -Maximum 9999)
$name = [IO.Path]::GetFileNameWithoutExtension($Script)
$resultPath = (Join-Path $outDir "$name`_$stamp.result.txt") -replace '\\', '/'
$tmpJsx = Join-Path $outDir "$name`_$stamp.jsx"

$lib = Get-Content (Join-Path $here "jsx/lib.jsx") -Raw -Encoding UTF8
$lib = $lib.Replace("__RESULT_PATH__", $resultPath).Replace("__DATA__", $data)
$libLines = ($lib -split "`n").Count + 1
$full = $lib + "`n(function(){`ntry {`n" + $body + "`n} catch (e) { R.errors.push(e.toString() + "" (line "" + (e.line - $libLines - 2) + "" of $name.jsx)""); }`nwriteResult();`n})();`n"
[IO.File]::WriteAllText($tmpJsx, $full, (New-Object Text.UTF8Encoding($false)))

# Syntax-check before sending: a parse error inside AE opens a blocking dialog.
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) {
    $tmpJs = [IO.Path]::ChangeExtension($tmpJsx, ".check.js")
    Copy-Item $tmpJsx $tmpJs
    $ErrorActionPreference = "Continue"
    $check = & $node.Source --check $tmpJs 2>&1
    $code = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
    Remove-Item $tmpJs -ErrorAction SilentlyContinue
    if ($code -ne 0) { Write-Output "ERROR: syntax check failed (nothing was sent to After Effects):"; $check | Select-Object -First 8 | ForEach-Object { Write-Output "  $_" }; exit 1 }
}

# Pick the right After Effects when several are open (e.g. 2025 with the lesson + 2026 untitled):
# -Project filter > a window with a saved .aep (not Untitled) > any window.
$wins = @(Get-Process -Name AfterFX -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle })
if ($Project) { $proc = $wins | Where-Object { $_.MainWindowTitle -like "*$Project*" } | Select-Object -First 1 }
if (-not $proc) { $proc = $wins | Where-Object { $_.MainWindowTitle -match '\.aep' -and $_.MainWindowTitle -notmatch 'Untitled' } | Select-Object -First 1 }
if (-not $proc) { $proc = $wins | Select-Object -First 1 }
if (-not $proc) { Write-Output "ERROR: After Effects is not running (no AfterFX window found). Open the project first."; exit 1 }
if ($wins.Count -gt 1) { Write-Output ("note: " + $wins.Count + " After Effects windows open; using: " + $proc.MainWindowTitle) }

& $proc.Path -r $tmpJsx
for ($i = 0; $i -lt $Timeout * 2; $i++) {
    if (Test-Path $resultPath) { Start-Sleep -Milliseconds 200; Get-Content $resultPath -Raw -Encoding UTF8; exit 0 }
    Start-Sleep -Milliseconds 500
}
Write-Output "ERROR: no result after $Timeout s. Check After Effects for an open dialog (an error dialog blocks all later scripts - click OK) or a long render/preview, then run again."
exit 1
