"""Сборка клиента v2: берёт исходник приложения v1 (/home/claude/okk/app.src.html),
вставляет вход/права/журнал (client_v2.js) и кладёт готовые файлы в web/."""
import os, re, shutil
HERE = os.path.dirname(os.path.abspath(__file__))
V1 = os.environ.get('OKK_V1', '/home/claude/okk')
WEB = os.path.join(HERE, 'web')
os.makedirs(WEB, exist_ok=True)
s = open(os.path.join(V1, 'app.src.html')).read()


def rep(old, new, cnt=1):
    global s
    assert old in s, 'не найдено: ' + old[:80]
    s = s.replace(old, new, cnt)


# 1. блок обновления/входа v1 -> v2
a = s.index('const REMOTE={on:false,ver:null};')
b = s.index('\nstart();', a) + len('\nstart();')
s = s[:a] + open(os.path.join(HERE, 'client_v2.js')).read() + s[b:]
# 2. отдельное хранилище для просмотра «глазами пользователя»
rep("const VAR=window.OKK_VAR||'e';", "const VAR=window.OKK_VAR||'e';\nconst PREVIEW_AS=new URLSearchParams(location.search).get('as');\nconst DBNAME=PREVIEW_AS?'okk-preview':'okk-req';")
rep("indexedDB.open('okk-req',1)", "indexedDB.open(DBNAME,1)")
# 3. журнал действий
rep("  setTop(k,'',true);", "  setTop(k,'',true);\n  if(!v.back) track('open_kon',{kon:k});")
rep("function openModal(v){", "function openModal(v){\n  track('open_doc',{doc:v.doc,page:v.page});")
rep("$('pq').oninput=()=>{S.pq=$('pq').value;applyF();};",
    "let pqT=0;$('pq').oninput=()=>{S.pq=$('pq').value;applyF();clearTimeout(pqT);pqT=setTimeout(()=>{if(S.pq.trim().length>1)track('search',{q:S.pq.trim(),kon:k});},2000);};")
rep("function doSearch(){\n  const q=norm(S.q); const res=$('res'), body=$('homeBody');",
    "let hsT=0;\nfunction doSearch(){\n  const q=norm(S.q); const res=$('res'), body=$('homeBody');\n  clearTimeout(hsT);hsT=setTimeout(()=>{if(S.q.trim().length>1)track('search',{q:S.q.trim()});},2000);")
rep("function matExport(name,tables){", "function matExport(name,tables){\n  track('export',{cat:name});")
rep("function vMatOne(v){", "function vMatOne(v){\n  if(!v.back) track('open_mat',{m:v.m});")
# 4. права: выгрузка
rep('<div class="mbar"><button class="xbtn" id="xls">${I.xls}<span>Скачать Excel</span></button></div>',
    '${can(\'export\')?`<div class="mbar"><button class="xbtn" id="xls">${I.xls}<span>Скачать Excel</span></button></div>`:\'\'}')
# 5. права: предложить изменение (кнопка в шапке карточки)
rep("""${c.bad?'<span class="tagbad">НЕ ДОПУСКАЕТСЯ</span>':''}${changed?' <span class="pill p-warn">изменено</span>':''}</div></div>""",
    """${c.bad?'<span class="tagbad">НЕ ДОПУСКАЕТСЯ</span>':''}${changed?' <span class="pill p-warn">изменено</span>':''}</div>${can('suggest')&&!PREVIEW_AS?`<button class="sgb" data-sg="${c.id}" aria-label="Предложить изменение">Предложить изменение</button>`:''}</div>""")
rep("  $('main').querySelectorAll('.dt').forEach(b=>b.onclick=()=>openModal({doc:b.dataset.doc,page:+b.dataset.page}));\n  const base=",
    "  $('main').querySelectorAll('.dt').forEach(b=>b.onclick=()=>openModal({doc:b.dataset.doc,page:+b.dataset.page}));\n  const bindSg=()=>$('main').querySelectorAll('.sgb').forEach(b=>b.onclick=()=>{let cc=null;secs.forEach(s=>s.cards.forEach(c=>{if(c.id===b.dataset.sg)cc=c;}));if(cc)openSuggest(k,cc.title,cc.ids);});bindSg();\n  const base=")
rep("    $('main').querySelectorAll('.dt').forEach(b=>b.onclick=()=>openModal({doc:b.dataset.doc,page:+b.dataset.page}));\n    $('main').querySelectorAll('#pchips button')",
    "    $('main').querySelectorAll('.dt').forEach(b=>b.onclick=()=>openModal({doc:b.dataset.doc,page:+b.dataset.page}));bindSg();\n    $('main').querySelectorAll('#pchips button')")
