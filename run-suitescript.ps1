<#
.SYNOPSIS
  Universal PowerShell launcher for NetSuite SuiteScript projects.
.DESCRIPTION
  Cross-platform PowerShell launcher for any NetSuite SuiteScript project using mock-netsuite.
  Automatically detects available scripts and provides interactive selection.
  Works on Windows, macOS, and Linux with PowerShell Core.
#>
param(
    [string]$ScriptName
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Function to detect if running on Windows
function Test-IsWindows {
    if ($PSVersionTable.PSVersion.Major -ge 6) {
        return $PSVersionTable.Platform -eq 'Win32NT'
    } else {
        # PowerShell 5.1 and earlier only run on Windows
        return $true
    }
}

$IsWindowsPlatform = Test-IsWindows

# Resolve script directory
$PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $PSScriptRoot
Write-Host "🚀 Starting NetSuite SuiteScript Runtime (PowerShell)..."
Write-Host "📁 Working directory: $PSScriptRoot"

# If node_modules doesn't exist or is empty, run the automated reinstall before continuing
try {
    $nmExists = Test-Path -Path "node_modules"
    $nmEmpty = $false
    if ($nmExists) {
        $entries = Get-ChildItem -Path "node_modules" -Force -ErrorAction SilentlyContinue
        if (-not $entries) { $nmEmpty = $true }
    }

    if (-not $nmExists -or $nmEmpty) {
        Write-Host "⚠️  node_modules missing or empty. Running automated reinstall..." -ForegroundColor Yellow
        # Run reinstall with AUTO_REINSTALL guard
        $env:AUTO_REINSTALL = '1'
        $result = Start-Process -FilePath 'npm' -ArgumentList 'run','reinstall' -NoNewWindow -Wait -PassThru
        if ($result.ExitCode -ne 0) {
            Write-Host "❌ Automated reinstall failed. Please run: AUTO_REINSTALL=1 npm run reinstall" -ForegroundColor Red
            exit 1
        }
        Write-Host "✅ Dependencies installed via automated reinstall. Continuing..." -ForegroundColor Green
    }
}
catch {
    Write-Host "⚠️  Error checking/installing dependencies: $_" -ForegroundColor Yellow
}

if (-Not (Test-Path -Path "src/suitescript" -PathType Container)) {
    Write-Host "❌ src/suitescript folder not found. Building from TypeScript sources..."
    if (-Not (Test-Path -Path "ts_src/suitescript" -PathType Container)) {
        Write-Host "❌ ts_src/suitescript folder not found. Make sure you're in the correct directory."
        exit 1
    }
    Write-Host "🔧 Building SuiteScript files..."
    npm run build
}

function Show-Scripts {
    Write-Host ""
    Write-Host "📝 Available Suitelet Scripts:" -ForegroundColor Yellow
    Write-Host "===============================" -ForegroundColor Yellow
    $i = 1
    Get-ChildItem -Path "src/suitescript" -Filter "sl_*.js" | ForEach-Object {
        $base = $_.BaseName
        Write-Host ("{0}) {1} (Suitelet)" -f $i, $base) -ForegroundColor White
        $i++
    }
    Write-Host ""
}

function Select-Script {
    Show-Scripts
    $scripts = @(Get-ChildItem -Path "src/suitescript" -Filter "sl_*.js" | ForEach-Object { $_.BaseName })
    if ($scripts.Count -eq 0) { 
        Write-Host "❌ No Suitelet scripts found in src/suitescript/ folder" -ForegroundColor Red
        exit 1 
    }

    # Use first Suitelet as default
    $defaultScript = $scripts[0]

    $prompt = "🎯 Select a script to run (1-{0}) or press Enter for default ({1}): " -f $scripts.Count, $defaultScript
    Write-Host $prompt -ForegroundColor Cyan -NoNewline
    $choice = Read-Host

    if ([string]::IsNullOrWhiteSpace($choice)) {
        Write-Host "✅ Using default: $defaultScript" -ForegroundColor Green
        return $defaultScript
    }
    if ($choice -match '^[0-9]+$' -and [int]$choice -ge 1 -and [int]$choice -le $scripts.Count) {
        $selectedScript = $scripts[[int]$choice - 1]
        Write-Host "✅ Selected: $selectedScript" -ForegroundColor Green
        return $selectedScript
    }
    Write-Host "✅ Invalid choice, using default: $defaultScript" -ForegroundColor Green
    return $defaultScript
}

if ($ScriptName) {
    if (Test-Path -Path "src/suitescript/$ScriptName.js" -PathType Leaf) {
        $selectedScript = $ScriptName
        Write-Host "✅ Running specific script: $selectedScript" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Script '$ScriptName.js' not found in src/suitescript/ folder" -ForegroundColor Red
        Show-Scripts
        exit 1
    }
}
else {
    $selectedScript = Select-Script
}
Write-Host ""

# Node check
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Node.js not found. Please install Node.js (>=20) and rerun."; exit 1
}
$nodeVersion = (& node --version) -replace "\r|\n",""
$nodeMajor = ([regex]::Match($nodeVersion, 'v?(\d+)')).Groups[1].Value

