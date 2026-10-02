import base64, re
src=open('app.src.html').read().replace('__DEMO_ZIP__',base64.b64encode(open('demo_old.zip','rb').read()).decode())
open('Требования_ОКК.html','w').write(src)
s=src
lib={'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js':'node_modules/xlsx-js-style/dist/xlsx.bundle.js','jszip/3.10.1/jszip.min.js':'node_modules/jszip/dist/jszip.min.js','pdf.js/3.11.174/pdf.min.js':'node_modules/pdfjs-dist/build/pdf.min.js'}
for k,v in lib.items():
    tag=f'<script src="{k if k.startswith("http") else "https://cdnjs.cloudflare.com/ajax/libs/"+k}"></script>'; assert tag in s; s=s.replace(tag,'<script>'+open(v).read()+'\n</script>')
w=open('node_modules/pdfjs-dist/build/pdf.worker.min.js').read()
a="const PDF_WORKER='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';"; assert a in s
s=s.replace(a,"const PDF_WORKER=URL.createObjectURL(new Blob([document.getElementById('pdfw').textContent],{type:'application/javascript'}));")
s=s.replace('<script>\nconst PDF_WORKER','<script type="text/plain" id="pdfw">'+w+'</script>\n<script>\nconst PDF_WORKER',1)
b="try{const blob=new Blob([`importScripts(${JSON.stringify(PDF_WORKER)});`],{type:'application/javascript'});L.GlobalWorkerOptions.workerPort=new Worker(URL.createObjectURL(blob));}"; assert b in s
s=s.replace(b,"try{L.GlobalWorkerOptions.workerPort=new Worker(PDF_WORKER);}")
open('Требования_ОКК_офлайн.html','w').write(s)
head='''<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icon-180.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="ОКК">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
'''
p=head+s.replace('<div class="app">','</head><body><div class="app">',1).replace('body{margin:0;','body{margin:0;padding-top:env(safe-area-inset-top,0px);',1)
p+="\n<script>if('serviceWorker' in navigator){addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));}</script>\n</body></html>"
open('pwa/index.html','w').write(p)
sw=open('pwa/sw.js').read(); m=re.search(r"okk-v(\d+)",sw); sw=sw.replace(m.group(0),f"okk-v{int(m.group(1))+1}"); open('pwa/sw.js','w').write(sw)
print('ok', re.search(r"okk-v\d+",sw).group(0))
