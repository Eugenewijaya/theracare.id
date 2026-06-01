param(
  [string]$OrgId = "org-lively-bird-08327342",
  [string]$ProjectId = "shy-breeze-07125943",
  [double]$DataTransferLimitGb = 5,
  [int]$WarnPercent = 80
)

$ErrorActionPreference = "Stop"

if ($DataTransferLimitGb -le 0) {
  throw "DataTransferLimitGb must be greater than 0."
}

$project = $null
$projectJson = npx.cmd neonctl projects get $ProjectId --output json
if ($LASTEXITCODE -eq 0 -and $projectJson) {
  $project = $projectJson | ConvertFrom-Json
} elseif ($OrgId) {
  $projectsJson = npx.cmd neonctl projects list --org-id $OrgId --output json
  if ($LASTEXITCODE -ne 0) {
    throw "Failed to read Neon project. Run neonctl auth first."
  }
  $projects = $projectsJson | ConvertFrom-Json
  $project = $projects | Where-Object { $_.id -eq $ProjectId } | Select-Object -First 1
}
if (-not $project) {
  throw "Project $ProjectId was not found."
}

$limitBytes = [double]$DataTransferLimitGb * 1024 * 1024 * 1024
$hasUsageMetric = $false
$usedBytes = $null
if ($null -ne $project.data_transfer_bytes) {
  $hasUsageMetric = $true
  $usedBytes = [double]$project.data_transfer_bytes
}
$percent = if ($hasUsageMetric -and $limitBytes -gt 0) { [math]::Round(($usedBytes / $limitBytes) * 100, 2) } else { $null }
$status = if (-not $hasUsageMetric) { "unknown" } elseif ($percent -ge 100) { "over_limit" } elseif ($percent -ge $WarnPercent) { "warning" } else { "ok" }

$result = [pscustomobject]@{
  status = $status
  projectId = $project.id
  projectName = $project.name
  dataTransferBytes = if ($hasUsageMetric) { [int64]$usedBytes } else { $null }
  dataTransferGb = if ($hasUsageMetric) { [math]::Round($usedBytes / 1GB, 3) } else { $null }
  assumedLimitGb = $DataTransferLimitGb
  usagePercent = $percent
  warnPercent = $WarnPercent
  quotaResetAtUtc = if ($project.consumption_period_end) { $project.consumption_period_end } else { $project.quota_reset_at }
  consumptionPeriodStartUtc = $project.consumption_period_start
  consumptionPeriodEndUtc = $project.consumption_period_end
  updatedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
}

$result | ConvertTo-Json -Depth 5

if ($status -ne "ok") {
  exit 2
}
