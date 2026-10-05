#!/usr/bin/env bash
# Обновление кода ОКК v2. Данные (/opt/okk-data) и Caddy не трогает.
# Запуск из папки репозитория:  git pull && sudo bash deploy/update.sh
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
[ "$(id -u)" = 0 ] || { echo "Нужен sudo"; exit 1; }
rsync -a --delete --exclude '.git' --exclude '__pycache__' "$SRC/" /opt/okk/app/
chown -R root:okk /opt/okk/app && chmod -R g+rX,o-rwx /opt/okk/app
/opt/okk/venv/bin/pip install -q -r /opt/okk/app/server/requirements.txt
install -m 644 /opt/okk/app/deploy/okk.service /etc/systemd/system/okk.service
systemctl daemon-reload && systemctl restart okk && sleep 2
curl -fsS http://127.0.0.1:8001/api/health && echo " — обновлено"