# Try to switch to Node 20 if not already using it
if ($nodeMajor -ne '20') {
    # Try to use nvm if available to switch to Node 20
    $nvmCommand = $null
    $switched = $false
    
    if (Get-Command nvm -ErrorAction SilentlyContinue) {
        $nvmCommand = "nvm"
    } elseif ($IsWindowsPlatform -and (Get-Command nvm.exe -ErrorAction SilentlyContinue)) {
        $nvmCommand = "nvm.exe"
    } elseif (-not $IsWindowsPlatform) {
        # On Unix systems, try to source nvm if available
        $nvmPath = "$env:HOME/.nvm/nvm.sh"
        if (Test-Path $nvmPath) {
            Write-Host "🔄 Attempting to switch to Node 20 with nvm..." -ForegroundColor Yellow
            # For PowerShell on Unix, we need to use bash to source nvm and switch
            try {
                $bashCommand = "source '$nvmPath' && nvm use 20 >/dev/null 2>&1 && which node"
                $nodePath = & bash -c $bashCommand 2>$null
                if ($LASTEXITCODE -eq 0 -and $nodePath) {
                    # Get the directory containing node
                    $nodePath = $nodePath.Trim()
                    $nodeDir = Split-Path -Parent $nodePath
                    if (Test-Path "$nodeDir/node") {
                        $env:PATH = "$nodeDir" + [IO.Path]::PathSeparator + $env:PATH
                        $nodeVersion = & node --version
                        $nodeMajor = ([regex]::Match($nodeVersion, 'v?(\d+)')).Groups[1].Value
                        Write-Host "✅ Switched to Node.js $nodeVersion using nvm" -ForegroundColor Green
                        $switched = $true
                        
                        # Check if native modules need rebuilding after Node version change
                        if (Test-Path "node_modules") {
                            Write-Host "🔧 Checking for native modules that may need rebuilding..." -ForegroundColor Cyan
                            try {
                                # Test if better-sqlite3 (common native module) works
                                node -e "require('better-sqlite3')" 2>$null
                                if ($LASTEXITCODE -ne 0) {
                                    Write-Host "🔧 Rebuilding native modules for current Node version..." -ForegroundColor Cyan
                                    npm rebuild --silent 2>$null
                                    if ($LASTEXITCODE -eq 0) {
                                        Write-Host "✅ Native modules rebuilt successfully" -ForegroundColor Green
                                    } else {
                                        Write-Host "⚠️ Native modules rebuild may have issues, but continuing..." -ForegroundColor Yellow
                                    }
                                }
                            }
                            catch {
                                # Continue silently if better-sqlite3 doesn't exist
                            }
                        }
                    }
                } else {
                    Write-Host "⚠️  nvm failed to switch to Node 20; continuing with installed Node $nodeVersion" -ForegroundColor Yellow
                }
            } catch {
                Write-Host "⚠️  Error during nvm switch: $_" -ForegroundColor Yellow
            }
        }
    }
    
    if ($nvmCommand) {
        Write-Host "🔄 Attempting to switch to Node 20 with nvm..." -ForegroundColor Yellow
        try {
            & $nvmCommand use 20 2>$null
            if ($LASTEXITCODE -eq 0) {
                $nodeVersion = (& node --version) -replace "\r|\n",""
                $nodeMajor = ([regex]::Match($nodeVersion, 'v?(\d+)')).Groups[1].Value
                Write-Host "✅ Switched to Node.js $nodeVersion using nvm" -ForegroundColor Green
                
                # Check if native modules need rebuilding after Node version change
                if (Test-Path "node_modules") {
                    Write-Host "🔧 Checking for native modules that may need rebuilding..." -ForegroundColor Cyan
                    try {
                        # Test if better-sqlite3 (common native module) works
                        node -e "require('better-sqlite3')" 2>$null
                        if ($LASTEXITCODE -ne 0) {
                            Write-Host "🔧 Rebuilding native modules for current Node version..." -ForegroundColor Cyan
                            npm rebuild --silent 2>$null
                            if ($LASTEXITCODE -eq 0) {
                                Write-Host "✅ Native modules rebuilt successfully" -ForegroundColor Green
                            } else {
                                Write-Host "⚠️ Native modules rebuild may have issues, but continuing..." -ForegroundColor Yellow
                            }
                        }
                    }
                    catch {
                        # Continue silently if better-sqlite3 doesn't exist
                    }
                }
            } else {
                Write-Host "⚠️  nvm failed to switch to Node 20; continuing with installed Node $nodeVersion" -ForegroundColor Yellow
            }
        } catch {
            Write-Host "⚠️  nvm not available to switch Node versions. Current Node: $nodeVersion" -ForegroundColor Yellow
        }
    }
}

