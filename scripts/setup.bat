@echo off
REM =============================================================================
REM WE Accounting & Tax AI - Local Development Setup Script (Windows)
REM =============================================================================
REM Usage: scripts\setup.bat
REM =============================================================================

echo.
echo ========================================
echo  WE Accounting and Tax AI - Local Setup
echo ========================================
echo.

REM Check Node.js
echo [1/5] Checking Node.js...
node -v >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js is not installed
    echo Please install from https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=1 delims=." %%i in ('node -v') do set NODE_VER=%%i
set NODE_VER=%NODE_VER:~1%
echo       Node.js version: v%NODE_VER%.x
echo       [OK] Node.js installed

REM Install dependencies
echo.
echo [2/5] Installing dependencies...
call npm install
if errorlevel 1 (
    echo [ERROR] Failed to install dependencies
    pause
    exit /b 1
)
echo       [OK] Dependencies installed

REM Check .env file
echo.
echo [3/5] Checking environment configuration...
if not exist ".env" (
    echo       Creating .env from .env.example...
    copy .env.example .env >nul
    echo       [WARNING] Please edit .env with your credentials
) else (
    echo       [OK] .env file exists
)

REM Check Firebase config
echo.
echo [4/5] Checking Firebase configuration...
findstr /C:"your_firebase_api_key" .env >nul 2>&1
if not errorlevel 1 (
    echo       [WARNING] Firebase API key not configured
    echo       Please update FIREBASE_API_KEY in .env
) else (
    echo       [OK] Firebase appears configured
)

REM Check Gemini config
echo.
echo [5/5] Checking Gemini AI configuration...
findstr /C:"your_gemini_api_key" .env >nul 2>&1
if not errorlevel 1 (
    echo       [WARNING] Gemini API key not configured
    echo       Get key from: https://aistudio.google.com/app/apikey
) else (
    echo       [OK] Gemini API appears configured
)

echo.
echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo Next steps:
echo   1. Edit .env with your API keys
echo   2. Run: npm run dev
echo   3. Open: http://localhost:5173
echo.
echo Documentation:
echo   - Firebase: https://console.firebase.google.com
echo   - Gemini AI: https://aistudio.google.com
echo.
pause
