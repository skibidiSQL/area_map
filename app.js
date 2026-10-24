/* Карта пространства: бессерверная PWA-версия (Supabase + IndexedDB). */
(() => {
const SUPABASE_URL = 'https://rlzgzbviuvkuzhcfyzcg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_STl70_TA-R8cRWX9qsw_DA_GxuGw0WZ';
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let BASE = location.origin + location.pathname.replace(/\/$/, '');
const PKG = window.__PKG || null,
      THREE_URL = 'vendor/three.min.js',
      EMB = /\/embed\/?$/.test(location.pathname);
let rec = null, role = 'view', st = 0;

const body = document.body,
      rnd = () => [...crypto.getRandomValues(new Uint8Array(12))].map(b => b.toString(36).padStart(2, '0')).join(''),
      view = v => body.dataset.v = v,
      nav_ = on => body.toggleAttribute('data-nav', on),
      dq = () => JSON.parse(localStorage.getItem('tk-del') || '[]'),
      dlg = h => { const d = $('#dlg'); d.firstElementChild.innerHTML = h; d.hidden = false; },
      undlg = () => $('#dlg').hidden = true,
      link = r => BASE + '/#/m/' + r.id + '/' + r.share.token,
      esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const DB = (() => {
  let p;
  const open = () => p || (p = new Promise((ok, no) => {
    const r = indexedDB.open('tk-spacemap', 1);
    r.onupgradeneeded = () => { r.result.createObjectStore('maps', { keyPath: 'id' }); };
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  }));
  const tx = async (s, m, f) => {
    const d = await open();
    return new Promise((ok, no) => { const t = d.transaction(s, m), q = f(t.objectStore(s)); t.oncomplete = () => ok(q && q.result); t.onerror = () => no(t.error); });
  };
  return { get: (s, k) => tx(s, 'readonly', o => o.get(k)), put: (s, v) => tx(s, 'readwrite', o => o.put(v)),
           del: (s, k) => tx(s, 'readwrite', o => o.delete(k)), all: s => tx(s, 'readonly', o => o.getAll()) };
})();
const mine = async () => (await DB.all('maps')).sort((a, b) => b.updated - a.updated);

function deny(msg) {
  view('auth'); nav_(false);
  $('#auth').innerHTML = `<div class="card"><h3>Нет доступа</h3><p>${msg}</p>${EMB ? '' : '<div class="btns"><button class="pri" onclick="location.hash=\'\';location.reload()">На главную</button></div>'}</div>`;
}

async function nav() {
  const ms = await mine();
  $('#nav').innerHTML = `<div class="nh">Мои карты</div>` +
    (ms.map(m => `<div class="nr"><button class="ni${rec && rec.id == m.id ? ' on' : ''}" data-m="${m.id}">🗺 ${esc(m.name)}</button><button class="nx" data-x="${m.id}" aria-label="Удалить карту" title="Удалить">🗑</button></div>`).join('') || '<small style="padding:6px 12px">Карт пока нет</small>') +
    '<button class="ni" data-n="new">＋ Создать карту</button>';
}

function home(k) {
  view('home'); nav_(innerWidth >= 900);
  $('#home').innerHTML = k == 'new' ? `<div class="card"><h3>Новая карта пространства</h3><label>Название</label><input type="text" id="cn" maxlength="80"><label>Краткое описание (по желанию)</label><textarea id="cd"></textarea><div class="btns"><button data-a="cancel">Отмена</button><button class="pri" data-a="next">Далее</button></div></div>`
    : `<div><button class="plus" data-a="new" aria-label="Создать карту">+</button><div class="plus-t">Создать карту пространства</div></div>`;
}

async function leave() { if (st) { clearTimeout(st); await persist(); } }

$('#cab').onclick = async e => {
  if (e.target.id == 'nbk') return nav_(false);
  const b = e.target.closest('[data-n],[data-m],[data-a],[data-x]');
  if (!b) return;
  const d = b.dataset, a = d.n || d.a;
  
  if (d.m) { await leave(); openRec(await DB.get('maps', d.m), 'owner'); }
  if (a == 'new') { await leave(); rec = null; home('new'); if (innerWidth < 900) nav_(false); setTimeout(() => $('#cn').focus(), 50); }
  if (a == 'cancel') home();
  if (a == 'next') return createMap();
  if (d.x) {
    const m = await DB.get('maps', d.x);
    return dlg(`<h3>Удалить карту «${esc(m.name)}»?</h3><p>Она будет удалена безвозвратно.</p><div class="btns"><button data-d="cancel">Отмена</button><button class="pri" data-d="delmap" data-id="${m.id}">Удалить</button></div>`);
  }
  if (innerWidth < 900 && d.m) nav_(false);
  nav();
};
$('#hb').onclick = $('#bg').onclick = () => nav_();

async function createMap() {
  const name = $('#cn').value.trim();
  if (!name) return toast('Введите название');
  const r = { id: rnd(), name, desc: $('#cd').value.trim(), share: { mode: 'off', token: rnd() },
              data: { name, bg: null, cor: [], rooms: [], pois: [], panos: [] }, updated: Date.now(), dirty: true };
  try { await DB.put('maps', r); } catch { return toast('Не удалось сохранить карту'); }
  openRec(r, 'owner'); sync();
}

function openRec(r, ro, solo) {
  rec = r; role = ro;
  body.toggleAttribute('data-solo', !!solo);
  $('#shr').hidden = ro != 'owner' && ro != 'edit'; 
  view('map'); nav_(!solo && innerWidth >= 900);
  Core.open(r.data, ro);
  nav();
}

Core.onSave = d => {
  if (!rec || role == 'view') return;
  rec.data = d; rec.name = d.name || rec.name; rec.updated = Date.now(); rec.dirty = true;
  clearTimeout(st); st = setTimeout(persist, 500);
};

async function persist(r = rec) {
  st = 0;
  if (!r) return;
  try { await DB.put('maps', r); } catch { toast('Не удалось сохранить карту локально'); }
  nav(); sync();
}

async function sync() {
  if (!navigator.onLine) return;
  
  for (const id of dq()) {
    await supabase.from('maps').delete().eq('id', id);
    localStorage.setItem('tk-del', JSON.stringify(dq().filter(x => x != id)));
  }
  
  let all = [];
  try { all = await DB.all('maps'); } catch { return; }
  
  for (const m of all.filter(m => m.dirty && !dq().includes(m.id))) {
    const { error } = await supabase.from('maps').upsert({
      id: m.id, name: m.name, desc: m.desc,
      share_mode: m.share.mode, share_token: m.share.token,
      data: m.data, updated: m.updated
    });
    if (!error) { m.dirty = false; await DB.put('maps', m); }
  }
}

async function pull() {
  if (!navigator.onLine) return;
  for (const l of await mine()) {
    const { data: x } = await supabase.from('maps').select('*').eq('id', l.id).single();
    if (x && x.updated > l.updated) {
      await DB.put('maps', {
        id: x.id, name: x.name, desc: x.desc,
        share: { mode: x.share_mode, token: x.share_token },
        data: x.data, updated: Number(x.updated), dirty: false
      });
    }
  }
}

function dropRemote(id) { localStorage.setItem('tk-del', JSON.stringify([...dq(), id])); sync(); }

function shareDlg() {
  const m = rec.share.mode, o = (v, t) => `<option value="${v}"${m == v ? ' selected' : ''}>${t}</option>`;
  dlg(`<h3>Поделиться «${esc(rec.name)}»</h3><label>Доступ по ссылке</label><select id="sm">${o('off', '🔒 Только я')}${o('view', '👁 Все со ссылкой — посетитель (просмотр)')}${o('edit', '✏️ Все со ссылкой — организатор (редактирование)')}</select>` +
    (m == 'off' ? '<p><small>Ссылка не работает, пока вы не откроете доступ.</small></p>'
      : `<label>Ссылка</label><input type="text" id="sl" readonly value="${esc(link(rec))}"><div class="btns"><button class="pri" data-d="copy">Копировать ссылку</button><button data-d="reset">Новая ссылка</button></div><label>Встроить на сайт</label><textarea id="se" readonly rows="4">${esc(embedCode(rec))}</textarea><div class="btns"><button data-d="copyembed">Копировать код</button></div>`) +
    `<label>Без интернета</label><div class="btns" style="margin-top:0"><button data-d="pack">⬇ Офлайн-версия (.html)</button></div><p><small>Открывается на телефоне без сети.</small></p><div class="btns"><button class="pri" data-d="cancel">Готово</button></div>`);
}

const embedCode = r => `<iframe src="${BASE}/embed#/m/${r.id}/${r.share.token}" width="100%" height="640" style="border:0" allowfullscreen loading="lazy"></iframe>`;
const touch = () => { rec.updated = Date.now(); rec.dirty = true; persist(); };

async function pack() {
  toast('Готовлю файл…');
  try {
    const t = u => fetch(u).then(r => r.ok ? r.text() : Promise.reject(u)), z = s => s.replace(/<\/script/gi, '<\\/script');
    const [h, css, core, app, three] = await Promise.all(['index.html', 'style.css', 'script.js', 'app.js', THREE_URL].map(t)),
          r = rec.share.mode == 'edit' ? 'edit' : 'view',
          m = { ...rec, share: { mode: rec.share.mode, token: '' }, dirty: false },
          out = h.replace(/<link rel="stylesheet" href="style.css">/, () => `<style>${css}</style>`)
            .replace(/<script src="vendor\/three\.min\.js"><\/script>/, () => `<script>${z(three)}</script>`)
            .replace(/<script src="script.js"><\/script>/, () => `<script>window.__PKG=${z(JSON.stringify({ map: m, role: r }))}</script><script>${z(core)}</script>`)
            .replace(/<script src="app.js"><\/script>/, () => `<script>${z(app)}</script>`);
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], { type: 'text/html' }));
    a.download = (rec.name.replace(/[^\p{L}\p{N}]+/gu, '_') || 'map') + '.html';
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4e4);
  } catch { toast('Не удалось собрать файл'); }
}