Write-Host "✅ Using Node.js $nodeVersion"

# Enforce supported Node major versions (18,20,22) - only exit if really unsupported
if (-not ($nodeMajor -in @('18','20','22'))) {
    Write-Host "❗ Unsupported Node major version detected: $nodeVersion"
    Write-Host "Please switch to Node 18, 20, or 22 (recommended: 20). Example using nvm:"
    Write-Host "  nvm install 20 && nvm use 20"
    Write-Host "Exiting to avoid native module incompatibility (better-sqlite3)."
    exit 1
}

# Load .env if present
if (Test-Path -Path ".env") {
    Write-Host "🔧 Loading environment variables from .env..."
    Get-Content .env | Where-Object { $_ -and -not $_.StartsWith('#') } | ForEach-Object {
        $parts = $_ -split '=',2
        if ($parts.Count -eq 2) { [System.Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim()) }
    }
}

# Generic API key presence check
$hasApiKeys = $false
if (Test-Path -Path ".env") {
    $envContent = Get-Content .env -Raw -ErrorAction SilentlyContinue
    if ($envContent -match 'API_KEY') {
        $hasApiKeys = $true
        Write-Host "✅ Environment variables loaded successfully" -ForegroundColor Green
    }
}

if (-not $hasApiKeys -and (Test-Path -Path ".env.example")) {
    $exampleContent = Get-Content .env.example -Raw -ErrorAction SilentlyContinue
    if ($exampleContent -match 'API_KEY') {
        Write-Host "⚠️  API keys may not be set. Check your .env file." -ForegroundColor Yellow
        Write-Host "💡 You can copy .env.example to .env and set your API keys:" -ForegroundColor Cyan
        Write-Host "   cp .env.example .env" -ForegroundColor Cyan
        Write-Host "   # Then edit .env and set your API keys" -ForegroundColor Cyan
    }
}

# Gemini API key specific checks: detect missing file, missing key, or empty value and show explicit guidance
if (Test-Path -Path ".env") {
    $envRaw = Get-Content .env -Raw -ErrorAction SilentlyContinue
    if ($envRaw -match '(^|\n)\s*GEMINI_API_KEY\s*=') {
        # Key present in file; check if exported to environment or empty
        $geminiVal = [System.Environment]::GetEnvironmentVariable('GEMINI_API_KEY')
        if ([string]::IsNullOrEmpty($geminiVal)) {
            Write-Host "⚠️  .env contains GEMINI_API_KEY but it's empty. Add your API key to enable AI features." -ForegroundColor Yellow
            Write-Host "💡 Example: GEMINI_API_KEY=\"your_api_key_here\"" -ForegroundColor Cyan
        } else {
            Write-Host "✅ GEMINI_API_KEY is set - AI analysis will work!" -ForegroundColor Green
        }
    }
    else {
        Write-Host "⚠️  .env found but GEMINI_API_KEY is missing. AI functionality will be disabled until you add it." -ForegroundColor Yellow
        Write-Host "💡 Add a line like: GEMINI_API_KEY=\"your_api_key_here\" to .env" -ForegroundColor Cyan
    }
}
else {
    Write-Host "⚠️  .env file not found. GEMINI_API_KEY is not set — AI functionality will be disabled." -ForegroundColor Yellow
    Write-Host "💡 Create a .env file (copy .env.example) and add GEMINI_API_KEY to enable AI features." -ForegroundColor Cyan
}
Write-Host ""

