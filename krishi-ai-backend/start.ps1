# Activate virtual environment
.\venv\Scripts\Activate.ps1

Write-Host ""
Write-Host "Starting Krishi AI Backend Server..." -ForegroundColor Green
Write-Host "API will be available at: http://localhost:8000" -ForegroundColor Cyan
Write-Host "API Docs will be available at: http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""

# Start the server
python -m app.main
