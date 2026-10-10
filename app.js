/* Scaffale — inventario personale di libri, dischi e film.
   App web installabile (PWA). Dati sul telefono + copia su Google Drive. */
'use strict';

const VERSION = '1.4.1';
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const stripHtml = s => { const d = document.createElement('div'); d.innerHTML = String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n'); return (d.textContent || '').trim(); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmtDate = ts => new Date(ts).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTime = ts => new Date(ts).toLocaleString('it-IT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/* ── Tipi di oggetto ───────────────────────────────────────── */
const TIPI = {
  libro:    { label: 'Libro',    plural: 'Libri',    autore: 'Autore',  editore: 'Editore',      codice: 'ISBN',
              formati: ['Copertina rigida', 'Brossura', 'Tascabile', 'Edizione speciale', 'Fumetto'] },
  vinile:   { label: 'Vinile',   plural: 'Vinili',   autore: 'Artista', editore: 'Etichetta',    codice: 'Codice a barre', musica: true,
              formati: ['LP 33 giri', '45 giri (7")', 'EP', '10"', 'Maxi 12"', 'Box set'],
              confezioni: ['Copertina singola', 'Gatefold', 'Busta interna stampata', 'Box'],
              supporto: 'Disco', custodia: 'Copertina' },
  cd:       { label: 'CD',       plural: 'CD',       autore: 'Artista', editore: 'Etichetta',    codice: 'Codice a barre', musica: true,
              formati: ['CD', 'CD 8 cm', 'Enhanced CD', 'HDCD', 'SHM-CD', 'SACD ibrido', 'CD+G', 'CD-R'],
              confezioni: ['Jewel case', 'Digipak', 'Slipcase', 'Cardboard sleeve', 'Box'],
              supporto: 'Disco', custodia: 'Custodia e booklet' },
  cassetta: { label: 'Cassetta', plural: 'Cassette', autore: 'Artista', editore: 'Etichetta',    codice: 'Codice a barre', musica: true,
              formati: ['Cassetta', 'Microcassetta', 'DCC'],
              confezioni: ['Custodia standard', 'Slipcase', 'Box'],
              supporto: 'Nastro', custodia: 'J-card e custodia' },
  film:     { label: 'Film',     plural: 'Film',     autore: 'Regista', editore: 'Distributore', codice: 'Codice a barre',
              formati: ['DVD', 'Blu-ray', '4K UHD', 'VHS', 'Box set'] },
};
const isMusic = t => !!(TIPI[t] && TIPI[t].musica);
const CONDIZIONI = ['Nuovo / sigillato', 'Come nuovo', 'Ottimo', 'Buono', 'Discreto', 'Rovinato'];
const SPARS = ['DDD', 'ADD', 'AAD', 'DDA'];
const NASTRI = ['Tipo I (normale)', 'Tipo II (cromo)', 'Tipo IV (metal)'];
const RIDUZIONI = ['Nessuna', 'Dolby B', 'Dolby C', 'Dolby S', 'Dolby HX Pro', 'dbx'];
const ORIGINI = ['Originale stampata', 'Registrata in casa'];
const SPUNTE = {
  vinile:   [['inserto', 'Inserti / poster presenti']],
  cd:       [['booklet', 'Booklet presente'], ['obi', 'Obi strip'], ['custodiaRotta', 'Custodia da sostituire']],
  cassetta: [['jcard', 'J-card presente'], ['linguette', 'Linguette anti-registrazione intatte'], ['testato', 'Nastro testato, suona bene']],
};
const EMPTY = () => ({
  id: uid(), tipo: 'libro', titolo: '', autore: '', anno: '', editore: '', codice: '', formato: '', genere: '',
  descrizione: '', tracklist: '', pagine: '', durata: '', condizione: '', posizione: '', prezzo: '', valutazione: 0,
  catalogo: '', paese: '', confezione: '', condCustodia: '', numDischi: '', spars: '', matrice: '', ifpi: '',
  tipoNastro: '', riduzione: '', origine: '',
  note: '', commenti: [], foto: [], coverUrl: '', prestatoA: '', prestatoIl: '', desiderio: false,
  createdAt: Date.now(), updatedAt: Date.now(),
});
// Dati della versione 1.0: il tipo "musica" viene diviso in vinile / CD / cassetta
function detectMusicTipo(s) {
  s = String(s || '');
  if (/cassett|musicassetta|\bdcc\b|microcassette|tape/i.test(s)) return 'cassetta';
  if (/\bcd\b|compact disc|sacd|hdcd|shm-cd|cd-r|cd\+g/i.test(s)) return 'cd';
  if (/vinyl|vinile|\blp\b|45 giri|7"|10"|12"/i.test(s)) return 'vinile';
  return '';
}
function normalize(it) {
  if (it && it.tipo === 'musica') {
    it.tipo = detectMusicTipo(it.formato) || 'vinile';
    if (it.formato === 'Vinile LP') it.formato = 'LP 33 giri';
    else if (it.formato === 'Vinile 45 giri') it.formato = '45 giri (7")';
    else if (it.formato === 'Musicassetta') it.formato = 'Cassetta';
  }
  if (it && it.condizione === 'Nuovo') it.condizione = 'Nuovo / sigillato';
  return it;
}

/* ── Icone ─────────────────────────────────────────────────── */
const ICON = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  scan: '<path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2"/><path d="M8 8v8M11 8v8M14 8v8M17 8v8"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  cloud: '<path d="M7 18a5 5 0 1 1 .9-9.9A6 6 0 0 1 19 10a4 4 0 0 1-1 8H7z"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  hand: '<path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V12M14 11V6.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1a6 6 0 0 1-5-2.7L3 14.5a1.5 1.5 0 0 1 2.5-1.6L8 15"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>',
};
const ic = (n, size) => `<svg class="i" viewBox="0 0 24 24"${size ? ` style="width:${size}px;height:${size}px"` : ''}>${ICON[n]}</svg>`;

/* ── Configurazione ────────────────────────────────────────── */
const BASE = window.SCAFFALE_CONFIG || {};
function cfg(k) {
  const local = localStorage.getItem('cfg_' + k);
  if (local) return local;
  return { clientId: BASE.GOOGLE_CLIENT_ID, tmdbKey: BASE.TMDB_API_KEY, discogsToken: BASE.DISCOGS_TOKEN, booksKey: BASE.GOOGLE_BOOKS_KEY }[k] || '';
}
function setCfg(k, v) { v = String(v || '').trim(); v ? localStorage.setItem('cfg_' + k, v) : localStorage.removeItem('cfg_' + k); }

/* ── IndexedDB ─────────────────────────────────────────────── */
const DB = {
  db: null,
  open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('scaffale', 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('items', { keyPath: 'id' }); d.createObjectStore('photos', { keyPath: 'id' }); d.createObjectStore('meta'); };
      r.onsuccess = () => { this.db = r.result; res(); };
      r.onerror = () => rej(r.error);
    });
  },
  tx(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, mode); const s = t.objectStore(store);
      let out; const r = fn(s); if (r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => res(out); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
    });
  },
  all: (st) => DB.tx(st, 'readonly', s => s.getAll()),
  get: (st, k) => DB.tx(st, 'readonly', s => s.get(k)),
  put: (st, v, k) => DB.tx(st, 'readwrite', s => (k === undefined ? s.put(v) : s.put(v, k))),
  del: (st, k) => DB.tx(st, 'readwrite', s => s.delete(k)),
  putMany: (st, vs) => DB.tx(st, 'readwrite', s => { vs.forEach(v => s.put(v)); }),
};
const getMeta = k => DB.get('meta', k);
const setMeta = (k, v) => DB.put('meta', v, k);

/* ── Stato ─────────────────────────────────────────────────── */
const S = {
  items: [], view: 'list', id: null, draft: null, draftIsNew: false, newPhotos: [],
  filter: localStorage.getItem('filter') || 'tutti', sort: localStorage.getItem('sort') || 'recenti', q: '',
  addTipo: 'libro', syncState: 'off', syncError: '', lastSync: 0, dirty: false, expanded: false,
};
const live = () => S.items.filter(i => !i.deleted);
const byId = id => S.items.find(i => i.id === id);
async function loadItems() {
  const all = await DB.all('items'); const fix = [];
  all.forEach(i => { const before = i.tipo + '|' + i.condizione; normalize(i); if (before !== i.tipo + '|' + i.condizione) fix.push(i); });
  if (fix.length) await DB.putMany('items', fix);
  S.items = all;
}

/* ── Navigazione ───────────────────────────────────────────── */
function go(view, id, replace) {
  S.view = view; S.id = id || null; S.expanded = false;
  const st = { view, id: S.id };
  replace ? history.replaceState(st, '') : history.pushState(st, '');
  render(); window.scrollTo(0, 0);
}
window.addEventListener('popstate', e => {
  closeSheet(); Scanner.stop();
  const st = e.state || { view: 'list' };
  if (S.view === 'edit' && st.view !== 'edit') discardDraftPhotos();
  S.view = st.view; S.id = st.id;
  if (S.view === 'edit' && !S.draft) S.view = 'list';
  render();
});

/* ── Toast ─────────────────────────────────────────────────── */
let toastT;
function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms);
}

/* ── Foto ──────────────────────────────────────────────────── */
const photoURLs = new Map();
async function compressImage(file, max = 1400, q = 0.8) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(r => c.toBlob(r, 'image/jpeg', q));
  } finally { URL.revokeObjectURL(url); }
}
async function photoURL(id) {
  if (photoURLs.has(id)) return photoURLs.get(id);
  let p = await DB.get('photos', id);
  if (!p || !p.blob) {
    const map = (await getMeta('photoMap')) || {};
    if (map[id] && Drive.token()) {
      try { const blob = await (await Drive.download(map[id])).blob(); p = { id, blob }; await DB.put('photos', p); } catch (e) { return null; }
    } else return null;
  }
  const u = URL.createObjectURL(p.blob); photoURLs.set(id, u); return u;
}
function hydratePhotos(root = document) {
  root.querySelectorAll('img[data-photo]').forEach(async img => {
    const u = await photoURL(img.dataset.photo);
    if (u) { img.src = u; img.hidden = false; }
  });
}
function discardDraftPhotos() {
  S.newPhotos.forEach(id => DB.del('photos', id)); S.newPhotos = [];
}

