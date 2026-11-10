#!/usr/bin/env bash
# Запускать НА СЕРВЕРЕ (192.168.48.150), в консоли/SSH.
# Обновляет Раскрой так же, как локально (с токеном расчёта).
set -euo pipefail

DIR=/opt/raskroy/raskroy
IMAGE=192.168.48.150:3002/admin/raskroy:latest

# Токен: из окружения или из файла рядом
TOKEN="${VITE_CUT_API_TOKEN:-}"
if [ -z "$TOKEN" ] && [ -f "$DIR/.env" ]; then
  # shellcheck disable=SC1090
  TOKEN="$(grep -E '^VITE_CUT_API_TOKEN=' "$DIR/.env" | head -1 | cut -d= -f2- | tr -d '\r')"
fi
if [ -z "$TOKEN" ] && [ -f /opt/raskroy/.env ]; then
  TOKEN="$(grep -E '^VITE_CUT_API_TOKEN=' /opt/raskroy/.env | head -1 | cut -d= -f2- | tr -d '\r')"
fi
if [ -z "$TOKEN" ]; then
  echo "ERROR: задайте VITE_CUT_API_TOKEN (export или файл $DIR/.env)"
  exit 1
fi

mkdir -p /opt/raskroy
if [ ! -d "$DIR/.git" ]; then
  git clone https://github.com/Doktorina/Optimized-cutting-patterns.git "$DIR"
fi

cd "$DIR"
git fetch --all
git reset --hard origin/main
git pull --ff-only || true

echo "$TOKEN" | grep -q . 
printf 'VITE_CUT_API_TOKEN=%s\n' "$TOKEN" > .env

docker build --build-arg VITE_CUT_API_TOKEN="$TOKEN" -t "$IMAGE" .
docker compose up -d --force-recreate

echo
echo "OK. Проверьте http://192.168.48.150:8084"
echo "У пользователей: Ctrl+F5 (сброс кэша браузера)."
