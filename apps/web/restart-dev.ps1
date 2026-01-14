# Restart Dev Server Script
# This script stops any running npm dev server and starts a fresh one

Write-Host "🔄 Restarting Krishi AI Development Server..." -ForegroundColor Cyan

# Find and kill any existing node processes running vite
Write-Host "Stopping existing dev server..." -ForegroundColor Yellow
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -like "*vite*"
} | Stop-Process -Force -ErrorAction SilentlyContinue

# Wait a moment for processes to fully terminate
Start-Sleep -Seconds 2

# Start the dev server
Write-Host "Starting fresh dev server..." -ForegroundColor Green
npm run dev
