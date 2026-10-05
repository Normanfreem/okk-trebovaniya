#!/usr/bin/env bash
# Установка ОКК v2 рядом с программой лаборатории. Лабораторию НЕ трогает.
# Запуск из папки репозитория:  sudo bash deploy/install.sh <адрес> [ещё адрес ...]
#   например: sudo bash deploy/install.sh xn--80aiqasw.xn--p1ai okk.5-63-158-65.sslip.io
# Каждый адрес открывает программу полностью.
set -euo pipefail
HOST="${1:?Укажите адрес, например: sudo bash deploy/install.sh xn--80aiqasw.xn--p1ai okk.5-63-158-65.sslip.io}"
EXTRA=("${@:2}")
SRC="$(cd "$(dirname "$0")/.." && pwd)"
CADDY=/etc/caddy/Caddyfile
[ "$(id -u)" = 0 ] || { echo "Нужен sudo"; exit 1; }

echo "== 1. Проверка: порт 8001 свободен"
if ss -ltn | grep -q '127.0.0.1:8001\b' && ! systemctl is-active --quiet okk; then
  echo "Порт 8001 занят другой программой — остановка"; exit 1; fi

echo "== 2. Пакеты"
apt-get update -qq
apt-get install -y -qq python3-venv rsync >/dev/null

echo "== 3. Системный пользователь okk (без входа)"
id okk >/dev/null 2>&1 || useradd --system --home /opt/okk --shell /usr/sbin/nologin okk

echo "== 4. Папки /opt/okk (код) и /opt/okk-data (данные)"
install -d -o root -g okk -m 750 /opt/okk /opt/okk/app
install -d -o okk -g okk -m 700 /opt/okk-data /opt/okk-data/versions /opt/okk-data/backup
rsync -a --delete --exclude '.git' --exclude '__pycache__' "$SRC/" /opt/okk/app/
chown -R root:okk /opt/okk/app && chmod -R g+rX,o-rwx /opt/okk/app

echo "== 5. Python-окружение"
[ -x /opt/okk/venv/bin/python ] || python3 -m venv /opt/okk/venv
/opt/okk/venv/bin/pip install -q --upgrade pip
/opt/okk/venv/bin/pip install -q -r /opt/okk/app/server/requirements.txt
chown -R root:okk /opt/okk/venv && chmod -R g+rX,o-rwx /opt/okk/venv

echo "== 6. Служба okk"
install -m 644 /opt/okk/app/deploy/okk.service /etc/systemd/system/okk.service
systemctl daemon-reload
systemctl enable --now okk
sleep 2
curl -fsS http://127.0.0.1:8001/api/health >/dev/null && echo "служба отвечает"

echo "== 7. Caddy: только ДОБАВЛЯЕМ блоки для новых адресов"
BAK="$CADDY.bak-okk-$(date +%Y%m%d-%H%M%S)"; cp -a "$CADDY" "$BAK"; CHANGED=0
for H in "$HOST" "${EXTRA[@]}"; do
  if grep -q "^$H {" "$CADDY"; then echo "Блок для $H уже есть"; continue; fi
  CHANGED=1
  cat >> "$CADDY" <<CADDYBLOCK

# --- ОКК v2 (добавлено install.sh) ---
$H {
	encode gzip
	request_body {
		max_size 300MB
	}
	header {
		Strict-Transport-Security "max-age=31536000"
		X-Content-Type-Options nosniff
		Referrer-Policy no-referrer
		-Server
	}
	reverse_proxy 127.0.0.1:8001
}
CADDYBLOCK
done
if [ "$CHANGED" = 1 ]; then
  if ! caddy validate --config "$CADDY"; then
    echo "Проверка Caddyfile не прошла — возвращаю как было"; cp -a "$BAK" "$CADDY"; exit 1
  fi
  systemctl reload caddy
else
  rm -f "$BAK"; echo "Caddyfile не менялся"
fi

echo "== 8. Администратор"
if ! sudo -u okk OKK_DATA=/opt/okk-data /opt/okk/venv/bin/python /opt/okk/app/server/manage.py has-admin; then
  echo "Придумайте пароль администратора (логин ruslan):"
  sudo -u okk OKK_DATA=/opt/okk-data /opt/okk/venv/bin/python /opt/okk/app/server/manage.py create-admin ruslan "Руслан"
else
  echo "Администратор уже есть"
fi

echo "== 9. Ночная копия базы (хранится 30 дней)"
cat > /etc/cron.daily/okk-backup <<'CRON'
#!/bin/sh
sudo -u okk sqlite3 /opt/okk-data/okk.sqlite ".backup /opt/okk-data/backup/okk-$(date +%F).sqlite" 2>/dev/null || \
  sudo -u okk /opt/okk/venv/bin/python -c "import sqlite3,datetime;s=sqlite3.connect('/opt/okk-data/okk.sqlite');d=sqlite3.connect('/opt/okk-data/backup/okk-%s.sqlite'%datetime.date.today());s.backup(d)"
find /opt/okk-data/backup -name 'okk-*.sqlite' -mtime +30 -delete
CRON
chmod 755 /etc/cron.daily/okk-backup

echo
echo "ГОТОВО:  https://$HOST        панель:  https://$HOST/admin"
for H in "${EXTRA[@]}"; do echo "        https://$H        панель:  https://$H/admin"; done
echo "Лаборатория (служба lab, порт 8000) не затронута:"; systemctl is-active lab || true
