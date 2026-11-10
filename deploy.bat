@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo === Раскрой: выгрузка обновления на сервер ===
echo.

if not exist "docker-compose.yml" (
  echo Не найден docker-compose.yml
  pause
  exit /b 1
)

REM Берём image из docker-compose.yml
set "IMAGE="
for /f "usebackq tokens=*" %%L in (`findstr /R /C:"^[ ]*image:" "docker-compose.yml"`) do (
  set "LINE=%%L"
  set "LINE=!LINE:image:=!"
  for /f "tokens=* delims= " %%I in ("!LINE!") do set "IMAGE=%%I"
)
if not defined IMAGE (
  echo Не удалось прочитать image из docker-compose.yml
  pause
  exit /b 1
)
for /f "tokens=1 delims=/" %%A in ("!IMAGE!") do set "REGISTRY=%%A"

echo Registry: !REGISTRY!
echo Образ:    !IMAGE!
echo.

where docker >nul 2>&1
if errorlevel 1 (
  echo Docker не найден. Установите Docker Desktop и повторите.
  pause
  exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
  echo Docker не запущен. Запустите Docker Desktop.
  pause
  exit /b 1
)

REM Параметры из .env / .env.local
call :loadEnvFile ".env"
call :loadEnvFile ".env.local"

echo [1/3] Сборка образа...
docker compose build
if errorlevel 1 (
  echo Ошибка сборки.
  pause
  exit /b 1
)

echo.
echo [2/3] Вход в !REGISTRY! ...
docker login !REGISTRY!
if errorlevel 1 (
  echo Не удалось войти в registry.
  pause
  exit /b 1
)

echo.
echo [3/3] Загрузка образа на сервер...
docker compose push
if errorlevel 1 (
  echo Ошибка загрузки. Проверьте логин и права.
  pause
  exit /b 1
)

echo.
echo Образ загружен: !IMAGE!
echo На сервере в папке с docker-compose.yml:
echo   docker compose pull
echo   docker compose up -d
echo.
echo Готово.
pause
endlocal
exit /b 0

:loadEnvFile
if not exist "%~1" exit /b 0
for /f "usebackq tokens=1,* delims== eol=#" %%A in ("%~1") do (
  if /i "%%A"=="VITE_CUT_API_TOKEN" if not defined VITE_CUT_API_TOKEN set "VITE_CUT_API_TOKEN=%%B"
  if /i "%%A"=="CUT_API_ORIGIN" if not defined CUT_API_ORIGIN set "CUT_API_ORIGIN=%%B"
)
exit /b 0
