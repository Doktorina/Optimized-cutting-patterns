#!/usr/bin/env bash
# Один раз на сервере — дальше обновления приходят сами с ghcr.io (Watchtower).
set -euo pipefail

DIR=/opt/raskroy/raskroy
REPO=https://github.com/Doktorina/Optimized-cutting-patterns.git

mkdir -p /opt/raskroy
if [ ! -d "$DIR/.git" ]; then
  git clone "$REPO" "$DIR"
fi

cd "$DIR"
git fetch --all
git reset --hard origin/main

docker compose pull
docker compose up -d

echo
echo "OK: http://SERVER:8084"
echo "Дальше: push в main на GitHub → через ~1–2 мин Watchtower обновит контейнер."
echo "Пользователям: Ctrl+F5"