/* ── Copertina ─────────────────────────────────────────────── */
function coverHTML(it, cls = '') {
  const t = it.tipo || 'libro';
  let inner = `<div class="ph t-${t}"><span>${esc(it.titolo || 'Senza titolo')}</span></div>`;
  if (it.foto && it.foto[0]) inner += `<img data-photo="${esc(it.foto[0])}" alt="" hidden>`;
  else if (it.coverUrl) inner += `<img src="${esc(it.coverUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">`;
  return `<div class="cover t-${t} ${cls}">${inner}</div>`;
}

/* ── Render ────────────────────────────────────────────────── */
function render() {
  const app = $('#app');
  if (S.view === 'detail' && byId(S.id) && !byId(S.id).deleted) app.innerHTML = viewDetail(byId(S.id));
  else if (S.view === 'edit' && S.draft) app.innerHTML = viewEdit();
  else if (S.view === 'settings') app.innerHTML = viewSettings();
  else { S.view = 'list'; app.innerHTML = viewList(); renderGrid(); centerChip(false); }
  hydratePhotos(app);
}

function syncBtn() {
  return `<button class="iconbtn" data-a="syncTap" aria-label="Sincronizza">${ic('cloud')}<i class="sync-dot ${S.syncState}"></i></button>`;
}

function counts() {
  const L = live(); const c = { tutti: 0, libro: 0, vinile: 0, cd: 0, cassetta: 0, film: 0, desideri: 0, prestito: 0 };
  L.forEach(i => { if (i.desiderio) c.desideri++; else { c.tutti++; c[i.tipo]++; } if (i.prestatoA) c.prestito++; });
  return c;
}

function viewList() {
  const c = counts();
  const chips = [['tutti', 'Tutti'], ...Object.entries(TIPI).map(([k, v]) => [k, v.plural]), ['desideri', 'Desideri'], ['prestito', 'In prestito']]
    .filter(([k]) => !['desideri', 'prestito'].includes(k) || c[k] > 0)
    .map(([k, l]) => `<button class="chip ${S.filter === k ? 'on' : ''}" data-a="filter" data-v="${k}">${l}<b>${c[k]}</b></button>`).join('');
  const needLogin = cfg('clientId') && S.syncState === 'login' && S.dirty;
  return `
  <header class="top">
    <div class="grow"><h1>Scaffale</h1></div>
    ${syncBtn()}
    <button class="iconbtn" data-a="settings" aria-label="Impostazioni">${ic('gear')}</button>
  </header>
  <div class="searchbar"><label>${ic('search', 18)}<input id="q" type="search" placeholder="Cerca titolo, autore, codice, note…" value="${esc(S.q)}" autocomplete="off"></label></div>
  <nav class="chips">${chips}</nav>
  ${needLogin ? `<div class="banner">Ci sono modifiche da salvare su Drive.<button data-a="login">Accedi</button></div>` : ''}
  <div class="sortrow"><span id="countLbl"></span>
    <select id="sort" aria-label="Ordina">
      ${[['recenti', 'Aggiunti di recente'], ['titolo', 'Titolo A–Z'], ['autore', 'Autore A–Z'], ['anno', 'Anno'], ['voto', 'Voto']].map(([k, l]) => `<option value="${k}" ${S.sort === k ? 'selected' : ''}>${l}</option>`).join('')}
    </select></div>
  <main id="grid" class="grid"></main>
  <button class="fab" data-a="add">${ic('plus')}Aggiungi</button>`;
}

// Porta il filtro selezionato al centro della barra dei filtri
function centerChip(smooth) {
  const box = $('.chips'), el = box && box.querySelector('.chip.on');
  if (!el) return;
  const left = el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  box.scrollTo({ left: Math.max(0, left), behavior: smooth && !reduce ? 'smooth' : 'auto' });
}
function filtered() {
  const q = S.q.trim().toLowerCase();
  let L = live().filter(i => {
    if (S.filter === 'desideri') return i.desiderio;
    if (S.filter === 'prestito') return !!i.prestatoA;
    if (i.desiderio) return false;
    return S.filter === 'tutti' || i.tipo === S.filter;
  });
  if (q) L = L.filter(i => [i.titolo, i.autore, i.codice, i.editore, i.genere, i.posizione, i.note, i.anno, i.formato, i.prestatoA, ...(i.commenti || []).map(c => c.testo)].join(' ').toLowerCase().includes(q));
  const cmp = (a, b) => String(a || '').localeCompare(String(b || ''), 'it', { sensitivity: 'base' });
  const sorters = {
    recenti: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
    titolo: (a, b) => cmp(a.titolo, b.titolo),
    autore: (a, b) => cmp(a.autore, b.autore) || cmp(a.anno, b.anno),
    anno: (a, b) => (parseInt(b.anno) || 0) - (parseInt(a.anno) || 0),
    voto: (a, b) => (b.valutazione || 0) - (a.valutazione || 0),
  };
  return L.sort(sorters[S.sort] || sorters.recenti);
}

function renderGrid() {
  const g = $('#grid'); if (!g) return;
  const L = filtered();
  $('#countLbl').textContent = `${L.length} ${L.length === 1 ? 'pezzo' : 'pezzi'}`;
  if (!live().length) {
    g.innerHTML = `<div class="empty" style="grid-column:1/-1">${ic('book', 44)}<h2>Lo scaffale è vuoto</h2><p>Scansiona il codice a barre di un libro, un disco o un film: i dati si compilano da soli.</p><button class="btn primary" data-a="add">${ic('scan')}Aggiungi il primo</button></div>`;
    return;
  }
  if (!L.length) { g.innerHTML = `<div class="empty" style="grid-column:1/-1"><p>Nessun risultato.</p></div>`; return; }
  const label = i => { const T = TIPI[i.tipo]; if (!T) return ''; const f = i.formato || ''; return f && f.toLowerCase().startsWith(T.label.toLowerCase()) ? f : [T.label, f].filter(Boolean).join(' · '); };
  g.innerHTML = L.map(i => `
    <button class="card t-${esc(i.tipo)}" data-a="open" data-id="${esc(i.id)}">
      ${coverHTML(i)}
      <i class="stripe"></i>
      ${i.prestatoA ? `<span class="tag loan">In prestito</span>` : i.desiderio ? `<span class="tag">Desiderio</span>` : ''}
      <div class="meta"><b>${esc(i.titolo || 'Senza titolo')}</b><span>${esc([i.autore, i.anno].filter(Boolean).join(' · ') || '—')}</span><em>${esc(label(i))}</em></div>
    </button>`).join('');
  hydratePhotos(g);
}

function starsHTML(n, action, small) {
  return `<div class="stars ${small ? 'small' : ''}">${[1, 2, 3, 4, 5].map(v => `<button type="button" class="${v <= n ? 'on' : ''}" data-a="${action}" data-v="${v}" aria-label="${v} stelle">★</button>`).join('')}</div>`;
}

function viewDetail(it) {
  const T = TIPI[it.tipo] || TIPI.libro;
  const M = isMusic(it.tipo);
  const spunte = (SPUNTE[it.tipo] || []).filter(([k]) => it[k]).map(([, l]) => l).join(' · ');
  const facts = [
    [T.autore, it.autore], ['Anno', it.anno], [T.editore, it.editore], ['N. catalogo', M && it.catalogo], ['Paese', M && it.paese],
    ['Formato', it.formato], ['Confezione', M && it.confezione], ['Dischi', M && it.numDischi && +it.numDischi > 1 && it.numDischi],
    ['Codice SPARS', it.tipo === 'cd' && it.spars], ['Nastro', it.tipo === 'cassetta' && it.tipoNastro],
    ['Riduzione rumore', it.tipo === 'cassetta' && it.riduzione], ['Origine', it.tipo === 'cassetta' && it.origine],
    ['Genere', it.genere], ['Pagine', it.tipo === 'libro' && it.pagine], ['Durata', it.tipo === 'film' && it.durata],
    [M ? 'Condizione ' + T.supporto.toLowerCase() : 'Condizione', it.condizione], ['Condizione ' + (T.custodia || '').toLowerCase(), M && it.condCustodia],
    ['Dettagli', spunte],
    ['Posizione', it.posizione], ['Prezzo pagato', it.prezzo && (String(it.prezzo).match(/€/) ? it.prezzo : it.prezzo + ' €')],
    [T.codice, it.codice], ['Matrice / runout', M && it.matrice], ['Codici IFPI', it.tipo === 'cd' && it.ifpi],
    ['Aggiunto il', fmtDate(it.createdAt)],
  ].filter(([, v]) => v);
  const desc = it.descrizione || '';
  const longDesc = desc.length > 320;
  return `
  <header class="top">
    <button class="iconbtn" data-a="back" aria-label="Indietro">${ic('back')}</button>
    <div class="grow"></div>
    <button class="iconbtn" data-a="edit" data-id="${esc(it.id)}" aria-label="Modifica">${ic('pen')}</button>
  </header>
  <div class="hero">
    ${coverHTML(it)}
    <div class="info">
      <span class="pill t-${it.tipo}">${esc(it.formato || T.label)}</span>${it.desiderio ? '<span class="pill wish">Desiderio</span>' : ''}
      <h2>${esc(it.titolo || 'Senza titolo')}</h2>
      <div class="who">${esc([it.autore, it.anno].filter(Boolean).join(' · '))}</div>
      ${starsHTML(it.valutazione || 0, 'rateDetail')}
    </div>
  </div>
  <div class="detail">
    ${it.prestatoA ? `<div class="loanbox">In prestito a <b>${esc(it.prestatoA)}</b>${it.prestatoIl ? ` dal ${esc(fmtDate(it.prestatoIl))}` : ''}<button data-a="returned">Restituito</button></div>` : ''}
    ${desc ? `<div class="section"><h3>Descrizione</h3><div class="prose ${longDesc && !S.expanded ? 'clamp' : ''}">${esc(desc)}</div>${longDesc && !S.expanded ? '<button class="more" data-a="expand">Leggi tutto</button>' : ''}</div>` : ''}
    ${isMusic(it.tipo) && it.tracklist ? `<div class="section"><h3>Tracce</h3><div class="tracks">${esc(it.tracklist)}</div></div>` : ''}
    ${facts.length ? `<div class="section"><dl class="facts">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>` : ''}
    ${it.foto && it.foto.length ? `<div class="section"><h3>Foto</h3><div class="photos">${it.foto.map(p => `<button class="photo" data-a="viewPhoto" data-v="${esc(p)}"><img data-photo="${esc(p)}" alt="" hidden></button>`).join('')}</div></div>` : ''}
    ${it.note ? `<div class="section"><h3>Note</h3><div class="prose">${esc(it.note)}</div></div>` : ''}
    <div class="section"><h3>Commenti</h3>
      ${(it.commenti || []).map(c => `<div class="comment"><p>${esc(c.testo)}<small>${esc(fmtDateTime(c.data))}</small></p><button data-a="delComment" data-v="${esc(c.id)}" aria-label="Elimina commento">✕</button></div>`).join('')}
      <form class="composer" id="commentForm"><textarea id="commentText" rows="1" placeholder="Scrivi un commento…"></textarea><button type="submit">Invia</button></form>
    </div>
    <div class="actions">
      <button class="btn" data-a="edit" data-id="${esc(it.id)}">${ic('pen', 18)}Modifica</button>
      <button class="btn danger" data-a="delete">${ic('trash', 18)}Elimina</button>
    </div>
  </div>`;
}

