Write-Host "================================" -ForegroundColor Cyan
Write-Host "        VIGIL - STARTUP         " -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$envFile = ".env"
if (-not (Test-Path $envFile)) {
    Write-Host "ERROR: .env file not found. Copy .env.example to .env first." -ForegroundColor Red
    exit 1
}

Write-Host "Checking .env configuration..." -ForegroundColor Yellow
$envContent = Get-Content $envFile
if ($envContent -match "TELEGRAM_BOT_TOKEN=") {
    Write-Host "  [OK] Telegram Bot Token" -ForegroundColor Green
}
if ($envContent -match "LLM_API_KEY=.+") {
    Write-Host "  [OK] LLM API Key" -ForegroundColor Green
} else {
    Write-Host "  [WARN] LLM API Key not set - agent will have limited responses" -ForegroundColor Yellow
}
if ($envContent -match "PRIVATE_KEY=.+") {
    Write-Host "  [OK] Wallet Private Key" -ForegroundColor Green
} else {
    Write-Host "  [WARN] Wallet Private Key not set" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "Starting services in separate windows..." -ForegroundColor Cyan

# Start Agent API
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$PWD`"; npm run agent:start; Read-Host 'Press Enter to exit'"

Start-Sleep -Seconds 3

# Start Telegram Bot
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$PWD`"; npm run bot:start; Read-Host 'Press Enter to exit'"

Start-Sleep -Seconds 2

# Start Dashboard
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$PWD\dashboard`"; npm run dev; Read-Host 'Press Enter to exit'"

Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Services starting up:" -ForegroundColor Cyan
Write-Host "  Agent API:     http://localhost:3001" -ForegroundColor White
Write-Host "  Dashboard:     http://localhost:3000" -ForegroundColor White
Write-Host "  Telegram Bot:  Running in background" -ForegroundColor White
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Close each window to stop the service." -ForegroundColor Gray
