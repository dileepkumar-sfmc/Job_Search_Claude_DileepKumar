# Stop hook — nudge Claude to keep CLAUDE.md in sync after feature work.
#
# Fires when a turn ends. It asks Claude to update CLAUDE.md only when:
#   * files under src/ changed this session (real feature/code work), AND
#   * CLAUDE.md hasn't already been updated to reflect them, AND
#   * we haven't already reminded for this exact set of changes.
#
# A marker file (.claude/.claudemd-review-hash) records the last change-set we
# reminded about, so this nudges at most once per distinct set of edits rather
# than on every turn. The hook never hard-fails work: any error just exits 0.

$ErrorActionPreference = 'SilentlyContinue'

# --- Read the hook payload from stdin -------------------------------------
$raw = [Console]::In.ReadToEnd()
try { $payload = $raw | ConvertFrom-Json } catch { $payload = $null }

# Loop guard: if we're already inside a stop-hook continuation, do nothing.
if ($payload -and $payload.stop_hook_active) { exit 0 }

# --- Resolve project root --------------------------------------------------
$projectDir = $env:CLAUDE_PROJECT_DIR
if (-not $projectDir) { $projectDir = (Get-Location).Path }
Set-Location $projectDir

# --- Gather the working-tree changes under src/ ---------------------------
$diff = & git diff HEAD -- src 2>$null | Out-String
$untracked = & git ls-files --others --exclude-standard -- src 2>$null | Out-String
$changeSet = ($diff + $untracked).Trim()

# No source changes -> nothing worth documenting.
if (-not $changeSet) { exit 0 }

# --- Compute a signature of this change-set --------------------------------
function Get-Sig([string]$text) {
  $sha = [System.Security.Cryptography.SHA1]::Create()
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
  -join ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') })
}
$sig = Get-Sig $changeSet

$marker = Join-Path $projectDir '.claude\.claudemd-review-hash'
$last = ''
if (Test-Path $marker) { $last = (Get-Content $marker -Raw).Trim() }

# If CLAUDE.md is itself among the working changes, docs are already being
# touched this session -> record the state and stay quiet.
$status = & git status --porcelain 2>$null | Out-String
if ($status -match 'CLAUDE\.md') {
  Set-Content -Path $marker -Value $sig -Encoding utf8
  exit 0
}

# Already reminded for this exact change-set -> don't nag again.
if ($sig -eq $last) { exit 0 }

# Record that we're reminding for this state, then emit the block instruction.
Set-Content -Path $marker -Value $sig -Encoding utf8

$reason = @'
Source files under src/ changed this session, but CLAUDE.md has not been updated to match. Before you finish:

1. Decide whether these changes added or altered something the architecture notes describe - a feature, the add-job / AI-generation data flow, provider routing, the tailored-resume prompt-to-renderer contract, the pipeline columns, the design system, or the Find Jobs flow.
2. If yes, and you have verified the change works (e.g. it builds and you exercised it), update ONLY the relevant section of CLAUDE.md so it stays accurate. Keep paired contracts in sync (e.g. the SYSTEM_PROMPT resume format and buildResumeDocx).
3. If the changes are purely cosmetic/internal, or not yet tested, do NOT edit CLAUDE.md - just note in one line that no doc update is needed and stop.
'@

$out = @{ decision = 'block'; reason = $reason } | ConvertTo-Json -Compress
Write-Output $out
exit 0
