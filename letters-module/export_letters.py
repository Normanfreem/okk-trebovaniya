"""Достаёт блок «Письма» из зашифрованного data.okk этого репозитория.

  pip install cryptography openpyxl
  python3 letters-module/export_letters.py --pwd <пароль> --out letters-module/data

Результат в --out: letters.json (119 писем с полным текстом) и pdf/ (письма и приложения).
Пароль спросить у владельца. Пароль и результат НЕ коммитить (репозиторий публичный).
"""
import argparse, hashlib, io, json, os, re, zipfile
import openpyxl
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ap = argparse.ArgumentParser()
ap.add_argument('--pwd', default=os.environ.get('OKK_PWD'))
ap.add_argument('--src', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data.okk'))
ap.add_argument('--out', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data'))
a = ap.parse_args()
assert a.pwd, 'Нужен пароль: --pwd или переменная OKK_PWD'
u = open(a.src, 'rb').read()
assert u[:4] == b'OKK1', 'Не тот формат data.okk'
key = hashlib.pbkdf2_hmac('sha256', a.pwd.encode(), u[4:20], 200000, 32)
try:
    zf = zipfile.ZipFile(io.BytesIO(AESGCM(key).decrypt(u[20:32], u[32:], None)))
except Exception:
    raise SystemExit('Неверный пароль')
xl = next(n for n in zf.namelist() if n.lower().endswith('.xlsx'))
ws = openpyxl.load_workbook(io.BytesIO(zf.read(xl)))['Письма']
H = [c.value for c in ws[1]]
T = json.loads(zf.read(next(n for n in zf.namelist() if n.endswith('_тексты писем.json'))))
pdfs = {n.split('/')[-1]: n for n in zf.namelist() if n.lower().endswith('.pdf')}
ST = {'Действует': 'active', 'Изменено частично': 'changed', 'Отменено': 'cancelled'}
clean = lambda t: re.sub(r'\n\s*\n+', '\n', re.sub(r'[ \t]+', ' ', t or '')).strip()
os.makedirs(os.path.join(a.out, 'pdf'), exist_ok=True)
L, used = [], set()
for r in ws.iter_rows(min_row=2, values_only=True):
    x = dict(zip(H, r))
    if not x.get('Номер'): continue
    att = []
    for l in str(x.get('Приложения') or '').split('\n'):
        if '|' in l:
            f, w = l.split('|', 1); f = f.strip()
            att.append({'file': '' if f in ('', '—') else f, 'what': w.strip()})
    g = lambda k: '' if x.get(k) is None else str(x[k])
    L.append({'num': g('Номер'), 'date': g('Дата'), 'from': g('От кого'), 'to': g('Кому'), 'reply': g('Ответ на'), 'subj': g('Тема'), 'sum': g('Суть'),
              'kw': g('Ключевые слова'), 'cat': g('Категория'), 'kons': [k.strip() for k in g('Конструктив').split(';') if k.strip()],
              'status': ST.get(g('Статус'), 'active'), 'cancelledBy': g('Отменено письмом'), 'cancels': g('Отменяет'), 'changedBy': g('Изменено письмом'),
              'changes': g('Изменяет'), 'note': g('Примечание'), 'file': g('Файл PDF'), 'att': att,
              'text': clean(T.get(g('Файл PDF'), '')), 'attText': [clean(T.get(t['file'], '')) for t in att if t['file']]})
    used.update([g('Файл PDF')] + [t['file'] for t in att if t['file']])
asof = ''
for r in openpyxl.load_workbook(io.BytesIO(zf.read(xl)))['Инфо'].iter_rows(values_only=True):
    if str(r[0]).lower().startswith('актуально'): asof = str(r[1])
json.dump({'asof': asof, 'object': 'ВСЖМ-1, 4 этап', 'letters': L}, open(os.path.join(a.out, 'letters.json'), 'w'), ensure_ascii=False, separators=(',', ':'))
n = 0
for f in used:
    if f in pdfs:
        open(os.path.join(a.out, 'pdf', f), 'wb').write(zf.read(pdfs[f])); n += 1
    elif f:
        print('нет PDF:', f)
print(f'Готово: {len(L)} писем, {n} PDF → {a.out}')
