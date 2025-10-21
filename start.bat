@echo off
REM Quick start script - Run the web application
REM (Assumes setup.bat has already been run)

echo.
echo Starting Network Dataset Generator...
echo.

REM Check if build exists
if not exist "build\Release\NetworkPacketAnalyzer.exe" (
    echo [ERROR] Backend not built yet!
    echo Please run setup.bat first.
    echo.
    pause
    exit /b 1
)

REM Check if node_modules exists
if not exist "web\node_modules\" (
    echo [ERROR] Node.js dependencies not installed!
    echo Please run setup.bat first.
    echo.
    pause
    exit /b 1
)

REM Check if running as Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ========================================
    echo  ADMINISTRATOR PRIVILEGES REQUIRED
    echo ========================================
    echo.
    echo Packet capture requires Administrator privileges.
    echo.
    echo Please:
    echo   1. Right-click this script
    echo   2. Select "Run as administrator"
    echo.
    pause
    exit /b 1
)

echo Backend: build\Release\NetworkPacketAnalyzer.exe [OK]
echo Frontend: web\node_modules\ [OK]
echo Privileges: Administrator [OK]
echo.
echo Starting development server...
echo Open http://localhost:3000 in your browser
echo.
echo Press Ctrl+C to stop the server
echo.

cd web
npm run dev
