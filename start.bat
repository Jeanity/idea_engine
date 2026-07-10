@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo  HadIdea - startup
echo ============================================

REM --- Sanity checks -------------------------------------------------
if not exist ".env.local" (
    echo [ERROR] .env.local is missing. Copy .env.example to .env.local and fill it in.
    pause
    exit /b 1
)

findstr /b "INNGEST_DEV=1" .env.local >nul
if errorlevel 1 (
    echo [WARN] INNGEST_DEV=1 not found in .env.local - report generation will 500.
    echo        Add the line INNGEST_DEV=1 to .env.local.
    pause
)

if not exist "node_modules\" (
    echo [INFO] node_modules missing - running npm install first...
    call npm install
    if errorlevel 1 (
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

REM --- Start servers in their own windows ----------------------------
echo [1/2] Starting Next.js dev server (http://localhost:3000)...
start "HadIdea - Next.js" cmd /k "cd /d %~dp0 && npm run dev"

echo [2/2] Starting Inngest dev server (http://localhost:8288)...
start "HadIdea - Inngest" cmd /k "cd /d %~dp0 && npx inngest-cli@latest dev -u http://localhost:3000/api/inngest"

echo.
echo Both servers launched in separate windows.
echo   App:               http://localhost:3000
echo   Inngest dashboard: http://localhost:8288
echo.
echo Close those windows (or Ctrl+C in them) to stop the servers.
timeout /t 5 >nul
