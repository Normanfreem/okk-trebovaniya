const C='okk-v24';
const FILES=['./','index.html','manifest.webmanifest','icon-180.png','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
function timeout(ms){return new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),ms));}
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url); if(u.origin!==location.origin)return;
  if(/\.okk$|version\.json$|pack\.html$/.test(u.pathname))return;
  const isPage=e.request.mode==='navigate'||/\/$|index\.html$/.test(u.pathname);
  if(isPage){
    // сначала свежая версия из сети, без сети — сохранённая
    e.respondWith(Promise.race([fetch(e.request,{cache:'no-store'}),timeout(5000)]).then(r=>{if(r.ok){const cp=r.clone();caches.open(C).then(c=>c.put('index.html',cp));}return r;})
      .catch(()=>caches.match('index.html').then(h=>h||caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));}return r;})));
});