# Kill process on port 3001 (Windows) or use portable fallbacks for non-Windows
Write-Host "🧹 Cleaning up existing processes using port 3001..."
try {
    if ($IsWindowsPlatform) {
        # PowerShell on Windows - prefer modern Get-NetTCPConnection
        if (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue) {
            $entry = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
        if ($entry) {
            $owningProcessId = $entry.OwningProcess
            Write-Host "Killing PID $owningProcessId (Windows)"
            Stop-Process -Id $owningProcessId -Force -ErrorAction SilentlyContinue
            }
        }
        else {
            # Fallback to netstat parsing on Windows
            $connections = netstat -ano | Select-String -Pattern ":3001\s" | ForEach-Object { 
                if ($_ -match '\s+([0-9]+)$') { $matches[1] }
            }
            if ($connections) { 
                $connections | ForEach-Object { 
                    $foundPid = $_
                    Write-Host "Killing PID $foundPid"
                    Stop-Process -Id $foundPid -Force -ErrorAction SilentlyContinue 
                } 
            }
        }
    }
    else {
        # Non-Windows platforms (macOS/Linux) - try lsof then netstat
        if (Get-Command lsof -ErrorAction SilentlyContinue) {
            $processIds = & lsof -ti:3001 2>$null
            if ($processIds) {
                $processIds -split "\r?\n" | ForEach-Object {
                    if ($_ -match '^\d+$') {
                        Write-Host "Killing PID $_ (lsof)"
                        Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
                    }
                }
            }
        }
        else {
            # Last resort: try netstat parsing (macOS/BSD style)
            if (Get-Command netstat -ErrorAction SilentlyContinue) {
                $out = & netstat -anp tcp 2>$null | Select-String ":3001" | Select-String "LISTEN"
                if ($out) {
                    # netstat output doesn't show PID on macOS; warn the user
                    Write-Host "⚠️  Found a listener on port 3001 but couldn't determine PID on this platform. Please kill it manually if needed."
                }
            }
        }
    }
}
catch {
    Write-Host "⚠️  Could not auto-kill port 3001: $_"
}

# Setup database (with fallback to rebuild native modules if needed)
Write-Host "🗄️ Setting up database..."
try {
    & npm run setup-db
}
catch {
    Write-Host "⚠️  setup-db failed. Attempting to rebuild native modules (better-sqlite3)..."
    try {
        # Try to update binary first
        & npm rebuild --update-binary
    }
    catch {
        Write-Host "⚠️  npm rebuild --update-binary failed, trying plain npm rebuild..."
        try { & npm rebuild } catch { Write-Host "⚠️  npm rebuild also failed: $_" }
    }

    Write-Host "🔁 Retrying setup-db..."
    try { & npm run setup-db } catch { Write-Host "❌ setup-db still failing: $_"; throw }
}

Write-Host "🚀 Starting selected script: $selectedScript..."
$scriptPath = Join-Path ((Get-Location).Path) "src/suitescript/$selectedScript.js"
$targetUrl = "http://localhost:3001/suitelet/${selectedScript}?id=1"

# Start the application with native PowerShell (cross-platform)
Write-Host "🟢 Starting with PowerShell cross-platform process management..."

# Set up environment variables for the process
$env:SUITELET_SCRIPT_PATH = $scriptPath
$env:FEATURED_SCRIPT = [IO.Path]::GetFileNameWithoutExtension($scriptPath)
$env:PORT = "3001"

Write-Host "🚀 Starting Mock NetSuite Server..."
Write-Host "📄 Script: $scriptPath"

