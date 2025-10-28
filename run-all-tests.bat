@echo off
setlocal enableextensions enabledelayedexpansion

REM Usage: run-all-tests.bat [Release|Debug]
set "CONFIG=%~1"
if "%CONFIG%"=="" set "CONFIG=Release"

set "ROOT=%~dp0"
pushd "%ROOT%" >nul

REM ---------- Frontend (Vitest) ----------
set "FRONTEND_RC=1"
pushd "web" >nul
if not exist "node_modules" (
  echo [Web] Installing npm dependencies ^(first run^)...
  call npm ci
  if errorlevel 1 (
    set "FRONTEND_RC=1"
    goto :after_web
  )
)

echo [Web] Running Vitest with coverage...
call npm run test:coverage -- --run
set "FRONTEND_RC=%ERRORLEVEL%"

:after_web
popd >nul

REM ---------- Backend (CMake + CTest) ----------
set "BACKEND_RC=0"
if not exist "build" (
  mkdir build
)

if not exist "build\CMakeCache.txt" (
  echo [C++] Configuring CMake project...
  call cmake -S . -B build
  if errorlevel 1 (
    set "BACKEND_RC=1"
    goto :summary
  )
)

echo [C++] Building tests ^(config %CONFIG%^)...
call cmake --build build --config %CONFIG% --target network_tests
if errorlevel 1 (
  set "BACKEND_RC=1"
  goto :summary
)

echo [C++] Running CTest...
call ctest --test-dir build -C %CONFIG% --output-on-failure
set "TMP_RC=%ERRORLEVEL%"
if not "%TMP_RC%"=="0" set "BACKEND_RC=1"

:summary
set "FRONTEND_STATUS=PASS"
if not "%FRONTEND_RC%"=="0" set "FRONTEND_STATUS=FAIL"
set "BACKEND_STATUS=PASS"
if not "%BACKEND_RC%"=="0" set "BACKEND_STATUS=FAIL"

echo.
echo ==================== TEST SUMMARY ====================
echo Frontend ^(Vitest + coverage^): %FRONTEND_STATUS%
if exist "web\coverage\index.html" echo   Coverage report: %ROOT%web\coverage\index.html
echo Backend ^(Catch2 via CTest^): %BACKEND_STATUS%
echo ======================================================

set "EXIT_RC=0"
if not "%FRONTEND_STATUS%"=="PASS" set "EXIT_RC=1"
if not "%BACKEND_STATUS%"=="PASS" set "EXIT_RC=1"

endlocal & exit /b %EXIT_RC%
