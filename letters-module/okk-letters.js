/*!
 * okk-letters.js — реестр писем ОКК (поиск по полному тексту, статусы отмены, PDF).
 * Без зависимостей. Подключение:
 *   <div id="letters"></div>
 *   <script src="okk-letters.js"></script>
 *   <script>OKKLetters.mount(document.getElementById('letters'), {data: 'letters.json', pdfBase: 'pdf/'});</script>
 * Опции:
 *   data     — URL файла letters.json или уже загруженный объект {asof, letters:[...]}
 *   pdfBase  — путь к папке с PDF (по умолчанию 'pdf/')
 *   openPdf  — своя функция открытия PDF: (url, fileName, letter) => {...}; по умолчанию — новая вкладка
 *   title    — заголовок блока (по умолчанию «Письма»); '' — без заголовка
 * Цвета меняются CSS-переменными --okl-* на контейнере (см. CSS ниже).
 */
(function (global) {
  'use strict';

  var CSS = [
    '.okl{--okl-bg:#eef1f0;--okl-card:#fff;--okl-soft:#f4f7f6;--okl-ink:#172026;--okl-ink2:#4c5a61;--okl-ink3:#7d8a90;--okl-line:#d7dedc;--okl-line2:#bcc6c4;',
    '--okl-accent:#1d5a9c;--okl-accent-bg:#e3eef9;--okl-ok:#1f6b3f;--okl-ok-bg:#e1f2e7;--okl-bad:#a02929;--okl-bad-bg:#fbe5e5;--okl-warn:#8a5200;--okl-warn-bg:#fff0cf;--okl-mark:#ffe27a;',
    'font:15px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:var(--okl-ink);background:var(--okl-bg);padding:12px;box-sizing:border-box}',
    '.okl *{box-sizing:border-box}',
    '.okl-h{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin:0 0 8px}',
    '.okl-h h2{margin:0;font-size:20px;font-weight:600}',
    '.okl-h span{font-size:12px;color:var(--okl-ink3)}',
    '.okl-bar{display:flex;flex-direction:column;gap:8px;margin-bottom:8px}',
    '.okl-q{width:100%;font:inherit;font-size:16px;padding:10px 12px;border:1.5px solid var(--okl-line2);border-radius:10px;background:var(--okl-card);color:var(--okl-ink);outline:none}',
    '.okl-q:focus{border-color:var(--okl-accent)}',
    '.okl-chips{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none}',
    '.okl-chips button,.okl-chips select{flex:none;font:inherit;font-size:13px;border:1px solid var(--okl-line2);background:var(--okl-card);color:var(--okl-ink);border-radius:999px;padding:6px 12px;cursor:pointer}',
    '.okl-chips button.on{background:var(--okl-accent);border-color:var(--okl-accent);color:#fff}',
    '.okl-chips select{max-width:240px}',
    '.okl-cnt{font-size:12.5px;color:var(--okl-ink3);margin:2px 0 6px}',
    '.okl-list{display:flex;flex-direction:column;gap:8px}',
    '.okl-row{background:var(--okl-card);border:1px solid var(--okl-line);border-radius:8px;padding:10px 12px;display:flex;flex-direction:column;gap:5px}',
    '.okl-row.cancelled{box-shadow:inset 3px 0 0 #c43a3a}.okl-row.changed{box-shadow:inset 3px 0 0 #d99a1e}',
    '.okl-row.cancelled h3,.okl-row.cancelled .okl-sum{color:var(--okl-ink2)}',
    '.okl-row.hl{outline:2px solid var(--okl-accent);outline-offset:1px}',
    '.okl-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--okl-ink2)}',
    '.okl-st{margin-left:auto;font-size:11.5px;font-weight:500;border-radius:4px;padding:1px 7px}',
    '.okl-st.active{background:var(--okl-ok-bg);color:var(--okl-ok)}.okl-st.cancelled{background:var(--okl-bad-bg);color:var(--okl-bad)}.okl-st.changed{background:var(--okl-warn-bg);color:var(--okl-warn)}',
    '.okl-row h3{margin:0;font-size:15px;font-weight:500;line-height:1.35}',
    '.okl-sum{font-size:13.5px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    '.okl-row.open .okl-sum{display:block}',
    '.okl-note{font-size:13px;border-radius:5px;padding:5px 8px}',
    '.okl-note.cancelled{background:var(--okl-bad-bg);color:var(--okl-bad)}.okl-note.changed{background:var(--okl-warn-bg)}.okl-note.info{background:var(--okl-soft)}',
    '.okl-ref{border:0;background:none;padding:0;font:inherit;color:var(--okl-accent);text-decoration:underline;cursor:pointer;font-weight:500}',
    '.okl-snip{font-size:13px;background:var(--okl-soft);border-left:3px solid var(--okl-accent);border-radius:4px;padding:5px 8px}',
    '.okl-snip i{font-style:normal;color:var(--okl-ink2);font-size:12px}',
    '.okl-more{display:none;flex-direction:column;gap:6px}.okl-row.open .okl-more{display:flex}',
    '.okl-more dl{display:grid;grid-template-columns:120px minmax(0,1fr);gap:3px 10px;margin:2px 0 0;font-size:13px}',
    '.okl-more dt{color:var(--okl-ink2)}.okl-more dd{margin:0}',
    '.okl-ft{display:flex;flex-wrap:wrap;gap:5px;align-items:center}',
    '.okl-pdf{display:inline-flex;align-items:center;gap:6px;padding:3px 8px 3px 4px;border-radius:5px;font:inherit;font-size:12px;background:var(--okl-card);border:1px solid var(--okl-line2);cursor:pointer;color:var(--okl-ink)}',
    '.okl-pdf b{font-size:9px;font-weight:600;color:#fff;background:#1d3a5c;border-radius:3px;padding:1px 3px}',
    '.okl-exp{margin-left:auto;border:0;background:none;color:var(--okl-accent);font:inherit;font-size:12.5px;cursor:pointer;padding:3px 2px}',
    '.okl mark{background:var(--okl-mark);color:inherit}',
    '.okl-empty{text-align:center;color:var(--okl-ink3);padding:30px 0}',
    '@media (max-width:600px){.okl-more dl{grid-template-columns:1fr}.okl-more dt{margin-top:4px;font-size:12px}}'
  ].join('\n');

  // синонимы для поиска (короткое -> часть слова)
  var SYN = { 'кф': 'фильтрац', 'ку': 'уплотнен', 'жб': 'железобетон', 'ги': 'гидроизол', 'щпс': 'щебеночно-песчан', 'пгс': 'песчано-гравийн', 'f': 'морозост', 'w': 'водонепрониц' };
  var STL = { active: 'Действует', changed: 'Изменено', cancelled: 'Отменено' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/ё/g, 'е').replace(/[.\s/]+/g, ' ').trim(); }
  function has(t, w) { return t.indexOf(w) >= 0 || (SYN[w] && t.indexOf(SYN[w]) >= 0); }
  function dnum(d) { var m = String(d || '').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/); return m ? +m[3] * 10000 + +m[2] * 100 + +m[1] : 0; }
  function keyOf(n) { return String(n).replace(/[^0-9A-Za-zА-Яа-я]/g, '').toUpperCase(); }
  function plural(n, a, b, c) { n = Math.abs(n) % 100; var n1 = n % 10; if (n > 10 && n < 20) return c; if (n1 > 1 && n1 < 5) return b; if (n1 === 1) return a; return c; }
  function mark(html, words) {
    var ws = words.filter(function (w) { return w.length >= 2; }).map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); });
    if (!ws.length) return html;
    var re = new RegExp('(' + ws.join('|') + ')', 'gi');
    return html.replace(/(<[^>]*>)|([^<]+)/g, function (m, tag, txt) { return tag || txt.replace(re, '<mark>$1</mark>'); });
  }

  function mount(el, opt) {
    opt = opt || {};
    var pdfBase = opt.pdfBase == null ? 'pdf/' : opt.pdfBase;
    var openPdf = opt.openPdf || function (url) { window.open(url, '_blank'); };
    if (!document.getElementById('okl-css')) { var st = document.createElement('style'); st.id = 'okl-css'; st.textContent = CSS; document.head.appendChild(st); }
    el.classList.add('okl');
    el.innerHTML = '<div class="okl-empty">Загружаю письма…</div>';
    var S = { q: '', st: '', kon: '', open: {} }, L = [], asof = '';

    function start(d) {
      asof = d.asof || '';
      L = (d.letters || []).slice().sort(function (a, b) { return dnum(b.date) - dnum(a.date); });
      L.forEach(function (x, i) {
        x._i = i;
        x._head = norm([x.num, x.date, x.subj, x.sum, x.kw, (x.kons || []).join(' '), x.cat, x.from, x.reply, x.note, x.cancels, x.changes, x.cancelledBy, x.changedBy, (x.att || []).map(function (a) { return a.what; }).join(' ')].join(' '));
        x._body = norm([x.text || ''].concat(x.attText || []).join(' '));
      });
      var kons = {}; L.forEach(function (x) { (x.kons || []).forEach(function (k) { kons[k] = 1; }); });
      var cnt = { active: 0, changed: 0, cancelled: 0 }; L.forEach(function (x) { cnt[x.status] = (cnt[x.status] || 0) + 1; });
      el.innerHTML =
        (opt.title === '' ? '' : '<div class="okl-h"><h2>' + esc(opt.title || 'Письма') + '</h2><span>' + L.length + ' ' + plural(L.length, 'письмо', 'письма', 'писем') + ' · действуют ' + (cnt.active + cnt.changed) + ' · отменено ' + cnt.cancelled + (asof ? ' · на ' + esc(asof) : '') + '</span></div>') +
        '<div class="okl-bar"><input class="okl-q" type="search" placeholder="Поиск по тексту писем: щебень, Кф, 8002, свая…" autocomplete="off">' +
        '<div class="okl-chips"><button data-st="" class="on">Все</button><button data-st="active">Действуют</button><button data-st="changed">Изменены</button><button data-st="cancelled">Отменены</button>' +
        '<select data-kon><option value="">Все конструктивы</option>' + Object.keys(kons).sort(function (a, b) { return a.localeCompare(b, 'ru'); }).map(function (k) { return '<option>' + esc(k) + '</option>'; }).join('') + '</select></div></div>' +
        '<div class="okl-cnt"></div><div class="okl-list"></div>';
      var q = el.querySelector('.okl-q');
      q.addEventListener('input', function () { S.q = q.value; draw(); });
      el.querySelector('[data-kon]').addEventListener('change', function (e) { S.kon = e.target.value; draw(); });
      el.addEventListener('click', onClick);
      draw();
    }

    function find(ref) {
      var m = String(ref).match(/№\s*([^\s;]+)/); var k = keyOf(m ? m[1] : ref);
      for (var i = 0; i < L.length; i++) if (keyOf(L[i].num) === k) return L[i];
      return null;
    }
    function refs(txt) {
      return String(txt || '').split(/\n|;\s*(?=№)/).map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) {
        var x = find(s), m = s.match(/^(№\s*\S+(?:\s+от\s+[\d.]+)?)(.*)$/), head = m ? m[1] : s, rest = m ? m[2].replace(/^\s*:\s*/, '') : '';
        return x ? '<button class="okl-ref" data-go="' + x._i + '">' + esc(head) + '</button>' + (rest ? ' — ' + esc(rest) : '') : esc(s);
      }).join('<br>');
    }
    function snippet(x, words) {
      var parts = [{ t: x.text || '', w: 'письма' }].concat((x.attText || []).map(function (t, i) { return { t: t || '', w: 'приложения ' + (i + 1) }; }));
      for (var a = 0; a < words.length; a++) {
        var w = words[a]; if (w.length < 2) continue;
        for (var b = 0; b < parts.length; b++) {
          var p = parts[b], lo = p.t.toLowerCase().replace(/ё/g, 'е'), i = lo.indexOf(w); if (i < 0) continue;
          var s = Math.max(0, lo.lastIndexOf(' ', Math.max(0, i - 80))), e = Math.min(p.t.length, i + w.length + 120);
          return { where: p.w, text: (s > 0 ? '…' : '') + p.t.slice(s, e).replace(/\s+/g, ' ').trim() + (e < p.t.length ? '…' : '') };
        }
      }
      return null;
    }
    function row(x, words) {
      var ws = words.concat(words.map(function (w) { return SYN[w]; }).filter(Boolean));
      var inHead = words.every(function (w) { return has(x._head, w); });
      var sn = words.length && !inHead ? snippet(x, words) : null;
      var open = S.open[x._i] || (words.length && !inHead && !sn);
      var files = []; if (x.file) files.push({ f: x.file, w: 'Письмо', t: x.subj });
      (x.att || []).forEach(function (a, i) { if (a.file) files.push({ f: a.file, w: 'Прил. ' + (i + 1), t: a.what }); });
      var dl = [['От кого', x.from], ['Кому', x.to], ['Ответ на', x.reply], ['Категория', x.cat], ['Конструктив', (x.kons || []).join(', ')], ['Ключевые слова', x.kw]]
        .filter(function (p) { return p[1]; }).map(function (p) { return '<dt>' + p[0] + '</dt><dd>' + mark(esc(p[1]), ws) + '</dd>'; }).join('') +
        ((x.att || []).length ? '<dt>Приложения</dt><dd>' + x.att.map(function (a, i) { return (i + 1) + '. ' + esc(a.what); }).join('<br>') + '</dd>' : '');
      return '<article class="okl-row ' + x.status + (open ? ' open' : '') + '" data-i="' + x._i + '">' +
        '<div class="okl-top"><span>' + esc(x.date) + '</span><span>' + mark(esc('№ ' + x.num), ws) + '</span><span class="okl-st ' + x.status + '">' + STL[x.status] + '</span></div>' +
        '<h3>' + mark(esc(x.subj || '(без темы)'), ws) + '</h3>' +
        (x.status === 'cancelled' && x.cancelledBy ? '<div class="okl-note cancelled"><b>Отменено.</b> Взамен — ' + refs(x.cancelledBy) + '</div>' : '') +
        (x.status === 'changed' && x.changedBy ? '<div class="okl-note changed">Изменено: ' + refs(x.changedBy) + '</div>' : '') +
        '<div class="okl-sum">' + mark(esc(x.sum), ws) + '</div>' +
        (sn ? '<div class="okl-snip"><i>В тексте ' + esc(sn.where) + ':</i> ' + mark(esc(sn.text), ws) + '</div>' : '') +
        '<div class="okl-more">' +
        (x.cancels ? '<div class="okl-note info">Отменяет: ' + refs(x.cancels) + '</div>' : '') +
        (x.changes ? '<div class="okl-note info">Изменяет: ' + refs(x.changes) + '</div>' : '') +
        (x.note ? '<div class="okl-note info">' + esc(x.note) + '</div>' : '') +
        '<dl>' + dl + '</dl></div>' +
        '<div class="okl-ft">' + files.map(function (f) { return '<button class="okl-pdf" data-pdf="' + esc(f.f) + '" title="' + esc(f.t || f.f) + '"><b>PDF</b>' + esc(f.w) + '</button>'; }).join('') +
        '<button class="okl-exp">' + (open ? 'Свернуть' : 'Подробнее') + '</button></div></article>';
    }
    function draw() {
      var words = norm(S.q).split(' ').filter(Boolean);
      var R = L.filter(function (x) {
        if (S.st && x.status !== S.st) return false;
        if (S.kon && (x.kons || []).indexOf(S.kon) < 0) return false;
        return words.every(function (w) { return has(x._head, w) || has(x._body, w); });
      });
      el.querySelector('.okl-cnt').textContent = (words.length || S.st || S.kon) ? 'Найдено: ' + R.length : '';
      el.querySelector('.okl-list').innerHTML = R.length ? R.map(function (x) { return row(x, words); }).join('') : '<div class="okl-empty">Ничего не найдено</div>';
      [].forEach.call(el.querySelectorAll('[data-st]'), function (b) { b.classList.toggle('on', (b.getAttribute('data-st') || '') === S.st); });
    }
    function go(i) {
      var t = el.querySelector('.okl-row[data-i="' + i + '"]');
      if (!t) { S.q = ''; S.st = ''; S.kon = ''; el.querySelector('.okl-q').value = ''; el.querySelector('[data-kon]').value = ''; draw(); t = el.querySelector('.okl-row[data-i="' + i + '"]'); }
      if (!t) return;
      S.open[i] = true; t.classList.add('open'); t.querySelector('.okl-exp').textContent = 'Свернуть';
      t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      t.classList.add('hl'); setTimeout(function () { t.classList.remove('hl'); }, 1800);
    }
    function onClick(e) {
      var b = e.target.closest('button'); if (!b || !el.contains(b)) return;
      if (b.hasAttribute('data-st')) { S.st = b.getAttribute('data-st'); draw(); return; }
      if (b.hasAttribute('data-go')) { go(+b.getAttribute('data-go')); return; }
      var r = b.closest('.okl-row'); if (!r) return; var x = L[+r.getAttribute('data-i')];
      if (b.hasAttribute('data-pdf')) { var f = b.getAttribute('data-pdf'); openPdf(pdfBase + encodeURIComponent(f), f, x); return; }
      if (b.classList.contains('okl-exp')) { var o = !r.classList.contains('open'); r.classList.toggle('open', o); S.open[x._i] = o; b.textContent = o ? 'Свернуть' : 'Подробнее'; }
    }

    if (typeof opt.data === 'object' && opt.data) start(opt.data);
    else fetch(opt.data || 'letters.json').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(start).catch(function (e) { el.innerHTML = '<div class="okl-empty">Не удалось загрузить письма: ' + esc(e.message || e) + '</div>'; });

    return { search: function (s) { var q = el.querySelector('.okl-q'); if (q) { q.value = s; S.q = s; draw(); } }, letters: function () { return L; } };
  }

  global.OKKLetters = { mount: mount };
})(typeof window !== 'undefined' ? window : this);
