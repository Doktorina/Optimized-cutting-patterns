@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo Push to GitHub — CI na servere soberet obraz:
echo   git push origin main
echo.
pause