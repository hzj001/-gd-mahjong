#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  cp .env.example .env
  echo "已创建 .env"
fi

echo ">>> docker compose up -d --build"
docker compose up -d --build

echo ">>> 等待 API..."
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:8080/health >/dev/null; then
    echo "OK  http://127.0.0.1:8080"
    exit 0
  fi
  sleep 2
done
echo "WARN 请查看: docker compose logs -f api"
exit 1