# Function to recover from npm/runtime errors
function Recover-FromError {
    Write-Host "⚠️  Error detected. Attempting comprehensive recovery..." -ForegroundColor Yellow
    
    # Setup NVM environment
    Write-Host "🔧 Setting up Node.js environment..."
    $env:NVM_DIR = "$env:HOME\.nvm"
    if (Test-Path "$env:NVM_DIR\nvm.sh") {
        # On Unix-like systems with PowerShell Core
        if (-not $IsWindows) {
            & bash -c ". `$NVM_DIR/nvm.sh && nvm install 20 && nvm use 20"
        }
    }
    
    Write-Host "📋 Node version: $(node --version)"
    
    Write-Host "🧹 Removing node_modules..."
    if (Test-Path "node_modules") {
        Remove-Item -Recurse -Force "node_modules"
    }
    
    Write-Host "📦 Performing clean npm install..."
    npm ci
    
    Write-Host "� Checking mock-netsuite package..."
    npm list @scottybee84/mock-netsuite --depth=0
    
    Write-Host "🏗️ Building project..."
    npm run build
    
    Write-Host "✅ Recovery complete. Retrying..." -ForegroundColor Green
}

# Run with automatic recovery on failure
$attempt = 1
$maxAttempts = 2

while ($attempt -le $maxAttempts) {
    Write-Host "🎯 Attempt $attempt of $maxAttempts"

    # Precompute runtime and CLI entry paths
    $runtimeEntry = Join-Path (Join-Path ((Get-Location).Path) "node_modules") "@scottybee84/mock-netsuite/suitescript-runtime.js"
    $npxPath = $null
    try { $npxPath = (Get-Command npx -ErrorAction SilentlyContinue).Source } catch {}

    try {
        # First: try starting the direct runtime (deterministic)
        if (Test-Path $runtimeEntry) {
            Write-Host "🟢 Starting direct runtime first: $runtimeEntry" -ForegroundColor Cyan

            # Kill any lingering listeners just in case
            try { if (Get-Command lsof -ErrorAction SilentlyContinue) { & lsof -ti:3001 | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue } } } catch {}

            $nodeStartInfo = New-Object System.Diagnostics.ProcessStartInfo
            $nodeStartInfo.FileName = (Get-Command node).Source
            $nodeStartInfo.Arguments = "`"$runtimeEntry`""
            $nodeStartInfo.WorkingDirectory = (Get-Location).Path
            $nodeStartInfo.UseShellExecute = $false
            $nodeStartInfo.RedirectStandardOutput = $false
            $nodeStartInfo.RedirectStandardError = $false
            $nodeStartInfo.CreateNoWindow = $false
            $nodeStartInfo.EnvironmentVariables["SUITELET_SCRIPT_PATH"] = $scriptPath
            $nodeStartInfo.EnvironmentVariables["FEATURED_SCRIPT"] = [IO.Path]::GetFileNameWithoutExtension($scriptPath)
            $nodeStartInfo.EnvironmentVariables["PORT"] = "3001"

            $proc = [System.Diagnostics.Process]::Start($nodeStartInfo)

            Write-Host "⏳ Waiting for direct runtime to bind port 3001..."
            Start-Sleep -Seconds 2

            # Check listener
            $isListening = $false
            try {
                if (Get-Command lsof -ErrorAction SilentlyContinue) {
                    $listeners = & lsof -ti:3001 2>$null
                    if ($listeners) { $isListening = $true }
                } elseif (Get-Command netstat -ErrorAction SilentlyContinue) {
                    $out = & netstat -an | Select-String ":3001" | Select-String "LISTEN"
                    if ($out) { $isListening = $true }
                }
            } catch {}

            # Health-check the suitelet endpoint if listening
            if ($isListening) {
                $healthOk = $false
                for ($i = 0; $i -lt 6; $i++) {
                    try {
                        $resp = Invoke-WebRequest -Uri $targetUrl -Method Get -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
                        if ($resp.StatusCode -eq 200 -and $resp.Content -and $resp.Content.Length -gt 50) { $healthOk = $true; break }
                        if ($resp.StatusCode -eq 404) { break }
                    } catch {}
                    Start-Sleep -Seconds 1
                }

                if ($healthOk) {
                    Write-Host "✅ Direct runtime is healthy and serving the suitelet" -ForegroundColor Green
                } else {
                    Write-Host "⚠️ Direct runtime started but suitelet healthcheck failed or returned 404. Will try CLI fallback..." -ForegroundColor Yellow
                    try { if ($proc -and !$proc.HasExited) { $proc.Kill() } } catch {}
                    $isListening = $false
                }
            } else {
                Write-Host "⚠️ Direct runtime failed to bind port 3001" -ForegroundColor Yellow
                try { if ($proc -and !$proc.HasExited) { $proc.Kill() } } catch {}
            }
        }

        # If direct runtime didn't start or didn't serve the suitelet, try the CLI as a fallback
        if (-not $isListening -and $npxPath) {
            Write-Host "🔁 Attempting fallback: start package CLI via npx" -ForegroundColor Cyan
            Write-Host "🧪 Running: npx @scottybee84/mock-netsuite --runtime --suitelet `"$scriptPath`""

            $startInfo = New-Object System.Diagnostics.ProcessStartInfo
            $startInfo.FileName = $npxPath
            $quotedScriptPath = "`"$scriptPath`""
            $startInfo.Arguments = "@scottybee84/mock-netsuite --runtime --suitelet $quotedScriptPath"
            $startInfo.WorkingDirectory = (Get-Location).Path
            $startInfo.UseShellExecute = $false
            $startInfo.RedirectStandardOutput = $false
            $startInfo.RedirectStandardError = $false
            $startInfo.CreateNoWindow = $false
            $startInfo.EnvironmentVariables["SUITELET_SCRIPT_PATH"] = $scriptPath
            $startInfo.EnvironmentVariables["FEATURED_SCRIPT"] = [IO.Path]::GetFileNameWithoutExtension($scriptPath)
            $startInfo.EnvironmentVariables["PORT"] = "3001"

            $proc = [System.Diagnostics.Process]::Start($startInfo)
            Write-Host "⏳ Waiting for CLI to bind port 3001..."
            Start-Sleep -Seconds 1

            # Poll to see if the CLI started and the suitelet is available
            $healthOk = $false
            $shouldFallback = $false
            for ($i = 0; $i -lt 8; $i++) {
                try {
                    $resp = Invoke-WebRequest -Uri $targetUrl -Method Get -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
                    if ($resp.StatusCode -eq 200 -and $resp.Content -and $resp.Content.Length -gt 50) { $healthOk = $true; break }
                    if ($resp.StatusCode -eq 404) { $shouldFallback = $true; break }
                } catch {}
                Start-Sleep -Seconds 1
            }

            if ($healthOk) {
                $isListening = $true
                Write-Host "✅ CLI started and suitelet is serving" -ForegroundColor Green
            } elseif ($shouldFallback) {
                Write-Host "⚠️ CLI started but returned 404 for suitelet. Consider using direct runtime instead." -ForegroundColor Yellow
            } else {
                Write-Host "❌ CLI did not start or suitelet did not respond" -ForegroundColor Red
            }
        }

        if (-not $isListening) {
            throw "Unable to start a working runtime (direct runtime and CLI both failed)."
        }

        Write-Host "🧪 SuiteScript Runtime Server running on http://localhost:3001"
        Write-Host "🎯 Opening: $targetUrl"
        # Open browser
        if ($IsWindowsPlatform) { Start-Process $targetUrl } else { if (Get-Command open -ErrorAction SilentlyContinue) { & open $targetUrl } elseif (Get-Command xdg-open -ErrorAction SilentlyContinue) { & xdg-open $targetUrl } else { Write-Host "🌐 Please open: $targetUrl" } }

        Write-Host "🎮 Server is running! Press Ctrl+C to stop the server."
        Write-Host "Waiting for the runtime process to exit..."
        $proc.WaitForExit()
        Write-Host "✅ Server completed successfully" -ForegroundColor Green
        break

    } catch {
        Write-Host "❌ Attempt $attempt failed: $_" -ForegroundColor Red
        if ($attempt -lt $maxAttempts) { Recover-FromError; $attempt++ } else { Write-Host "💥 All attempts failed. Manual intervention required." -ForegroundColor Red; exit 1 }
    }
}

Write-Host "Process exited. Goodbye."
