/* Scaffale — inventario personale di libri, dischi e film.
   App web installabile (PWA). Dati sul telefono + copia su Google Drive. */
'use strict';

const VERSION = '2.3.0';
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
const stripHtml = s => { const d = document.createElement('div'); d.innerHTML = String(s || '').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n'); return (d.textContent || '').trim(); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LOC = () => (window.I18N ? I18N.locale() : 'it-IT');
const tr = s => (window.I18N ? I18N.tr(s) : s);
const LNG = () => (window.I18N ? I18N.lang() : 'it');
const fmtDate = ts => new Date(ts).toLocaleDateString(LOC(), { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTime = ts => new Date(ts).toLocaleString(LOC(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

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
const LUNGHEZZE = ['C46', 'C60', 'C90', 'C100', 'C120'];
const MARCHE = ['TDK', 'Maxell', 'BASF', 'Sony', 'Memorex', 'Philips', 'Agfa', 'Fuji', "That's", 'Denon', 'Scotch'];
const TAPE_TEMPLATE = 'Lato A\n1. \n2. \n3. \n\nLato B\n1. \n2. \n3. ';
const SPUNTE = {
  vinile:   [['inserto', 'Inserti / poster presenti']],
  cd:       [['booklet', 'Booklet presente'], ['obi', 'Obi strip'], ['custodiaRotta', 'Custodia da sostituire']],
  cassetta: [['jcard', 'J-card presente'], ['linguette', 'Linguette anti-registrazione intatte'], ['testato', 'Nastro testato, suona bene']],
};
const EMPTY = () => ({
  id: uid(), tipo: 'libro', titolo: '', autore: '', anno: '', editore: '', codice: '', formato: '', genere: '',
  descrizione: '', tracklist: '', pagine: '', durata: '', condizione: '', posizione: '', prezzo: '', valutazione: 0,
  catalogo: '', paese: '', confezione: '', condCustodia: '', numDischi: '', spars: '', matrice: '', ifpi: '',
  tipoNastro: '', riduzione: '', origine: '', lunghezzaNastro: '', marcaNastro: '',
  note: '', commenti: [], foto: [], coverUrl: '', prestatoA: '', prestatoIl: '', desiderio: false,
  stato: '', serie: '', volume: '', tags: [], valore: '', valoreDiscogs: null, discogsId: '',
  createdAt: Date.now(), updatedAt: Date.now(),
});
// Stato di lettura / visione / ascolto
const STATI = {
  libro:  [['da', 'Da leggere'], ['in', 'In lettura'], ['fatto', 'Letto']],
  film:   [['da', 'Da vedere'], ['fatto', 'Visto']],
  musica: [['da', 'Da ascoltare'], ['fatto', 'Ascoltato']],
};
const statiFor = t => STATI[t] || (isMusic(t) ? STATI.musica : []);
const statoLabel = it => ((statiFor(it.tipo).find(([k]) => k === it.stato) || [])[1]) || '';
const PRESTITO_GIORNI = 30;
const loanDays = it => it.prestatoIl ? Math.max(0, Math.floor((Date.now() - new Date(it.prestatoIl).getTime()) / 864e5)) : 0;
const num = v => { const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.').replace(/[^\d.\-]/g, '')); return isFinite(n) ? n : 0; };
const money = (v, cur = 'EUR') => new Intl.NumberFormat(LOC(), { style: 'currency', currency: cur || 'EUR', maximumFractionDigits: v >= 100 ? 0 : 2 }).format(v);
// Condizioni dell'app ↔ gradi Discogs (Goldmine)
const GRADE_ORDER = ['Mint (M)', 'Near Mint (NM or M-)', 'Very Good Plus (VG+)', 'Very Good (VG)', 'Good Plus (G+)', 'Good (G)', 'Fair (F)', 'Poor (P)'];
const GRADE_OF = { 'Nuovo / sigillato': 'Mint (M)', 'Come nuovo': 'Near Mint (NM or M-)', 'Ottimo': 'Very Good Plus (VG+)', 'Buono': 'Very Good (VG)', 'Discreto': 'Good Plus (G+)', 'Rovinato': 'Fair (F)' };
const GRADE_LABEL = { 'Mint (M)': 'Nuovo / sigillato', 'Near Mint (NM or M-)': 'Come nuovo', 'Very Good Plus (VG+)': 'Ottimo', 'Very Good (VG)': 'Buono', 'Good Plus (G+)': 'Discreto', 'Good (G)': 'Mediocre', 'Fair (F)': 'Rovinato', 'Poor (P)': 'Pessimo' };
const gradeShort = g => ({ 'Near Mint (NM or M-)': 'NM' }[g] || (String(g).match(/\(([^)]+)\)/) || [])[1] || g);
const DEFAULT_GRADE = 'Very Good Plus (VG+)';
// Valore di un pezzo: quello inserito a mano vince; poi il prezzo Discogs per la condizione della copia; poi il minimo in vendita
function marketValue(it) {
  const man = num(it.valore);
  if (man) return { v: man, cur: 'EUR', src: 'manuale' };
  const d = it.valoreDiscogs;
  if (d && d.sugg) {
    const g = GRADE_OF[it.condizione] || DEFAULT_GRADE;
    if (d.sugg[g] != null) return { v: d.sugg[g], cur: d.scur || 'EUR', src: 'discogs', grade: g, assumed: !GRADE_OF[it.condizione] };
  }
  if (d && d.min) return { v: d.min, cur: d.cur || 'EUR', src: 'minimo' };
  return { v: 0, cur: 'EUR', src: '' };
}
const valueOf = it => marketValue(it).v;
const parseTags = s => [...new Set(String(s || '').split(/[,#\n]/).map(t => t.trim()).filter(Boolean))];
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^(the|il|lo|la|i|gli|le|l'|el|los|las)\s+/, '').replace(/[^a-z0-9]/g, '');
// Tutte le forme in cui lo stesso codice può essere scritto (ISBN 10/13, UPC 12/EAN 13)
function codeVariants(c) {
  c = String(c || '').replace(/[^\dX]/gi, '').toUpperCase(); if (!c) return [];
  const out = new Set(isbnVariants(c));
  if (c.length === 13 && c[0] === '0') out.add(c.slice(1));
  if (c.length === 12) out.add('0' + c);
  return [...out];
}
const sameCode = (a, b) => { const A = codeVariants(a); return !!A.length && codeVariants(b).some(v => A.includes(v)); };
// Stessa opera (titolo e primo autore uguali), per riconoscere altre edizioni
const sameWork = (i, c) => norm(String(i.titolo).split(/[:(\[]/)[0]) === norm(String(c.titolo).split(/[:(\[]/)[0]) &&
  (!i.autore || !c.autore || norm(String(i.autore).split(/[,&]/)[0]) === norm(String(c.autore).split(/[,&]/)[0]));
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
  if (it && !it.deleted && !Array.isArray(it.tags)) it.tags = parseTags(it.tags);
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
  check: '<path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2"/><path d="m8 12.5 2.8 2.8L16.5 9"/>',
  chart: '<path d="M3 20h18"/><path d="M6 16v-4M11 16V6M16 16V9M21 16v-2"/>',
  dice: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="9" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="9" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="9" cy="15" r="1.3" fill="currentColor" stroke="none"/><circle cx="15" cy="15" r="1.3" fill="currentColor" stroke="none"/>',
  share: '<path d="M12 3v12M7.5 7.5 12 3l4.5 4.5"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/>',
  bolt: '<path d="M13 3 5 14h6l-1 7 8-11h-6z"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  download: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5"/><path d="M5 19h14"/>',
};
const ic = (n, size) => `<svg class="i" viewBox="0 0 24 24"${size ? ` style="width:${size}px;height:${size}px"` : ''}>${ICON[n]}</svg>`;

/* ── Configurazione ────────────────────────────────────────── */
const BASE = window.SCAFFALE_CONFIG || {};
function cfg(k) {
  const local = localStorage.getItem('cfg_' + k);
  if (local) return local;
  return { clientId: BASE.GOOGLE_CLIENT_ID, tmdbKey: BASE.TMDB_API_KEY, discogsToken: BASE.DISCOGS_TOKEN, booksKey: BASE.GOOGLE_BOOKS_KEY, visionKey: BASE.GOOGLE_VISION_KEY }[k] || '';
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
  batch: [], batchTipo: 'libro', batchTarget: null, pickTipo: 'tutti', valuing: null,
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
  S.view = view; S.id = id || null; S.expanded = false; S.batchTarget = null;
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
  else if (S.view === 'stats') app.innerHTML = viewStats();
  else if (S.view === 'batch') app.innerHTML = viewBatch();
  else { S.view = 'list'; app.innerHTML = viewList(); renderGrid(); centerChip(false); }
  hydratePhotos(app);
}

function syncBtn() {
  return `<button class="iconbtn" data-a="syncTap" aria-label="Sincronizza">${ic('cloud')}<i class="sync-dot ${S.syncState}"></i></button>`;
}

function counts() {
  const L = live(); const c = { tutti: 0, libro: 0, vinile: 0, cd: 0, cassetta: 0, film: 0, desideri: 0, prestito: 0, scoprire: 0, valore: 0 };
  L.forEach(i => {
    if (i.desiderio) c.desideri++; else { c.tutti++; c[i.tipo]++; c.valore += valueOf(i); if (i.stato === 'da' || i.stato === 'in') c.scoprire++; }
    if (i.prestatoA) c.prestito++;
  });
  return c;
}

function viewList() {
  const c = counts();
  const compact = v => new Intl.NumberFormat(LOC(), { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: v >= 1000 ? 1 : 0 }).format(v);
  const chips = [['tutti', 'Tutti'], ...Object.entries(TIPI).map(([k, v]) => [k, v.plural]), ['valore', 'Valore'], ['scoprire', 'Da scoprire'], ['desideri', 'Desideri'], ['prestito', 'In prestito']]
    .filter(([k]) => !['desideri', 'prestito', 'scoprire'].includes(k) || c[k] > 0 || S.filter === k)
    .map(([k, l]) => `<button class="chip ${S.filter === k ? 'on' : ''}" data-a="filter" data-v="${k}">${l}<b>${k === 'valore' ? (c.valore ? compact(c.valore) : '€') : c[k]}</b></button>`).join('');
  const needLogin = cfg('clientId') && S.syncState === 'login' && S.dirty;
  const queued = S.batch.length;
  return `
  <header class="top">
    <div class="grow"><h1>Spinyl</h1></div>
    <button class="iconbtn" data-a="check" aria-label="Ce l'ho già?">${ic('check')}</button>
    <button class="iconbtn" data-a="stats" aria-label="Statistiche">${ic('chart')}</button>
    ${syncBtn()}
    <button class="iconbtn" data-a="settings" aria-label="Impostazioni">${ic('gear')}</button>
  </header>
  <div class="searchbar"><label>${ic('search', 18)}<input id="q" type="search" placeholder="Cerca titolo, autore, codice, note…" value="${esc(S.q)}" autocomplete="off"></label></div>
  <nav class="chips">${chips}</nav>
  ${needLogin ? `<div class="banner">Ci sono modifiche da salvare su Drive.<button data-a="login">Accedi</button></div>` : ''}
  ${queued ? `<div class="banner">${queued === 1 ? '1 codice in coda' : queued + ' codici in coda'} dalla scansione a raffica.<button data-a="openBatch">Apri</button></div>` : ''}
  <div class="sortrow"><span id="countLbl"></span>
    <select id="sort" aria-label="Ordina">
      ${[['recenti', 'Aggiunti di recente'], ['titolo', 'Titolo A–Z'], ['autore', 'Autore A–Z'], ['anno', 'Anno'], ['voto', 'Voto'], ['serie', 'Serie'], ['valore', 'Valore']].map(([k, l]) => `<option value="${k}" ${S.sort === k ? 'selected' : ''}>${l}</option>`).join('')}
    </select></div>
  <div id="listTools"></div>
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
    if (S.filter === 'scoprire') return i.stato === 'da' || i.stato === 'in';
    if (S.filter === 'valore') return true;
    return S.filter === 'tutti' || i.tipo === S.filter;
  });
  // "#etichetta" cerca solo tra le etichette
  if (q.startsWith('#') && q.length > 1) { const t = q.slice(1).trim(); L = L.filter(i => (i.tags || []).some(x => x.toLowerCase() === t)); }
  else if (q) L = L.filter(i => [i.titolo, i.autore, i.codice, i.editore, i.genere, i.posizione, i.note, i.anno, i.formato, i.prestatoA, i.serie, i.catalogo, ...(i.tags || []), ...(i.commenti || []).map(c => c.testo)].join(' ').toLowerCase().includes(q));
  const cmp = (a, b) => String(a || '').localeCompare(String(b || ''), LOC(), { sensitivity: 'base', numeric: true });
  const sorters = {
    recenti: (a, b) => (b.createdAt || 0) - (a.createdAt || 0),
    titolo: (a, b) => cmp(a.titolo, b.titolo),
    autore: (a, b) => cmp(a.autore, b.autore) || cmp(a.anno, b.anno),
    anno: (a, b) => (parseInt(b.anno) || 0) - (parseInt(a.anno) || 0),
    voto: (a, b) => (b.valutazione || 0) - (a.valutazione || 0),
    serie: (a, b) => (!a.serie - !b.serie) || cmp(a.serie, b.serie) || (num(a.volume) - num(b.volume)) || cmp(a.titolo, b.titolo),
    valore: (a, b) => valueOf(b) - valueOf(a) || cmp(a.titolo, b.titolo),
  };
  return L.sort(sorters[S.sort] || sorters.recenti);
}

function renderGrid() {
  const g = $('#grid'); if (!g) return;
  const L = filtered();
  $('#countLbl').textContent = `${L.length} ${L.length === 1 ? 'pezzo' : 'pezzi'}`;
  const tools = $('#listTools');
  if (tools) {
    const tag = S.q.trim().startsWith('#') ? S.q.trim() : '';
    tools.innerHTML = (S.filter === 'desideri' && L.length ? `<button class="toolbtn" data-a="shareWish">${ic('share', 18)}Condividi la lista desideri</button>` : '')
      + (tag ? `<button class="toolbtn" data-a="clearTag">Filtro <b translate="no">${esc(tag)}</b> ✕</button>` : '');
  }
  if (!live().length) {
    g.innerHTML = `<div class="empty" style="grid-column:1/-1">${ic('book', 44)}<h2>Lo scaffale è vuoto</h2><p>Scansiona il codice a barre di un libro, un disco o un film: i dati si compilano da soli.</p><button class="btn primary" data-a="add">${ic('scan')}Aggiungi il primo</button></div>`;
    return;
  }
  const sortSel = $('#sort'); if (sortSel) sortSel.style.visibility = S.filter === 'valore' ? 'hidden' : '';
  if (!L.length) { g.innerHTML = `<div class="empty" style="grid-column:1/-1"><p>Nessun risultato.</p></div>`; return; }
  if (S.filter === 'valore') { g.innerHTML = valueTableHTML(L); hydratePhotos(g); return; }
  const label = i => { const T = TIPI[i.tipo]; if (!T) return ''; const f = i.formato || ''; return f && f.toLowerCase().startsWith(T.label.toLowerCase()) ? f : [T.label, f].filter(Boolean).join(' · '); };
  g.innerHTML = L.map(i => `
    <button class="card t-${esc(i.tipo)}" data-a="open" data-id="${esc(i.id)}">
      ${coverHTML(i)}
      <i class="stripe"></i>
      ${i.prestatoA ? `<span class="tag loan ${loanDays(i) > PRESTITO_GIORNI ? 'late' : ''}">${loanDays(i) > PRESTITO_GIORNI ? 'Da ' + loanDays(i) + ' giorni' : 'In prestito'}</span>` : i.desiderio ? `<span class="tag">Desiderio</span>` : i.stato === 'in' ? `<span class="tag now">${esc(statoLabel(i))}</span>` : ''}
      ${S.sort === 'serie' && i.serie && i.volume ? `<span class="tag vol" translate="no">#${esc(i.volume)}</span>` : ''}
      <div class="meta"><b translate="no">${esc(i.titolo || tr('Senza titolo'))}</b><span translate="no">${esc((S.sort === 'serie' && i.serie ? [i.serie, i.volume && 'vol. ' + i.volume] : [i.autore, i.anno]).filter(Boolean).join(' · ') || '—')}</span><em>${esc(label(i))}</em></div>
    </button>`).join('');
  hydratePhotos(g);
}

// Tab "Valore": totale per categoria, diviso per condizione, con il valore di ogni pezzo
function valueTableHTML(L) {
  const tot = L.reduce((t, i) => t + valueOf(i), 0); const valued = L.filter(i => valueOf(i) > 0).length;
  const music = L.filter(i => isMusic(i.tipo)).length;
  const SRC = { manuale: 'stimato da te', discogs: 'Discogs', minimo: 'min. Discogs' };
  let h = `<div class="vt" style="grid-column:1/-1">
    <div class="vt-total"><span>Valore totale</span><b>${esc(money(tot))}</b><small>${valued === L.length ? (L.length === 1 ? '1 pezzo con valore' : `tutti i ${L.length} pezzi hanno un valore`) : `${valued} pezzi su ${L.length} con valore`}</small></div>
    ${music && cfg('discogsToken') ? `<button id="valueAllBtn" class="btn block" data-a="valueAll">${S.valuing && S.valuing.all ? `Aggiorno ${S.valuing.done} di ${S.valuing.tot}… (tocca per fermare)` : 'Aggiorna i prezzi dei dischi da Discogs'}</button>` : ''}`;
  Object.keys(TIPI).forEach(k => {
    const items = L.filter(i => i.tipo === k); if (!items.length) return;
    const sum = items.reduce((t, i) => t + valueOf(i), 0);
    const by = {}; items.forEach(i => { const c = CONDIZIONI.includes(i.condizione) ? i.condizione : ''; (by[c] = by[c] || [0, 0]); by[c][0]++; by[c][1] += valueOf(i); });
    const conds = [...CONDIZIONI, ''].filter(c => by[c]);
    const rows = items.slice().sort((a, b) => valueOf(b) - valueOf(a) || String(a.titolo).localeCompare(String(b.titolo), LOC())).map(i => {
      const m = marketValue(i);
      return `<button class="vrow" data-a="open" data-id="${esc(i.id)}">
        <span class="vt-t"><b translate="no">${esc(i.titolo)}</b><small translate="no">${esc([i.autore, i.anno].filter(Boolean).join(' · '))}</small></span>
        <span class="vt-c">${i.condizione ? `<span>${esc(i.condizione)}</span>` : '<span class="muted">—</span>'}${isMusic(i.tipo) && GRADE_OF[i.condizione] ? `<i translate="no">${esc(gradeShort(GRADE_OF[i.condizione]))}</i>` : ''}</span>
        <span class="vt-v">${m.v ? `<b>${esc(money(m.v, m.cur))}</b><i>${SRC[m.src]}</i>` : '<b class="muted">—</b>'}</span>
      </button>`;
    }).join('');
    h += `<section class="vgroup t-${k}">
      <header><b>${TIPI[k].plural}</b><small>${items.length === 1 ? '1 pezzo' : items.length + ' pezzi'}</small><span>${esc(money(sum))}</span></header>
      <div class="vconds">${conds.map(c => `<div class="vc"><span>${c ? esc(c) : 'Condizione non indicata'}</span><small>× ${by[c][0]}</small><b>${by[c][1] ? esc(money(by[c][1])) : '—'}</b></div>`).join('')}</div>
      <div class="vrows">${rows}</div>
    </section>`;
  });
  h += `<p class="note vt-note">Dischi: prezzo suggerito da Discogs per la condizione della tua copia (se la condizione manca, viene calcolato come Ottimo · VG+). Libri e film: il valore stimato che scrivi tu nella scheda. Il valore che inserisci a mano vale sempre più di quello automatico.</p></div>`;
  return h;
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
    ['Serie', it.serie && [it.serie, it.volume && 'vol. ' + it.volume].filter(Boolean).join(' · ')],
    ['Formato', it.formato], ['Confezione', M && it.confezione], ['Dischi', M && it.numDischi && +it.numDischi > 1 && it.numDischi],
    ['Codice SPARS', it.tipo === 'cd' && it.spars], ['Nastro', it.tipo === 'cassetta' && it.tipoNastro],
    ['Riduzione rumore', it.tipo === 'cassetta' && it.riduzione], ['Durata nastro', it.tipo === 'cassetta' && it.lunghezzaNastro], ['Marca nastro', it.tipo === 'cassetta' && it.marcaNastro], ['Origine', it.tipo === 'cassetta' && it.origine],
    ['Genere', it.genere], ['Pagine', it.tipo === 'libro' && it.pagine], ['Durata', it.tipo === 'film' && it.durata],
    [M ? 'Condizione ' + T.supporto.toLowerCase() : 'Condizione', it.condizione], ['Condizione ' + (T.custodia || '').toLowerCase(), M && it.condCustodia],
    ['Dettagli', spunte],
    ['Posizione', it.posizione], ['Prezzo pagato', it.prezzo && (num(it.prezzo) ? money(num(it.prezzo)) : it.prezzo)],
    ['Valore stimato', it.valore && (num(it.valore) ? money(num(it.valore)) : it.valore)],
    [T.codice, it.codice], ['Matrice / runout', M && it.matrice], ['Codici IFPI', it.tipo === 'cd' && it.ifpi],
    ['Aggiunto il', fmtDate(it.createdAt)],
  ].filter(([, v]) => v);
  const desc = it.descrizione || '';
  const longDesc = desc.length > 320;
  const stati = statiFor(it.tipo);
  const days = loanDays(it);
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
      <h2 translate="no">${esc(it.titolo || tr('Senza titolo'))}</h2>
      <div class="who" translate="no">${esc([it.autore, it.anno].filter(Boolean).join(' · '))}</div>
      ${starsHTML(it.valutazione || 0, 'rateDetail')}
    </div>
  </div>
  <div class="detail">
    ${it.desiderio ? `<button class="btn primary block" style="margin-top:14px" data-a="gotIt">L'ho comprato!</button>` : ''}
    ${stati.length && !it.desiderio ? `<div class="seg statseg" style="grid-template-columns:repeat(${stati.length},1fr)">${stati.map(([k, l]) => `<button type="button" class="${it.stato === k ? 'on' : ''}" data-a="setStato" data-v="${k}">${it.stato === k ? '✓ ' : ''}${l}</button>`).join('')}</div>` : ''}
    ${it.prestatoA ? `<div class="loanbox ${days > PRESTITO_GIORNI ? 'late' : ''}"><div>In prestito a <b translate="no">${esc(it.prestatoA)}</b>${it.prestatoIl ? `<small>${days === 0 ? 'da oggi' : days === 1 ? 'da 1 giorno' : 'da ' + days + ' giorni'}</small>` : ''}</div>
      <div class="loanacts"><button data-a="remind">Ricordaglielo</button><button data-a="returned">Restituito</button></div></div>` : ''}
    ${desc ? `<div class="section"><h3>Descrizione</h3><div translate="no" class="prose ${longDesc && !S.expanded ? 'clamp' : ''}">${esc(desc)}</div>${longDesc && !S.expanded ? '<button class="more" data-a="expand">Leggi tutto</button>' : ''}</div>` : ''}
    ${isMusic(it.tipo) && it.tracklist ? `<div class="section"><h3>Tracce</h3><div class="tracks" translate="no">${esc(it.tracklist)}</div></div>` : ''}
    ${valueHTML(it)}
    ${facts.length ? `<div class="section"><dl class="facts">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>` : ''}
    ${(it.tags || []).length ? `<div class="section"><h3>Etichette</h3><div class="tagrow">${it.tags.map(t => `<button class="tagchip" data-a="tag" data-v="${esc(t)}" translate="no">#${esc(t)}</button>`).join('')}</div></div>` : ''}
    ${seriesHTML(it)}
    ${linksHTML(it)}
    ${it.foto && it.foto.length ? `<div class="section"><h3>Foto</h3><div class="photos">${it.foto.map(p => `<button class="photo" data-a="viewPhoto" data-v="${esc(p)}"><img data-photo="${esc(p)}" alt="" hidden></button>`).join('')}</div></div>` : ''}
    ${it.note ? `<div class="section"><h3>Note</h3><div class="prose" translate="no">${esc(it.note)}</div></div>` : ''}
    <div class="section"><h3>Commenti</h3>
      ${(it.commenti || []).map(c => `<div class="comment"><p translate="no">${esc(c.testo)}<small>${esc(fmtDateTime(c.data))}</small></p><button data-a="delComment" data-v="${esc(c.id)}" aria-label="Elimina commento">✕</button></div>`).join('')}
      <form class="composer" id="commentForm"><textarea id="commentText" rows="1" placeholder="Scrivi un commento…"></textarea><button type="submit">Invia</button></form>
    </div>
    <div class="actions">
      <button class="btn" data-a="edit" data-id="${esc(it.id)}">${ic('pen', 18)}Modifica</button>
      <button class="btn danger" data-a="delete">${ic('trash', 18)}Elimina</button>
    </div>
  </div>`;
}

// Valore: per i dischi i prezzi Discogs per condizione, per libri e film i venduti su eBay / AbeBooks
function valueHTML(it) {
  const m = marketValue(it);
  const head = m.v ? `<div class="value"><b>${esc(money(m.v, m.cur))}</b><span>${
    m.src === 'manuale' ? 'valore inserito da te'
    : m.src === 'minimo' ? 'prezzo minimo in vendita su Discogs'
    : m.assumed ? 'condizione non indicata: calcolato come Ottimo (VG+)'
    : `per la tua copia · ${esc(it.condizione)}`}</span></div>` : '';
  if (!isMusic(it.tipo)) {
    return `<div class="section"><h3>Quanto vale?</h3>${head}
      <p class="note pnote">Per libri e film non esiste un listino gratuito: guarda a quanto sono stati venduti davvero, poi scrivi il valore nella scheda (Modifica › Valore stimato).</p>${soldLinks(it)}</div>`;
  }
  const v = it.valoreDiscogs; const tok = !!cfg('discogsToken');
  const busy = S.valuing && S.valuing.id === it.id;
  let body = head;
  if (v) {
    body += priceTableHTML(v, it.condizione);
    body += `<p class="note value-note"><span>Aggiornato il ${esc(fmtDate(v.at))}</span>${v.match === 'titolo' ? '<br><span>Edizione trovata per titolo: controlla che sia la tua.</span>' : ''}</p>`;
  } else if (tok) body += `<p class="note pnote">Scopri quanto vale questa edizione: Discogs suggerisce un prezzo per ogni condizione, in base alle vendite.</p>`;
  else body += `<p class="note pnote">Per i prezzi dei dischi inserisci il token Discogs nelle Impostazioni.</p>`;
  return `<div class="section"><h3>Valore di mercato</h3>${body}${soldLinks(it)}
    ${tok ? `<div class="stack" style="padding-top:2px"><button class="btn block" data-a="valueNow" ${busy ? 'disabled' : ''}>${busy ? 'Controllo su Discogs…' : v ? 'Aggiorna da Discogs' : 'Controlla il valore su Discogs'}</button></div>` : ''}</div>`;
}

// Gli altri volumi della stessa serie e quelli che mancano
function seriesHTML(it) {
  if (!it.serie) return '';
  const k = norm(it.serie);
  const all = live().filter(i => !i.desiderio && i.serie && norm(i.serie) === k);
  const others = all.filter(i => i.id !== it.id).sort((a, b) => num(a.volume) - num(b.volume) || String(a.titolo).localeCompare(b.titolo));
  const vols = new Set(all.map(i => num(i.volume)).filter(n => n > 0 && Number.isInteger(n)));
  const max = Math.max(0, ...vols);
  const missing = []; for (let n = 1; n <= max && max <= 200; n++) if (!vols.has(n)) missing.push(n);
  if (!others.length && !missing.length) return '';
  return `<div class="section"><h3><span>Serie</span> · <span translate="no">${esc(it.serie)}</span></h3>
    ${missing.length ? `<p class="note" style="margin:8px 0">Ti mancano i volumi: <b translate="no">${missing.slice(0, 30).join(', ')}${missing.length > 30 ? '…' : ''}</b></p>` : ''}
    <div class="minilist">${others.map(o => `<button class="mini" data-a="open" data-id="${esc(o.id)}"><span class="num" translate="no">${esc(o.volume || '–')}</span><span translate="no">${esc(o.titolo)}</span></button>`).join('')}</div></div>`;
}

// Dove ascoltare, guardare o leggere
function linksHTML(it) {
  const enc = encodeURIComponent; const L = [];
  const q = [it.autore, it.titolo].filter(Boolean).join(' ');
  const cc = { it: 'it', en: 'gb', es: 'es' }[LNG()] || 'it';
  if (isMusic(it.tipo)) {
    L.push(['Apple Music', `https://music.apple.com/${cc}/search?term=${enc(q)}`], ['Spotify', `https://open.spotify.com/search/${enc(q)}`], ['YouTube', `https://www.youtube.com/results?search_query=${enc(q)}`]);
    if (it.discogsId) L.push(['Discogs', `https://www.discogs.com/release/${enc(it.discogsId)}`]);
  } else if (it.tipo === 'film') {
    L.push(['Trailer', `https://www.youtube.com/results?search_query=${enc([it.titolo, it.anno, 'trailer'].filter(Boolean).join(' '))}`]);
    L.push(['JustWatch', { it: 'https://www.justwatch.com/it/cerca?q=', en: 'https://www.justwatch.com/uk/search?q=', es: 'https://www.justwatch.com/es/buscar?q=' }[LNG()] + enc(it.titolo)]);
  } else if (it.tipo === 'libro') {
    const isbn = String(it.codice || '').replace(/[^\dX]/gi, '');
    L.push(['Google Libri', isbn ? `https://books.google.com/books?vid=ISBN${isbn}` : `https://www.google.com/search?tbm=bks&q=${enc(q)}`]);
    if (isbn) L.push(['Open Library', `https://openlibrary.org/isbn/${isbn}`]);
  }
  if (!L.length) return '';
  const title = isMusic(it.tipo) ? 'Ascolta' : it.tipo === 'film' ? 'Guarda' : 'Leggi di più';
  return `<div class="section"><h3>${title}</h3><div class="links">${L.map(([n, u]) => `<a class="linkbtn" href="${esc(u)}" target="_blank" rel="noopener">${ic('play', 16)}${esc(n)}</a>`).join('')}</div></div>`;
}

function viewEdit() {
  const d = S.draft; const T = TIPI[d.tipo] || TIPI.libro;
  const posizioni = [...new Set(live().map(i => i.posizione).filter(Boolean))];
  const generi = [...new Set(live().map(i => i.genere).filter(Boolean))];
  const serieList = [...new Set(live().map(i => i.serie).filter(Boolean))];
  const allTags = [...new Set(live().flatMap(i => i.tags || []))].sort((a, b) => a.localeCompare(b));
  const f = (name, label, attrs = '') => `<label class="field"><span>${label}</span><input data-f="${name}" value="${esc(d[name])}" ${attrs}></label>`;
  const sel = (name, label, opts) => `<label class="field"><span>${label}</span><select data-f="${name}"><option value=""></option>${opts.map(o => `<option value="${esc(o)}" ${d[name] === o ? 'selected' : ''}>${esc(o)}</option>`).join('')}${d[name] && !opts.includes(d[name]) ? `<option value="${esc(d[name])}" selected>${esc(d[name])}</option>` : ''}</select></label>`;
  const chk = (name, label) => `<label class="field inline"><span>${label}</span><input type="checkbox" data-f="${name}" ${d[name] ? 'checked' : ''}></label>`;
  const M = isMusic(d.tipo);
  const edizione = !M ? '' : `
    <div class="section">
      <h3>Edizione</h3>
      <div class="two">${sel('confezione', 'Confezione', T.confezioni)}${f('numDischi', d.tipo === 'cassetta' ? 'N. cassette' : 'N. dischi', 'inputmode="numeric"')}</div>
      ${d.tipo === 'cd' ? `<div class="two">${sel('spars', 'Codice SPARS', SPARS)}<div></div></div>` : ''}
      ${d.tipo === 'cassetta' ? `<div class="two">${sel('tipoNastro', 'Tipo di nastro', NASTRI)}${sel('riduzione', 'Riduzione rumore', RIDUZIONI)}</div><div class="two">${sel('lunghezzaNastro', 'Durata nastro', LUNGHEZZE)}<label class="field"><span>Marca nastro</span><input data-f="marcaNastro" list="dl-marche" value="${esc(d.marcaNastro)}"></label></div>${sel('origine', 'Origine', ORIGINI)}<datalist id="dl-marche">${MARCHE.map(x => `<option value="${esc(x)}">`).join('')}</datalist>` : ''}
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
      <div class="two">
        <label class="field"><span>Serie / saga</span><input data-f="serie" list="dl-serie" value="${esc(d.serie)}" autocomplete="off"></label>
        ${f('volume', 'Volume n.', 'inputmode="decimal"')}
      </div>
      ${d.tipo === 'libro' ? f('pagine', 'Pagine', 'inputmode="numeric"') : ''}
      ${d.tipo === 'film' ? f('durata', 'Durata') : ''}
      <label class="field"><span>${T.codice}</span><div class="with-btn"><input data-f="codice" value="${esc(d.codice)}" inputmode="numeric"><button type="button" data-a="scanForDraft" aria-label="Scansiona">${ic('scan')}</button></div></label>
      <label class="field"><span>Descrizione</span><textarea data-f="descrizione" rows="4">${esc(d.descrizione)}</textarea></label>
      ${isMusic(d.tipo) ? `<label class="field"><span>Tracce</span><textarea data-f="tracklist" rows="${d.tipo === 'cassetta' ? 6 : 4}" placeholder="${d.tipo === 'cassetta' ? 'Lato A&#10;1. …&#10;&#10;Lato B&#10;1. …' : ''}">${esc(d.tracklist)}</textarea>${d.tipo === 'cassetta' && !d.tracklist ? '<button type="button" class="more" data-a="tapeTemplate">+ Modello Lato A / Lato B</button>' : ''}</label>` : ''}
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
      ${statiFor(d.tipo).length ? `<div class="field"><span>${d.tipo === 'libro' ? 'Lettura' : d.tipo === 'film' ? 'Visione' : 'Ascolto'}</span><div class="seg" style="grid-template-columns:repeat(${statiFor(d.tipo).length},1fr);margin-top:6px">${statiFor(d.tipo).map(([k, l]) => `<button type="button" class="${d.stato === k ? 'on' : ''}" data-a="draftStato" data-v="${k}">${l}</button>`).join('')}</div></div>` : ''}
      ${M ? `<div class="two">${sel('condizione', 'Condizione ' + T.supporto.toLowerCase(), CONDIZIONI)}${sel('condCustodia', 'Condizione ' + T.custodia.toLowerCase(), CONDIZIONI)}</div>`
        : sel('condizione', 'Condizione', CONDIZIONI)}
      <div class="two">${f('prezzo', 'Prezzo pagato', 'inputmode="decimal"')}${f('valore', 'Valore stimato', 'inputmode="decimal"')}</div>
      <label class="field"><span>Posizione (es. Salotto, scaffale 2)</span><input data-f="posizione" list="dl-pos" value="${esc(d.posizione)}"></label>
      <label class="field"><span>Etichette (separate da virgola, es. Prima stampa, Autografato)</span><input data-f="tagsTxt" value="${esc(d.tagsTxt != null ? d.tagsTxt : (d.tags || []).join(', '))}" autocomplete="off" translate="no"></label>
      ${allTags.filter(t => !parseTags(d.tagsTxt != null ? d.tagsTxt : (d.tags || []).join(',')).includes(t)).length ? `<div class="tagrow suggest">${allTags.filter(t => !parseTags(d.tagsTxt != null ? d.tagsTxt : (d.tags || []).join(',')).includes(t)).slice(0, 12).map(t => `<button type="button" class="tagchip" data-a="addTag" data-v="${esc(t)}" translate="no">+ ${esc(t)}</button>`).join('')}</div>` : ''}
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
    <datalist id="dl-serie" translate="no">${serieList.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
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
    <div class="section"><h3>Lingua</h3>
      <label class="field"><span>Lingua</span><select id="langSel" translate="no">${Object.entries(window.I18N ? I18N.LANGS : { it: 'Italiano' }).map(([k, v]) => `<option value="${k}" ${LNG() === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    </div>

    <div class="section"><h3>Google Drive</h3>
      <div class="status"><i class="${st[0]}"></i><div>${esc(st[1])}<small>${esc(st[2])}</small></div></div>
      <div class="stack">
        ${has && !tok ? `<button class="btn primary block" data-a="login">${ic('cloud', 18)}Accedi con Google</button>` : ''}
        ${has && tok ? `<button class="btn dark block" data-a="syncNow">Sincronizza ora</button><button class="btn block" data-a="logout">Esci da Google</button>` : ''}
        <p class="note">I dati sono salvati nel telefono e copiati nella cartella <b>Scaffale</b> del tuo Google Drive (file <i>scaffale.json</i> e cartella <i>foto</i>). Puoi usare l'app anche offline: si sincronizza appena possibile.</p>
      </div>
    </div>

    <div class="section"><h3>Backup ed esportazione</h3>
      <div class="stack">
        <button class="btn block" data-a="export">Esporta backup completo (con foto)</button>
        <button class="btn block" data-a="import">Importa da backup</button>
        <button class="btn block" data-a="exportCsv">${ic('download', 18)}Esporta tabella CSV (Excel, Numbers)</button>
      </div>
    </div>

    <div class="section"><h3>Importa da altre app</h3>
      <p class="note" style="margin:10px 0">Porta qui una collezione che hai già catalogato altrove. I doppioni vengono saltati.</p>
      <div class="stack">
        <button class="btn block" data-a="importDiscogs" ${cfg('discogsToken') ? '' : 'disabled'}>Collezione Discogs</button>
        ${cfg('discogsToken') ? '' : '<p class="note" style="margin:-4px 0 0">Per Discogs serve il token (qui sotto, in Ricerca online).</p>'}
        <button class="btn block" data-a="importCsv">File CSV: Goodreads, Letterboxd, Discogs</button>
        <p class="note" style="margin:0">Goodreads: My Books › Import and export › Export Library. Letterboxd: Settings › Data › Export (usa watched.csv, ratings.csv o watchlist.csv). Discogs: Collection › Export.</p>
      </div>
    </div>

    <div class="section"><h3>Ricerca online</h3>
      <p class="note" style="margin:10px 0">Libri: Google Libri + Open Library. Vinili, CD e cassette: MusicBrainz + Apple Music (+ Discogs con il token). Film: Apple TV. Con le chiavi facoltative qui sotto la ricerca migliora.</p>
      <details class="adv"><summary>Chiavi facoltative e configurazione avanzata</summary>
        <label class="field"><span>Chiave Google Libri (libri, facoltativa)</span><input id="cfg-booksKey" value="${esc(cfg('booksKey'))}" autocomplete="off"></label>
        <label class="field"><span>Chiave API TMDB (film, consigliata)</span><input id="cfg-tmdbKey" value="${esc(cfg('tmdbKey'))}" autocomplete="off"></label>
        <label class="field"><span>Token Discogs (vinili, CD, cassette)</span><input id="cfg-discogsToken" value="${esc(cfg('discogsToken'))}" autocomplete="off"></label>
        <label class="field"><span>Chiave Google Cloud Vision (riconosce anche le copertine senza scritte, facoltativa)</span><input id="cfg-visionKey" value="${esc(cfg('visionKey'))}" autocomplete="off"></label>
        ${cfg('visionKey') ? `<p class="note" style="margin:6px 0 10px">Google Vision questo mese: ${visionUsed()} di ${VISION_MONTHLY} foto su questo telefono</p>` : ''}
        <label class="field"><span>Client ID Google</span><input id="cfg-clientId" value="${esc(cfg('clientId'))}" autocomplete="off"></label>
        <div class="stack" style="padding-top:12px"><button class="btn block" data-a="saveCfg">Salva impostazioni</button></div>
      </details>
    </div>
    <p class="note" style="text-align:center">Spinyl ${VERSION} · ${live().length} pezzi</p>
  </div>`;
}

/* ── Sheet ─────────────────────────────────────────────────── */
function openSheet(html) {
  $('#sheet').innerHTML = html; $('#sheetWrap').classList.remove('hidden');
  hydratePhotos($('#sheet'));
}
function closeSheet() { $('#sheetWrap').classList.add('hidden'); $('#sheet').innerHTML = ''; }

function sheetAdd() {
  S.pickWish = false; S.coverMode = null;
  const tipoSeg = `<div class="seg seg5" style="margin-bottom:14px">${Object.entries(TIPI).map(([k, v]) => `<button class="${S.addTipo === k ? 'on' : ''}" data-a="addTipo" data-v="${k}">${v.label}</button>`).join('')}</div>`;
  openSheet(`<h2>Aggiungi</h2>${tipoSeg}
    <button class="bigbtn" data-a="addScan"><span class="ic">${ic('scan')}</span><span><b>Scansiona il codice a barre</b><small>Il modo più veloce: compila tutto da solo</small></span></button>
    <button class="bigbtn" data-a="addCover"><span class="ic">${ic('camera')}</span><span><b>Foto della copertina</b><small>Riconosce titolo e autore dalla copertina</small></span></button>
    <button class="bigbtn" data-a="addSearch"><span class="ic">${ic('search')}</span><span><b>Cerca per titolo</b><small>Se il codice manca o non viene trovato</small></span></button>
    <button class="bigbtn" data-a="addManual"><span class="ic">${ic('hand')}</span><span><b>Inserisci a mano</b><small>Per edizioni rare o fatte in casa</small></span></button>
    <button class="bigbtn" data-a="addBatch"><span class="ic">${ic('bolt')}</span><span><b>Scansione a raffica</b><small>Tanti pezzi di fila, li controlli alla fine</small></span></button>`);
}

const searchPlaceholder = tipo => isMusic(tipo) ? 'Artista e titolo' : tipo === 'libro' ? 'Titolo o autore' : 'Titolo del film';
function sheetSearch(tipo, prefill = '', code = '', opts = {}) {
  S.searchCtx = { tipo, code, cover: !!opts.cover };
  const title = opts.cover ? 'Dalla copertina' : `Cerca ${tipo === 'cd' ? 'CD' : TIPI[tipo].label.toLowerCase()}`;
  openSheet(`<h2>${title}</h2>
    ${opts.cover ? `<div class="coverhead">${S.coverShotUrl ? `<img src="${S.coverShotUrl}" alt="">` : ''}<p class="note">${prefill ? (opts.how === 'vision' ? 'Ho riconosciuto la copertina: correggi il testo se serve.' : 'Ho letto le scritte della copertina: correggi il testo se serve.') : 'Non sono riuscito a leggere la copertina: scrivi titolo e autore.'}</p></div>
      <div class="seg seg5" style="margin-bottom:4px">${Object.entries(TIPI).map(([k, v]) => `<button type="button" class="${tipo === k ? 'on' : ''}" data-a="searchTipo" data-v="${k}">${v.label}</button>`).join('')}</div>` : ''}
    ${code ? `<p class="lead">Codice ${esc(code)} non trovato. Prova con il titolo${isMusic(tipo) ? ' e l’artista' : ''}.</p>` : ''}
    <form class="searchform" id="titleSearch"><input id="titleQ" type="search" placeholder="${searchPlaceholder(tipo)}" value="${esc(prefill)}" autocomplete="off" translate="no"><button class="btn primary" type="submit">Cerca</button></form>
    ${opts.cover && !cfg('visionKey') ? '<p class="note" style="margin:-4px 2px 10px">Suggerimento iPhone: tocca il campo, poi “Scansiona testo” per copiare le scritte con la fotocamera.</p>' : ''}
    <div id="results" class="results"></div>
    ${code ? `<button class="btn block" style="margin-top:12px" data-a="manualWithCode">Inserisci a mano</button>` : ''}`);
  if (opts.auto && prefill) setTimeout(() => { const f = $('#titleSearch'); if (f) f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); }, 50);
  else setTimeout(() => $('#titleQ')?.focus(), 250);
}

function loadingHTML(msg) { return `<div class="loading"><div class="spinner"></div>${esc(msg)}</div>`; }

function resultsHTML(list) {
  S.candidates = list;
  return list.map((c, i) => `
    <button class="result" data-a="pick" data-v="${i}">
      <div class="th">${c.coverUrl ? `<img src="${esc(c.coverUrl)}" ${c._coverAlt ? `data-alt="${esc(c._coverAlt)}"` : ''} alt="" loading="lazy" referrerpolicy="no-referrer" onerror="if(this.dataset.alt){this.src=this.dataset.alt;this.dataset.alt=''}else{this.remove()}">` : ''}</div>
      <div><b translate="no">${esc(c.titolo)}</b><span>${esc([c.autore, c.anno, c.editore].filter(Boolean).join(' · '))}</span>${c.sub ? `<span>${esc(c.sub)}</span>` : ''}<em>${esc(c.fonte)}</em></div>
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
      coverUrl: `https://coverartarchive.org/release/${r.id}/front-500`, _coverAlt: r['release-group']?.id ? `https://coverartarchive.org/release-group/${r['release-group'].id}/front-500` : '', descrizione: '', genere: '', fonte: 'MusicBrainz', _mbid: r.id,
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
// Apple accetta richieste da altri siti solo in modalità JSONP (script con callback)
let jsonpN = 0;
function jsonp(url, ms = 12000) {
  return new Promise((res, rej) => {
    const name = '__scaffaleCb' + (++jsonpN) + Date.now().toString(36);
    const sc = document.createElement('script');
    const done = () => { clearTimeout(t); try { delete window[name]; } catch (e) { window[name] = undefined; } sc.remove(); };
    const t = setTimeout(() => { done(); rej(new Error('timeout')); }, ms);
    window[name] = data => { done(); res(data); };
    sc.onerror = () => { done(); rej(new Error('jsonp')); };
    sc.src = url + (url.includes('?') ? '&' : '?') + 'callback=' + name;
    document.head.appendChild(sc);
  });
}
async function itunes(term, entity) {
  const d = await jsonp(`https://itunes.apple.com/search?country=it&lang=it_it&limit=10&entity=${entity}&term=${encodeURIComponent(term)}`);
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

// Film — Wikidata (gratuito, nessuna chiave) + Wikipedia per trama e locandina
const WD = 'https://www.wikidata.org/w/api.php?format=json&origin=*&';
const FILM_CLASSES = new Set(['Q11424', 'Q24869', 'Q506240', 'Q202866', 'Q29168811', 'Q93204', 'Q226730', 'Q24862', 'Q5398426', 'Q1259759', 'Q20650540', 'Q581714', 'Q117467246']);
const wdIds = (e, p) => ((e.claims || {})[p] || []).map(c => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
const wdLabel = e => e && ((e.labels?.[LNG()] || e.labels?.en || e.labels?.it || {}).value || '');
async function wikidataFilms(q) {
  const s = await fj(WD + 'action=wbsearchentities&type=item&limit=15&language=' + LNG() + '&uselang=' + LNG() + '&search=' + encodeURIComponent(q));
  const ids = (s.search || []).map(x => x.id); if (!ids.length) return [];
  const g = await fj(WD + 'action=wbgetentities&props=claims|labels|sitelinks&languages=' + [LNG(), 'en', 'it'].join('|') + '&sitefilter=' + [LNG(), 'en', 'it'].map(l => l + 'wiki').join('|') + '&ids=' + ids.join('|'));
  const films = ids.map(id => g.entities?.[id]).filter(e => e && wdIds(e, 'P31').some(c => FILM_CLASSES.has(c))).slice(0, 8);
  if (!films.length) return [];
  const extra = [...new Set(films.flatMap(e => [...wdIds(e, 'P57').slice(0, 2), ...wdIds(e, 'P136').slice(0, 2), ...wdIds(e, 'P272').slice(0, 1)]))].slice(0, 50);
  let L = {};
  if (extra.length) { try { L = (await fj(WD + 'action=wbgetentities&props=labels&languages=' + [LNG(), 'en', 'it'].join('|') + '&ids=' + extra.join('|'))).entities || {}; } catch (e) {} }
  return films.map(e => {
    const time = (((e.claims?.P577 || [])[0] || {}).mainsnak?.datavalue?.value?.time) || '';
    const dur = (((e.claims?.P2047 || [])[0] || {}).mainsnak?.datavalue?.value?.amount) || '';
    const wl = [LNG(), 'en', 'it'].find(l => e.sitelinks?.[l + 'wiki']); const wiki = wl ? { lang: wl, title: e.sitelinks[wl + 'wiki'].title } : null;
    return { tipo: 'film', titolo: wdLabel(e), anno: year(time), autore: wdIds(e, 'P57').slice(0, 2).map(id => wdLabel(L[id])).filter(Boolean).join(', '),
      genere: wdIds(e, 'P136').slice(0, 2).map(id => wdLabel(L[id])).filter(Boolean).join(', '),
      editore: wdIds(e, 'P272').slice(0, 1).map(id => wdLabel(L[id])).filter(Boolean).join(''),
      durata: dur ? Math.round(Math.abs(parseFloat(dur))) + ' min' : '', descrizione: '', coverUrl: '', fonte: 'Wikidata', _wiki: wiki };
  });
}
async function wikipediaInfo(w) {
  const d = await fj(`https://${w.lang}.wikipedia.org/w/api.php?format=json&origin=*&action=query&redirects=1&prop=pageimages|extracts&exintro=1&explaintext=1&exsentences=6&piprop=thumbnail&pithumbsize=600&titles=` + encodeURIComponent(w.title));
  const pg = Object.values(d.query?.pages || {})[0] || {};
  return { descrizione: (pg.extract || '').trim(), coverUrl: pg.thumbnail?.source || '' };
}
const filmKey = c => String(c.titolo).toLowerCase().normalize('NFD').replace(/[^a-z0-9]/g, '') + '|' + (c.anno || '');

// Film
async function tmdb(q) {
  const k = cfg('tmdbKey'); if (!k) return [];
  const d = await fj(`https://api.themoviedb.org/3/search/movie?language=${LOC()}&api_key=${encodeURIComponent(k)}&query=${encodeURIComponent(q)}`);
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
    // Sembra un numero di catalogo (es. DGCC-24425, PCS 7088)? Cercalo come tale: identifica l'edizione esatta
    const looksCat = /\d/.test(q) && /^[a-z0-9][a-z0-9 .\-\/]{2,22}$/i.test(q.trim()) && q.trim().split(/\s+/).length <= 3;
    const catQ = q.trim().replace(/"/g, '');
    const [cat, dc, mb, it] = await Promise.all([
      looksCat ? settled([discogs('catno=' + encodeURIComponent(catQ)), musicBrainz(`catno:"${catQ}"`)]) : Promise.resolve([]),
      settled([discogs('q=' + encodeURIComponent(q) + '&format=' + fmt)]),
      settled([musicBrainz(`${q} AND format:${mbFmt}`)]).then(r => r.length ? r : settled([musicBrainz(q)])),
      settled([itunes(q, 'album')]),
    ]);
    cat.forEach(c => { c.sub = ['N. catalogo ' + (c.catalogo || catQ), c.sub].filter(Boolean).join(' · '); });
    const seen = new Set(); const all = [...cat, ...dc.slice(0, 6), ...mb.slice(0, 6), ...it.slice(0, 4)].filter(c => { const k = (c._discogsId || c._mbid || '') + ''; if (k && seen.has(k)) return false; if (k) seen.add(k); return true; });
    return fitMusic(all, tipo);
  }
  const [t, it, wd] = await Promise.all([settled([tmdb(q)]), settled([itunes(q, 'movie')]), settled([wikidataFilms(q)])]);
  // TMDB (se c'è la chiave) e Apple hanno le locandine: vengono prima; Wikidata completa regista, anno e i film mancanti
  const out = []; const idx = new Map();
  [...t, ...it, ...wd].forEach(c => {
    const k = filmKey(c);
    if (idx.has(k)) { const a = out[idx.get(k)]; ['autore', 'genere', 'durata', 'editore'].forEach(f => { if (!a[f] && c[f]) a[f] = c[f]; }); if (!a._wiki && c._wiki) a._wiki = c._wiki; if (!String(a.fonte).includes(c.fonte)) a.fonte += ' + ' + c.fonte; }
    else { idx.set(k, out.length); out.push(c); }
  });
  return out.slice(0, 14);
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
  return { tipo, list: await filmFromUpc(code, up[0]) };
}
async function filmFromUpc(code, up) {
  let list = [];
  if (up) {
    const raw = up.titolo; const t = cleanProductTitle(raw);
    list = (await searchByTitle('film', t)).slice(0, 6);
    if (!list.length) list = [{ tipo: 'film', ...up, titolo: t, fonte: 'UPCitemdb' }];
    list.forEach(c => { c.formato = guessFilmFormat(raw); if (!c.coverUrl && up.coverUrl) c.coverUrl = up.coverUrl; });
  }
  list.forEach(c => { c.codice = code; c.tipo = 'film'; });
  return list;
}
// Riconosce un codice senza sapere se è un libro, un disco o un film
async function identifyCode(code) {
  code = String(code).replace(/\D/g, '');
  if (/^(978|979)\d{10}$/.test(code)) return searchByCode('libro', code);
  const variants = [code]; if (code.length === 13 && code[0] === '0') variants.push(code.slice(1)); if (code.length === 12) variants.push('0' + code);
  const music = await settled([discogs('barcode=' + code), musicBrainz(variants.map(v => 'barcode:' + v).join(' OR '))]);
  if (music.length) {
    const t = (music.find(c => c.tipo) || {}).tipo || 'cd';
    const list = fitMusic(music, t); list.forEach(c => { c.codice = code; });
    return { tipo: t, list };
  }
  const up = (await settled([upcLookup(code)]))[0];
  if (!up) return { tipo: '', list: [] };
  const mt = detectMusicTipo(up.titolo);
  if (mt) {
    const t = cleanProductTitle(up.titolo);
    let list = (await settled([itunes(t, 'album')])).slice(0, 5);
    if (!list.length) list = [{ ...up, titolo: t, fonte: 'UPCitemdb' }];
    list = fitMusic(list, mt); list.forEach(c => { c.codice = code; });
    return { tipo: mt, list };
  }
  return { tipo: 'film', list: await filmFromUpc(code, up) };
}

// Dettagli aggiuntivi dopo la scelta
async function enrich(c) {
  try {
    if (c._mbid) {
      const r = await fj(`https://musicbrainz.org/ws/2/release/${c._mbid}?inc=recordings+genres+labels+release-groups&fmt=json`);
      if (c._coverAlt) {
        try { const h = await fetch(`https://coverartarchive.org/release/${c._mbid}`, { method: 'GET' }); if (!h.ok) c.coverUrl = c._coverAlt; } catch (e) {}
      }
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
      const r = await jsonp(`https://itunes.apple.com/lookup?entity=song&country=it&id=${c._itunesCollection}`);
      c.tracklist = (r.results || []).filter(x => x.wrapperType === 'track').map(t => `${t.trackNumber}. ${t.trackName}`).join('\n');
    }
    if (c._wiki && (!c.descrizione || !c.coverUrl)) {
      try { const w = await wikipediaInfo(c._wiki); if (!c.descrizione) c.descrizione = w.descrizione; if (!c.coverUrl) c.coverUrl = w.coverUrl; } catch (e) {}
    }
    if (c._tmdbId) {
      const k = encodeURIComponent(cfg('tmdbKey'));
      const m = await fj(`https://api.themoviedb.org/3/movie/${c._tmdbId}?language=${LOC()}&append_to_response=credits&api_key=${k}`);
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
  if (c._discogsId) out.discogsId = String(c._discogsId);
  return out;
}

/* ── Flusso: scansione → ricerca → modulo ──────────────────── */
async function handleCode(code, tipo, intoDraft) {
  code = String(code).replace(/\s/g, '');
  S.intoDraft = intoDraft === true; S.pickWish = false; S.coverMode = null;
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
  let shotId = null;
  if (S.coverMode === 'add' && S.coverShot && !data.coverUrl && !S.intoDraft) {
    shotId = uid(); await DB.put('photos', { id: shotId, blob: S.coverShot }); data.foto = [shotId];
  }
  S.coverMode = null;
  if (S.checkPrice && ((S.checkPrice.cand && S.checkPrice.cand === c) || (data.codice && S.checkPrice.code && sameCode(data.codice, S.checkPrice.code))) && (!data.discogsId || String(data.discogsId) === S.checkPrice.id)) {
    data.discogsId = S.checkPrice.id; data.valoreDiscogs = { ...S.checkPrice.p, match: 'barcode' };
  }
  if (S.pickWish) { // "Aggiungi ai desideri" dal controllo veloce: salva subito
    S.pickWish = false;
    const it = normalize({ ...EMPTY(), ...data, desiderio: true });
    await saveItem(it); toast('Aggiunto ai desideri'); return go('detail', it.id);
  }
  startDraft(data, S.intoDraft);
  if (shotId) S.newPhotos.push(shotId);
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
  active: false, stream: null, timer: null, onCode: null, canvas: null, continuous: false, mode: '', last: '', lastAt: 0,
  hint(t) { $('.scan-hint').textContent = t; },
  count(t) { const c = $('#scanCount'); if (c) c.textContent = t || ''; },
  readyHint() { return this.continuous ? 'Raffica: inquadra un codice dopo l’altro' : this.mode === 'check' ? 'Controllo veloce: inquadra il codice' : 'Inquadra il codice a 15–20 cm, con buona luce'; },
  // opts.continuous: non si chiude a ogni codice (scansione a raffica); opts.mode 'check': "Ce l'ho già?"
  async start(onCode, opts = {}) {
    this.onCode = onCode; this.active = true; this.continuous = !!opts.continuous; this.mode = opts.mode || ''; this.last = ''; this.lastAt = 0;
    $('#scanner').classList.remove('hidden'); $('#manualCode').value = '';
    $('#scanner').classList.toggle('batch', this.continuous); $('#scanner').classList.toggle('check', this.mode === 'check');
    this.count(opts.count || '');
    this.hint('Avvio la fotocamera…');
    const video = $('#scanVideo');
    const constraints = { video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false };
    try {
      const detP = getDetector(); detP.catch(() => {});
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (!this.active) { this.stream.getTracks().forEach(t => t.stop()); return; }
      video.srcObject = this.stream; await video.play().catch(() => {});
      this.tuneCamera();
      this.hint('Carico il lettore…');
      const { det } = await detP;
      if (!this.active) return;
      this.hint(this.readyHint());
      this.canvas = this.canvas || document.createElement('canvas');
      const tick = async () => {
        if (!this.active) return;
        if (video.videoWidth) {
          try {
            cropToCanvas(video, video.videoWidth, video.videoHeight, this.canvas);
            const r = await det.detect(this.canvas);
            const hit = (r || []).map(x => x.rawValue).find(validCode);
            if (hit) {
              if (!this.continuous) return this.submit(hit);
              if (this.submit(hit)) { this.timer = setTimeout(tick, 1300); return; }
            }
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
      if (code) { this.onCode = cb; const r = this.submit(code); if (this.continuous) this.hint(this.readyHint()); return r; }
      this.hint('Codice non leggibile nella foto. Riprova più vicino e dritto, oppure digitalo.');
    } catch (e) { this.hint('Lettore non disponibile: digita il codice qui sotto.'); }
  },
  submit(code) {
    if (this.continuous) {
      // in raffica lo stesso codice letto due volte di seguito conta una volta sola
      const now = Date.now(); if (code === this.last && now - this.lastAt < 5000) return false;
      this.last = code; this.lastAt = now;
      if (navigator.vibrate) navigator.vibrate(60);
      const f = $('.scan-frame'); if (f) { f.classList.remove('hit'); void f.offsetWidth; f.classList.add('hit'); }
      this.onCode && this.onCode(code); return true;
    }
    if (navigator.vibrate) navigator.vibrate(60); const cb = this.onCode; this.stop(); cb && cb(code); return true;
  },
  found(code) { if (validCode(code)) this.submit(code); },
  stop() {
    this.active = false; this.onCode = null; clearTimeout(this.timer);
    if (this.stream) { this.stream.getTracks().forEach(t => t.stop()); this.stream = null; }
    const v = $('#scanVideo'); if (v && v.srcObject) { try { v.srcObject.getTracks().forEach(t => t.stop()); } catch (e) {} v.srcObject = null; }
    $('#scanner').classList.add('hidden'); this.hint('Inquadra il codice a barre'); this.count('');
    this.continuous = false; this.mode = '';
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
  const name = `spinyl-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([JSON.stringify(data)], name, { type: 'application/json' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Backup Spinyl' }); return; } catch (e) { if (e.name === 'AbortError') return; }
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

/* ── Righe riassuntive (oggetti della collezione o risultati online) ── */
function rowHTML(it, action) {
  const img = it.foto && it.foto[0] ? `<img data-photo="${esc(it.foto[0])}" alt="" hidden>`
    : it.coverUrl ? `<img src="${esc(it.coverUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : '';
  const T = TIPI[it.tipo];
  const inner = `<div class="th">${img}</div><div><b translate="no">${esc(it.titolo || '—')}</b><span translate="no">${esc([it.autore, it.anno].filter(Boolean).join(' · '))}</span>${it.formato || T ? `<em>${esc(it.formato || T.label)}</em>` : ''}</div>`;
  return action ? `<button class="result" data-a="${action}" data-id="${esc(it.id)}">${inner}</button>` : `<div class="result static">${inner}</div>`;
}

/* ── "Ce l'ho già?" ────────────────────────────────────────── */
function startCheck() { closeSheet(); S.coverMode = null; Scanner.start(code => checkCode(code), { mode: 'check' }); }
const CHECK_AGAIN = () => `<div class="row" style="gap:10px"><button class="btn block" data-a="check">${ic('check', 18)}Altro codice</button><button class="btn block" data-a="checkCover">${ic('camera', 18)}Copertina</button></div>`;
const PRICE_BOX = '<div class="section pricebox" id="checkPrice"></div>';
// Mostra "Ce l'hai già" / "È nei desideri" se il pezzo è nella collezione; altrimenti false
function checkKnown(owned, wish, code, token, cand) {
  if (owned.length) {
    openSheet(`<div class="verdict ok"><b>✓</b>Ce l'hai già</div><div class="results">${owned.map(i => rowHTML(i, 'open')).join('')}</div>${PRICE_BOX}
      <div class="stack" style="padding-top:14px">${CHECK_AGAIN()}</div>`);
    checkPrice(owned[0], cand, code, token); return true;
  }
  if (wish.length) {
    openSheet(`<div class="verdict wish"><b>★</b>È nella tua lista desideri</div><div class="results">${wish.map(i => rowHTML(i, 'open')).join('')}</div>${PRICE_BOX}
      <div class="stack" style="padding-top:14px"><button class="btn primary block" data-a="gotIt" data-id="${esc(wish[0].id)}" ${code ? `data-code="${esc(code)}"` : ''}>L'ho comprato!</button>${CHECK_AGAIN()}</div>`);
    checkPrice(wish[0], cand, code, token); return true;
  }
  return false;
}
async function checkCode(code) {
  code = String(code).replace(/\D/g, ''); S.checkPrice = null;
  const hits = live().filter(i => i.codice && sameCode(i.codice, code));
  S.check = { code, token: code, res: null };
  if (checkKnown(hits.filter(i => !i.desiderio), hits.filter(i => i.desiderio), code, code, null)) return;
  openSheet(`<h2>Controllo ${esc(code)}…</h2>${loadingHTML('Non è nella collezione: cerco cos’è')}`);
  let res = { tipo: '', list: [] };
  try { res = await identifyCode(code); } catch (e) {}
  if ($('#sheetWrap').classList.contains('hidden') || !S.check || S.check.token !== code) return; // chiuso nel frattempo
  showCheckResult(code, res, code);
}
function showCheckResult(code, res, token) {
  S.check.res = res;
  const c = res.list[0];
  const other = c ? live().filter(i => sameWork(i, c)) : [];
  const otherWish = other.filter(i => i.desiderio);
  if (otherWish.length && !other.some(i => !i.desiderio)) return checkKnown([], otherWish, code, token, c);
  openSheet(`<div class="verdict no"><b>✕</b>Non ce l'hai</div>
    ${c ? `<div class="results">${rowHTML(c)}</div>${res.list.length > 1 ? '<p class="note" style="margin:8px 2px 0">Ci sono più edizioni con questo codice: scegli la tua quando lo aggiungi.</p>' : ''}`
      : `<p class="lead" style="margin-top:0">Codice ${esc(code)} non trovato nei database online.</p>`}
    ${other.length ? `<p class="note warnnote">Hai già lo stesso titolo in un'altra edizione:</p><div class="results">${other.map(i => rowHTML(i, 'open')).join('')}</div>` : ''}
    ${c ? PRICE_BOX : ''}
    <div class="stack" style="padding-top:14px">
      <button class="btn primary block" data-a="checkAdd" data-v="own">Aggiungi alla collezione</button>
      <button class="btn block" data-a="checkAdd" data-v="wish">Aggiungi ai desideri</button>
      ${CHECK_AGAIN()}
    </div>`);
  if (c) checkPrice(null, c, code, token);
}
// Controllo partito da una foto della copertina: il risultato scelto viene confrontato con la collezione
function checkFromCandidate(c) {
  const code = c.codice ? String(c.codice).replace(/\D/g, '') : '';
  const token = 'cover' + Date.now().toString(36);
  S.check = { code, token, res: null }; S.checkPrice = null;
  const sameKind = i => i.tipo === c.tipo || (isMusic(i.tipo) && isMusic(c.tipo));
  const hits = live().filter(i => (code && i.codice && sameCode(i.codice, code)) || (sameKind(i) && sameWork(i, c)));
  if (checkKnown(hits.filter(i => !i.desiderio), hits.filter(i => i.desiderio), code, token, c)) { S.check.res = { tipo: c.tipo, list: [c] }; return; }
  showCheckResult(code, { tipo: c.tipo, list: [c] }, token);
}
// "Quanto vale?" durante il controllo veloce
async function checkPrice(item, cand, code, token = code) {
  const box = $('#checkPrice'); if (!box) return;
  const base = { ...(cand || {}), ...(item || {}) }; if (!base.codice && code) base.codice = code;
  const set = html => { const b = $('#checkPrice'); if (b && S.check && S.check.token === token) b.innerHTML = '<h3>Quanto vale?</h3>' + html; };
  if (!isMusic(base.tipo)) {
    const mv = item && !item.desiderio ? marketValue(item) : { v: 0 };
    return set(`${mv.v ? `<div class="value"><b>${esc(money(mv.v, mv.cur))}</b><span>valore inserito da te</span></div>` : ''}<p class="note pnote">Per libri e film non esiste un listino gratuito: guarda a quanto sono stati venduti davvero.</p>${soldLinks(base)}`);
  }
  if (!cfg('discogsToken')) return set(`<p class="note pnote">Per i prezzi dei dischi inserisci il token Discogs nelle Impostazioni.</p>${soldLinks(base)}`);
  set(loadingHTML('Chiedo i prezzi a Discogs…'));
  try {
    let id = (item && item.discogsId) || (cand && cand._discogsId);
    let match = 'barcode';
    if (!id) { const m = await discogsLookupId({ ...base, discogsId: '' }); if (m) { id = m.id; match = m.match; } }
    if (!id) return set(`<p class="note pnote">Edizione non trovata su Discogs.</p>${soldLinks(base)}`);
    const p = await discogsPrices(String(id));
    S.checkPrice = { id: String(id), p, code, cand };
    if (item) { // aggiorna anche il valore del pezzo che hai già
      item.discogsId = String(id); item.valoreDiscogs = { ...p, match: (item.valoreDiscogs && item.valoreDiscogs.match) || match }; saveItem(item);
    }
    const mv = item && !item.desiderio ? marketValue(item) : null;
    set(`${mv && mv.v ? `<div class="value"><b>${esc(money(mv.v, mv.cur))}</b><span>${mv.src === 'discogs' && !mv.assumed ? 'la tua copia · ' + esc(item.condizione) : 'la tua copia'}</span></div>` : ''}${priceTableHTML(p, item && item.condizione)}${soldLinks({ ...base, discogsId: String(id) })}`);
  } catch (e) {
    set(`<p class="note pnote">Discogs non risponde: riprova tra poco.</p>${soldLinks(base)}`);
  }
}
function checkAdd(el) {
  const wish = el.dataset.v === 'wish'; const { code, res } = S.check || {};
  const list = (res && res.list) || [];
  S.intoDraft = false; S.pickWish = wish;
  if (!list.length) { closeSheet(); S.pickWish = false; return startDraft({ tipo: (res && res.tipo) || (/^(978|979)/.test(code || '') ? 'libro' : S.addTipo), codice: code || '', desiderio: wish }, false); }
  if (list.length === 1) return pickCandidate(list[0]);
  S.candidates = list; S.searchCtx = { tipo: res.tipo, code };
  openSheet(`<h2>Quale di questi?</h2><div class="results">${resultsHTML(list)}</div>
    <button class="btn block" style="margin-top:12px" data-a="manualWithCode">Nessuno, inserisco a mano</button>`);
}
async function gotIt(el) {
  const it = byId((el && el.dataset.id) || S.id); if (!it) return;
  it.desiderio = false; it.createdAt = Date.now();
  // comprato dopo il controllo veloce: completa con il codice e i dati trovati online
  const code = el && el.dataset.code;
  if (code && !it.codice) it.codice = code;
  const c = code && S.check && S.check.res && S.check.res.list[0];
  if (c) ['coverUrl', 'editore', 'anno', 'formato', 'catalogo', 'paese'].forEach(k => { if (!it[k] && c[k]) it[k] = c[k]; });
  await saveItem(it); closeSheet(); toast('Spostato nella collezione');
  if (S.view === 'detail' && S.id === it.id) render(); else go('detail', it.id);
}

/* ── Scansione a raffica ───────────────────────────────────── */
const saveBatch = () => setMeta('batch', S.batch).catch(() => {});
function batchCountText() {
  const n = S.batch.length, f = S.batch.filter(r => r.data).length;
  return n ? `${n} in coda · ${f} trovati` : '';
}
function startBatch() { Scanner.start(batchAdd, { continuous: true, count: batchCountText() }); }
function batchAdd(code) {
  code = String(code).replace(/\D/g, '');
  if (S.batch.some(r => r.code === code)) { toast('Già in coda', 1200); return; }
  S.batch.push({ id: uid(), code, tipo: S.batchTipo, status: 'wait' });
  toast('+ ' + code, 1000);
  saveBatch(); refreshBatch(); runBatch();
}
function refreshBatch() {
  if (Scanner.active && Scanner.continuous) Scanner.count(batchCountText());
  if (S.view === 'batch' && $('#sheetWrap').classList.contains('hidden')) render();
}
let batchRunning = false;
async function runBatch() {
  if (batchRunning) return; batchRunning = true;
  try {
    let r;
    while ((r = S.batch.find(x => x.status === 'wait'))) {
      if (!navigator.onLine) break;
      r.status = 'busy'; refreshBatch();
      try {
        const res = await searchByCode(r.tipo, r.code);
        if (!S.batch.includes(r)) continue; // tolto nel frattempo
        if (!res.list.length) r.status = 'none';
        else {
          r.tipo = res.tipo;
          r.data = await enrich({ ...res.list[0] });
          r.alts = res.list.length > 1 ? res.list.slice(0, 8) : null;
          r.status = res.list.length > 1 ? 'multi' : 'ok';
        }
      } catch (e) { r.status = navigator.onLine ? 'none' : 'wait'; }
      r.dup = live().some(i => !i.desiderio && i.codice && sameCode(i.codice, r.code));
      await saveBatch(); refreshBatch();
      await sleep(900); // MusicBrainz: al massimo una richiesta al secondo
    }
  } finally { batchRunning = false; }
}
const BATCH_STATUS = { wait: 'In attesa', busy: 'Cerco…', ok: 'Trovato', multi: 'Più edizioni', none: 'Non trovato' };
function viewBatch() {
  const B = S.batch; const ready = B.filter(batchReady).length;
  const busy = B.some(r => r.status === 'wait' || r.status === 'busy');
  const row = r => {
    const d = r.data || {}; const T = TIPI[r.tipo] || {};
    return `<div class="result qrow ${r.status}">
      <div class="th">${d.coverUrl ? `<img src="${esc(d.coverUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : r.status === 'busy' ? '<div class="spinner"></div>' : ''}</div>
      <div class="grow"><b translate="no">${esc(d.titolo || r.code)}</b>${d.titolo ? `<span translate="no">${esc([d.autore, d.anno].filter(Boolean).join(' · '))}</span>` : ''}
        <em>${esc([T.label, BATCH_STATUS[r.status]].filter(Boolean).join(' · '))}</em>${r.dup ? `<span class="dupnote">Ce l'hai già</span>` : ''}
        ${r.dup && r.data ? `<label class="dupforce"><input type="checkbox" data-a="batchForce" data-v="${r.id}" ${r.force ? 'checked' : ''}><span>Aggiungi un'altra copia</span></label>` : ''}
        ${r.status === 'multi' ? `<div class="qacts"><button data-a="batchChoose" data-v="${r.id}">Scegli l'edizione</button></div>` : ''}
        ${r.status === 'none' ? `<div class="qacts"><button data-a="batchSearch" data-v="${r.id}">Cerca per titolo</button></div>` : ''}
      </div>
      <button class="x" data-a="batchRemove" data-v="${r.id}" aria-label="Togli dalla coda">✕</button>
    </div>`;
  };
  return `
  <header class="top">
    <button class="iconbtn" data-a="back" aria-label="Indietro">${ic('back')}</button>
    <div class="grow title-sm">Scansione a raffica</div>
    ${B.length ? `<button class="iconbtn" data-a="batchClear" aria-label="Svuota la coda">${ic('trash')}</button>` : ''}
  </header>
  <div class="form">
    <div class="seg seg5" style="margin-top:6px">${Object.entries(TIPI).map(([k, v]) => `<button type="button" class="${S.batchTipo === k ? 'on' : ''}" data-a="batchTipo" data-v="${k}">${v.label}</button>`).join('')}</div>
    <p class="note" style="margin:10px 2px 4px">${!B.length ? 'Scegli il tipo e tocca “Scansiona”: leggi un codice dopo l’altro, senza fermarti.' : busy ? 'Cerco i dati un codice alla volta: puoi aspettare qui o continuare a scansionare.' : 'Controlla l’elenco, poi aggiungi tutto con un tocco.'}</p>
    ${!navigator.onLine && busy ? '<p class="note warnnote">Sei offline: la ricerca riparte appena torna la connessione.</p>' : ''}
    ${B.length ? `<div class="results">${B.map(row).join('')}</div>` : ''}
  </div>
  <div class="savebar">
    <button class="btn" data-a="batchScan">${ic('scan', 18)}Scansiona</button>
    <button class="btn primary" data-a="batchSave" ${ready ? '' : 'disabled'}>${ready === 1 ? 'Aggiungi 1 pezzo' : `Aggiungi ${ready} pezzi`}</button>
  </div>`;
}
async function batchAssign(c) {
  const r = S.batch.find(x => x.id === S.batchTarget); S.batchTarget = null;
  if (!r) return closeSheet();
  openSheet(`<h2>Un attimo…</h2>${loadingHTML('Recupero i dettagli')}`);
  r.data = await enrich({ ...c }); r.tipo = c.tipo || r.tipo; r.status = 'ok';
  r.data.codice = r.data.codice || r.code;
  await saveBatch(); closeSheet(); render();
}
// pronti da aggiungere: trovati, e se li hai già solo se chiedi un'altra copia
const batchReady = r => !!r.data && (!r.dup || r.force);
async function batchSave() {
  const ready = S.batch.filter(batchReady); if (!ready.length) return;
  const now = Date.now();
  const items = ready.map((r, i) => normalize({ ...EMPTY(), ...r.data, tipo: r.data.tipo || r.tipo, codice: r.data.codice || r.code, createdAt: now + ready.length - i, updatedAt: now }));
  await DB.putMany('items', items); S.items.push(...items);
  S.batch = S.batch.filter(r => !r.data); await saveBatch(); markDirty(); // i doppioni non scelti escono dalla coda
  toast(items.length === 1 ? 'Aggiunto 1 pezzo' : `Aggiunti ${items.length} pezzi`);
  if (!S.batch.length) { history.replaceState({ view: 'list' }, ''); S.view = 'list'; render(); } else render();
}

/* ── Valore di mercato (Discogs) ───────────────────────────── */
async function discogsLookupId(it) {
  if (it.discogsId) return { id: String(it.discogsId), match: 'id' };
  const fmt = { vinile: 'Vinyl', cd: 'CD', cassetta: 'Cassette' }[it.tipo];
  const code = String(it.codice || '').replace(/\D/g, '');
  if (code) { const r = await discogs('barcode=' + code); if (r[0]) return { id: String(r[0]._discogsId), match: 'barcode' }; }
  if (it.catalogo) { const r = await discogs('catno=' + encodeURIComponent(it.catalogo) + (it.autore ? '&artist=' + encodeURIComponent(it.autore) : '')); if (r[0]) return { id: String(r[0]._discogsId), match: 'catno' }; }
  const r = await discogs('q=' + encodeURIComponent([it.autore, it.titolo].filter(Boolean).join(' ')) + (fmt ? '&format=' + fmt : ''));
  return r[0] ? { id: String(r[0]._discogsId), match: 'titolo' } : null;
}
// Prezzi Discogs di un'edizione: suggeriti per condizione (in base alle vendite) + minimo in vendita ora
async function discogsPrices(id) {
  const tok = encodeURIComponent(cfg('discogsToken'));
  const [st, sg] = await Promise.allSettled([
    fj(`https://api.discogs.com/marketplace/stats/${encodeURIComponent(id)}?curr_abbr=EUR&token=${tok}`),
    fj(`https://api.discogs.com/marketplace/price_suggestions/${encodeURIComponent(id)}?token=${tok}`),
  ]);
  if (st.status === 'rejected' && sg.status === 'rejected') throw st.reason;
  const s = st.status === 'fulfilled' ? st.value || {} : {};
  const sugg = {}; let scur = '';
  if (sg.status === 'fulfilled' && sg.value && typeof sg.value === 'object') {
    for (const [k, v] of Object.entries(sg.value)) if (v && v.value != null && GRADE_ORDER.includes(k)) { sugg[k] = Math.round(+v.value * 100) / 100; scur = v.currency || scur; }
  }
  return { min: s.lowest_price && s.lowest_price.value != null ? +s.lowest_price.value : null, cur: (s.lowest_price && s.lowest_price.currency) || 'EUR', n: s.num_for_sale || 0,
    sugg: Object.keys(sugg).length ? sugg : null, scur: scur || 'EUR', suggErr: sg.status === 'rejected', at: Date.now() };
}
async function discogsValue(it) {
  const tok = cfg('discogsToken'); if (!tok) throw new Error('token');
  const m = await discogsLookupId(it); if (!m) return false;
  const p = await discogsPrices(m.id);
  const prev = it.valoreDiscogs && it.valoreDiscogs.match;
  it.discogsId = m.id;
  it.valoreDiscogs = { ...p, match: m.match === 'id' ? (prev || 'id') : m.match };
  await saveItem(it); return true;
}
// Tabella dei prezzi per condizione (evidenzia quella della tua copia)
function priceTableHTML(p, cond) {
  const mine = GRADE_OF[cond]; let h = '';
  if (p.sugg) {
    h += `<div class="ptable">${GRADE_ORDER.filter(g => p.sugg[g] != null).map(g => `<div class="prow ${g === mine ? 'mine' : ''}"><span class="pg" translate="no">${esc(gradeShort(g))}</span><span class="pl">${esc(GRADE_LABEL[g])}</span>${g === mine ? '<span class="pm">la tua copia</span>' : ''}<b>${esc(money(p.sugg[g], p.scur))}</b></div>`).join('')}</div>
      <p class="note pnote">Prezzi suggeriti da Discogs in base alle vendite, secondo la condizione del disco.</p>`;
  } else if (p.suggErr) {
    h += `<p class="note pnote">Mancano i prezzi per condizione: su Discogs apri Settings › Seller Settings, scegli valuta e paese e salva (basta una volta).</p>`;
  }
  h += `<p class="note pnote">${p.min != null ? `<span>In vendita ora, da</span> <b>${esc(money(p.min, p.cur))}</b> <span>${p.n === 1 ? '(1 copia)' : `(${p.n} copie)`}</span>` : '<span>Nessuna copia in vendita ora su Discogs</span>'}</p>`;
  return h;
}
// Dove vedere a quanto è stato venduto davvero (libri e film non hanno un listino gratuito)
function soldLinks(it) {
  const enc = encodeURIComponent; const L = LNG();
  const eb = { it: 'https://www.ebay.it', en: 'https://www.ebay.co.uk', es: 'https://www.ebay.es' }[L] || 'https://www.ebay.it';
  const isbn = it.tipo === 'libro' ? String(it.codice || '').replace(/[^\dX]/gi, '') : '';
  const kind = isMusic(it.tipo) ? ({ vinile: 'LP', cd: 'CD', cassetta: L === 'it' ? 'musicassetta' : 'cassette' }[it.tipo]) : it.tipo === 'film' ? (it.formato || 'DVD') : '';
  const q = isbn || [it.autore, it.titolo, kind].filter(Boolean).join(' ') || String(it.codice || '');
  const out = [['Venduti su eBay', `${eb}/sch/i.html?_nkw=${enc(q)}&LH_Sold=1&LH_Complete=1`]];
  if (it.tipo === 'libro') {
    const ab = { it: 'https://www.abebooks.it', en: 'https://www.abebooks.co.uk', es: 'https://www.iberlibro.com' }[L] || 'https://www.abebooks.it';
    out.push(['AbeBooks', isbn ? `${ab}/servlet/SearchResults?isbn=${isbn}` : `${ab}/servlet/SearchResults?kn=${enc(q)}`]);
  }
  if (isMusic(it.tipo) && it.discogsId) out.push(['Discogs', `https://www.discogs.com/sell/release/${enc(it.discogsId)}`]);
  return `<div class="links">${out.map(([n, u]) => `<a class="linkbtn" href="${esc(u)}" target="_blank" rel="noopener"><span>${esc(n)}</span><span aria-hidden="true">↗</span></a>`).join('')}</div>`;
}
async function valueNow() {
  const it = byId(S.id); if (!it || S.valuing) return;
  S.valuing = { id: it.id }; render();
  try { toast(await discogsValue(it) ? 'Valore aggiornato' : 'Edizione non trovata su Discogs'); }
  catch (e) { toast('Discogs non risponde: riprova tra poco'); }
  S.valuing = null; if (S.view === 'detail') render();
}
async function valueAll() {
  if (S.valuing) { S.valuing.stop = true; return; }
  const L = live().filter(i => isMusic(i.tipo) && !i.desiderio).sort((a, b) => ((a.valoreDiscogs || {}).at || 0) - ((b.valoreDiscogs || {}).at || 0));
  if (!L.length) return;
  S.valuing = { all: true, done: 0, tot: L.length, stop: false };
  const btn = () => $('#valueAllBtn');
  const upd = () => { const b = btn(); if (b && S.valuing) b.textContent = `Aggiorno ${S.valuing.done} di ${S.valuing.tot}… (tocca per fermare)`; };
  upd();
  for (const it of L) {
    if (S.valuing.stop) break;
    const lookup = !it.discogsId;
    try { await discogsValue(it); } catch (e) { if (/429/.test(e.message)) await sleep(30000); else if (!navigator.onLine) break; }
    S.valuing.done++; upd();
    await sleep(lookup ? 3300 : 2200); // limite Discogs: 60 richieste al minuto
  }
  const done = S.valuing.done; S.valuing = null;
  toast(done === 1 ? 'Aggiornato 1 valore' : `Aggiornati ${done} valori`);
  if (S.view === 'stats' || S.view === 'list') render();
}

/* ── Statistiche e "pesca a caso" ──────────────────────────── */
function bars(rows, color, translate) {
  if (!rows.length) return '<p class="note" style="margin:8px 0 12px">Nessun dato ancora.</p>';
  const max = Math.max(...rows.map(r => r[1]));
  return `<div class="bars">${rows.map(([l, n, k]) => `<div class="bar"><span class="bl" ${translate ? '' : 'translate="no"'}>${esc(l)}</span><span class="bt"><i style="width:${Math.max(3, n / max * 100)}%;background:${k ? `var(--${k === 'cassetta' ? 'tape' : k})` : color}"></i></span><b>${n}</b></div>`).join('')}</div>`;
}
function viewStats() {
  const own = live().filter(i => !i.desiderio), wish = live().filter(i => i.desiderio);
  const spent = own.reduce((s, i) => s + num(i.prezzo), 0);
  const valued = own.filter(i => valueOf(i) > 0); const value = valued.reduce((s, i) => s + valueOf(i), 0);
  const byType = Object.keys(TIPI).map(k => [TIPI[k].plural, own.filter(i => i.tipo === k).length, k]).filter(x => x[1]);
  const dec = {}; own.forEach(i => { const y = parseInt(i.anno, 10); if (y > 1500 && y < 2100) { const d = Math.floor(y / 10) * 10; dec[d] = (dec[d] || 0) + 1; } });
  const decades = Object.entries(dec).sort((a, b) => a[0] - b[0]).map(([d, n]) => [`${d}–${String(+d + 9).slice(2)}`, n]);
  const top = (fn, n = 8) => { const m = new Map(); own.forEach(i => new Set(fn(i).map(v => String(v).trim()).filter(Boolean)).forEach(v => { const k = v.toLowerCase(); const e = m.get(k) || [v, 0]; e[1]++; m.set(k, e); })); return [...m.values()].filter(e => e[1] > 1 || m.size <= n).sort((a, b) => b[1] - a[1]).slice(0, n); };
  const genres = top(i => String(i.genere || '').split(/[,/]/));
  const authors = top(i => i.autore ? [String(i.autore).split(/,|;| & /)[0]] : []);
  const late = live().filter(i => i.prestatoA && loanDays(i) > PRESTITO_GIORNI).sort((a, b) => loanDays(b) - loanDays(a));
  const loans = live().filter(i => i.prestatoA).length;
  const st = (t, k) => own.filter(i => (t === 'musica' ? isMusic(i.tipo) : i.tipo === t) && i.stato === k).length;
  const stRows = [['Libri letti', st('libro', 'fatto')], ['In lettura', st('libro', 'in')], ['Da leggere', st('libro', 'da')], ['Film visti', st('film', 'fatto')], ['Da vedere', st('film', 'da')], ['Dischi ascoltati', st('musica', 'fatto')], ['Da ascoltare', st('musica', 'da')]].filter(r => r[1]);
  const music = own.filter(i => isMusic(i.tipo)).length;
  const tile = (n, l, sub) => `<div class="tile"><b>${n}</b><span>${l}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
  const pickers = [['tutti', 'Tutti'], ...Object.entries(TIPI).map(([k, v]) => [k, v.plural])];
  return `
  <header class="top">
    <button class="iconbtn" data-a="back" aria-label="Indietro">${ic('back')}</button>
    <div class="grow title-sm">La tua collezione</div>
  </header>
  <div class="form">
    <div class="tiles">
      ${tile(own.length, own.length === 1 ? 'pezzo' : 'pezzi')}
      ${tile(wish.length, 'desideri')}
      ${tile(spent ? money(spent) : '—', 'spesi', spent ? `su ${own.filter(i => num(i.prezzo)).length} con prezzo` : '')}
      ${tile(value ? money(value) : '—', 'valore stimato', value ? `su ${valued.length} con valore` : '')}
    </div>

    <div class="section pick"><h3>Non sai cosa scegliere?</h3>
      <div class="pickchips">${pickers.map(([k, l]) => `<button type="button" class="chip ${S.pickTipo === k ? 'on' : ''}" data-a="pickTipo" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="stack"><button class="btn primary block" data-a="pickRandom">${ic('dice', 20)}Pesca a caso</button></div>
    </div>

    <div class="section"><h3>Per tipo</h3>${bars(byType, '', true)}</div>
    <div class="section"><h3>Per decennio</h3>${bars(decades, 'var(--accent)', false)}</div>
    <div class="section"><h3>Generi più presenti</h3>${bars(genres.map(([l, n]) => [l, n]), 'var(--tape)', false)}</div>
    <div class="section"><h3>Autori e artisti più presenti</h3>${bars(authors.map(([l, n]) => [l, n]), 'var(--film)', false)}</div>
    ${stRows.length ? `<div class="section"><h3>Lettura, visione, ascolto</h3><dl class="facts">${stRows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>` : ''}
    <div class="section"><h3>Prestiti</h3>
      ${loans ? `<p class="note" style="margin:10px 0">${loans === 1 ? '1 pezzo in prestito' : loans + ' pezzi in prestito'}${late.length ? ` · ${late.length} da più di ${PRESTITO_GIORNI} giorni` : ''}</p>` : '<p class="note" style="margin:10px 0 12px">Nessun pezzo in prestito.</p>'}
      ${late.length ? `<div class="results" style="padding-bottom:12px">${late.map(i => rowHTML(i, 'open')).join('')}</div>` : ''}
    </div>
    ${music && cfg('discogsToken') ? `<div class="section"><h3>Valore dei dischi</h3>
      <p class="note" style="margin:10px 0">Controlla su Discogs il prezzo minimo di ${music === 1 ? '1 disco' : music + ' dischi'}. Ci vuole circa un minuto ogni 30: puoi continuare a usare l'app.</p>
      <div class="stack"><button id="valueAllBtn" class="btn block" data-a="valueAll">${S.valuing && S.valuing.all ? `Aggiorno ${S.valuing.done} di ${S.valuing.tot}… (tocca per fermare)` : 'Aggiorna tutti i valori'}</button></div></div>` : ''}
  </div>`;
}
function pickRandom() {
  const t = S.pickTipo;
  let pool = live().filter(i => !i.desiderio && !i.prestatoA && (t === 'tutti' || i.tipo === t));
  if (!pool.length) return toast('Niente da pescare qui');
  const fresh = pool.filter(i => i.stato === 'da' || i.stato === 'in');
  if (fresh.length && Math.random() < 0.5) pool = fresh; // a volte preferisce quello che non hai ancora letto/visto
  let it; let n = 0;
  do { it = pool[Math.floor(Math.random() * pool.length)]; } while (pool.length > 1 && it.id === S.lastPick && ++n < 10);
  S.lastPick = it.id;
  const h = isMusic(it.tipo) ? 'Stasera ascolta…' : it.tipo === 'film' ? 'Stasera guarda…' : 'Adesso leggi…';
  openSheet(`<h2>${h}</h2>
    <div class="pickcard">${coverHTML(it)}<div><b translate="no">${esc(it.titolo)}</b><span translate="no">${esc([it.autore, it.anno].filter(Boolean).join(' · '))}</span>
      ${it.posizione ? `<small>Lo trovi in: <span translate="no">${esc(it.posizione)}</span></small>` : ''}</div></div>
    <div class="row" style="margin-top:16px"><button class="btn" data-a="pickRandom">${ic('dice', 18)}Un altro</button><button class="btn primary" data-a="open" data-id="${esc(it.id)}">Apri</button></div>`);
}

/* ── Condividere ───────────────────────────────────────────── */
async function shareText(text, title) {
  if (navigator.share) { try { await navigator.share({ title, text }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); toast('Testo copiato: incollalo dove vuoi'); }
  catch (e) { location.href = 'https://wa.me/?text=' + encodeURIComponent(text); }
}
function shareWish() {
  const W = live().filter(i => i.desiderio);
  if (!W.length) return toast('La lista desideri è vuota');
  const title = tr('La mia lista desideri');
  const parts = [title + ' 🎁', ''];
  Object.entries(TIPI).forEach(([k, T]) => {
    const L = W.filter(i => i.tipo === k).sort((a, b) => String(a.autore || a.titolo).localeCompare(String(b.autore || b.titolo), LOC()));
    if (!L.length) return;
    parts.push(tr(T.plural).toUpperCase());
    L.forEach(i => parts.push(`• ${i.titolo}${i.autore ? ' — ' + i.autore : ''}${i.formato ? ' (' + tr(i.formato) + ')' : ''}`));
    parts.push('');
  });
  parts.push(tr('Creata con Spinyl'));
  shareText(parts.join('\n'), title);
}
function remindLoan() {
  const it = byId(S.id); if (!it || !it.prestatoA) return;
  const name = String(it.prestatoA).trim().split(/\s+/)[0];
  const d = it.prestatoIl ? new Date(it.prestatoIl).toLocaleDateString(LOC(), { day: 'numeric', month: 'long' }) : '';
  const msg = {
    it: `Ciao ${name}! Ti ricordi di "${it.titolo}" che ti ho prestato${d ? ' il ' + d : ''}? Quando puoi me lo riporti? Grazie 😊`,
    en: `Hi ${name}! Do you remember "${it.titolo}", which I lent you${d ? ' on ' + d : ''}? Could you bring it back when you get a chance? Thanks 😊`,
    es: `¡Hola ${name}! ¿Te acuerdas de "${it.titolo}", que te presté${d ? ' el ' + d : ''}? ¿Me lo devuelves cuando puedas? Gracias 😊`,
  }[LNG()] || '';
  shareText(msg, it.titolo);
}
async function saveFile(file, title) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function exportCsv() {
  const sep = LNG() === 'en' ? ',' : ';';
  const n = v => { v = num(v); return v ? (sep === ';' ? String(v).replace('.', ',') : String(v)) : ''; };
  const order = Object.keys(TIPI);
  const L = live().sort((a, b) => (a.desiderio - b.desiderio) || (order.indexOf(a.tipo) - order.indexOf(b.tipo)) || String(a.autore || '').localeCompare(String(b.autore || ''), LOC()) || String(a.titolo).localeCompare(String(b.titolo), LOC()));
  const cols = [
    ['Tipo', i => tr((TIPI[i.tipo] || {}).label || i.tipo)], ['Titolo', i => i.titolo], ['Autore / artista', i => i.autore], ['Anno', i => i.anno],
    ['Editore / etichetta', i => i.editore], ['Formato', i => tr(i.formato)], ['Genere', i => i.genere], ['Serie', i => i.serie], ['Volume', i => i.volume],
    ['Codice', i => i.codice], ['N. catalogo', i => i.catalogo], ['Paese', i => i.paese], ['Condizione', i => tr(i.condizione)], ['Posizione', i => i.posizione],
    ['Prezzo pagato', i => n(i.prezzo)], ['Valore stimato', i => n(i.valore)], ['Valore di mercato', i => { const m = marketValue(i); return m.src && m.src !== 'manuale' ? n(m.v) : ''; }],
    ['Voto', i => i.valutazione || ''], ['Stato', i => tr(statoLabel(i))], ['Etichette', i => (i.tags || []).join(', ')], ['Lista desideri', i => i.desiderio ? tr('Sì') : ''],
    ['Prestato a', i => i.prestatoA], ['Prestato il', i => i.prestatoIl], ['Note', i => i.note], ['Aggiunto il', i => { if (!i.createdAt) return ''; const d = new Date(i.createdAt); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }],
  ];
  const cell = v => { v = String(v ?? ''); return /["\n\r,;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const csv = '﻿' + [cols.map(c => cell(tr(c[0]))).join(sep), ...L.map(i => cols.map(c => cell(c[1](i))).join(sep))].join('\r\n');
  saveFile(new File([csv], `spinyl-${new Date().toISOString().slice(0, 10)}.csv`, { type: 'text/csv' }), 'Spinyl CSV');
}

/* ── Importare da altre app ────────────────────────────────── */
function parseCSV(text) {
  text = String(text).replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : first.includes('\t') && !first.includes(',') ? '\t' : ',';
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; }
    else if (ch === '"') q = true;
    else if (ch === sep) { row.push(f); f = ''; }
    else if (ch === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (ch !== '\r') f += ch;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const head = (rows.shift() || []).map(h => h.trim());
  return rows.filter(r => r.some(x => String(x).trim())).map(r => Object.fromEntries(head.map((h, i) => [h, String(r[i] ?? '').trim()])));
}
const cleanDiscogsName = s => String(s || '').replace(/\s\(\d+\)$/, '').replace(/\*$/, '').trim();
const goldmine = s => { s = String(s || ''); return /^Mint/.test(s) ? 'Nuovo / sigillato' : /Near Mint/.test(s) ? 'Come nuovo' : /Very Good Plus/.test(s) ? 'Ottimo' : /Very Good/.test(s) ? 'Buono' : /Good/.test(s) ? 'Discreto' : /Fair|Poor/.test(s) ? 'Rovinato' : ''; };
function discogsAny(formats, qty) {
  const s = formats.join(' | ').replace(/\bCass\b/g, 'Cassette');
  const m = discogsMedia([s], qty);
  if (!m.tipo && /DVD|Blu-?ray|VHS/i.test(s)) return { tipo: 'film', formato: guessFilmFormat(s) };
  return m;
}
function fromDiscogsApi(r) {
  const b = r.basic_information || {};
  const fm = b.formats || [];
  const l = (b.labels || [])[0] || {};
  return { ...discogsAny(fm.flatMap(f => [f.name, ...(f.descriptions || []), f.text].filter(Boolean)), fm[0] && fm[0].qty),
    titolo: b.title || '', autore: (b.artists || []).map(a => cleanDiscogsName(a.anv || a.name)).join(', '), anno: b.year ? String(b.year) : '',
    editore: cleanDiscogsName(l.name), catalogo: l.catno && l.catno.toLowerCase() !== 'none' ? l.catno : '',
    genere: [...(b.genres || []), ...(b.styles || [])].slice(0, 4).join(', '), coverUrl: b.cover_image || '',
    discogsId: String(b.id || r.id || ''), valutazione: r.rating || 0, createdAt: Date.parse(r.date_added) || 0 };
}
function fromDiscogsCsv(r) {
  const f = r.Format || ''; const q = (f.match(/(\d+)\s*x/i) || [])[1];
  return { ...discogsAny([f], q), titolo: r.Title || '', autore: cleanDiscogsName(r.Artist), editore: cleanDiscogsName(r.Label),
    catalogo: r['Catalog#'] && r['Catalog#'].toLowerCase() !== 'none' ? r['Catalog#'] : '', anno: year(r.Released), discogsId: r.release_id || '',
    valutazione: +r.Rating || 0, condizione: goldmine(r['Collection Media Condition']), condCustodia: goldmine(r['Collection Sleeve Condition']),
    note: r['Collection Notes'] || '', createdAt: Date.parse(r['Date Added']) || 0 };
}
function fromGoodreads(r) {
  const digits = s => String(s || '').replace(/[^\dX]/gi, '');
  const isbn = digits(r.ISBN13) || digits(r.ISBN);
  let titolo = r.Title || '', serie = '', volume = '';
  const m = titolo.match(/^(.*?)\s*\(([^()]+?),?\s*#(\d+(?:\.\d+)?)\)\s*$/);
  if (m) { titolo = m[1]; serie = m[2].replace(/,\s*$/, '').trim(); volume = m[3]; }
  const shelf = r['Exclusive Shelf'] || ''; const bind = r.Binding || '';
  const when = Date.parse(r['Date Added']) || 0;
  return { tipo: 'libro', titolo, autore: r.Author || '', codice: isbn, editore: r.Publisher || '', pagine: r['Number of Pages'] || '',
    anno: r['Original Publication Year'] || r['Year Published'] || '', valutazione: +r['My Rating'] || 0, serie, volume,
    formato: /hardcover/i.test(bind) ? 'Copertina rigida' : /mass market/i.test(bind) ? 'Tascabile' : /paperback/i.test(bind) ? 'Brossura' : /comic|graphic/i.test(bind) ? 'Fumetto' : '',
    stato: shelf === 'read' ? 'fatto' : shelf === 'currently-reading' ? 'in' : shelf === 'to-read' ? 'da' : '',
    desiderio: shelf === 'to-read' && !(+r['Owned Copies'] > 0),
    tags: String(r.Bookshelves || '').split(',').map(t => t.trim()).filter(t => t && !['read', 'to-read', 'currently-reading'].includes(t)),
    note: r['Private Notes'] || '',
    commenti: r['My Review'] ? [{ id: uid(), testo: stripHtml(r['My Review']), data: Date.parse(r['Date Read']) || when || Date.now() }] : [],
    coverUrl: isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false` : '', createdAt: when };
}
function fromLetterboxd(r, wl) {
  return { tipo: 'film', titolo: r.Name || '', anno: r.Year || '', valutazione: r.Rating ? Math.min(5, Math.round(+r.Rating)) : 0,
    stato: wl ? 'da' : 'fatto', desiderio: !!wl, createdAt: Date.parse(r.Date) || 0 };
}
function isDup(c, list) {
  return list.some(e => (c.discogsId && e.discogsId && String(e.discogsId) === String(c.discogsId))
    || (c.codice && e.codice && sameCode(c.codice, e.codice))
    || (e.tipo === c.tipo && (!c.codice || !e.codice) && sameWork(e, c) && (!c.anno || !e.anno || String(c.anno) === String(e.anno))));
}
function importPreview(list, source, askOwn) {
  const ex = live(); const fresh = []; const promote = []; let dups = 0;
  list.forEach(c => {
    // è nella lista desideri e ora ce l'hai: passa nella collezione invece di essere un doppione
    if (!c.desiderio) { const w = ex.find(e => e.desiderio && isDup(c, [e])); if (w && !promote.some(p => p.w === w)) { promote.push({ w, c }); return; } }
    if (isDup(c, ex) || isDup(c, fresh)) dups++; else fresh.push(c);
  });
  S.importList = fresh; S.importPromote = promote;
  const total = fresh.length + promote.length;
  const more = fresh.length - 5;
  openSheet(`<h2>Importa da ${esc(source)}</h2>
    <p class="lead">${fresh.length === 1 ? '1 pezzo nuovo' : fresh.length + ' pezzi nuovi'}${promote.length ? ` · ${promote.length === 1 ? '1 dai desideri alla collezione' : promote.length + ' dai desideri alla collezione'}` : ''}${dups ? ` · ${dups === 1 ? '1 già presente' : dups + ' già presenti'}` : ''}</p>
    ${fresh.length ? `<div class="results">${fresh.slice(0, 5).map(c => rowHTML(c)).join('')}</div>${more > 0 ? `<p class="note" style="margin:8px 2px">…e altri ${more}</p>` : ''}` : ''}
    ${!total ? `<button class="btn block" style="margin-top:14px" data-a="closeSheet">Chiudi</button>`
      : askOwn ? `<p class="note" style="margin:14px 2px 8px">Questi film li hai in DVD o Blu-ray, o li metto nei desideri?</p>
        <div class="stack"><button class="btn primary block" data-a="importGo" data-v="own">Li ho in collezione</button><button class="btn block" data-a="importGo" data-v="wish">Mettili nei desideri</button></div>`
      : `<button class="btn primary block" style="margin-top:14px" data-a="importGo">${total === 1 ? 'Importa 1 pezzo' : `Importa ${total} pezzi`}</button>`}`);
}
async function importGo(el) {
  const wish = el.dataset.v === 'wish'; const now = Date.now(); const list = S.importList || [];
  const items = list.map((c, i) => normalize({ ...EMPTY(), ...c, desiderio: wish || !!c.desiderio, createdAt: c.createdAt || now - i, updatedAt: now }));
  const moved = wish ? [] : (S.importPromote || []).map(({ w, c }) => {
    Object.entries(c).forEach(([k, v]) => { if (k !== 'createdAt' && v !== '' && v != null && (w[k] === '' || w[k] == null || (Array.isArray(w[k]) && !w[k].length) || w[k] === 0)) w[k] = v; });
    w.desiderio = false; w.createdAt = now; w.updatedAt = now; return w;
  });
  await DB.putMany('items', [...items, ...moved]); S.items.push(...items); S.importList = null; S.importPromote = null;
  const n = items.length + moved.length;
  closeSheet(); toast(n === 1 ? 'Importato 1 pezzo' : `Importati ${n} pezzi`); markDirty();
  S.filter = 'tutti'; S.q = ''; go('list');
  queueCovers(items.filter(i => !i.coverUrl).map(i => i.id));
}
async function importCsvFile(file) {
  let rows;
  try { rows = parseCSV(await file.text()); } catch (e) { return toast('File CSV non leggibile'); }
  const h = rows[0] ? Object.keys(rows[0]) : [];
  if (h.includes('Exclusive Shelf') || h.includes('Book Id')) return importPreview(rows.map(fromGoodreads).filter(c => c.titolo), 'Goodreads');
  if (h.includes('Letterboxd URI')) { const wl = /watchlist/i.test(file.name || ''); return importPreview(rows.map(r => fromLetterboxd(r, wl)).filter(c => c.titolo), 'Letterboxd', !wl); }
  if (h.includes('release_id') || h.includes('Catalog#')) return importPreview(rows.map(fromDiscogsCsv).filter(c => c.titolo && c.tipo), 'Discogs');
  toast('Formato non riconosciuto: servono i CSV di Goodreads, Letterboxd o Discogs', 4500);
}
async function importDiscogs() {
  const tok = cfg('discogsToken'); if (!tok) return toast('Serve il token Discogs');
  openSheet(`<h2>Collezione Discogs</h2>${loadingHTML('Leggo la tua collezione…')}`);
  try {
    const me = await fj('https://api.discogs.com/oauth/identity?token=' + encodeURIComponent(tok));
    const out = []; let page = 1, pages = 1;
    do {
      const d = await fj(`https://api.discogs.com/users/${encodeURIComponent(me.username)}/collection/folders/0/releases?per_page=100&page=${page}&sort=added&sort_order=desc&token=${encodeURIComponent(tok)}`);
      pages = (d.pagination && d.pagination.pages) || 1;
      (d.releases || []).forEach(r => out.push(fromDiscogsApi(r)));
      page++; if (page <= pages) await sleep(1100);
    } while (page <= pages && page <= 60);
    if ($('#sheetWrap').classList.contains('hidden')) return;
    if (!out.length) return openSheet(`<h2>Collezione Discogs</h2><p class="lead">La collezione di <b translate="no">${esc(me.username)}</b> su Discogs è vuota.</p>`);
    importPreview(out.filter(c => c.tipo && c.titolo), 'Discogs');
  } catch (e) {
    openSheet(`<h2>Collezione Discogs</h2><p class="lead">Non riesco a leggere la collezione. Controlla il token e la connessione, poi riprova.</p>`);
  }
}

/* ── Copertine mancanti (dopo un'importazione) ─────────────── */
let coverRunning = false;
async function queueCovers(ids) {
  if (!ids.length) return;
  const q = new Set([...((await getMeta('coverJob')) || []), ...ids]);
  await setMeta('coverJob', [...q]); runCovers();
}
async function findCover(it) {
  if (it.discogsId && cfg('discogsToken')) {
    const r = await fj(`https://api.discogs.com/releases/${encodeURIComponent(it.discogsId)}?token=${encodeURIComponent(cfg('discogsToken'))}`);
    return (r.images && r.images[0] && (r.images[0].uri || r.images[0].uri150)) || '';
  }
  if (isMusic(it.tipo)) { const L = await itunes([it.autore, it.titolo].filter(Boolean).join(' '), 'album'); const m = L.find(c => sameWork(c, it)); return m ? m.coverUrl : ''; }
  if (it.tipo === 'film') {
    const L = await itunes(it.titolo, 'movie').catch(() => []);
    const m = L.find(c => norm(c.titolo) === norm(it.titolo) && (!it.anno || !c.anno || Math.abs(+c.anno - +it.anno) <= 1));
    if (m && m.coverUrl) return m.coverUrl;
    const W = await wikidataFilms(it.titolo);
    const w = W.find(c => (!it.anno || !c.anno || String(c.anno) === String(it.anno)) && norm(c.titolo) === norm(it.titolo)) || W.find(c => it.anno && String(c.anno) === String(it.anno));
    return w && w._wiki ? (await wikipediaInfo(w._wiki)).coverUrl : '';
  }
  if (it.tipo === 'libro') {
    const L = await openLibrarySearch('title=' + encodeURIComponent(it.titolo) + (it.autore ? '&author=' + encodeURIComponent(String(it.autore).split(',')[0]) : ''));
    const m = L.find(c => c.coverUrl); return m ? m.coverUrl : '';
  }
  return '';
}
async function runCovers() {
  if (coverRunning || !navigator.onLine) return; coverRunning = true;
  try {
    const q = (await getMeta('coverJob')) || [];
    while (q.length) {
      const it = byId(q[0]);
      if (it && !it.deleted && !it.coverUrl && !(it.foto || []).length) {
        try {
          const u = await findCover(it);
          if (u) { it.coverUrl = u; await saveItem(it); if (S.view === 'list') renderGrid(); }
        } catch (e) { if (!navigator.onLine) break; }
        await sleep(1100);
      }
      q.shift(); await setMeta('coverJob', q);
    }
  } finally { coverRunning = false; }
}

/* ── Nuova versione disponibile e novità ───────────────────── */
function showUpdateBar() {
  if ($('#updateBar')) return;
  const b = document.createElement('div'); b.id = 'updateBar'; b.className = 'updatebar'; b.setAttribute('role', 'status');
  b.innerHTML = `<span>È pronta una nuova versione di Spinyl.</span><button data-a="reloadApp">Aggiorna</button>`;
  document.body.appendChild(b);
}
const NEWS = {
  '2.2': [
    ['Foto copertina', 'Fotografa la copertina di un disco o di un libro: Spinyl lo riconosce e cerca dati e prezzi.'],
  ],
  '2.1': [
    ['Quanto vale?', 'Scansionando un disco con “Ce l’ho già?” vedi subito i prezzi Discogs per ogni condizione; per libri e film i venduti su eBay e AbeBooks.'],
    ['Tab Valore', 'Nella lista, il filtro “Valore”: totale per categoria, diviso per condizione, con il prezzo di ogni pezzo.'],
  ],
  '2.0': [
    ['Ce l’ho già?', 'Il tasto con la spunta in alto: scansioni un codice in negozio e scopri subito se ce l’hai.'],
    ['Scansione a raffica', 'Da “Aggiungi”: leggi tanti codici di fila e li controlli alla fine.'],
    ['Valore di mercato', 'Per vinili, CD e cassette: il prezzo minimo in vendita su Discogs.'],
    ['Statistiche e pesca a caso', 'Il tasto con il grafico: i numeri della collezione e cosa ascoltare stasera.'],
    ['Letto, visto, ascoltato', 'Segna a che punto sei: trovi tutto nel filtro “Da scoprire”.'],
    ['Serie ed etichette', 'Volumi di una saga (con quelli che mancano) ed etichette libere come “Autografato”.'],
    ['Condividi e ricorda', 'Manda la lista desideri e ricorda i prestiti con un messaggio.'],
    ['Importa ed esporta', 'Da Goodreads, Letterboxd e Discogs; tabella CSV per Excel.'],
  ],
};
const verNum = v => String(v || '0').split('.').slice(0, 2).map(Number).reduce((a, n) => a * 1000 + (n || 0), 0);
function maybeWhatsNew() {
  let seen = null; try { seen = localStorage.getItem('seenVersion'); localStorage.setItem('seenVersion', VERSION); } catch (e) { return; }
  if (seen === VERSION || (!seen && !live().length)) return;
  const from = seen ? verNum(seen) : verNum('1.9');
  const items = Object.keys(NEWS).filter(v => verNum(v) > from && verNum(v) <= verNum(VERSION)).flatMap(v => NEWS[v]);
  if (!items.length) return;
  setTimeout(() => openSheet(`<h2>Novità di Spinyl ${VERSION.replace(/\.0$/, '')}</h2>
    <ul class="news">${items.map(([t, d]) => `<li><b>${esc(t)}</b><span>${esc(d)}</span></li>`).join('')}</ul>
    <button class="btn primary block" style="margin-top:6px" data-a="closeSheet">Inizia</button>`), 600);
}

/* ── Riconoscere un pezzo dalla foto della copertina ───────── */
// 1) Google Cloud Vision, se c'è la chiave: riconosce anche le copertine senza scritte
// 2) altrimenti lettura del testo sul telefono (Tesseract, gratuito, nessun dato inviato)
const TESS_URLS = ['https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js', 'https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js'];
let ocrWorkerP = null;
function ocrStatus(msg) { const l = $('#ocrStatus .loading'); if (l && l.lastChild) l.lastChild.textContent = msg; }
async function ocrImage(blob) {
  if (!(await loadFirst(TESS_URLS, () => window.Tesseract && window.Tesseract.createWorker))) throw new Error('ocr-load');
  if (!ocrWorkerP) {
    ocrStatus('Preparo il lettore di testo (solo la prima volta)…');
    ocrWorkerP = Tesseract.createWorker('eng', 1, {
      logger: m => { if (m && m.status === 'recognizing text') ocrStatus(`Leggo le scritte… ${Math.round((m.progress || 0) * 100)}%`); },
    }).catch(e => { ocrWorkerP = null; throw e; });
  }
  const worker = await ocrWorkerP;
  const { data } = await worker.recognize(blob);
  let lines = (data && data.lines) || [];
  if (!lines.length && data && data.blocks) lines = data.blocks.flatMap(b => (b.paragraphs || []).flatMap(p => p.lines || []));
  lines = lines.map(l => ({ text: l.text, h: l.bbox ? l.bbox.y1 - l.bbox.y0 : 0, conf: l.confidence }));
  if (!lines.length && data && data.text) lines = String(data.text).split('\n').map(t => ({ text: t, h: 0 }));
  return lines;
}
// Dalle righe lette tiene le scritte più grandi (di solito titolo e autore), nell'ordine in cui compaiono
function ocrQuery(lines) {
  const L = lines.map(l => ({
    t: String(l.text || '').replace(/[^\p{L}\p{N}'’&.,:!? -]/gu, ' ').split(/\s+/).filter(w => w.length > 1 || /^[\p{N}&aeiouAEIOU]$/u.test(w)).join(' ').trim(),
    h: l.h || 0, c: l.conf == null ? 100 : l.conf,
  })).filter(l => l.t.length >= 2 && /\p{L}{2,}/u.test(l.t) && l.c >= 45);
  const maxH = Math.max(0, ...L.map(l => l.h));
  const top = L.slice().sort((a, b) => b.h - a.h).filter(l => !maxH || l.h >= maxH * 0.45).slice(0, 3); // solo le scritte grandi
  return L.filter(l => top.includes(l)).map(l => l.t).join(' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}
async function visionAnnotate(blob) {
  const small = await compressImage(blob, 1024, 0.85);
  const b64 = (await blobToDataURL(small)).split(',')[1];
  const r = await fetch('https://vision.googleapis.com/v1/images:annotate?key=' + encodeURIComponent(cfg('visionKey')), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ image: { content: b64 }, features: [{ type: 'WEB_DETECTION', maxResults: 8 }, { type: 'TEXT_DETECTION', maxResults: 1 }] }] }),
  });
  if (!r.ok) throw new Error('vision ' + r.status);
  const d = ((await r.json()).responses || [])[0] || {};
  const w = d.webDetection || {};
  return {
    guess: (w.bestGuessLabels || []).map(x => x.label).filter(Boolean),
    entities: (w.webEntities || []).filter(e => e.description && (e.score || 0) >= 0.5).map(e => e.description),
    text: (d.fullTextAnnotation && d.fullTextAnnotation.text) || ((d.textAnnotations || [])[0] || {}).description || '',
  };
}
const VISION_JUNK = /\b(vinyl|vinile|vinilo|records?|lp|album|cover|copertina|portada|book|libro|cd|compact disc|cassette|cassetta|dvd|blu-?ray|poster|art|artwork|edition|paperback|hardcover|novel|romanzo|discogs|amazon|ebay)\b/gi;
function visionQuery(v) {
  const g = String(v.guess[0] || '').replace(VISION_JUNK, ' ').replace(/\s+/g, ' ').trim();
  if (g.split(' ').length >= 2) return g.slice(0, 90);
  const junk = new RegExp(VISION_JUNK.source, 'i');
  const ent = v.entities.filter(e => !junk.test(e)).slice(0, 2).join(' ');
  const txt = String(v.text).split('\n').map(t => t.trim()).filter(t => /\p{L}{2,}/u.test(t)).slice(0, 3).join(' ');
  return [g, ent || txt].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 90);
}
// Limite mensile per telefono: con più amici sulla stessa chiave il totale resta nelle 1000 foto gratuite di Google
const VISION_MONTHLY = +(BASE.VISION_MONTHLY_LIMIT || 100);
const monthKey = () => new Date().toISOString().slice(0, 7);
function visionUsed() { try { const u = JSON.parse(localStorage.getItem('visionUse') || '{}'); return u.m === monthKey() ? (u.n || 0) : 0; } catch (e) { return 0; } }
function visionCount() { try { localStorage.setItem('visionUse', JSON.stringify({ m: monthKey(), n: visionUsed() + 1 })); } catch (e) {} }
async function recognizeCover(file) {
  const mode = S.coverMode || 'add';
  const tipo = S.coverTipo || S.addTipo || 'libro';
  let blob;
  try { blob = await compressImage(file, 1600, 0.9); } catch (e) { return toast('Formato foto non supportato'); }
  if (S.coverShotUrl) URL.revokeObjectURL(S.coverShotUrl);
  S.coverShot = blob; S.coverShotUrl = URL.createObjectURL(blob); S.coverMode = mode;
  const overLimit = !!cfg('visionKey') && visionUsed() >= VISION_MONTHLY;
  const useVision = !!cfg('visionKey') && !overLimit;
  if (overLimit) toast('Limite mensile di Google Vision raggiunto: leggo le scritte sul telefono', 3500);
  const token = S.coverToken = uid();
  openSheet(`<h2>Leggo la copertina…</h2><div class="coverhead"><img src="${S.coverShotUrl}" alt=""></div>
    <div id="ocrStatus">${loadingHTML(useVision ? 'Riconosco la copertina…' : 'Leggo le scritte sulla copertina…')}</div>`);
  let q = '', how = '';
  if (useVision) {
    try { const v = await visionAnnotate(blob); visionCount(); q = visionQuery(v); how = 'vision'; }
    catch (e) { console.warn(e); toast('Google Vision non risponde: provo a leggere le scritte', 3000); }
  }
  if (!q) {
    try { q = ocrQuery(await ocrImage(blob)); how = 'ocr'; }
    catch (e) { console.warn(e); }
  }
  if (S.coverToken !== token || $('#sheetWrap').classList.contains('hidden')) return; // annullato
  S.coverMode = mode;
  sheetSearch(tipo, q, '', { cover: true, auto: !!q, how });
}
function startCover(mode, tipo) {
  S.coverMode = mode; S.coverTipo = tipo;
  const inp = $('#coverInput'); if (inp) inp.click();
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
  addSearch: () => { S.intoDraft = false; S.pickWish = false; S.coverMode = null; sheetSearch(S.addTipo); },
  addManual: () => { closeSheet(); startDraft({ tipo: S.addTipo }, false); },
  manualWithCode: () => {
    const c = S.searchCtx || {}; closeSheet();
    if (S.batchTarget) { S.batch = S.batch.filter(r => r.id !== S.batchTarget); S.batchTarget = null; saveBatch(); }
    const wish = !!S.pickWish; S.pickWish = false;
    startDraft({ tipo: c.tipo || S.addTipo, codice: c.code || '', desiderio: wish }, S.intoDraft);
  },
  pick: el => {
    const c = S.candidates[+el.dataset.v];
    if (S.batchTarget) return batchAssign(c);
    if (S.coverMode === 'check') { S.coverMode = null; return checkFromCandidate(c); }
    return pickCandidate(c);
  },
  closeScanner: () => {
    const wasBatch = Scanner.continuous; Scanner.stop();
    if (wasBatch && S.view !== 'batch' && S.batch.length) go('batch');
    else if (wasBatch && S.view === 'batch') render();
  },
  scanPhoto: () => $('#scanPhotoInput').click(),

  scanForDraft: () => { const t = S.draft.tipo; Scanner.start(code => { S.draft.codice = code; handleCode(code, t, true); }); },
  searchForDraft: () => { S.intoDraft = true; S.pickWish = false; S.coverMode = null; sheetSearch(S.draft.tipo, [S.draft.titolo, isMusic(S.draft.tipo) ? S.draft.autore : ''].filter(Boolean).join(' ')); },
  draftTipo: el => { S.draft.tipo = el.dataset.v; render(); },
  rateDraft: el => { const v = +el.dataset.v; S.draft.valutazione = S.draft.valutazione === v ? 0 : v; el.parentElement.outerHTML = starsHTML(S.draft.valutazione, 'rateDraft'); },
  addPhoto: () => $('#photoInput').click(),
  rmPhoto: el => { S.draft.foto = S.draft.foto.filter(p => p !== el.dataset.v); render(); },
  rmCover: () => { S.draft.coverUrl = ''; render(); },
  tapeTemplate: () => { S.draft.tracklist = TAPE_TEMPLATE; render(); const t = $('[data-f=tracklist]'); if (t) { t.focus(); t.setSelectionRange(10, 10); } },
  cancelEdit: () => { discardDraftPhotos(); S.draft = null; history.back(); },
  save: async () => {
    const d = S.draft;
    if (d.tagsTxt != null) { d.tags = parseTags(d.tagsTxt); delete d.tagsTxt; }
    if (!d.titolo.trim()) { toast('Serve almeno il titolo'); $('[data-f="titolo"]')?.focus(); return; }
    d.titolo = d.titolo.trim();
    const isNew = S.draftIsNew; S.newPhotos = []; S.draft = null;
    if (!isNew) { const orig = byId(d.id); (orig?.foto || []).filter(p => !d.foto.includes(p)).forEach(p => DB.del('photos', p)); }
    await saveItem(d);
    toast(isNew ? 'Aggiunto allo scaffale' : 'Salvato');
    if (isNew) { history.replaceState({ view: 'detail', id: d.id }, ''); S.view = 'detail'; S.id = d.id; render(); window.scrollTo(0, 0); }
    else history.back();
  },

  edit: el => { const it = byId(el.dataset.id); S.draft = { ...EMPTY(), ...JSON.parse(JSON.stringify(it)) }; S.draft.foto = S.draft.foto || []; S.draft.commenti = S.draft.commenti || []; S.draft.tags = S.draft.tags || []; S.draftIsNew = false; S.newPhotos = []; go('edit'); },
  rateDetail: async el => { const it = byId(S.id); const v = +el.dataset.v; it.valutazione = it.valutazione === v ? 0 : v; await saveItem(it); el.parentElement.outerHTML = starsHTML(it.valutazione, 'rateDetail'); },
  expand: () => { S.expanded = true; render(); },
  returned: async () => { const it = byId(S.id); it.prestatoA = ''; it.prestatoIl = ''; await saveItem(it); render(); toast('Segnato come restituito'); },
  delComment: async el => { if (!confirm(tr('Eliminare questo commento?'))) return; const it = byId(S.id); it.commenti = (it.commenti || []).filter(c => c.id !== el.dataset.v); await saveItem(it); render(); },
  delete: async () => {
    const it = byId(S.id); if (!confirm(tr(`Eliminare "${it.titolo}" dallo scaffale?`))) return;
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
    ['booksKey', 'tmdbKey', 'discogsToken', 'visionKey', 'clientId'].forEach(k => { const el = $('#cfg-' + k); if (el) setCfg(k, el.value); });
    toast('Impostazioni salvate'); render();
  },
};
Object.assign(actions, {
  check: () => startCheck(),
  checkAdd,
  gotIt,
  stats: () => go('stats'),
  pickTipo: el => { S.pickTipo = el.dataset.v; document.querySelectorAll('.pickchips .chip').forEach(c => c.classList.toggle('on', c === el)); },
  pickRandom: () => pickRandom(),
  draftStato: el => { S.draft.stato = S.draft.stato === el.dataset.v ? '' : el.dataset.v; render(); },
  setStato: async el => { const it = byId(S.id); it.stato = it.stato === el.dataset.v ? '' : el.dataset.v; await saveItem(it); render(); },
  addTag: el => { const cur = parseTags(S.draft.tagsTxt != null ? S.draft.tagsTxt : (S.draft.tags || []).join(',')); cur.push(el.dataset.v); S.draft.tagsTxt = cur.join(', '); render(); },
  tag: el => { S.q = '#' + el.dataset.v; S.filter = 'tutti'; localStorage.setItem('filter', 'tutti'); go('list'); },
  clearTag: () => { S.q = ''; const q = $('#q'); if (q) q.value = ''; renderGrid(); },
  shareWish: () => shareWish(),
  remind: () => remindLoan(),
  valueNow: () => valueNow(),
  valueAll: () => valueAll(),
  addBatch: () => { S.batchTipo = S.addTipo; closeSheet(); startBatch(); },
  openBatch: () => go('batch'),
  batchScan: () => startBatch(),
  batchTipo: el => { S.batchTipo = el.dataset.v; render(); },
  batchRemove: el => { S.batch = S.batch.filter(r => r.id !== el.dataset.v); saveBatch(); render(); },
  batchClear: () => { if (!confirm(tr('Svuotare la coda?'))) return; S.batch = []; saveBatch(); render(); },
  batchChoose: el => { const r = S.batch.find(x => x.id === el.dataset.v); if (!r || !r.alts) return; S.batchTarget = r.id; S.candidates = r.alts; openSheet(`<h2>Quale di questi?</h2><div class="results">${resultsHTML(r.alts)}</div>`); },
  batchSearch: el => { const r = S.batch.find(x => x.id === el.dataset.v); if (!r) return; S.intoDraft = false; S.pickWish = false; sheetSearch(r.tipo, '', r.code); S.batchTarget = r.id; },
  batchSave: () => batchSave(),
  addCover: () => { closeSheet(); startCover('add', S.addTipo); },
  checkCover: () => { closeSheet(); startCover('check', S.coverTipo || localStorage.getItem('coverTipo') || 'vinile'); },
  scanCover: () => { const check = Scanner.mode === 'check'; Scanner.stop(); startCover(check ? 'check' : 'add', check ? (S.coverTipo || localStorage.getItem('coverTipo') || 'vinile') : S.addTipo); },
  searchTipo: el => {
    const t = el.dataset.v; S.searchCtx.tipo = t; S.coverTipo = t; try { localStorage.setItem('coverTipo', t); } catch (e) {}
    document.querySelectorAll('[data-a=searchTipo]').forEach(b => b.classList.toggle('on', b === el));
    const q = $('#titleQ'); if (q) { q.placeholder = tr(searchPlaceholder(t)); if (q.value.trim()) $('#titleSearch').requestSubmit(); }
  },
  batchForce: el => { const r = S.batch.find(x => x.id === el.dataset.v); if (r) { r.force = !r.force; saveBatch(); render(); } },
  exportCsv: () => exportCsv(),
  importCsv: () => $('#csvInput').click(),
  importDiscogs: () => importDiscogs(),
  importGo,
  reloadApp: () => location.reload(),
});
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
  if (t.id === 'langSel' && window.I18N) { I18N.set(t.value); location.reload(); return; }
  if (t.id === 'sort') { S.sort = t.value; localStorage.setItem('sort', S.sort); renderGrid(); }
  if (t.dataset.f && S.draft) S.draft[t.dataset.f] = t.type === 'checkbox' ? t.checked : t.value;
});
document.addEventListener('submit', async e => {
  e.preventDefault();
  if (e.target.id === 'manualCodeForm') {
    const code = $('#manualCode').value.replace(/\D/g, ''); if (code.length < 8) { toast('Codice troppo corto'); return; }
    Scanner.submit(code); if (Scanner.continuous) $('#manualCode').value = '';
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
$('#coverInput').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) recognizeCover(f); else S.coverMode = null; });
$('#csvInput').addEventListener('change', e => { const f = e.target.files[0]; e.target.value = ''; if (f) importCsvFile(f); });

window.addEventListener('online', () => { scheduleSync(800); runBatch(); runCovers(); });
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  scheduleSync(800);
  if (S.swReg) S.swReg.update().catch(() => {}); // controlla se è uscita una nuova versione
});

/* ── Avvio ─────────────────────────────────────────────────── */
(async function init() {
  await DB.open();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  const justLogged = Drive.handleRedirect();
  await loadItems();
  S.dirty = !!(await getMeta('dirty'));
  S.lastSync = (await getMeta('lastSync')) || 0;
  S.batch = ((await getMeta('batch')) || []).map(r => (r.status === 'busy' ? { ...r, status: 'wait' } : r));
  history.replaceState({ view: 'list' }, '');
  if (window.I18N) I18N.start();
  render();
  if (cfg('clientId')) { if (Drive.token()) { sync(); if (justLogged) toast('Collegato a Google Drive'); } else setSync('login'); }
  maybeWhatsNew();
  runBatch(); runCovers();
  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
      S.swReg = reg;
      reg.addEventListener('updatefound', () => {
        const w = reg.installing; if (!w) return;
        w.addEventListener('statechange', () => { if (w.state === 'activated' && hadController) showUpdateBar(); });
      });
    }).catch(() => {});
  }
})();