function viewEdit() {
  const d = S.draft; const T = TIPI[d.tipo] || TIPI.libro;
  const posizioni = [...new Set(live().map(i => i.posizione).filter(Boolean))];
  const generi = [...new Set(live().map(i => i.genere).filter(Boolean))];
  const f = (name, label, attrs = '') => `<label class="field"><span>${label}</span><input data-f="${name}" value="${esc(d[name])}" ${attrs}></label>`;
  const sel = (name, label, opts) => `<label class="field"><span>${label}</span><select data-f="${name}"><option value=""></option>${opts.map(o => `<option ${d[name] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}${d[name] && !opts.includes(d[name]) ? `<option selected>${esc(d[name])}</option>` : ''}</select></label>`;
  const chk = (name, label) => `<label class="field inline"><span>${label}</span><input type="checkbox" data-f="${name}" ${d[name] ? 'checked' : ''}></label>`;
  const M = isMusic(d.tipo);
  const edizione = !M ? '' : `
    <div class="section">
      <h3>Edizione</h3>
      <div class="two">${sel('confezione', 'Confezione', T.confezioni)}${f('numDischi', d.tipo === 'cassetta' ? 'N. cassette' : 'N. dischi', 'inputmode="numeric"')}</div>
      ${d.tipo === 'cd' ? `<div class="two">${sel('spars', 'Codice SPARS', SPARS)}<div></div></div>` : ''}
      ${d.tipo === 'cassetta' ? `<div class="two">${sel('tipoNastro', 'Tipo di nastro', NASTRI)}${sel('riduzione', 'Riduzione rumore', RIDUZIONI)}</div>${sel('origine', 'Origine', ORIGINI)}` : ''}
      ${(SPUNTE[d.tipo] || []).map(([k, l]) => chk(k, l)).join('')}
      ${d.tipo !== 'cassetta' ? `<details class="adv" ${d.matrice || d.ifpi ? 'open' : ''}><summary>Dettagli avanzati (per collezionisti)</summary>
        <label class="field"><span>Matrice / runout (scritte incise vicino al centro)</span><textarea data-f="matrice" rows="2">${esc(d.matrice)}</textarea></label>
        ${d.tipo === 'cd' ? `<label class="field"><span>Codici IFPI (mastering / mould SID)</span><textarea data-f="ifpi" rows="2">${esc(d.ifpi)}</textarea></label>` : ''}
      </details>` : ''}
    </div>`;
  return `
  <header class="top">
    <button class="iconbtn" data-a="cancelEdit" aria-label="Annulla">${ic('back')}</button>
    <div class="grow title-sm">${S.draftIsNew ? 'Nuovo pezzo' : 'Modifica'}</div>
  </header>
  <div class="form">
    <div class="seg seg5">${Object.entries(TIPI).map(([k, v]) => `<button type="button" class="${d.tipo === k ? 'on' : ''}" data-a="draftTipo" data-v="${k}">${v.label}</button>`).join('')}</div>
    <div class="quick">
      <button class="btn" data-a="scanForDraft">${ic('scan', 18)}Scansiona</button>
      <button class="btn" data-a="searchForDraft">${ic('search', 18)}Cerca online</button>
    </div>

    <div class="section">
      <h3>Dati</h3>
      ${f('titolo', 'Titolo *', 'autocomplete="off"')}
      ${f('autore', T.autore)}
      <div class="two">${f('anno', 'Anno', 'inputmode="numeric"')}${f('editore', T.editore)}</div>
      ${M ? `<div class="two">${f('catalogo', 'N. catalogo')}${f('paese', 'Paese')}</div>` : ''}
      <div class="two">
        <label class="field"><span>Formato</span><input data-f="formato" list="dl-formati" value="${esc(d.formato)}"></label>
        <label class="field"><span>Genere</span><input data-f="genere" list="dl-generi" value="${esc(d.genere)}"></label>
      </div>
      ${d.tipo === 'libro' ? f('pagine', 'Pagine', 'inputmode="numeric"') : ''}
      ${d.tipo === 'film' ? f('durata', 'Durata') : ''}
      <label class="field"><span>${T.codice}</span><div class="with-btn"><input data-f="codice" value="${esc(d.codice)}" inputmode="numeric"><button type="button" data-a="scanForDraft" aria-label="Scansiona">${ic('scan')}</button></div></label>
      <label class="field"><span>Descrizione</span><textarea data-f="descrizione" rows="4">${esc(d.descrizione)}</textarea></label>
      ${isMusic(d.tipo) ? `<label class="field"><span>Tracce</span><textarea data-f="tracklist" rows="4">${esc(d.tracklist)}</textarea></label>` : ''}
    </div>

    ${edizione}

    <div class="section">
      <h3>Foto</h3>
      <div class="photos">
        ${d.coverUrl ? `<div class="photo"><img src="${esc(d.coverUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.style.opacity=0"><span class="badge">Copertina</span><button type="button" class="x" data-a="rmCover" aria-label="Rimuovi copertina">✕</button></div>` : ''}
        ${d.foto.map(p => `<div class="photo"><img data-photo="${esc(p)}" alt="" hidden><button type="button" class="x" data-a="rmPhoto" data-v="${esc(p)}" aria-label="Rimuovi foto">✕</button></div>`).join('')}
        <button type="button" class="addphoto" data-a="addPhoto">${ic('camera')}Aggiungi</button>
      </div>
    </div>

    <div class="section">
      <h3>La mia copia</h3>
      ${M ? `<div class="two">${sel('condizione', 'Condizione ' + T.supporto.toLowerCase(), CONDIZIONI)}${sel('condCustodia', 'Condizione ' + T.custodia.toLowerCase(), CONDIZIONI)}</div>${f('prezzo', 'Prezzo pagato', 'inputmode="decimal"')}`
        : `<div class="two">${sel('condizione', 'Condizione', CONDIZIONI)}${f('prezzo', 'Prezzo pagato', 'inputmode="decimal"')}</div>`}
      <label class="field"><span>Posizione (es. Salotto, scaffale 2)</span><input data-f="posizione" list="dl-pos" value="${esc(d.posizione)}"></label>
      <div class="field"><span>Il mio voto</span>${starsHTML(d.valutazione || 0, 'rateDraft')}</div>
      <label class="field"><span>Note</span><textarea data-f="note" rows="3">${esc(d.note)}</textarea></label>
      <div class="two">
        ${f('prestatoA', 'Prestato a')}
        <label class="field"><span>Dal</span><input type="date" data-f="prestatoIl" value="${esc(d.prestatoIl)}"></label>
      </div>
      <label class="field inline"><span>Lista desideri (non ancora posseduto)</span><input type="checkbox" data-f="desiderio" ${d.desiderio ? 'checked' : ''}></label>
    </div>
    <datalist id="dl-formati">${T.formati.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
    <datalist id="dl-pos">${posizioni.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
    <datalist id="dl-generi">${generi.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
  </div>
  <div class="savebar">
    <button class="btn" data-a="cancelEdit">Annulla</button>
    <button class="btn primary" data-a="save">Salva</button>
  </div>`;
}

function viewSettings() {
  const has = !!cfg('clientId'); const tok = !!Drive.token();
  const st = !has ? ['', 'Google Drive non configurato', 'Serve il Client ID Google (vedi la guida).']
    : S.syncState === 'error' ? ['error', 'Errore di sincronizzazione', S.syncError]
    : tok ? ['ok', 'Collegato a Google Drive', S.lastSync ? 'Ultima sincronizzazione: ' + fmtDateTime(S.lastSync) : 'Pronto']
    : ['login', 'Accesso scaduto o non effettuato', 'Tocca "Accedi" per salvare su Drive.'];
  return `
  <header class="top">
    <button class="iconbtn" data-a="back" aria-label="Indietro">${ic('back')}</button>
    <div class="grow title-sm">Impostazioni</div>
  </header>
  <div class="form">
    <div class="section"><h3>Google Drive</h3>
      <div class="status"><i class="${st[0]}"></i><div>${esc(st[1])}<small>${esc(st[2])}</small></div></div>
      <div class="stack">
        ${has && !tok ? `<button class="btn primary block" data-a="login">${ic('cloud', 18)}Accedi con Google</button>` : ''}
        ${has && tok ? `<button class="btn dark block" data-a="syncNow">Sincronizza ora</button><button class="btn block" data-a="logout">Esci da Google</button>` : ''}
        <p class="note">I dati sono salvati nel telefono e copiati nella cartella <b>Scaffale</b> del tuo Google Drive (file <i>scaffale.json</i> e cartella <i>foto</i>). Puoi usare l'app anche offline: si sincronizza appena possibile.</p>
      </div>
    </div>

    <div class="section"><h3>Backup</h3>
      <div class="stack">
        <button class="btn block" data-a="export">Esporta backup completo (con foto)</button>
        <button class="btn block" data-a="import">Importa da backup</button>
      </div>
    </div>

    <div class="section"><h3>Ricerca online</h3>
      <p class="note" style="margin:10px 0">Libri: Google Libri + Open Library. Vinili, CD e cassette: MusicBrainz + Apple Music (+ Discogs con il token). Film: Apple TV. Con le chiavi facoltative qui sotto la ricerca migliora.</p>
      <details class="adv"><summary>Chiavi facoltative e configurazione avanzata</summary>
        <label class="field"><span>Chiave Google Libri (libri, facoltativa)</span><input id="cfg-booksKey" value="${esc(cfg('booksKey'))}" autocomplete="off"></label>
        <label class="field"><span>Chiave API TMDB (film, consigliata)</span><input id="cfg-tmdbKey" value="${esc(cfg('tmdbKey'))}" autocomplete="off"></label>
        <label class="field"><span>Token Discogs (vinili, CD, cassette)</span><input id="cfg-discogsToken" value="${esc(cfg('discogsToken'))}" autocomplete="off"></label>
        <label class="field"><span>Client ID Google</span><input id="cfg-clientId" value="${esc(cfg('clientId'))}" autocomplete="off"></label>
        <div class="stack" style="padding-top:12px"><button class="btn block" data-a="saveCfg">Salva impostazioni</button></div>
      </details>
    </div>
    <p class="note" style="text-align:center">Scaffale ${VERSION} · ${live().length} pezzi</p>
  </div>`;
}

/* ── Sheet ─────────────────────────────────────────────────── */
function openSheet(html) {
  $('#sheet').innerHTML = html; $('#sheetWrap').classList.remove('hidden');
  hydratePhotos($('#sheet'));
}
function closeSheet() { $('#sheetWrap').classList.add('hidden'); $('#sheet').innerHTML = ''; }

function sheetAdd() {
  const tipoSeg = `<div class="seg seg5" style="margin-bottom:14px">${Object.entries(TIPI).map(([k, v]) => `<button class="${S.addTipo === k ? 'on' : ''}" data-a="addTipo" data-v="${k}">${v.label}</button>`).join('')}</div>`;
  openSheet(`<h2>Aggiungi</h2>${tipoSeg}
    <button class="bigbtn" data-a="addScan"><span class="ic">${ic('scan')}</span><span><b>Scansiona il codice a barre</b><small>Il modo più veloce: compila tutto da solo</small></span></button>
    <button class="bigbtn" data-a="addSearch"><span class="ic">${ic('search')}</span><span><b>Cerca per titolo</b><small>Se il codice manca o non viene trovato</small></span></button>
    <button class="bigbtn" data-a="addManual"><span class="ic">${ic('hand')}</span><span><b>Inserisci a mano</b><small>Per edizioni rare o fatte in casa</small></span></button>`);
}

function sheetSearch(tipo, prefill = '', code = '') {
  S.searchCtx = { tipo, code };
  openSheet(`<h2>Cerca ${tipo === 'cd' ? 'CD' : TIPI[tipo].label.toLowerCase()}</h2>
    ${code ? `<p class="lead">Codice ${esc(code)} non trovato. Prova con il titolo${isMusic(tipo) ? ' e l’artista' : ''}.</p>` : ''}
    <form class="searchform" id="titleSearch"><input id="titleQ" type="search" placeholder="${isMusic(tipo) ? 'Artista e titolo' : tipo === 'libro' ? 'Titolo o autore' : 'Titolo del film'}" value="${esc(prefill)}" autocomplete="off"><button class="btn primary" type="submit">Cerca</button></form>
    <div id="results" class="results"></div>
    ${code ? `<button class="btn block" style="margin-top:12px" data-a="manualWithCode">Inserisci a mano</button>` : ''}`);
  setTimeout(() => $('#titleQ')?.focus(), 250);
}

function loadingHTML(msg) { return `<div class="loading"><div class="spinner"></div>${esc(msg)}</div>`; }

function resultsHTML(list) {
  S.candidates = list;
  return list.map((c, i) => `
    <button class="result" data-a="pick" data-v="${i}">
      <div class="th">${c.coverUrl ? `<img src="${esc(c.coverUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</div>
      <div><b>${esc(c.titolo)}</b><span>${esc([c.autore, c.anno, c.editore].filter(Boolean).join(' · '))}</span>${c.sub ? `<span>${esc(c.sub)}</span>` : ''}<em>${esc(c.fonte)}</em></div>
    </button>`).join('');
}

/* ── Ricerca dati online ───────────────────────────────────── */
async function fj(url, opts = {}) {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const r = await fetch(url, { ...opts, signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
const settled = async ps => (await Promise.allSettled(ps)).flatMap(r => (r.status === 'fulfilled' ? r.value || [] : []));
const year = s => (String(s || '').match(/\d{4}/) || [''])[0];
const cleanProductTitle = s => String(s || '')
  .replace(/\[.*?\]|\(.*?\)/g, ' ')
  .replace(/\b(blu-?ray|dvd|4k|uhd|ultra hd|vinyl|vinile|lp|cd|edizione|edition|special|deluxe|steelbook|widescreen|region \w+|import|nuovo|new|sealed|disc|2-disc|collector'?s?)\b/gi, ' ')
  .replace(/[-–|:,]+\s*$/, '').replace(/\s+/g, ' ').trim();

// Libri
async function googleBooks(q) {
  const key = cfg('booksKey');
  const d = await fj('https://www.googleapis.com/books/v1/volumes?maxResults=12&printType=books&q=' + encodeURIComponent(q) + (key ? '&key=' + encodeURIComponent(key) : ''));
  return (d.items || []).map(it => {
    const v = it.volumeInfo || {}; const ids = v.industryIdentifiers || [];
    const isbn = ids.find(x => x.type === 'ISBN_13') || ids.find(x => x.type === 'ISBN_10');
    let img = v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail);
    if (img) img = img.replace('http://', 'https://').replace('&edge=curl', '');
    return { tipo: 'libro', titolo: [v.title, v.subtitle].filter(Boolean).join(': '), autore: (v.authors || []).join(', '), anno: year(v.publishedDate),
      editore: v.publisher || '', descrizione: stripHtml(v.description), genere: (v.categories || []).join(', '), pagine: v.pageCount || '',
      coverUrl: img || '', codice: isbn ? isbn.identifier : '', fonte: 'Google Libri' };
  });
}
// ISBN: converte tra 10 e 13 cifre (alcune edizioni sono registrate solo in un formato)
function isbnVariants(c) {
  c = String(c).replace(/[^\dX]/gi, '').toUpperCase(); const out = [c];
  if (/^\d{9}[\dX]$/.test(c)) {
    const b = '978' + c.slice(0, 9); let s = 0; b.split('').forEach((d, i) => { s += +d * (i % 2 ? 3 : 1); });
    out.push(b + ((10 - (s % 10)) % 10));
  } else if (/^978\d{10}$/.test(c)) {
    const b = c.slice(3, 12); let s = 0; b.split('').forEach((d, i) => { s += +d * (10 - i); });
    const k = (11 - (s % 11)) % 11; out.push(b + (k === 10 ? 'X' : k));
  }
  return out;
}
// Riempie i campi vuoti di un risultato con quelli di un altro
const BOOK_FIELDS = ['titolo', 'autore', 'anno', 'editore', 'descrizione', 'genere', 'pagine', 'coverUrl', 'codice'];
function mergeBook(a, b) { if (!b) return a; BOOK_FIELDS.forEach(k => { if (!a[k] && b[k]) a[k] = b[k]; }); if (b.fonte && !String(a.fonte).includes(b.fonte)) a.fonte += ' + ' + b.fonte; return a; }
const bookKey = c => (String(c.titolo).split(':')[0] + '|' + String(c.autore).split(',')[0]).toLowerCase().normalize('NFD').replace(/[^a-z0-9|]/g, '');
async function openLibrarySearch(params) {
  const fields = 'key,title,subtitle,author_name,first_publish_year,publish_year,publisher,isbn,cover_i,number_of_pages_median,subject';
  const d = await fj(`https://openlibrary.org/search.json?limit=12&fields=${fields}&${params}`);
  return (d.docs || []).map(b => {
    const isbn = (b.isbn || []).find(x => x.length === 13) || (b.isbn || [])[0] || '';
    return { tipo: 'libro', titolo: [b.title, b.subtitle].filter(Boolean).join(': '), autore: (b.author_name || []).slice(0, 3).join(', '),
      anno: b.first_publish_year ? String(b.first_publish_year) : '', editore: (b.publisher || [])[0] || '', pagine: b.number_of_pages_median || '',
      genere: (b.subject || []).slice(0, 3).join(', '), coverUrl: b.cover_i ? `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg` : '',
      codice: isbn, descrizione: '', fonte: 'Open Library' };
  });
}
async function openLibraryIsbn(isbn) {
  const d = await fj(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`);
  const b = d['ISBN:' + isbn]; if (!b) return [];
  return [{ tipo: 'libro', titolo: [b.title, b.subtitle].filter(Boolean).join(': '), autore: (b.authors || []).map(a => a.name).join(', '), anno: year(b.publish_date),
    editore: (b.publishers || []).map(p => p.name).join(', '), pagine: b.number_of_pages || '', genere: (b.subjects || []).slice(0, 3).map(s => s.name).join(', '),
    coverUrl: b.cover ? (b.cover.large || b.cover.medium || '') : '', codice: isbn, descrizione: '', fonte: 'Open Library' }];
}

// Musica — riconosce vinile / CD / cassetta e i dettagli del formato
function mbMedia(r) {
  const f = ((r.media || [])[0] || {}).format || '';
  const tipo = detectMusicTipo(f) || (/vinyl/i.test(f) ? 'vinile' : '');
  let formato = '';
  if (tipo === 'vinile') formato = /7"/.test(f) ? '45 giri (7")' : /10"/.test(f) ? '10"' : 'LP 33 giri';
  else if (tipo === 'cd') formato = /8cm/i.test(f) ? 'CD 8 cm' : /enhanced/i.test(f) ? 'Enhanced CD' : /hdcd/i.test(f) ? 'HDCD' : /shm/i.test(f) ? 'SHM-CD' : /sacd/i.test(f) ? 'SACD ibrido' : /cd\+g/i.test(f) ? 'CD+G' : /cd-r/i.test(f) ? 'CD-R' : 'CD';
  else if (tipo === 'cassetta') formato = /micro/i.test(f) ? 'Microcassetta' : /dcc|digital compact/i.test(f) ? 'DCC' : 'Cassetta';
  return { tipo, formato, numDischi: (r.media || []).length > 1 ? String(r.media.length) : '' };
}
async function musicBrainz(query) {
  const d = await fj('https://musicbrainz.org/ws/2/release/?fmt=json&limit=12&query=' + encodeURIComponent(query));
  return (d.releases || []).map(r => {
    const m = mbMedia(r); const li = (r['label-info'] || [])[0] || {};
    return {
      tipo: m.tipo, titolo: r.title, autore: (r['artist-credit'] || []).map(a => (a.name || a.artist?.name || '') + (a.joinphrase || '')).join(''),
      anno: year(r.date), editore: li.label?.name || '', catalogo: li['catalog-number'] || '', paese: r.country || '',
      formato: m.formato, numDischi: m.numDischi, codice: r.barcode || '',
      coverUrl: `https://coverartarchive.org/release/${r.id}/front-500`, descrizione: '', genere: '', fonte: 'MusicBrainz', _mbid: r.id,
      sub: [r.country, (r.media || []).map(m => m.format).filter(Boolean).join(' + ')].filter(Boolean).join(' · '),
    };
  });
}
function discogsMedia(arr, qty) {
  const s = (arr || []).join(' | ');
  const tipo = /cassette/i.test(s) ? 'cassetta' : /\bCD\b|CDr|SACD|HDCD/.test(s) ? 'cd' : /vinyl|LP/i.test(s) ? 'vinile' : '';
  const out = { tipo, formato: '' };
  if (tipo === 'vinile') out.formato = /7"/.test(s) ? '45 giri (7")' : /10"/.test(s) ? '10"' : /12"/.test(s) && !/LP/.test(s) ? 'Maxi 12"' : /\bEP\b/.test(s) ? 'EP' : 'LP 33 giri';
  if (tipo === 'cd') out.formato = /SACD/.test(s) ? 'SACD ibrido' : /HDCD/.test(s) ? 'HDCD' : /SHM/.test(s) ? 'SHM-CD' : /CD\+G/.test(s) ? 'CD+G' : /CDr/.test(s) ? 'CD-R' : /Enhanced/i.test(s) ? 'Enhanced CD' : /Mini/i.test(s) ? 'CD 8 cm' : 'CD';
  if (tipo === 'cassetta') {
    out.formato = /Microcassette/i.test(s) ? 'Microcassetta' : /DCC/.test(s) ? 'DCC' : 'Cassetta';
    out.tipoNastro = /Metal/i.test(s) ? 'Tipo IV (metal)' : /Chrome|CrO2/i.test(s) ? 'Tipo II (cromo)' : /Ferric|Normal/i.test(s) ? 'Tipo I (normale)' : '';
    out.riduzione = /HX Pro/i.test(s) ? 'Dolby HX Pro' : /Dolby C/i.test(s) ? 'Dolby C' : /Dolby S/i.test(s) ? 'Dolby S' : /Dolby/i.test(s) ? 'Dolby B' : /dbx/i.test(s) ? 'dbx' : '';
  }
  if (/Box Set/i.test(s) && tipo === 'vinile') out.formato = 'Box set';
  if (qty && +qty > 1) out.numDischi = String(qty);
  return out;
}
async function discogs(params) {
  const tok = cfg('discogsToken'); if (!tok) return [];
  const d = await fj(`https://api.discogs.com/database/search?type=release&per_page=12&${params}&token=${encodeURIComponent(tok)}`);
  return (d.results || []).map(r => {
    const parts = String(r.title || '').split(' - '); const art = parts.length > 1 ? parts.shift() : '';
    return { ...discogsMedia(r.format, r.format_quantity), titolo: parts.join(' - '), autore: art, anno: r.year || '', editore: (r.label || [])[0] || '',
      catalogo: r.catno && r.catno !== 'none' ? r.catno : '', paese: r.country || '',
      genere: [...(r.genre || []), ...(r.style || [])].slice(0, 4).join(', '), coverUrl: r.cover_image || '', codice: (r.barcode || [])[0] || '',
      descrizione: '', fonte: 'Discogs', _discogsId: r.id, sub: [(r.format || []).join(', '), r.country].filter(Boolean).join(' · ') };
  });
}
async function itunes(term, entity) {
  const d = await fj(`https://itunes.apple.com/search?country=it&lang=it_it&limit=10&entity=${entity}&term=${encodeURIComponent(term)}`);
  return (d.results || []).map(r => ({
    tipo: entity === 'movie' ? 'film' : '',
    titolo: entity === 'album' ? r.collectionName : r.trackName, autore: r.artistName || '', anno: year(r.releaseDate),
    descrizione: stripHtml(r.longDescription || r.description || ''), genere: r.primaryGenreName || '',
    coverUrl: (r.artworkUrl100 || '').replace(/100x100bb/, '600x600bb'),
    durata: r.trackTimeMillis ? Math.round(r.trackTimeMillis / 60000) + ' min' : '',
    editore: entity === 'album' ? String(r.copyright || '').replace(/^[℗©\s\d]+/, '').slice(0, 60) : '',
    codice: '', fonte: entity === 'movie' ? 'Apple TV' : 'Apple Music', _itunesCollection: entity === 'album' ? r.collectionId : null,
  }));
}

// Film
async function tmdb(q) {
  const k = cfg('tmdbKey'); if (!k) return [];
  const d = await fj(`https://api.themoviedb.org/3/search/movie?language=it-IT&api_key=${encodeURIComponent(k)}&query=${encodeURIComponent(q)}`);
  return (d.results || []).slice(0, 10).map(m => ({
    tipo: 'film', titolo: m.title, anno: year(m.release_date), descrizione: m.overview || '', autore: '',
    coverUrl: m.poster_path ? 'https://image.tmdb.org/t/p/w500' + m.poster_path : '', fonte: 'TMDB', _tmdbId: m.id,
    sub: m.original_title && m.original_title !== m.title ? m.original_title : '',
  }));
}
async function upcLookup(code) {
  const d = await fj('https://api.upcitemdb.com/prod/trial/lookup?upc=' + encodeURIComponent(code));
  return (d.items || []).map(i => ({ titolo: i.title || '', descrizione: i.description || '', coverUrl: (i.images || [])[0] || '', editore: i.brand || '' }));
}
const guessFilmFormat = s => /4k|uhd/i.test(s) ? '4K UHD' : /blu-?ray/i.test(s) ? 'Blu-ray' : /dvd/i.test(s) ? 'DVD' : /vhs/i.test(s) ? 'VHS' : '';
// Mette prima i risultati del formato scelto e allinea tipo/formato alla tab selezionata
function fitMusic(list, tipo) {
  const ok = list.filter(c => c.tipo === tipo), other = list.filter(c => c.tipo !== tipo);
  other.forEach(c => { c.formato = ''; delete c.tipoNastro; delete c.riduzione; });
  const out = [...ok, ...other];
  out.forEach(c => { c.tipo = tipo; if (!c.formato) c.formato = TIPI[tipo].formati[0]; });
  return out;
}

async function searchByTitle(tipo, q) {
  if (tipo === 'libro') {
    const [gb, ol] = await Promise.all([settled([googleBooks(q)]), settled([openLibrarySearch('q=' + encodeURIComponent(q))])]);
    const out = gb.slice(); const idx = new Map(out.map((c, i) => [bookKey(c), i]));
    ol.forEach(c => { const k = bookKey(c); if (idx.has(k)) mergeBook(out[idx.get(k)], c); else { idx.set(k, out.length); out.push(c); } });
    return out.slice(0, 16);
  }
  if (isMusic(tipo)) {
    const fmt = { vinile: 'Vinyl', cd: 'CD', cassetta: 'Cassette' }[tipo];
    const mbFmt = { vinile: 'vinyl', cd: 'cd', cassetta: 'cassette' }[tipo];
    const [dc, mb, it] = await Promise.all([
      settled([discogs('q=' + encodeURIComponent(q) + '&format=' + fmt)]),
      settled([musicBrainz(`${q} AND format:${mbFmt}`)]).then(r => r.length ? r : settled([musicBrainz(q)])),
      settled([itunes(q, 'album')]),
    ]);
    return fitMusic([...dc.slice(0, 6), ...mb.slice(0, 6), ...it.slice(0, 4)], tipo);
  }
  const t = await settled([tmdb(q)]);
  return t.length ? t : settled([itunes(q, 'movie')]);
}

async function searchByCode(tipo, code) {
  code = String(code).replace(/\D/g, '');
  const isIsbn = /^(978|979)\d{10}$/.test(code) || /^\d{9}[\dX]$/i.test(code);
  if (tipo === 'libro' || isIsbn) {
    const vs = isbnVariants(code);
    const [gb, ol] = await Promise.all([
      settled(vs.map(v => googleBooks('isbn:' + v))),
      settled(vs.map(v => openLibraryIsbn(v))),
    ]);
    let olx = ol;
    if (!gb.length && !ol.length) olx = await settled([openLibrarySearch('isbn=' + vs[0])]);
    const seen = new Set(); let list = gb.filter(c => { const k = bookKey(c); if (seen.has(k)) return false; seen.add(k); return true; });
    if (!list.length) list = olx.slice(0, 1);
    list.forEach(c => {
      mergeBook(c, olx.find(o => bookKey(o) === bookKey(c)) || (list.length === 1 ? olx[0] : null));
      c.codice = code; c.tipo = 'libro';
      if (!c.coverUrl) c.coverUrl = `https://covers.openlibrary.org/b/isbn/${code}-L.jpg?default=false`;
    });
    return { tipo: 'libro', list };
  }
  if (isMusic(tipo)) {
    const variants = [code]; if (code.length === 13 && code[0] === '0') variants.push(code.slice(1)); if (code.length === 12) variants.push('0' + code);
    let list = await settled([discogs('barcode=' + code), musicBrainz(variants.map(v => 'barcode:' + v).join(' OR '))]);
    if (!list.length) {
      const up = await settled([upcLookup(code)]);
      if (up[0]) {
        const t = cleanProductTitle(up[0].titolo);
        list = (await settled([itunes(t, 'album')])).slice(0, 5);
        if (!list.length) list = [{ ...up[0], titolo: t, fonte: 'UPCitemdb' }];
        const guessed = detectMusicTipo(up[0].titolo);
        list.forEach(c => { c.tipo = guessed || tipo; });
      }
    }
    // Se il codice appartiene chiaramente a un altro formato musicale, avvisa e usa quello giusto
    const found = list.find(c => c.tipo && isMusic(c.tipo));
    const realTipo = list.length && found && !list.some(c => c.tipo === tipo) ? found.tipo : tipo;
    list = fitMusic(list, realTipo);
    list.forEach(c => { c.codice = code; });
    return { tipo: realTipo, list, switched: realTipo !== tipo };
  }
  // film
  const up = await settled([upcLookup(code)]);
  let list = [];
  if (up[0]) {
    const raw = up[0].titolo; const t = cleanProductTitle(raw);
    list = (await searchByTitle('film', t)).slice(0, 6);
    if (!list.length) list = [{ tipo: 'film', ...up[0], titolo: t, fonte: 'UPCitemdb' }];
    list.forEach(c => { c.formato = guessFilmFormat(raw); if (!c.coverUrl && up[0].coverUrl) c.coverUrl = up[0].coverUrl; });
  }
  list.forEach(c => { c.codice = code; c.tipo = 'film'; });
  return { tipo, list };
}

// Dettagli aggiuntivi dopo la scelta
async function enrich(c) {
  try {
    if (c._mbid) {
      const r = await fj(`https://musicbrainz.org/ws/2/release/${c._mbid}?inc=recordings+genres+labels+release-groups&fmt=json`);
      const tracks = (r.media || []).flatMap((m, mi, all) => (m.tracks || []).map(t => `${all.length > 1 ? (mi + 1) + '-' : ''}${t.number}. ${t.title}`));
      c.tracklist = tracks.join('\n');
      const g = [...(r.genres || []), ...((r['release-group'] || {}).genres || [])].sort((a, b) => (b.count || 0) - (a.count || 0)).map(x => x.name);
      if (g.length) c.genere = [...new Set(g)].slice(0, 3).join(', ');
      const ry = year((r['release-group'] || {})['first-release-date']);
      if (ry && ry !== c.anno) c.descrizione = `Prima pubblicazione: ${ry}. Questa edizione: ${c.anno || '—'}${r.country ? ' (' + r.country + ')' : ''}.`;
    } else if (c._discogsId) {
      const r = await fj(`https://api.discogs.com/releases/${c._discogsId}?token=${encodeURIComponent(cfg('discogsToken'))}`);
      c.tracklist = (r.tracklist || []).filter(t => t.type_ !== 'heading').map(t => `${t.position ? t.position + '. ' : ''}${t.title}${t.duration ? ' (' + t.duration + ')' : ''}`).join('\n');
      if (r.notes) c.descrizione = stripHtml(r.notes).slice(0, 2000);
      if (r.images && r.images[0]) c.coverUrl = r.images[0].uri || c.coverUrl;
      const ids = r.identifiers || [];
      const pick = rx => ids.filter(x => rx.test(x.type || '')).map(x => (x.description ? x.description + ': ' : '') + x.value);
      const spars = ids.find(x => /SPARS/i.test(x.type || ''));
      if (spars && SPARS.includes(String(spars.value).trim().toUpperCase())) c.spars = String(spars.value).trim().toUpperCase();
      const mx = pick(/Matrix/i); if (mx.length) c.matrice = mx.join('\n');
      const sid = pick(/SID/i); if (sid.length) c.ifpi = sid.join('\n');
      if (!c.catalogo && r.labels && r.labels[0] && r.labels[0].catno !== 'none') c.catalogo = r.labels[0].catno;
      if (!c.paese && r.country) c.paese = r.country;
    } else if (c._itunesCollection) {
      const r = await fj(`https://itunes.apple.com/lookup?entity=song&country=it&id=${c._itunesCollection}`);
      c.tracklist = (r.results || []).filter(x => x.wrapperType === 'track').map(t => `${t.trackNumber}. ${t.trackName}`).join('\n');
    } else if (c._tmdbId) {
      const k = encodeURIComponent(cfg('tmdbKey'));
      const m = await fj(`https://api.themoviedb.org/3/movie/${c._tmdbId}?language=it-IT&append_to_response=credits&api_key=${k}`);
      c.autore = ((m.credits?.crew || []).filter(x => x.job === 'Director').map(x => x.name)).join(', ');
      c.durata = m.runtime ? m.runtime + ' min' : '';
      c.genere = (m.genres || []).map(g => g.name).join(', ');
      if (!c.descrizione) c.descrizione = m.overview || '';
      const cast = (m.credits?.cast || []).slice(0, 5).map(x => x.name).join(', ');
      if (cast) c.descrizione = (c.descrizione ? c.descrizione + '\n\n' : '') + 'Con: ' + cast;
      if (!c.editore) c.editore = ((m.production_companies || [])[0] || {}).name || '';
    }
  } catch (e) { console.warn('enrich', e); }
  const out = {}; for (const [k, v] of Object.entries(c)) if (!k.startsWith('_') && k !== 'fonte' && k !== 'sub' && v !== '' && v != null) out[k] = v;
  return out;
}

/* ── Flusso: scansione → ricerca → modulo ──────────────────── */
async function handleCode(code, tipo, intoDraft) {
  code = String(code).replace(/\s/g, '');
  S.intoDraft = intoDraft === true;
  if (!intoDraft) {
    const dup = live().find(i => i.codice && i.codice.replace(/\D/g, '') === code.replace(/\D/g, ''));
    if (dup) {
      S.pendingCode = { code, tipo };
      openSheet(`<h2>Ce l'hai già</h2><div class="results">${''}</div>
        <button class="result" data-a="open" data-id="${esc(dup.id)}"><div class="th">${dup.coverUrl ? `<img src="${esc(dup.coverUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</div><div><b>${esc(dup.titolo)}</b><span>${esc([dup.autore, dup.anno].filter(Boolean).join(' · '))}</span></div></button>
        <div class="row" style="margin-top:14px"><button class="btn" data-a="dupAnyway">Aggiungi un'altra copia</button><button class="btn primary" data-a="open" data-id="${esc(dup.id)}">Apri</button></div>`);
      return;
    }
  }
  openSheet(`<h2>Cerco ${esc(code)}…</h2>${loadingHTML('Sto cercando nei database online')}`);
  let res;
  try { res = await searchByCode(tipo, code); } catch (e) { res = { tipo, list: [] }; }
  if (res.switched) toast(`Questo codice è di ${{ vinile: 'un vinile', cd: 'un CD', cassetta: 'una cassetta' }[res.tipo]}: l'ho spostato lì`, 3500);
  if (!res.list.length) {
    if (!navigator.onLine) { closeSheet(); toast('Sei offline: compila a mano, potrai cercare dopo'); return startDraft({ tipo: res.tipo, codice: code }, S.intoDraft); }
    sheetSearch(res.tipo, '', code); S.searchCtx.code = code; return;
  }
  if (res.list.length === 1) return pickCandidate(res.list[0]);
  S.candidates = res.list;
  openSheet(`<h2>Quale di questi?</h2><p class="lead">Trovati ${res.list.length} risultati per ${esc(code)}.</p><div class="results">${resultsHTML(res.list)}</div>
    <button class="btn block" style="margin-top:12px" data-a="manualWithCode">Nessuno, inserisco a mano</button>`);
  S.searchCtx = { tipo: res.tipo, code };
}

async function pickCandidate(c) {
  openSheet(`<h2>Un attimo…</h2>${loadingHTML('Recupero i dettagli')}`);
  const data = await enrich({ ...c });
  closeSheet();
  startDraft(data, S.intoDraft);
}

function startDraft(data, intoDraft) {
  if (intoDraft && S.draft) {
    Object.assign(S.draft, data); render(); toast('Dati compilati'); return;
  }
  S.draft = { ...EMPTY(), ...data }; S.draftIsNew = true; S.newPhotos = [];
  go('edit');
}

/* ── Scanner (fotocamera) ──────────────────────────────────── */
// 1) lettore integrato del browser (Chrome Android)  2) zxing-cpp in WebAssembly (iPhone)  3) ZXing JS come ultima risorsa
const BD_URLS = ['https://cdn.jsdelivr.net/npm/barcode-detector@3.0.8/dist/iife/ponyfill.min.js', 'https://unpkg.com/barcode-detector@3.0.8/dist/iife/ponyfill.min.js'];
const ZXING_URLS = ['https://unpkg.com/@zxing/library@0.21.3/umd/index.min.js', 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js'];
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
async function loadFirst(urls, ok) { if (ok()) return true; for (const u of urls) { try { await loadScript(u); if (ok()) return true; } catch (e) {} } return false; }
// Cifra di controllo EAN/UPC: scarta le letture sbagliate
function validCode(c) {
  c = String(c || '').replace(/\D/g, '');
  if (![8, 12, 13].includes(c.length)) return c.length >= 6; // altri formati: accetta
  const d = c.split('').map(Number); const chk = d.pop(); let sum = 0;
  d.reverse().forEach((n, i) => { sum += n * (i % 2 === 0 ? 3 : 1); });
  return (10 - (sum % 10)) % 10 === chk;
}
let detectorPromise = null;
function getDetector() {
  if (detectorPromise) return detectorPromise;
  detectorPromise = (async () => {
    try {
      if ('BarcodeDetector' in window && (await BarcodeDetector.getSupportedFormats()).includes('ean_13'))
        return { kind: 'native', det: new BarcodeDetector({ formats: FORMATS }) };
    } catch (e) {}
    if (await loadFirst(BD_URLS, () => window.BarcodeDetectionAPI && window.BarcodeDetectionAPI.BarcodeDetector)) {
      try {
        const det = new window.BarcodeDetectionAPI.BarcodeDetector({ formats: FORMATS });
        return { kind: 'wasm', det };
      } catch (e) { console.warn(e); }
    }
    if (await loadFirst(ZXING_URLS, () => window.ZXing)) {
      const hints = new Map();
      hints.set(ZXing.DecodeHintType.POSSIBLE_FORMATS, [ZXing.BarcodeFormat.EAN_13, ZXing.BarcodeFormat.EAN_8, ZXing.BarcodeFormat.UPC_A, ZXing.BarcodeFormat.UPC_E]);
      hints.set(ZXing.DecodeHintType.TRY_HARDER, true);
      const reader = new ZXing.MultiFormatReader(); reader.setHints(hints);
      return { kind: 'zxing', det: { detect: async (canvas) => {
        try {
          const src = new ZXing.HTMLCanvasElementLuminanceSource(canvas);
          const r = reader.decode(new ZXing.BinaryBitmap(new ZXing.HybridBinarizer(src)));
          return r ? [{ rawValue: r.getText() }] : [];
        } catch (e) { return []; }
      } } };
    }
    detectorPromise = null;
    throw new Error('Nessun lettore di codici disponibile');
  })();
  return detectorPromise;
}
// Ritaglia il centro dell'immagine (dove sta il riquadro) e lo ingrandisce
function cropToCanvas(src, w, h, canvas, frac = { x: 0.85, y: 0.45 }, target = 1280) {
  const cw = Math.round(w * frac.x), ch = Math.round(h * frac.y);
  const sx = Math.round((w - cw) / 2), sy = Math.round((h - ch) / 2);
  const scale = Math.min(2.5, Math.max(1, target / cw));
  canvas.width = Math.round(cw * scale); canvas.height = Math.round(ch * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true; ctx.drawImage(src, sx, sy, cw, ch, 0, 0, canvas.width, canvas.height);
  return canvas;
}
async function decodeImageFile(file) {
  const { det } = await getDetector();
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const W = img.naturalWidth, H = img.naturalHeight; const c = document.createElement('canvas');
    // prova: immagine intera ridotta, poi il centro a diverse dimensioni
    const tries = [{ x: 1, y: 1, t: 1600 }, { x: 0.7, y: 0.5, t: 1600 }, { x: 0.5, y: 0.35, t: 1400 }, { x: 0.9, y: 0.9, t: 2200 }];
    for (const t of tries) {
      cropToCanvas(img, W, H, c, t, t.t);
      const r = await det.detect(c).catch(() => []);
      const hit = (r || []).map(x => x.rawValue).find(validCode);
      if (hit) return hit;
    }
    return null;
  } finally { URL.revokeObjectURL(url); }
}
const Scanner = {
  active: false, stream: null, timer: null, onCode: null, canvas: null,
  hint(t) { $('.scan-hint').textContent = t; },
  async start(onCode) {
    this.onCode = onCode; this.active = true;
    $('#scanner').classList.remove('hidden'); $('#manualCode').value = '';
    this.hint('Avvio la fotocamera…');
    const video = $('#scanVideo');
    const constraints = { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false };
    try {
      const detP = getDetector();
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!this.active) { this.stream.getTracks().forEach(t => t.stop()); return; }
      video.srcObject = this.stream; await video.play().catch(() => {});
      this.tuneCamera();
      this.hint('Carico il lettore…');
      const { det } = await detP;
      if (!this.active) return;
      this.hint('Inquadra il codice a 15–20 cm, con buona luce');
      this.canvas = this.canvas || document.createElement('canvas');
      const tick = async () => {
        if (!this.active) return;
        if (video.videoWidth) {
          try {
            cropToCanvas(video, video.videoWidth, video.videoHeight, this.canvas);
            const r = await det.detect(this.canvas);
            const hit = (r || []).map(x => x.rawValue).find(validCode);
            if (hit) return this.submit(hit);
          } catch (e) {}
        }
        this.timer = setTimeout(tick, 120);
      };
      tick();
    } catch (e) {
      console.warn(e);
      this.hint(e && e.name === 'NotAllowedError'
        ? 'Accesso alla fotocamera negato. Abilitalo in Impostazioni › Safari › Fotocamera, oppure usa “Scatta una foto”.'
        : 'Fotocamera non disponibile: usa “Scatta una foto” o digita il codice.');
    }
  },
  // Zoom leggero e messa a fuoco continua dove il telefono lo permette (aiuta sugli iPhone recenti)
  tuneCamera() {
    try {
      const track = this.stream.getVideoTracks()[0]; const cap = track.getCapabilities ? track.getCapabilities() : {};
      const adv = {};
      if (cap.focusMode && cap.focusMode.includes('continuous')) adv.focusMode = 'continuous';
      if (cap.zoom && cap.zoom.max >= 1.8) adv.zoom = Math.min(2, cap.zoom.max);
      if (Object.keys(adv).length) track.applyConstraints({ advanced: [adv] }).catch(() => {});
    } catch (e) {}
  },
  async fromPhoto(file) {
    const cb = this.onCode;
    this.hint('Leggo la foto…');
    try {
      const code = await decodeImageFile(file);
      if (code) { this.onCode = cb; return this.submit(code); }
      this.hint('Codice non leggibile nella foto. Riprova più vicino e dritto, oppure digitalo.');
    } catch (e) { this.hint('Lettore non disponibile: digita il codice qui sotto.'); }
  },
  submit(code) { if (navigator.vibrate) navigator.vibrate(60); const cb = this.onCode; this.stop(); cb && cb(code); },
  found(code) { if (validCode(code)) this.submit(code); },
  stop() {
    this.active = false; this.onCode = null; clearTimeout(this.timer);
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    const v = $('#scanVideo'); if (v && v.srcObject) { try { v.srcObject.getTracks().forEach(t => t.stop()); } catch (e) {} v.srcObject = null; }
    $('#scanner').classList.add('hidden'); this.hint('Inquadra il codice a barre');
  },
};

/* ── Google Drive ──────────────────────────────────────────── */
class NeedLogin extends Error {}
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const Drive = {
  token() {
    try { const t = JSON.parse(localStorage.getItem('gtoken') || 'null'); if (t && t.exp > Date.now() + 60000) return t.t; } catch (e) {}
    return null;
  },
  redirectUri() { return location.origin + location.pathname.replace(/index\.html$/, ''); },
  login() {
    const cid = cfg('clientId');
    if (!cid) { toast('Manca il Client ID Google: vedi Impostazioni'); go('settings'); return; }
    const st = uid(); localStorage.setItem('oauthState', st);
    const p = new URLSearchParams({ client_id: cid, redirect_uri: this.redirectUri(), response_type: 'token', scope: SCOPE, include_granted_scopes: 'true', state: st });
    const hint = localStorage.getItem('gHint'); if (hint) p.set('login_hint', hint);
    location.href = 'https://accounts.google.com/o/oauth2/v2/auth?' + p.toString();
  },
  handleRedirect() {
    if (!/access_token=|error=/.test(location.hash)) return false;
    const h = new URLSearchParams(location.hash.slice(1));
    history.replaceState({ view: 'list' }, '', location.pathname + location.search);
    if (h.get('error')) { setTimeout(() => toast('Accesso a Google annullato'), 300); return false; }
    if (h.get('state') !== localStorage.getItem('oauthState')) return false;
    localStorage.setItem('gtoken', JSON.stringify({ t: h.get('access_token'), exp: Date.now() + (parseInt(h.get('expires_in'), 10) || 3600) * 1000 }));
    return true;
  },
  logout() { const t = this.token(); localStorage.removeItem('gtoken'); if (t) fetch('https://oauth2.googleapis.com/revoke?token=' + t, { method: 'POST' }).catch(() => {}); },
  async api(url, opts = {}) {
    const t = this.token(); if (!t) throw new NeedLogin();
    const r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), Authorization: 'Bearer ' + t } });
    if (r.status === 401) { localStorage.removeItem('gtoken'); throw new NeedLogin(); }
    if (!r.ok) { const e = new Error('Drive ' + r.status); e.status = r.status; try { e.detail = await r.text(); } catch (x) {} throw e; }
    return r;
  },
  async find(q) {
    const r = await this.api('https://www.googleapis.com/drive/v3/files?spaces=drive&pageSize=10&fields=files(id,name)&q=' + encodeURIComponent(q));
    return (await r.json()).files || [];
  },
  async folder(name, parent) {
    const q = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false` + (parent ? ` and '${parent}' in parents` : '');
    const f = await this.find(q); if (f[0]) return f[0].id;
    const body = { name, mimeType: 'application/vnd.google-apps.folder' }; if (parent) body.parents = [parent];
    const r = await this.api('https://www.googleapis.com/drive/v3/files?fields=id', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return (await r.json()).id;
  },
  async upload(name, parent, blob, mime, fileId) {
    if (fileId) {
      const r = await this.api(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media&fields=id`, { method: 'PATCH', headers: { 'Content-Type': mime }, body: blob });
      return (await r.json()).id;
    }
    const boundary = 'scaffale' + Math.random().toString(36).slice(2);
    const meta = JSON.stringify({ name, parents: [parent], mimeType: mime });
    const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${mime}\r\n\r\n`, blob, `\r\n--${boundary}--`]);
    const r = await this.api('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body });
    return (await r.json()).id;
  },
  download(id) { return this.api(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`); },
};

