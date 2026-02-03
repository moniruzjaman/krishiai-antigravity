# Krishi AI Backend Deployment Script
# This script deploys the backend to Vercel

Write-Host "Krishi AI Backend Deployment" -ForegroundColor Green
Write-Host "==============================" -ForegroundColor Green
Write-Host ""

# Navigate to backend directory
Set-Location -Path "krishi-ai-backend"

Write-Host "Checking Vercel configuration..." -ForegroundColor Cyan
if (Test-Path "vercel.json") {
    Write-Host "vercel.json found" -ForegroundColor Green
} else {
    Write-Host "vercel.json not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "IMPORTANT: Before deploying, ensure you've set these environment variables in Vercel Dashboard:" -ForegroundColor Yellow
Write-Host "   - SUPABASE_URL" -ForegroundColor White
Write-Host "   - SUPABASE_KEY" -ForegroundColor White
Write-Host "   - SUPABASE_SERVICE_KEY" -ForegroundColor White
Write-Host "   - GEMINI_API_KEY" -ForegroundColor White
Write-Host "   - HF_TOKEN" -ForegroundColor White
Write-Host "   - OPENAI_API_KEY" -ForegroundColor White
Write-Host "   - SECRET_KEY (generate new for production)" -ForegroundColor White
Write-Host "   - DEBUG=False" -ForegroundColor White
Write-Host "   - ENVIRONMENT=production" -ForegroundColor White
Write-Host "   - ALLOWED_ORIGINS (update after frontend deployment)" -ForegroundColor White
Write-Host ""

$continue = Read-Host "Have you set all environment variables in Vercel Dashboard? (y/n)"
if ($continue -ne "y") {
    Write-Host "Deployment cancelled. Please set environment variables first." -ForegroundColor Red
    Write-Host "Visit: https://vercel.com/dashboard" -ForegroundColor Cyan
    exit 0
}

Write-Host ""
Write-Host "Deploying to Vercel..." -ForegroundColor Cyan
vercel --prod

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Backend deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "   1. Copy the deployment URL" -ForegroundColor White
    Write-Host "   2. Use it as VITE_BACKEND_URL for frontend deployment" -ForegroundColor White
    Write-Host "   3. Update ALLOWED_ORIGINS in backend with frontend URL after frontend deployment" -ForegroundColor White
} else {
    Write-Host ""
    Write-Host "Deployment failed!" -ForegroundColor Red
    Write-Host "Check the error messages above" -ForegroundColor White
}

# Return to root directory
Set-Location -Path ".."
