# Quick Start Test Guide (Windows PowerShell)
# This script sets up and runs all tests

Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Solana Tap-to-Pay Test Suite - Quick Start (Windows)" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check if backend directory exists
if (-not (Test-Path "backend")) {
  Write-Host "❌ Error: backend directory not found" -ForegroundColor Red
  Write-Host "Please run this script from the project root" -ForegroundColor Yellow
  exit 1
}

Write-Host "✅ Found backend directory" -ForegroundColor Green
Write-Host ""

# Check if backend is running
Write-Host "🔍 Checking if backend is running on localhost:3001..." -ForegroundColor Yellow

$backendRunning = $false
try {
  $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
  if ($response.StatusCode -eq 200) {
    $backendRunning = $true
  }
} catch {
  $backendRunning = $false
}

if ($backendRunning) {
  Write-Host "✅ Backend is running" -ForegroundColor Green
} else {
  Write-Host "⚠️  Backend is not running" -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Starting backend..." -ForegroundColor Cyan
  
  Push-Location backend
  
  Write-Host "   Installing dependencies..." -ForegroundColor Gray
  npm install 2>&1 | Out-Null
  
  Write-Host "   Starting backend server..." -ForegroundColor Gray
  $backendProcess = Start-Process -FilePath "npm" -ArgumentList "start" -PassThru -NoNewWindow
  
  Write-Host "   Backend started (PID: $($backendProcess.Id))" -ForegroundColor Green
  Write-Host "   Waiting 3 seconds for startup..." -ForegroundColor Gray
  Start-Sleep -Seconds 3
  
  # Check if backend started
  $backendStarted = $false
  try {
    $response = Invoke-WebRequest -Uri "http://localhost:3001/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
      $backendStarted = $true
    }
  } catch {
    $backendStarted = $false
  }
  
  if ($backendStarted) {
    Write-Host "✅ Backend started successfully" -ForegroundColor Green
  } else {
    Write-Host "❌ Failed to start backend" -ForegroundColor Red
    Write-Host "   Try starting it manually: cd backend && npm start" -ForegroundColor Yellow
    Pop-Location
    exit 1
  }
  
  Pop-Location
}

Write-Host ""
Write-Host "📦 Installing test dependencies..." -ForegroundColor Yellow

Push-Location backend
npm install node-fetch 2>&1 | Out-Null
Write-Host "✅ Dependencies installed" -ForegroundColor Green
Write-Host ""

Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Running Test Suite" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Run all tests
& node examples/run-all-tests.js
$testExit = $LASTEXITCODE

Pop-Location

Write-Host ""
Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan

if ($testExit -eq 0) {
  Write-Host "  ✅ All tests passed!" -ForegroundColor Green
} else {
  Write-Host "  ❌ Some tests failed" -ForegroundColor Red
}

Write-Host "════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

exit $testExit