/* ── Sincronizzazione ──────────────────────────────────────── */
const Sync = { running: false, again: false, timer: null };
function setSync(state, err) {
  S.syncState = state; S.syncError = err || '';
  document.querySelectorAll('.sync-dot').forEach(d => { d.className = 'sync-dot ' + state; });
  if (S.view === 'settings' && state !== 'syncing') render();
}
function scheduleSync(ms = 2500) { clearTimeout(Sync.timer); Sync.timer = setTimeout(() => sync(), ms); }
async function markDirty() { S.dirty = true; await setMeta('dirty', true); scheduleSync(); }

function mergeItems(localList, remoteList) {
  const map = new Map(localList.map(i => [i.id, i])); const changed = [];
  for (const r of (remoteList || []).map(normalize)) {
    const l = map.get(r.id);
    if (!l || (r.updatedAt || 0) > (l.updatedAt || 0)) { map.set(r.id, r); changed.push(r); }
  }
  return { all: [...map.values()], changed };
}

async function sync() {
  if (!cfg('clientId')) { setSync('off'); return; }
  if (Sync.running) { Sync.again = true; return; }
  if (!Drive.token()) { setSync('login'); return; }
  if (!navigator.onLine) { setSync('off'); return; }
  Sync.running = true; setSync('syncing');
  try {
    const m = (await getMeta('drive')) || {};
    if (!m.folder) m.folder = await Drive.folder('Scaffale');
    if (!m.photos) m.photos = await Drive.folder('foto', m.folder);
    if (!m.file) { const f = await Drive.find(`name='scaffale.json' and '${m.folder}' in parents and trashed=false`); if (f[0]) m.file = f[0].id; }
    await setMeta('drive', m);

    let remote = { items: [], foto: {} };
    if (m.file) {
      try { remote = await (await Drive.download(m.file)).json(); }
      catch (e) { if (e.status === 404) { m.file = null; await setMeta('drive', m); } else throw e; }
    }
    const { all, changed } = mergeItems(await DB.all('items'), remote.items);
    if (changed.length) await DB.putMany('items', changed);

    const photoMap = { ...(remote.foto || {}), ...((await getMeta('photoMap')) || {}) };
    let uploaded = 0;
    const used = new Set(all.filter(i => !i.deleted).flatMap(i => i.foto || []));
    for (const p of await DB.all('photos')) {
      if (!photoMap[p.id] && p.blob && used.has(p.id)) {
        photoMap[p.id] = await Drive.upload(p.id + '.jpg', m.photos, p.blob, 'image/jpeg');
        await setMeta('photoMap', photoMap); uploaded++;
      }
    }
    await setMeta('photoMap', photoMap);

    const remoteIds = new Set((remote.items || []).map(i => i.id + ':' + (i.updatedAt || 0)));
    const remoteBehind = all.some(i => !remoteIds.has(i.id + ':' + (i.updatedAt || 0)));
    if (S.dirty || uploaded || remoteBehind || !m.file) {
      const data = { app: 'Scaffale', versione: 1, aggiornato: new Date().toISOString(), items: all, foto: photoMap };
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      try { m.file = await Drive.upload('scaffale.json', m.folder, blob, 'application/json', m.file); }
      catch (e) { if (e.status === 404) { m.file = await Drive.upload('scaffale.json', m.folder, blob, 'application/json'); } else throw e; }
      await setMeta('drive', m);
    }
    S.dirty = false; await setMeta('dirty', false);
    S.lastSync = Date.now(); await setMeta('lastSync', S.lastSync);
    if (changed.length) { await loadItems(); if (S.view !== 'edit') render(); }
    setSync('ok');
  } catch (e) {
    if (e instanceof NeedLogin) setSync('login');
    else if (e.status === 404 && /folder|File not found/i.test(e.detail || '')) { await setMeta('drive', {}); setSync('error', 'Cartella su Drive non trovata, riprova'); }
    else { console.error(e); setSync('error', (e.message || 'Errore') + (e.detail ? ' — ' + String(e.detail).slice(0, 120) : '')); }
  } finally {
    Sync.running = false;
    if (Sync.again) { Sync.again = false; scheduleSync(500); }
  }
}

