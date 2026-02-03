# Krishi AI Frontend Deployment Script
# This script deploys the frontend to Vercel

param(
    [string]$BackendUrl = ""
)

Write-Host "Krishi AI Frontend Deployment" -ForegroundColor Green
Write-Host "=============================" -ForegroundColor Green
Write-Host ""

# Navigate to frontend directory
Set-Location -Path "krishi-ai-2.0"

Write-Host "Checking Vercel configuration..." -ForegroundColor Cyan
if (Test-Path "vercel.json") {
    Write-Host "vercel.json found" -ForegroundColor Green
}
else {
    Write-Host "vercel.json not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "IMPORTANT: Before deploying, ensure you've set these environment variables in Vercel Dashboard:" -ForegroundColor Yellow
Write-Host "   - VITE_API_KEY (Gemini API Key)" -ForegroundColor White
Write-Host "   - VITE_HF_TOKEN" -ForegroundColor White
Write-Host "   - VITE_SUPABASE_URL" -ForegroundColor White
Write-Host "   - VITE_SUPABASE_KEY" -ForegroundColor White
Write-Host "   - VITE_GEMINI_API_KEY" -ForegroundColor White
Write-Host "   - VITE_OPENAI_API_KEY" -ForegroundColor White

if ($BackendUrl -eq "") {
    Write-Host ""
    $BackendUrl = Read-Host "Enter your backend URL (from previous deployment)"
}

Write-Host "   - VITE_BACKEND_URL=$BackendUrl" -ForegroundColor White
Write-Host ""

$continue = Read-Host "Have you set all environment variables in Vercel Dashboard? (y/n)"
if ($continue -ne "y") {
    Write-Host "Deployment cancelled. Please set environment variables first." -ForegroundColor Red
    Write-Host "Visit: https://vercel.com/dashboard" -ForegroundColor Cyan
    exit 0
}

Write-Host ""
Write-Host "Building and deploying to Vercel..." -ForegroundColor Cyan
vercel --prod

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "Frontend deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Final step:" -ForegroundColor Yellow
    Write-Host "   Update the backend's ALLOWED_ORIGINS environment variable" -ForegroundColor White
    Write-Host "   with your frontend URL in Vercel Dashboard" -ForegroundColor White
    Write-Host ""
    Write-Host "Deployment complete! Visit your app at the URL above." -ForegroundColor Green
}
else {
    Write-Host ""
    Write-Host "Deployment failed!" -ForegroundColor Red
    Write-Host "Check the error messages above" -ForegroundColor White
}

# Return to root directory
Set-Location -Path ".."
