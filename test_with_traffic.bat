@echo off
echo === Testing Network Packet Capture with Active Traffic ===
echo.
echo This script will:
echo 1. Start the packet sniffer for 15 seconds
echo 2. Generate network traffic by pinging google.com
echo 3. Check the captured packets
echo.
pause

cd "%~dp0build\Release"

echo Starting packet capture in background...
start /B NetworkPacketAnalyzer.exe test_capture.csv auto both 15

echo Waiting 2 seconds for capture to initialize...
timeout /t 2 /nobreak > nul

echo Generating network traffic (pinging google.com)...
ping google.com -n 10

echo.
echo Waiting for capture to complete...
timeout /t 5 /nobreak > nul

echo.
echo === Checking captured data ===
if exist test_capture.csv (
    echo CSV file created!
    for %%A in (test_capture.csv) do echo File size: %%~zA bytes
    echo.
    echo First few lines:
    more /e +0 test_capture.csv | more /e +0 /p
) else (
    echo ERROR: CSV file not found!
)

pause