/* ── Salvataggio ───────────────────────────────────────────── */
async function saveItem(it) {
  it.updatedAt = Date.now();
  await DB.put('items', it);
  const idx = S.items.findIndex(x => x.id === it.id);
  idx >= 0 ? (S.items[idx] = it) : S.items.push(it);
  markDirty();
}

/* ── Backup ────────────────────────────────────────────────── */
const blobToDataURL = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
async function exportBackup() {
  toast('Preparo il backup…');
  const items = await DB.all('items'); const photos = {};
  const used = new Set(items.filter(i => !i.deleted).flatMap(i => i.foto || []));
  for (const id of used) { const p = await DB.get('photos', id); if (p && p.blob) photos[id] = await blobToDataURL(p.blob); }
  const data = { app: 'Scaffale', versione: 1, esportato: new Date().toISOString(), items, fotoDati: photos };
  const name = `scaffale-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Backup Scaffale' }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
async function importBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    if (!Array.isArray(data.items)) throw new Error('formato');
    for (const [id, du] of Object.entries(data.fotoDati || {})) { const blob = await (await fetch(du)).blob(); await DB.put('photos', { id, blob }); }
    const { changed } = mergeItems(await DB.all('items'), data.items);
    await DB.putMany('items', changed); await loadItems();
    toast(`Importati ${changed.length} pezzi`); markDirty(); render();
  } catch (e) { toast('File di backup non valido'); }
}

/* ── Azioni ────────────────────────────────────────────────── */
const actions = {
  closeSheet, back: () => history.back(),
  settings: () => go('settings'),
  filter: el => {
    S.filter = el.dataset.v; localStorage.setItem('filter', S.filter);
    document.querySelectorAll('.chips .chip').forEach(c => c.classList.toggle('on', c === el));
    renderGrid(); centerChip(true);
  },
  open: el => { closeSheet(); go('detail', el.dataset.id); },
  add: () => sheetAdd(),
  addTipo: el => { S.addTipo = el.dataset.v; sheetAdd(); },
  addScan: () => { closeSheet(); const t = S.addTipo; Scanner.start(code => handleCode(code, t, false)); },
  addSearch: () => { S.intoDraft = false; sheetSearch(S.addTipo); },
  addManual: () => { closeSheet(); startDraft({ tipo: S.addTipo }, false); },
  manualWithCode: () => { const c = S.searchCtx || {}; closeSheet(); startDraft({ tipo: c.tipo || S.addTipo, codice: c.code || '' }, S.intoDraft); },
  pick: el => pickCandidate(S.candidates[+el.dataset.v]),
  closeScanner: () => Scanner.stop(),
  scanPhoto: () => $('#scanPhotoInput').click(),

  scanForDraft: () => { const t = S.draft.tipo; Scanner.start(code => { S.draft.codice = code; handleCode(code, t, true); }); },
  searchForDraft: () => { S.intoDraft = true; sheetSearch(S.draft.tipo, [S.draft.titolo, isMusic(S.draft.tipo) ? S.draft.autore : ''].filter(Boolean).join(' ')); },
  draftTipo: el => { S.draft.tipo = el.dataset.v; render(); },
  rateDraft: el => { const v = +el.dataset.v; S.draft.valutazione = S.draft.valutazione === v ? 0 : v; el.parentElement.outerHTML = starsHTML(S.draft.valutazione, 'rateDraft'); },
  addPhoto: () => $('#photoInput').click(),
  rmPhoto: el => { S.draft.foto = S.draft.foto.filter(p => p !== el.dataset.v); render(); },
  rmCover: () => { S.draft.coverUrl = ''; render(); },
  cancelEdit: () => { discardDraftPhotos(); S.draft = null; history.back(); },
  save: async () => {
    const d = S.draft;
    if (!d.titolo.trim()) { toast('Serve almeno il titolo'); $('[data-f="titolo"]')?.focus(); return; }
    d.titolo = d.titolo.trim();
    const isNew = S.draftIsNew; S.newPhotos = []; S.draft = null;
    if (!isNew) { const orig = byId(d.id); (orig?.foto || []).filter(p => !d.foto.includes(p)).forEach(p => DB.del('photos', p)); }
    await saveItem(d);
    toast(isNew ? 'Aggiunto allo scaffale' : 'Salvato');
    if (isNew) { history.replaceState({ view: 'detail', id: d.id }, ''); S.view = 'detail'; S.id = d.id; render(); window.scrollTo(0, 0); }
    else history.back();
  },

  edit: el => { const it = byId(el.dataset.id); S.draft = JSON.parse(JSON.stringify(it)); S.draft.foto = S.draft.foto || []; S.draft.commenti = S.draft.commenti || []; S.draftIsNew = false; S.newPhotos = []; go('edit'); },
  rateDetail: async el => { const it = byId(S.id); const v = +el.dataset.v; it.valutazione = it.valutazione === v ? 0 : v; await saveItem(it); el.parentElement.outerHTML = starsHTML(it.valutazione, 'rateDetail'); },
  expand: () => { S.expanded = true; render(); },
  returned: async () => { const it = byId(S.id); it.prestatoA = ''; it.prestatoIl = ''; await saveItem(it); render(); toast('Segnato come restituito'); },
  delComment: async el => { if (!confirm('Eliminare questo commento?')) return; const it = byId(S.id); it.commenti = (it.commenti || []).filter(c => c.id !== el.dataset.v); await saveItem(it); render(); },
  delete: async () => {
    const it = byId(S.id); if (!confirm(`Eliminare "${it.titolo}" dallo scaffale?`)) return;
    const keep = { id: it.id, deleted: true, createdAt: it.createdAt };
    (it.foto || []).forEach(p => DB.del('photos', p));
    await saveItem(keep); toast('Eliminato'); history.back();
  },
  viewPhoto: async el => { const u = await photoURL(el.dataset.v); if (u) openSheet(`<img src="${u}" alt="" style="width:100%;border-radius:12px">`); },

  syncTap: () => { if (!cfg('clientId')) go('settings'); else if (!Drive.token()) Drive.login(); else { sync(); toast('Sincronizzazione…', 1200); } },
  login: () => Drive.login(),
  syncNow: () => sync(),
  logout: () => { Drive.logout(); setSync('login'); render(); },
  export: () => exportBackup(),
  import: () => $('#importInput').click(),
  saveCfg: () => {
    ['booksKey', 'tmdbKey', 'discogsToken', 'clientId'].forEach(k => { const el = $('#cfg-' + k); if (el) setCfg(k, el.value); });
    toast('Impostazioni salvate'); render();
  },
};
// "Aggiungi un'altra copia": procedi ignorando il duplicato
actions.dupAnyway = () => { const p = S.pendingCode; closeSheet(); handleCode(p.code, p.tipo, 'force'); };

document.addEventListener('click', e => {
  const a = e.target.closest('[data-a]'); if (!a) return;
  const fn = actions[a.dataset.a]; if (!fn) return;
  e.preventDefault(); fn(a, e);
});

document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'q') { S.q = t.value; renderGrid(); return; }
  if (t.dataset.f && S.draft) S.draft[t.dataset.f] = t.type === 'checkbox' ? t.checked : t.value;
  if (t.id === 'commentText') { t.style.height = 'auto'; t.style.height = Math.min(140, t.scrollHeight) + 'px'; }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'sort') { S.sort = t.value; localStorage.setItem('sort', S.sort); renderGrid(); }
  if (t.dataset.f && S.draft) S.draft[t.dataset.f] = t.type === 'checkbox' ? t.checked : t.value;
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  if (e.target.id === 'manualCodeForm') {
    const code = $('#manualCode').value.replace(/\D/g, ''); if (code.length < 8) { toast('Codice troppo corto'); return; }
    Scanner.submit(code);
  }
  if (e.target.id === 'titleSearch') {
    const q = $('#titleQ').value.trim(); if (!q) return; $('#titleQ').blur();
    const box = $('#results'); box.innerHTML = loadingHTML('Cerco…');
    const list = await searchByTitle(S.searchCtx.tipo, q).catch(() => []);
    if (S.searchCtx.code) list.forEach(c => { c.codice = S.searchCtx.code; });
    box.innerHTML = list.length ? resultsHTML(list) : `<p class="note" style="padding:12px 4px">Nessun risultato. Prova con parole diverse${navigator.onLine ? '' : ' (sei offline)'}.</p>`;
  }
  if (e.target.id === 'commentForm') {
    const txt = $('#commentText').value.trim(); if (!txt) return;
    const it = byId(S.id); it.commenti = [...(it.commenti || []), { id: uid(), testo: txt, data: Date.now() }];
    await saveItem(it); render();
  }
});

$('#photoInput').addEventListener('change', async e => {
  const files = [...e.target.files]; e.target.value = ''; if (!files.length || !S.draft) return;
  toast('Elaboro le foto…', 1500);
  for (const f of files) {
    try { const blob = await compressImage(f); const id = uid(); await DB.put('photos', { id, blob }); S.draft.foto.push(id); S.newPhotos.push(id); }
    catch (err) { toast('Formato foto non supportato'); }
  }
  render();
});
$('#scanPhotoInput').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f && Scanner.onCode) Scanner.fromPhoto(f); });
$('#importInput').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importBackup(f); });

window.addEventListener('online', () => scheduleSync(800));
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') scheduleSync(800); });

/* ── Avvio ─────────────────────────────────────────────────── */
(async function init() {
  await DB.open();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  const justLogged = Drive.handleRedirect();
  await loadItems();
  S.dirty = !!(await getMeta('dirty'));
  S.lastSync = (await getMeta('lastSync')) || 0;
  history.replaceState({ view: 'list' }, '');
  render();
  if (cfg('clientId')) { if (Drive.token()) { sync(); if (justLogged) toast('Collegato a Google Drive'); } else setSync('login'); }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
})();
