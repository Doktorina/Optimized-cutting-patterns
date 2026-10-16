@echo off
chcp 65001 >nul
cd /d "%~dp0"

where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js / npm не найдены. Установите с https://nodejs.org
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Установка зависимостей...
  call npm install
  if errorlevel 1 (
    echo Ошибка npm install
    pause
    exit /b 1
  )
)

echo.
echo Запуск локального сервера...
echo Откроется http://127.0.0.1:5173
echo Остановка: Ctrl+C
echo.

start "" "http://127.0.0.1:5173"
call npm run dev -- --host 127.0.0.1 --port 5173

pause
