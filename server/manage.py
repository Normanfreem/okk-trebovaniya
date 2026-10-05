"""Служебные команды:
  python3 manage.py create-admin <логин> [ФИО]   — создать администратора (пароль спросит)
  python3 manage.py set-password <логин>         — сменить пароль
  python3 manage.py upload <архив.zip>           — загрузить данные (как из панели)
"""
import base64, getpass, json, os, secrets, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import app as A


def ask_pw():
    while True:
        p1 = getpass.getpass('Пароль (не меньше 8 символов): ')
        p2 = getpass.getpass('Ещё раз: ')
        if p1 != p2:
            print('Не совпадают'); continue
        if len(p1) < 8:
            print('Слишком короткий'); continue
        return p1


def main():
    if len(sys.argv) == 2 and sys.argv[1] == 'has-admin':
        A.init_db()
        with A.db() as c:
            return 0 if c.execute('SELECT 1 FROM users WHERE is_admin=1 AND active=1').fetchone() else 1
    if len(sys.argv) < 3:
        print(__doc__); return 1
    cmd, login = sys.argv[1], sys.argv[2].strip().lower()
    A.init_db()
    with A.db() as c:
        if cmd == 'create-admin':
            if c.execute('SELECT 1 FROM users WHERE login=?', (login,)).fetchone():
                print('Такой логин уже есть'); return 1
            pw = os.environ.get('OKK_ADMIN_PW') or ask_pw()
            h, s = A.hash_pw(pw)
            lv = c.execute('SELECT id FROM levels ORDER BY id LIMIT 1').fetchone()['id']
            c.execute('INSERT INTO users(login,name,pw_hash,pw_salt,level_id,active,is_admin,offline_days,dk,created) VALUES(?,?,?,?,?,1,1,35,?,?)',
                      (login, sys.argv[3] if len(sys.argv) > 3 else 'Администратор', h, s, lv, base64.b64encode(secrets.token_bytes(32)).decode(), A.now()))
            print('Администратор создан:', login)
        elif cmd == 'set-password':
            u = c.execute('SELECT id FROM users WHERE login=?', (login,)).fetchone()
            if not u:
                print('Нет такого логина'); return 1
            h, s = A.hash_pw(ask_pw())
            c.execute('UPDATE users SET pw_hash=?,pw_salt=? WHERE id=?', (h, s, u['id']))
            c.execute('DELETE FROM sessions WHERE user_id=?', (u['id'],))
            print('Пароль изменён')
        elif cmd == 'upload':
            raw = open(sys.argv[2], 'rb').read()
            asof, kons = A.inspect_zip(raw)
            cur = c.execute('INSERT INTO versions(ts,fname,asof,size,kons,active,by_login) VALUES(?,?,?,?,?,0,?)',
                            (A.now(), os.path.basename(sys.argv[2]), asof, len(raw), json.dumps(kons, ensure_ascii=False), 'manage'))
            vid = cur.lastrowid
            open(os.path.join(A.DATA, 'versions', f'{vid}.zip'), 'wb').write(raw)
            c.execute('UPDATE versions SET active=CASE WHEN id=? THEN 1 ELSE 0 END', (vid,))
            print('Загружено, версия', vid, asof, kons)
        else:
            print(__doc__); return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