$('#shr').onclick = shareDlg;
$('#dlg').onchange = e => { if (e.target.id == 'sm') { rec.share.mode = e.target.value; touch(); shareDlg(); } };
$('#dlg').onclick = async e => {
  if (e.target.id == 'dlg') return undlg();
  const d = (e.target.closest('[data-d]') || {}).dataset;
  if (!d) return;
  if (d.d == 'cancel') undlg();
  if (d.d == 'delmap') {
    const id = d.id; await DB.del('maps', id);
    if (rec && rec.id == id) { rec = null; home(); }
    undlg(); dropRemote(id); nav();
  }
  if (d.d == 'copy') { try { await navigator.clipboard.writeText(link(rec)); } catch { $('#sl').select(); document.execCommand('copy'); } toast('Ссылка скопирована'); }
  if (d.d == 'reset') { rec.share.token = rnd(); touch(); shareDlg(); toast('Старая ссылка больше не работает'); }
  if (d.d == 'copyembed') { try { await navigator.clipboard.writeText($('#se').value); } catch { $('#se').select(); document.execCommand('copy'); } toast('Код скопирован'); }
  if (d.d == 'pack') pack();
};

async function openLink(id, tok) {
  let r = null;
  try { r = await DB.get('maps', id); } catch {}
  
  if (navigator.onLine) {
    const { data: m } = await supabase.from('maps').select('*').eq('id', id).single();
    if (m) {
      const remote = { id: m.id, name: m.name, desc: m.desc, share: { mode: m.share_mode, token: m.share_token }, data: m.data, updated: Number(m.updated), dirty: false };
      if (!r || remote.updated >= r.updated) { r = remote; await DB.put('maps', r); if (!EMB) toast('Карта сохранена для офлайн-доступа'); }
    } else if (r && r.share.token !== tok) { await DB.del('maps', id); r = null; }
  }
  
  let ro = r && r.share.token === tok && r.share.mode != 'off' ? r.share.mode : null;
  if (!tok && r) ro = 'owner'; 
  if (EMB && ro) ro = 'view';
  
  if (!ro) return deny('Владелец закрыл доступ по этой ссылке или карта удалена.');
  openRec(r, ro, !!tok);
}

