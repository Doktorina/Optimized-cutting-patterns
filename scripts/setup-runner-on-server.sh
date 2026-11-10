#!/usr/bin/env bash
# Запустить ОДИН РАЗ на сервере 192.168.48.150 под root/sudo.
# Ставит клон репо + GitHub Actions self-hosted runner с меткой raskroy.
set -euo pipefail

REPO_DIR=/opt/raskroy/raskroy
RUNNER_DIR=/opt/raskroy/actions-runner
REPO_URL=https://github.com/Doktorina/Optimized-cutting-patterns.git

echo "=== 1) Клон проекта ==="
mkdir -p /opt/raskroy
if [ ! -d "$REPO_DIR/.git" ]; then
  git clone "$REPO_URL" "$REPO_DIR"
else
  git -C "$REPO_DIR" pull --ff-only || true
fi

echo "=== 2) Скачать runner ==="
mkdir -p "$RUNNER_DIR"
cd "$RUNNER_DIR"
if [ ! -f ./config.sh ]; then
  curl -fsSL -o actions-runner-linux-x64.tar.gz \
    https://github.com/actions/runner/releases/download/v2.321.0/actions-runner-linux-x64-2.321.0.tar.gz
  tar xzf actions-runner-linux-x64.tar.gz
  rm -f actions-runner-linux-x64.tar.gz
fi

echo
echo "=== 3) Нужен токен регистрации runner ==="
echo "Откройте:"
echo "  https://github.com/Doktorina/Optimized-cutting-patterns/settings/actions/runners/new"
echo "Скопируйте токен (не ключ) и выполните:"
echo
echo "  cd $RUNNER_DIR"
echo "  ./config.sh --url https://github.com/Doktorina/Optimized-cutting-patterns --token ВАШ_ТОКЕН --labels raskroy --name raskroy-server --work _work"
echo "  sudo ./svc.sh install"
echo "  sudo ./svc.sh start"
echo
echo "Готово. После этого в Actions нажмите Run workflow."
