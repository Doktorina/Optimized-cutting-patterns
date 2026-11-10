@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo Deploy is automatic via GitHub Actions.
echo 1) git push origin main
echo 2) Wait for green check: https://github.com/Doktorina/Optimized-cutting-patterns/actions
echo 3) On server ONCE: bash scripts/update-on-server.sh
echo    After that Watchtower updates the app by itself.
echo.
pause