/* ---------- НОВАЯ ФУНКЦИЯ ДЛЯ ЗАГРУЗКИ ПАНОРАМ ---------- */
window.uploadPanorama = async function(file) {
  try {
    if (typeof toast === 'function') toast('Загрузка панорамы...');
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('panoramas')
      .upload(fileName, file);

    if (error) {
      console.error('Ошибка загрузки:', error);
      if (typeof toast === 'function') toast('Ошибка загрузки панорамы');
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('panoramas')
      .getPublicUrl(fileName);

    if (typeof toast === 'function') toast('Панорама успешно загружена!');
    return publicUrlData.publicUrl; 
  } catch (err) {
    console.error('Ошибка сети при загрузке:', err);
    return null;
  }
};
/* -------------------------------------------------------- */

(async () => {
  body.toggleAttribute('data-embed', EMB);
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !PKG) navigator.serviceWorker.register('sw.js').catch(() => {});
  addEventListener('online', () => { sync(); pull().then(nav); });
  addEventListener('hashchange', () => /^#\/m\//.test(location.hash) && location.reload());
  
  if (PKG) {
    let r = PKG.map;
    try { const o = await DB.get('maps', r.id); if (o && o.updated > r.updated) r = o; } catch {}
    return openRec(r, PKG.role, true);
  }
  
  const l = location.hash.match(/^#\/m\/([\w-]+)\/([\w-]*)/);
  if (l) return openLink(l[1], l[2]);
  
  if (EMB) return deny('Не указана карта для показа.');
  await nav(); home(); pull().then(nav); sync();
})();
})();