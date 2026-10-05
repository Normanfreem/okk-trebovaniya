/* ===================== v2: вход, права, журнал, предложения ===================== */
const REMOTE={on:true,ver:null};
const DEVICE=(()=>{const ua=navigator.userAgent;const m=/iPhone|iPad/.test(ua)?'iPhone/iPad':/Android/.test(ua)?'Android':/Windows/.test(ua)?'Windows':/Mac/.test(ua)?'Mac':'Другое';return m+(matchMedia('(display-mode: standalone)').matches?' · приложение':' · браузер');})();
let SESS=null; // {token,user,dk,lastCheck}
const can=p=>!!(SESS&&SESS.user&&(SESS.user.is_admin||SESS.user.perms&&SESS.user.perms[p]));
async function api(path,opt={}){
  const h=Object.assign({},opt.headers||{});
  if(SESS&&SESS.token) h['Authorization']='Bearer '+SESS.token;
  if(opt.json!==undefined){h['Content-Type']='application/json';opt.body=JSON.stringify(opt.json);}
  const r=await fetch(path,{method:opt.method||(opt.body?'POST':'GET'),headers:h,body:opt.body,cache:'no-store'});
  return r;
}
async function errText(r){try{const j=await r.json();return j.detail||('Ошибка '+r.status);}catch(e){return 'Ошибка '+r.status;}}
/* ---- журнал действий: очередь, уходит при появлении сети ---- */
let EVQ=[];
async function track(type,data){
  if(PREVIEW_AS) return;
  EVQ.push({type,data:data||{},ts:new Date().toISOString(),offline:!navigator.onLine,device:DEVICE});
  await put('kv','evq',EVQ); flushSoon();
}
let flushT=0; function flushSoon(){clearTimeout(flushT);flushT=setTimeout(flushEvents,1500);}
async function flushEvents(){
  if(!SESS||!navigator.onLine) return;
  const q=EVQ.slice(0,400); if(q.length){try{const r=await api('/api/events',{json:q});if(r.ok){EVQ=EVQ.slice(q.length);await put('kv','evq',EVQ);}}catch(e){}}
  let sq=(await get('kv','sgq'))||[];
  while(sq.length){try{const r=await api('/api/suggest',{json:sq[0]});if(!r.ok&&r.status!==403&&r.status!==400)break;sq.shift();await put('kv','sgq',sq);}catch(e){break;}}
}
window.addEventListener('online',()=>{flushEvents();serverSync(false);});
setInterval(flushEvents,30000);
/* ---- сохранить / стереть ---- */
async function saveSess(){if(!PREVIEW_AS) await put('kv','sess',SESS);}
async function wipe(msg){
  await clearAll(); D=null; PK=new Set(); SESS=null; EVQ=[]; S.stack=[]; S.tab='home';
  S.gate={err:msg||''}; render();
}
/* ---- загрузка своего пакета ---- */
async function decryptPack(buf,dkB64){
  const u=new Uint8Array(buf);
  if(String.fromCharCode(...u.slice(0,4))!=='OKK2') throw new Error('Повреждённый пакет');
  const key=await crypto.subtle.importKey('raw',Uint8Array.from(atob(dkB64),c=>c.charCodeAt(0)),'AES-GCM',false,['decrypt']);
  return await crypto.subtle.decrypt({name:'AES-GCM',iv:u.slice(4,16)},key,u.slice(16));
}
async function loadPack(ver){
  const r=await api('/api/pack'+(PREVIEW_AS?'?as_user='+encodeURIComponent(PREVIEW_AS):''));
  if(r.status===401){await wipe(await errText(r));return 'auth';}
  if(!r.ok) throw new Error(await errText(r));
  if(PREVIEW_AS){try{SESS.user=Object.assign({},SESS.user,{is_admin:false,perms:JSON.parse(atob(r.headers.get('X-Perms')||''))});}catch(e){}}
  const zip=await decryptPack(await r.arrayBuffer(),SESS.dk);
  // старые PDF убираем: права могли сузиться
  const keepData=await get('kv','data');
  await clearAll(); await put('kv','sess',SESS); await put('kv','evq',EVQ);
  if(keepData) await put('kv','data',keepData);
  const res=await importFiles([new File([zip],'data.zip')]);
  if(!res.failed){const d=await get('kv','data');d.remoteId=ver?ver.id:r.headers.get('X-Version');d.syncedAt=Date.now();d.demo=false;await put('kv','data',d);}
  await reload();
  return res;
}
/* ---- проверка на сервере ---- */
let syncing=false;
async function serverSync(manual){
  if(!SESS||syncing) return 'none';
  if(!navigator.onLine) return 'offline';
  syncing=true;
  try{
    let r; try{r=await api('/api/check',{method:'POST'});}catch(e){return 'offline';}
    if(r.status===401){await wipe(await errText(r));return 'auth';}
    if(!r.ok) return 'offline';
    const j=await r.json();
    SESS.user=j.user; SESS.lastCheck=Date.now(); await saveSess();
    flushEvents();
    if(j.version&&(!D||String(D.remoteId)!==String(j.version.id))){
      const res=await loadPack(j.version);
      if(res==='auth') return 'auth';
      S.stack=[]; render(); return 'updated';
    }
    if(manual) render();
    return 'same';
  }catch(e){return 'offline';}
  finally{syncing=false;}
}
/* ---- экран входа ---- */
function vGate(){
  setTop('Требования ОКК');
  const g=S.gate||{};
  $('main').innerHTML=`<div class="card"><div style="font-weight:600;font-size:17px;margin-bottom:6px">Вход</div><div class="note">Логин и пароль выдаёт ответственный ОКК. Первый вход — с интернетом, дальше приложение работает и без него.</div></div>
  <form id="gf" class="sec" autocomplete="on">
  <label class="search"><input id="lg" type="text" placeholder="Логин" autocomplete="username" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
  <label class="search"><input id="pw" type="password" placeholder="Пароль" autocomplete="current-password"></label>
  <div id="pwerr" class="msg m-err" ${g.err?'':'hidden'}>${esc(g.err||'')}</div>
  <button class="btn pri" id="go" type="submit">Войти</button></form>`;
  const er=t=>{$('pwerr').textContent=t;$('pwerr').hidden=false;$('go').textContent='Войти';$('go').disabled=false;};
  $('gf').onsubmit=async e=>{e.preventDefault();
    const lg=$('lg').value.trim(), pw=$('pw').value;
    if(!lg||!pw) return er('Введите логин и пароль');
    $('go').textContent='Вхожу…';$('go').disabled=true;
    let r; try{r=await api('/api/login',{json:{login:lg,password:pw,device:DEVICE}});}catch(x){return er('Нет связи с сервером. Для первого входа нужен интернет.');}
    if(!r.ok) return er(await errText(r));
    const j=await r.json();
    SESS={token:j.token,user:j.user,dk:j.dk,lastCheck:Date.now()}; await saveSess();
    $('go').textContent='Загружаю данные…';
    try{const res=await loadPack(j.version); if(res==='auth') return;}catch(x){return er('Не удалось загрузить данные: '+x.message);}
    S.gate=null; S.tab='home'; S.stack=[]; track('app_open',{first:true}); render();
  };
}
function vLocked(days){
  setTop('Требования ОКК');
  $('main').innerHTML=`<div class="card"><div style="font-weight:600;margin-bottom:6px">Нужна проверка доступа</div><div class="note">Приложение не связывалось с сервером больше ${days} дней. Подключитесь к интернету — проверка займёт секунду, и всё откроется.</div></div><button class="btn pri" id="rt">Проверить</button>`;
  $('rt').onclick=async()=>{$('rt').textContent='Проверяю…';const r=await serverSync(true);if(r==='offline'){$('rt').textContent='Нет связи — повторить';}else if(r==='same'||r==='updated'){render();}};
}
function vNoNet(){vLocked(SESS?SESS.user.offline_days:35);}
/* ---- данные и выход ---- */
function vData(){
  setTop('Данные и вход','',true);
  const u=SESS&&SESS.user||{};
  const last=SESS&&SESS.lastCheck?new Date(SESS.lastCheck).toLocaleString('ru-RU'):'—';
  let h=`<div class="card"><div style="font-weight:600">${esc(u.name||u.login||'')}</div><div class="note">Логин: ${esc(u.login||'')} · Уровень: ${esc(u.level||'')}${u.is_admin?' · администратор':''}</div></div>`;
  h+=`<div class="stat"><div><b>${esc(D&&D.asof||'—')}</b><small>актуально на</small></div><div><b>${D?D.reqs.filter(q=>q.status==='active').length:0}</b><small>требований</small></div><div><b>${D?D.docs.length:0}</b><small>документов</small></div></div>`;
  h+=`<button class="btn pri" id="sync">${I.upload}Проверить обновление</button><div class="note" id="syncmsg">Последняя проверка на сервере: ${esc(last)}. Без интернета приложение работает ${u.offline_days||35} дней с этого момента.</div>`;
  if(u.is_admin&&!PREVIEW_AS) h+=`<a class="btn" href="/admin" style="text-decoration:none;color:inherit">Панель администратора</a>`;
  if(!PREVIEW_AS) h+=`<button class="btn" id="out">Выйти на этом устройстве</button><div class="note">При выходе данные удаляются с устройства.</div>`;
  $('main').innerHTML=h;
  $('sync').onclick=async()=>{$('syncmsg').textContent='Проверяю…';const r=await serverSync(true);if(r==='same')$('syncmsg').textContent='У вас последняя версия.';else if(r==='offline')$('syncmsg').textContent='Нет связи. Попробуйте позже.';};
  if($('out')) $('out').onclick=async()=>{if(!confirm('Выйти? Данные будут удалены с этого устройства.'))return;await flushEvents();try{await api('/api/logout',{method:'POST'});}catch(e){}await wipe('');};
}
/* ---- предложение изменения ---- */
function openSuggest(kon,card,ids){
  const old=$('sgm'); if(old) old.remove();
  document.body.insertAdjacentHTML('beforeend',`<div class="dmodal" id="sgm"><div class="dw" style="max-width:640px;height:auto;align-self:center;background:var(--surface);border-radius:12px"><div class="dh" style="background:var(--nav)"><b>Предложить изменение</b><button id="sgx">Закрыть</button></div>
  <div style="padding:14px 16px;display:flex;flex-direction:column;gap:10px;color:var(--ink)"><div class="note">${esc(kon)} › ${esc(card)}</div>
  <textarea id="sgt" rows="6" style="width:100%;font:inherit;padding:10px;border:1px solid var(--line2);border-radius:8px;background:var(--surface);color:var(--ink)" placeholder="Что не так и как должно быть. Можно указать письмо или документ."></textarea>
  <div id="sgok" class="msg m-ok" hidden></div><button class="btn pri" id="sgs">Отправить ответственному ОКК</button></div></div></div>`);
  const close=()=>{const m=$('sgm');if(m)m.remove();};
  $('sgx').onclick=close; $('sgm').onclick=e=>{if(e.target.id==='sgm')close();};
  $('sgs').onclick=async()=>{const t=$('sgt').value.trim();if(!t)return;
    const it={kon,card,ids,text:t,ts:new Date().toISOString()};
    const sq=(await get('kv','sgq'))||[];sq.push(it);await put('kv','sgq',sq);
    track('suggest_create',{kon,card});
    $('sgok').textContent=navigator.onLine?'Отправлено.':'Сохранено. Уйдёт, когда появится интернет.';$('sgok').hidden=false;$('sgs').hidden=true;$('sgt').disabled=true;flushEvents();};
}
/* ---- старт ---- */
async function start(){
  try{await reload();}catch(e){}
  if(PREVIEW_AS){
    // просмотр глазами пользователя: отдельное хранилище, сеанс администратора берём из основного
    await clearAll();
    let main=null;try{main=JSON.parse(localStorage.getItem('okk-adm')||'null');}catch(e){}
    if(!main||!main.user||!main.user.is_admin) main=await new Promise(res=>{try{const r=indexedDB.open('okk-req',1);r.onsuccess=()=>{try{const g=r.result.transaction('kv').objectStore('kv').get('sess');g.onsuccess=()=>res(g.result);g.onerror=()=>res(null);}catch(e){res(null)}};r.onerror=()=>res(null);}catch(e){res(null)}});
    if(!main||!main.user||!main.user.is_admin){document.body.innerHTML='<p style="padding:20px;font:16px sans-serif">Просмотр доступен только администратору. Войдите в панель администратора и откройте просмотр оттуда.</p>';return;}
    SESS=Object.assign({},main);
    try{await loadPack(null);}catch(e){document.body.innerHTML='<p style="padding:20px;font:16px sans-serif">Не удалось загрузить: '+esc(e.message)+'</p>';return;}
    const pv=new URLSearchParams(location.search).get('name')||('пользователь #'+PREVIEW_AS);
    document.body.insertAdjacentHTML('afterbegin',`<div style="position:sticky;top:0;z-index:50;background:#8a5200;color:#fff;padding:8px 14px;font:600 14px var(--sans);text-align:center">Просмотр глазами: ${esc(pv)} — так видит этот человек. Действия не записываются.</div>`);
    render(); return;
  }
  SESS=await get('kv','sess')||null;
  EVQ=(await get('kv','evq'))||[];
  if(!SESS||!SESS.token){S.gate={};render();return;}
  const days=SESS.user&&SESS.user.offline_days||35;
  const expired=Date.now()-(SESS.lastCheck||0)>days*864e5;
  if(expired){const r=await serverSync(false); if(r==='auth') return; if(r==='offline'){vLocked(days);return;}}
  if(!D){const r=await serverSync(false); if(r!=='updated'){vLocked(days);} return;}
  render(); track('app_open',{}); serverSync(false);
}
start();
