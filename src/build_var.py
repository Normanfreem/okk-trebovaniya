import os, shutil, re
src = open('pwa/index.html').read()
reg = "<script>if('serviceWorker' in navigator){addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}</script>"
assert reg in src
names = {'e': 'Справочник ОКК — вариант 3'}
for v in 'e':
    s = src.replace(reg, '')
    s = s.replace('<title>Требования ОКК</title>', f'<title>{names[v]}</title>', 1)
    s = s.replace('<link rel="manifest" href="manifest.webmanifest">', '', 1)
    i = s.index('<script>\nconst PDF_WORKER') if '<script>\nconst PDF_WORKER' in s else s.index('const VAR=')
    s = s.replace('const VAR=window.OKK_VAR||\'\';', f"const VAR='{v}';", 1)
    d = f'pwa_var/{v}'; os.makedirs(d, exist_ok=True)
    open(f'{d}/index.html', 'w').write(s)
    for f in ['data.okk', 'version.json', 'icon-180.png', 'icon-192.png']:
        shutil.copy(f'pwa/{f}', f'{d}/{f}')
    print(v, len(s), s.count("const VAR='"+v+"'"))
