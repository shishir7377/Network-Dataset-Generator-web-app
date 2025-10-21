@echo off
REM =======================================================
REM Network Dataset Generator - One-Click Setup Script
REM =======================================================
REM This script builds the C++ backend and installs
REM Node.js dependencies for the web frontend.
REM
REM Prerequisites:
REM - CMake 3.15+
REM - Visual Studio 2019+ with C++ tools
REM - Node.js 16+ and npm
REM - Npcap SDK installed
REM =======================================================

echo.
echo ========================================
echo  Network Dataset Generator Setup
echo ========================================
echo.

REM Check if running as Administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [WARNING] Not running as Administrator
    echo Some operations may require elevated privileges.
    echo.
)

REM ===============================================
REM Step 1: Build C++ Backend
REM ===============================================
echo [1/3] Building C++ Backend...
echo.

REM Check if build directory exists
if not exist "build\" (
    echo Creating build directory...
    mkdir build
)

cd build

REM Configure CMake (adjust Npcap SDK path if needed)
echo Configuring CMake...
echo.

REM Try common Npcap SDK locations
set NPCAP_SDK=
if exist "C:\npcap-sdk-1.13\Include" (
    set NPCAP_SDK=C:\npcap-sdk-1.13
) else if exist "C:\Program Files\Npcap SDK\Include" (
    set NPCAP_SDK=C:\Program Files\Npcap SDK
) else if exist "%USERPROFILE%\Downloads\npcap-sdk-1.13\Include" (
    set NPCAP_SDK=%USERPROFILE%\Downloads\npcap-sdk-1.13
)

if defined NPCAP_SDK (
    echo Found Npcap SDK at: %NPCAP_SDK%
    cmake .. -DPCAP_INCLUDE_DIR="%NPCAP_SDK%\Include" ^
             -DPCAP_LIBRARY="%NPCAP_SDK%\Lib\x64\wpcap.lib" ^
             -DPACKET_LIBRARY="%NPCAP_SDK%\Lib\x64\Packet.lib" ^
             -A x64
) else (
    echo [WARNING] Npcap SDK not found in common locations.
    echo Please specify the path manually or run CMake separately.
    echo Attempting CMake without explicit paths...
    cmake .. -A x64
)

if %errorLevel% neq 0 (
    echo.
    echo [ERROR] CMake configuration failed!
    echo.
    echo Please ensure:
    echo   1. CMake is installed and in PATH
    echo   2. Visual Studio C++ tools are installed
    echo   3. Npcap SDK is installed
    echo.
    echo Manual setup:
    echo   cmake .. -DPCAP_INCLUDE_DIR="path\to\npcap-sdk\Include" ^
    echo            -DPCAP_LIBRARY="path\to\npcap-sdk\Lib\x64\wpcap.lib" ^
    echo            -DPACKET_LIBRARY="path\to\npcap-sdk\Lib\x64\Packet.lib" ^
    echo            -A x64
    echo.
    cd ..
    pause
    exit /b 1
)

echo.
echo Building Release configuration...
cmake --build . --config Release

if %errorLevel% neq 0 (
    echo.
    echo [ERROR] Build failed!
    echo Check the error messages above.
    cd ..
    pause
    exit /b 1
)

cd ..

echo.
echo [SUCCESS] C++ backend built successfully!
echo Executable: build\Release\NetworkPacketAnalyzer.exe
echo.

REM ===============================================
REM Step 2: Install Node.js Dependencies
REM ===============================================
echo [2/3] Installing Node.js dependencies...
echo.

cd web

REM Check if Node.js is installed
where node >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] Node.js not found!
    echo Please install Node.js 16+ from https://nodejs.org/
    cd ..
    pause
    exit /b 1
)

REM Check if npm is installed
where npm >nul 2>&1
if %errorLevel% neq 0 (
    echo [ERROR] npm not found!
    echo Please install Node.js with npm from https://nodejs.org/
    cd ..
    pause
    exit /b 1
)

echo Installing npm packages...
call npm install

if %errorLevel% neq 0 (
    echo.
    echo [ERROR] npm install failed!
    echo Check your internet connection and try again.
    cd ..
    pause
    exit /b 1
)

cd ..

echo.
echo [SUCCESS] Node.js dependencies installed!
echo.

REM ===============================================
REM Step 3: Verify Installation
REM ===============================================
echo [3/3] Verifying installation...
echo.

set SETUP_SUCCESS=1

REM Check if executable exists
if exist "build\Release\NetworkPacketAnalyzer.exe" (
    echo [OK] C++ Backend: build\Release\NetworkPacketAnalyzer.exe
) else (
    echo [FAIL] C++ Backend executable not found
    set SETUP_SUCCESS=0
)

REM Check if node_modules exists
if exist "web\node_modules\" (
    echo [OK] Node.js Dependencies: web\node_modules\
) else (
    echo [FAIL] Node.js dependencies not installed
    set SETUP_SUCCESS=0
)

REM Check if Npcap is running
sc query npcap | find "RUNNING" >nul 2>&1
if %errorLevel% equ 0 (
    echo [OK] Npcap Service: Running
) else (
    echo [WARNING] Npcap Service: Not running or not installed
    echo           Install Npcap from https://npcap.com/
    set SETUP_SUCCESS=0
)

echo.

if %SETUP_SUCCESS% equ 1 (
    echo ========================================
    echo  Setup Complete! ^>^>^>^>
    echo ========================================
    echo.
    echo To start the application:
    echo   1. Open a NEW terminal as Administrator
    echo   2. cd web
    echo   3. npm run dev
    echo   4. Open http://localhost:3000
    echo.
    echo For CLI usage:
    echo   build\Release\NetworkPacketAnalyzer.exe --help
    echo.
) else (
    echo ========================================
    echo  Setup Incomplete
    echo ========================================
    echo.
    echo Please review the warnings/errors above.
    echo.
)

pause
