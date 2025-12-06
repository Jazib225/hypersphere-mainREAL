# PowerShell script to start the backend server
Write-Host "Starting Hypersphere Backend..." -ForegroundColor Cyan

Set-Location backend

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
    npm install
}

Write-Host "Starting backend server on http://localhost:3001" -ForegroundColor Green
npm run dev

