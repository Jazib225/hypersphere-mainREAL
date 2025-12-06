# PowerShell script to start the frontend server
Write-Host "Starting Hypersphere Frontend..." -ForegroundColor Cyan

Set-Location frontend

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
    npm install
}

Write-Host "Starting frontend server on http://localhost:5173" -ForegroundColor Green
npm run dev

