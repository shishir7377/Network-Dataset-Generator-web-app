@echo off

setlocal
set BASEURL=%1
if "%BASEURL%"=="" set BASEURL=http://localhost:3000

echo === Testing GET /api/interfaces ===
curl -sS -H "Accept: application/json" "%BASEURL%/api/interfaces"
echo.

echo === Starting short capture via POST /api/capture (2s) ===
curl -sS -X POST "%BASEURL%/api/capture" ^
	-H "Content-Type: application/json" ^
	-d "{\"output\":\"blackbox_simple.csv\",\"iface\":\"\",\"filter\":\"both\",\"duration\":2}"
echo.

echo Done.
endlocal & exit /b 0