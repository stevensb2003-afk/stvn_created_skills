<#
.SYNOPSIS
    Instalador Windows PowerShell de stvn_created_skills para Google Antigravity.

.EXAMPLE
    .\install.ps1 -All
    .\install.ps1 -Category ui-ux-and-design
    .\install.ps1 -Category tools
    .\install.ps1 -Skill steven-oauth-verifier
    .\install.ps1 -Target ".\.agents\skills"
#>
param(
    [switch]$All,
    [ValidateSet("", "crm-and-saas", "cloud-deploy-and-security", "ui-ux-and-design", "tools", "creative-agency-video")]
    [string]$Category = "",
    [string]$Skill = "",
    [string]$Target = "$env:USERPROFILE\.gemini\config\skills",
    [switch]$List
)

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Categories = @("crm-and-saas", "cloud-deploy-and-security", "ui-ux-and-design", "tools", "creative-agency-video")

if ($List) {
    foreach ($cat in $Categories) {
        $catDir = Join-Path $RepoRoot $cat
        if (Test-Path $catDir) {
            Write-Host "[$cat]"
            Get-ChildItem -Path $catDir -Directory | Where-Object { Test-Path (Join-Path $_.FullName "SKILL.md") } | ForEach-Object {
                Write-Host "  - $($_.Name)"
            }
        }
    }
    exit 0
}

New-Item -ItemType Directory -Force -Path $Target | Out-Null
$Count = 0

function Install-OneSkill([string]$SourceDir) {
    $name = Split-Path -Leaf $SourceDir
    $destDir = Join-Path $Target $name
    if (Test-Path $destDir) {
        Remove-Item -Recurse -Force $destDir
    }
    Copy-Item -Recurse -Force $SourceDir $destDir
    Write-Host "  [copy] $name -> $destDir"
}

if ($Skill) {
    $found = $null
    foreach ($cat in $Categories) {
        $candidate = Join-Path (Join-Path $RepoRoot $cat) $Skill
        if (Test-Path (Join-Path $candidate "SKILL.md")) {
            $found = $candidate
            break
        }
    }
    if (-not $found) {
        throw "No se encontró la skill '$Skill'."
    }
    Write-Host "Instalando skill '$Skill' en $Target..."
    Install-OneSkill $found
    $Count = 1
} else {
    $selected = if ($Category) { @($Category) } else { $Categories }
    Write-Host "Instalando skills en $Target..."
    foreach ($cat in $selected) {
        $catDir = Join-Path $RepoRoot $cat
        if (-not (Test-Path $catDir)) { continue }
        Write-Host "==> $cat"
        Get-ChildItem -Path $catDir -Directory | Where-Object { Test-Path (Join-Path $_.FullName "SKILL.md") } | ForEach-Object {
            Install-OneSkill $_.FullName
            $script:Count++
        }
    }
}

Write-Host ""
Write-Host "Listo: $Count skill(s) instaladas en $Target."
