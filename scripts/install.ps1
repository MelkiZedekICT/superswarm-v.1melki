$ErrorActionPreference = "Stop"

foreach ($tool in @("git", "bun", "ollama")) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "Missing required command: $tool"
    }
}

$repo = Split-Path -Parent $PSScriptRoot
Push-Location $repo
try {
    bun install --frozen-lockfile
    Push-Location (Join-Path $repo "ui")
    try {
        bun install --frozen-lockfile
        bun run build
    } finally {
        Pop-Location
    }
    bun link
    Write-Host "Superswarm installed. Run: superswarm --help"
    Write-Host "Then initialize a Git project with: superswarm init --yes"
} finally {
    Pop-Location
}
