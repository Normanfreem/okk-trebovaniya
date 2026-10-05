# ОКК v2 — вход по логину, уровни доступа, журнал

Ставится рядом с программой лаборатории и её не трогает:
- код `/opt/okk/app`, окружение `/opt/okk/venv`, данные `/opt/okk-data`;
- системный пользователь `okk`, служба `okk`, порт `127.0.0.1:8001`;
- в `/etc/caddy/Caddyfile` только добавляется блок нового адреса (копия старого файла сохраняется рядом), затем `caddy validate` и `systemctl reload caddy`. Если проверка не прошла, файл возвращается как был.

Установка:  `sudo bash deploy/install.sh xn--80aiqasw.xn--p1ai okk.5-63-158-65.sslip.io` (оккадс.рф и адрес с IP; оба работают полностью)
Обновление: `sudo bash deploy/update.sh` (данные и Caddy не трогает)
Сменить пароль: `sudo -u okk OKK_DATA=/opt/okk-data /opt/okk/venv/bin/python /opt/okk/app/server/manage.py set-password ruslan`
Логи: `journalctl -u okk -n 100`
