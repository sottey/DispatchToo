<#
.SYNOPSIS
    Dispatch CLI — launcher for the Dispatch task management app.

.DESCRIPTION
    Provides commands to set up, start, update, and manage your Dispatch instance.

.PARAMETER Command
    The command to run: setup, dev, start, build, update, seed, studio, test, help

.EXAMPLE
    .\dispatch.ps1 setup
    .\dispatch.ps1 dev
    .\dispatch.ps1 update
#>

param(
    [Parameter(Position = 0)]
    [ValidateSet("setup", "dev", "start", "build", "update", "seed", "studio", "test", "lint", "help", "version", "")]
    [string]$Command = ""
)

$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ── Version ───────────────────────────────────────────────────
$PackageJson = Get-Content -Raw -Path "$PSScriptRoot\package.json" | ConvertFrom-Json
$Version = $PackageJson.version

# ── Colors ────────────────────────────────────────────────────
function Write-Cyan    { param([string]$Text) Write-Host $Text -ForegroundColor Cyan -NoNewline }
function Write-CyanLn  { param([string]$Text) Write-Host $Text -ForegroundColor Cyan }
function Write-DimLn   { param([string]$Text) Write-Host $Text -ForegroundColor DarkGray }
function Write-GreenLn { param([string]$Text) Write-Host $Text -ForegroundColor Green }
function Write-YellowLn{ param([string]$Text) Write-Host $Text -ForegroundColor Yellow }
function Write-RedLn   { param([string]$Text) Write-Host $Text -ForegroundColor Red }

# ── Logo ──────────────────────────────────────────────────────
function Show-Logo {
    $logo = @(
        "  ____  ___ ____  ____   _  _____ ____ _   _ "
        " |  _ \\|_ _/ ___||  _ \\ / \\|_   _/ ___| | | |"
        " | | | || |\\___ \\| |_) / _ \\ | || |   | |_| |"
        " | |_| || | ___) |  __/ ___ \\| || |___|  _  |"
        " |____/|___|____/|_| /_/   \\_\\_| \\____|_| |_|"
    )
    Write-Host ""
    foreach ($line in $logo) {
        Write-Host $line -ForegroundColor Cyan
    }
    Write-Host ""
    Write-DimLn "  v$Version - Personal task & dispatch manager"
    Write-Host ""
}

# ── Help ──────────────────────────────────────────────────────
function Show-Help {
    Show-Logo

    Write-Host "  USAGE" -ForegroundColor White
    Write-Host "    .\dispatch.ps1 " -NoNewline; Write-CyanLn "<command>"
    Write-Host ""
    Write-Host "  COMMANDS" -ForegroundColor White

    $commands = @(
        @{ Cmd = "setup";   Desc = "Interactive first-time setup (configure .env, database, account)" }
        @{ Cmd = "dev";     Desc = "Start the development server (http://localhost:3000)" }
        @{ Cmd = "start";   Desc = "Start the production server" }
        @{ Cmd = "build";   Desc = "Create a production build" }
        @{ Cmd = "update";  Desc = "Pull latest changes, install deps, run migrations" }
        @{ Cmd = "seed";    Desc = "Load sample data into the database" }
        @{ Cmd = "studio";  Desc = "Open Drizzle Studio (database GUI)" }
        @{ Cmd = "test";    Desc = "Run the test suite" }
        @{ Cmd = "lint";    Desc = "Run ESLint" }
        @{ Cmd = "version"; Desc = "Show version number" }
        @{ Cmd = "help";    Desc = "Show this help message" }
    )

    foreach ($c in $commands) {
        Write-Host "    " -NoNewline
        Write-Host ("{0,-10}" -f $c.Cmd) -ForegroundColor Cyan -NoNewline
        Write-Host $c.Desc -ForegroundColor DarkGray
    }
    Write-Host ""
}

