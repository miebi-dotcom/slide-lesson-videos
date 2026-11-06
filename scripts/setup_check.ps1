<#
Checks (and optionally installs) everything the skill needs on this machine. Run once per machine:
  powershell -NoProfile -ExecutionPolicy Bypass -File setup_check.ps1 [-Install]
Prints OK / MISSING per item; with -Install it pip-installs missing Python packages and winget-installs ffmpeg.
#>
param([switch]$Install)
$ok = $true
function Report($name, $good, $fix) {
    if ($good) { Write-Output ("OK       " + $name) }
    else { Write-Output ("MISSING  " + $name + "   -> " + $fix); $script:ok = $false }
}

# Python 3 + packages
$py = Get-Command python -ErrorAction SilentlyContinue
Report "Python 3" ($null -ne $py) "install Python 3 from python.org (tick 'Add to PATH')"
if ($py) {
    $pkgs = @{ "pymupdf" = "pymupdf"; "PIL" = "pillow" }   # slide lessons need no transcription or PSD tools
    foreach ($mod in $pkgs.Keys) {
        & python -c "import $mod" 2>$null
        $has = ($LASTEXITCODE -eq 0)
        if (-not $has -and $Install) { & python -m pip install --user $pkgs[$mod] | Out-Null; & python -c "import $mod" 2>$null; $has = ($LASTEXITCODE -eq 0) }
        Report ("Python package " + $pkgs[$mod]) $has ("python -m pip install --user " + $pkgs[$mod])
    }
}


# Node (optional: syntax-checks scripts before they reach After Effects)
$node = Get-Command node -ErrorAction SilentlyContinue
if ($node) { Write-Output "OK       Node.js (optional)" } else { Write-Output "optional Node.js not found: scripts still run, without the pre-check  -> winget install OpenJS.NodeJS.LTS" }

# After Effects
$ae = @(Get-ChildItem "C:\Program Files\Adobe" -Directory -Filter "Adobe After Effects*" -ErrorAction SilentlyContinue)
Report "After Effects installed" ($ae.Count -gt 0) "install After Effects 2023 or newer"
if ($ae.Count -gt 0) { Write-Output ("         found: " + (($ae | ForEach-Object { $_.Name }) -join ", ")) }
$running = @(Get-Process -Name AfterFX -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle })
if ($running.Count -eq 0) { Write-Output "note     After Effects is not running: open it with the lesson project before using the skill" }
elseif ($running.Count -gt 1) { Write-Output "note     several After Effects windows are open: keep only one version open (scripts go to the newest)" }
else { Write-Output ("OK       After Effects running: " + $running[0].MainWindowTitle) }
Write-Output "         In After Effects: Edit > Preferences > Scripting & Expressions > tick 'Allow Scripts to Write Files and Access Network'."

if ($ok) { Write-Output "`nREADY: this machine can run the skill." } else { Write-Output "`nNot ready: fix the MISSING items (or re-run with -Install)." }