rep(".pch h3{", ".pch>div{flex:1;min-width:0}\n@media (max-width:640px){.pch{flex-wrap:wrap}.pch>div{flex:1 1 calc(100% - 50px)}.sgb{margin-left:46px;padding:5px 9px;font-size:12px}}\n.sgb{flex:none;border:1px solid var(--line2);background:var(--surface);border-radius:6px;padding:6px 10px;font-size:12.5px;cursor:pointer;color:var(--accent-ink)}\n.sgb:hover{border-color:var(--accent)}\n.pch h3{")
# 6. демо не нужно
s = s.replace('__DEMO_ZIP__', '')
s = s.replace("<title>Требования ОКК</title>", "<title>Требования ОКК</title>", 1)
open(os.path.join(HERE, 'app.v2.src.html'), 'w').write(s)

# ---- встраивание библиотек (офлайн) — как в build_all.py v1
lib = {'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js': 'node_modules/xlsx-js-style/dist/xlsx.bundle.js',
       'jszip/3.10.1/jszip.min.js': 'node_modules/jszip/dist/jszip.min.js', 'pdf.js/3.11.174/pdf.min.js': 'node_modules/pdfjs-dist/build/pdf.min.js'}
for k, v in lib.items():
    tag = f'<script src="{k if k.startswith("http") else "https://cdnjs.cloudflare.com/ajax/libs/" + k}"></script>'
    assert tag in s, tag
    s = s.replace(tag, '<script>' + open(os.path.join(V1, v)).read() + '\n</script>')
w = open(os.path.join(V1, 'node_modules/pdfjs-dist/build/pdf.worker.min.js')).read()
a1 = "const PDF_WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';"
assert a1 in s
s = s.replace(a1, "const PDF_WORKER=URL.createObjectURL(new Blob([document.getElementById('pdfw').textContent],{type:'application/javascript'}));")
s = s.replace('<script>\nconst PDF_WORKER', '<script type="text/plain" id="pdfw">' + w + '</script>\n<script>\nconst PDF_WORKER', 1)
b1 = "try{const blob=new Blob([`importScripts(${JSON.stringify(PDF_WORKER)});`],{type:'application/javascript'});L.GlobalWorkerOptions.workerPort=new Worker(URL.createObjectURL(blob));}"
assert b1 in s
s = s.replace(b1, "try{L.GlobalWorkerOptions.workerPort=new Worker(PDF_WORKER);}")
head = '''<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/icon-180.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="ОКК">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
'''
p = head + s.replace('<div class="app">', '</head><body><div class="app">', 1).replace('body{margin:0;', 'body{margin:0;padding-top:env(safe-area-inset-top,0px);', 1)
p += "\n<script>if('serviceWorker' in navigator&&!new URLSearchParams(location.search).get('as')){addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));}</script>\n</body></html>"
open(os.path.join(WEB, 'index.html'), 'w').write(p)
for f in ['icon-180.png', 'icon-192.png', 'icon-512.png']:
    shutil.copy(os.path.join(V1, 'pwa', f), os.path.join(WEB, f))
open(os.path.join(WEB, 'manifest.webmanifest'), 'w').write(open(os.path.join(V1, 'pwa', 'manifest.webmanifest')).read().replace('"./"', '"/"'))
# service worker v2
vf = os.path.join(HERE, '.swver'); n = int(open(vf).read()) + 1 if os.path.exists(vf) else 1; open(vf, 'w').write(str(n))
open(os.path.join(WEB, 'sw.js'), 'w').write("""const C='okk2-v%d';
const FILES=['/','/index.html','/manifest.webmanifest','/icon-180.png','/icon-192.png','/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
function timeout(ms){return new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms));}
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url); if(u.origin!==location.origin)return;
  if(u.pathname.startsWith('/api/')||u.pathname.startsWith('/admin'))return;
  const isPage=u.pathname==='/'||u.pathname==='/index.html';
  if(isPage){
    e.respondWith(Promise.race([fetch(e.request,{cache:'no-store'}),timeout(5000)]).then(r=>{if(r.ok){const cp=r.clone();caches.open(C).then(c=>c.put('/index.html',cp));}return r;})
      .catch(()=>caches.match('/index.html')));
    return;
  }
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));}return r;})));
});
""" % n)
print('ok', len(p), 'sw', n)