# ── Prerequisite checks ──────────────────────────────────────
function Assert-NodeModules {
    if (-not (Test-Path "$PSScriptRoot\node_modules")) {
        Write-YellowLn "  Dependencies not installed. Running npm install..."
        Write-Host ""
        Set-Location $PSScriptRoot
        npm install
        if ($LASTEXITCODE -ne 0) {
            Write-RedLn "  npm install failed. Please fix errors and retry."
            exit 1
        }
        Write-Host ""
    }
}

# ── Commands ──────────────────────────────────────────────────
function Invoke-Setup {
    Show-Logo
    Assert-NodeModules
    Set-Location $PSScriptRoot
    npx tsx scripts/setup.ts
}

function Invoke-Dev {
    Show-Logo
    Assert-NodeModules
    Write-GreenLn "  Starting development server..."
    Write-DimLn "  http://localhost:3000"
    Write-Host ""
    Set-Location $PSScriptRoot
    npm run dev
}

function Invoke-Start {
    Show-Logo
    Assert-NodeModules
    Write-GreenLn "  Starting production server..."
    Write-Host ""
    Set-Location $PSScriptRoot
    npm run start
}

function Invoke-Build {
    Show-Logo
    Assert-NodeModules
    Write-GreenLn "  Creating production build..."
    Write-Host ""
    Set-Location $PSScriptRoot
    npm run build
}

function Invoke-Update {
    Show-Logo
    Write-GreenLn "  Updating Dispatch..."
    Write-Host ""

    Set-Location $PSScriptRoot

    # Pull latest changes
    Write-Host "  [1/3] " -NoNewline; Write-CyanLn "Pulling latest changes..."
    git pull
    if ($LASTEXITCODE -ne 0) {
        Write-YellowLn "  Git pull failed - you may have local changes. Continuing anyway..."
    }
    Write-Host ""

    # Install dependencies
    Write-Host "  [2/3] " -NoNewline; Write-CyanLn "Installing dependencies..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-RedLn "  npm install failed."
        exit 1
    }
    Write-Host ""

    # Run migrations
    Write-Host "  [3/3] " -NoNewline; Write-CyanLn "Running database migrations..."
    npm run db:migrate
    if ($LASTEXITCODE -ne 0) {
        Write-YellowLn "  No pending migrations or migration failed. Check db:migrate output."
    }
    Write-Host ""

    Write-GreenLn "  Update complete!"
    Write-Host ""
}

function Invoke-Seed {
    Show-Logo
    Assert-NodeModules
    Write-GreenLn "  Seeding database with sample data..."
    Write-Host ""
    Set-Location $PSScriptRoot
    npm run db:seed
}

function Invoke-Studio {
    Show-Logo
    Assert-NodeModules
    Write-GreenLn "  Opening Drizzle Studio..."
    Write-DimLn "  Browse your database at https://local.drizzle.studio"
    Write-Host ""
    Set-Location $PSScriptRoot
    npm run db:studio
}

function Invoke-Test {
    Show-Logo
    Assert-NodeModules
    Write-GreenLn "  Running tests..."
    Write-Host ""
    Set-Location $PSScriptRoot
    npm test
}

function Invoke-Lint {
    Show-Logo
    Assert-NodeModules
    Write-GreenLn "  Running ESLint..."
    Write-Host ""
    Set-Location $PSScriptRoot
    npm run lint
}

# ── Route ─────────────────────────────────────────────────────
switch ($Command) {
    "setup"   { Invoke-Setup }
    "dev"     { Invoke-Dev }
    "start"   { Invoke-Start }
    "build"   { Invoke-Build }
    "update"  { Invoke-Update }
    "seed"    { Invoke-Seed }
    "studio"  { Invoke-Studio }
    "test"    { Invoke-Test }
    "lint"    { Invoke-Lint }
    "version" { Write-Host "Dispatch v$Version" }
    "help"    { Show-Help }
    default   { Show-Help }
}
