/* Scaffale — inventario personale di libri, dischi e film.
   App web installabile (PWA). Dati sul telefono + copia su Google Drive. */
'use strict';

const VERSION = '2.26.0';
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
  note: '', commenti: [], foto: [], coverUrl: '', prestatoA: '', prestatoIl: '', restituireEntro: '', desiderio: false,
  stato: '', serie: '', volume: '', tags: [], valore: '', valoreDiscogs: null, discogsId: '', votoWeb: null, condiviso: null, offerta: '', prezzoRichiesto: '', notaCommunity: '',
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
// giorni alla data di restituzione (negativi = in ritardo); null se non c'è una data
const loanDue = it => { if (!it.prestatoA || !it.restituireEntro) return null; const d = new Date(it.restituireEntro + 'T23:59:59'); return isNaN(d) ? null : Math.ceil((d - Date.now()) / 864e5) - 1; };
const loanLate = it => !!it.prestatoA && (loanDue(it) != null ? loanDue(it) < 0 : loanDays(it) > PRESTITO_GIORNI);
const loanTag = it => { const due = loanDue(it); if (due == null) return loanDays(it) > PRESTITO_GIORNI ? 'Da ' + loanDays(it) + ' giorni' : 'In prestito';
  return due < 0 ? 'In ritardo' : due === 0 ? 'Da restituire oggi' : due === 1 ? 'Rientra domani' : due <= 3 ? 'Rientra tra ' + due + ' giorni' : 'In prestito'; };
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
// Prezzi da riscaricare: mai presi, vecchi di 30 giorni, o senza prezzi per condizione da più di 2 ore
// (succede finché su Discogs mancano valuta e paese: appena l'utente li imposta, i prezzi arrivano da soli)
const priceStale = (d, days = 30) => !d || !d.at || Date.now() - d.at > days * 864e5 || (!d.sugg && (d.suggErr || d.noTok) && !!cfg('discogsToken') && Date.now() - d.at > 2 * 3600e3);
// Fascia di prezzo sulla copertina: dal prezzo per la condizione peggiore a quello per la migliore (Discogs).
// Senza prezzi per condizione: il valore scritto a mano, oppure il prezzo minimo in vendita ("da …")
function priceRange(it) {
  const d = it.valoreDiscogs;
  if (d && d.sugg) { const v = Object.values(d.sugg).map(Number).filter(x => x > 0); if (v.length) return { lo: Math.min(...v), hi: Math.max(...v), cur: d.scur || 'EUR', src: 'discogs' }; }
  const man = num(it.valore); if (man) return { lo: man, hi: man, cur: 'EUR', src: 'manuale' };
  if (d && d.min) return { lo: d.min, hi: null, cur: d.cur || 'EUR', src: 'minimo' };
  return null;
}
const moneyR = (v, cur = 'EUR') => new Intl.NumberFormat(LOC(), { style: 'currency', currency: cur || 'EUR', maximumFractionDigits: v < 10 && v % 1 ? 2 : 0, minimumFractionDigits: v < 10 && v % 1 ? 2 : 0 }).format(v);
function rangeHTML(it) {
  const r = priceRange(it); if (!r) return '';
  const t = r.hi == null ? `<i>da</i> ${esc(moneyR(r.lo, r.cur))}` : r.lo === r.hi ? esc(moneyR(r.lo, r.cur)) : `${esc(moneyR(r.lo, r.cur))} – ${esc(moneyR(r.hi, r.cur))}`;
  return `<span class="prange ${r.src}">${t}</span>`;
}
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
  note: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
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
const S = { feedErr: {},
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
  const st = e.state || { view: S.main || 'list' };
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
// ── Ritaglio foto: riquadro da trascinare (angoli e centro), rotazione, proporzioni rapide ──
// cropImage(blob) → Promise<Blob|null> (null = annullato, si tiene la foto com'è)
async function loadImg(blob) {
  const url = URL.createObjectURL(blob);
  try { return await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; }); } finally { setTimeout(() => URL.revokeObjectURL(url), 2000); }
}
function cropImage(blob, opts = {}) {
  return new Promise(async resolve => {
    let src; try { src = await loadImg(blob); } catch (e) { return resolve(null); }
    let canvas = document.createElement('canvas'); canvas.width = src.naturalWidth; canvas.height = src.naturalHeight; canvas.getContext('2d').drawImage(src, 0, 0);
    const ov = document.createElement('div'); ov.className = 'cropov';
    ov.innerHTML = `<div class="croptop"><b>${tr(opts.title || 'Ritaglia la foto')}</b><span>${tr('Trascina gli angoli o il riquadro')}</span></div>
      <div class="cropstage"><div class="cropwrap"><img alt=""><div class="cropbox"><i data-h="nw"></i><i data-h="ne"></i><i data-h="sw"></i><i data-h="se"></i></div></div></div>
      <div class="cropratio">${[['free', 'Libero'], ['1', 'Quadrato'], ['0.6667', 'Libro / film']].map(([k, l], i) => `<button type="button" data-r="${k}" class="${i ? '' : 'on'}">${tr(l)}</button>`).join('')}<button type="button" data-rot="1">⟳ ${tr('Ruota')}</button></div>
      <div class="cropbtns"><button type="button" class="btn" data-c="skip">${tr(opts.skipLabel || 'Annulla')}</button><button type="button" class="btn primary" data-c="ok">✂ ${tr('Ritaglia')}</button></div>`;
    document.body.appendChild(ov);
    const img = ov.querySelector('img'), box = ov.querySelector('.cropbox'), wrap = ov.querySelector('.cropwrap');
    let r = { x: 0, y: 0, w: 1, h: 1 }, ratio = 0; // in frazioni dell'immagine mostrata
    const show = () => new Promise(res => { img.onload = res; img.src = canvas.toDataURL('image/jpeg', 0.85); });
    const W = () => img.clientWidth, H = () => img.clientHeight;
    const draw = () => { box.style.left = r.x * W() + 'px'; box.style.top = r.y * H() + 'px'; box.style.width = r.w * W() + 'px'; box.style.height = r.h * H() + 'px'; };
    const fitRatio = () => { // riquadro più grande con la proporzione scelta, al centro
      if (!ratio) { r = { x: 0.04, y: 0.04, w: 0.92, h: 0.92 }; return draw(); }
      const ar = ratio * H() / W(); // larghezza/altezza in frazioni
      let w = 0.92, h = w / ar; if (h > 0.92) { h = 0.92; w = h * ar; }
      r = { x: (1 - w) / 2, y: (1 - h) / 2, w, h }; draw();
    };
    await show(); fitRatio();
    const clamp = () => { r.w = Math.min(Math.max(r.w, 0.08), 1); r.h = Math.min(Math.max(r.h, 0.08), 1); r.x = Math.min(Math.max(r.x, 0), 1 - r.w); r.y = Math.min(Math.max(r.y, 0), 1 - r.h); };
    let drag = null;
    const pt = e => { const b = img.getBoundingClientRect(); return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height }; };
    wrap.addEventListener('pointerdown', e => {
      const h = e.target.dataset && e.target.dataset.h; const p = pt(e);
      if (!h && !box.contains(e.target)) return;
      drag = { h, p, r0: { ...r } }; wrap.setPointerCapture(e.pointerId); e.preventDefault();
    });
    wrap.addEventListener('pointermove', e => {
      if (!drag) return; const p = pt(e), dx = p.x - drag.p.x, dy = p.y - drag.p.y, o = drag.r0;
      if (!drag.h) { r = { ...o, x: o.x + dx, y: o.y + dy }; clamp(); return draw(); }
      let x1 = o.x, y1 = o.y, x2 = o.x + o.w, y2 = o.y + o.h;
      if (drag.h.includes('w')) x1 = Math.min(x2 - 0.08, Math.max(0, x1 + dx)); else x2 = Math.max(x1 + 0.08, Math.min(1, x2 + dx));
      if (drag.h.includes('n')) y1 = Math.min(y2 - 0.08, Math.max(0, y1 + dy)); else y2 = Math.max(y1 + 0.08, Math.min(1, y2 + dy));
      if (ratio) { const ar = ratio * H() / W(); const w = x2 - x1, h = w / ar; if (drag.h.includes('n')) y1 = y2 - h; else y2 = y1 + h; if (y1 < 0 || y2 > 1) return; }
      r = { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }; draw();
    });
    const end = () => { drag = null; }; wrap.addEventListener('pointerup', end); wrap.addEventListener('pointercancel', end);
    const done = out => { ov.remove(); window.removeEventListener('resize', draw); resolve(out); };
    window.addEventListener('resize', draw);
    ov.addEventListener('click', async e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.r) { ratio = b.dataset.r === 'free' ? 0 : +b.dataset.r; ov.querySelectorAll('[data-r]').forEach(x => x.classList.toggle('on', x === b)); return fitRatio(); }
      if (b.dataset.rot) { const c2 = document.createElement('canvas'); c2.width = canvas.height; c2.height = canvas.width; const g = c2.getContext('2d'); g.translate(c2.width, 0); g.rotate(Math.PI / 2); g.drawImage(canvas, 0, 0); canvas = c2; await show(); return fitRatio(); }
      if (b.dataset.c === 'skip') return done(null);
      if (b.dataset.c === 'ok') {
        const sx = Math.round(r.x * canvas.width), sy = Math.round(r.y * canvas.height), sw = Math.round(r.w * canvas.width), sh = Math.round(r.h * canvas.height);
        const k = Math.min(1, (opts.max || 1400) / Math.max(sw, sh));
        const out = document.createElement('canvas'); out.width = Math.round(sw * k); out.height = Math.round(sh * k);
        out.getContext('2d').drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
        out.toBlob(bl => done(bl), 'image/jpeg', opts.quality || 0.85);
      }
    });
  });
}
// ritaglia una foto già salvata: crea una foto nuova (così anche la copia su Drive si aggiorna) e sostituisce la vecchia
async function cropStoredPhoto(id) {
  const p = await DB.get('photos', id); if (!p || !p.blob || !S.draft) return;
  const out = await cropImage(p.blob); if (!out) return;
  const nid = uid(); await DB.put('photos', { id: nid, blob: out }); S.newPhotos.push(nid);
  S.draft.foto = S.draft.foto.map(x => x === id ? nid : x); render(); toast('Foto ritagliata');
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
  if (S.view === 'detail' && byId(S.id) && !byId(S.id).deleted) { app.innerHTML = viewDetail(byId(S.id)); autoOnline(byId(S.id)); loadComm(byId(S.id)); }
  else if (S.view === 'edit' && S.draft) app.innerHTML = viewEdit();
  else if (S.view === 'settings') app.innerHTML = viewSettings();
  else if (S.view === 'stats') app.innerHTML = viewStats();
  else if (S.view === 'batch') app.innerHTML = viewBatch();
  else if (S.view === 'home') { app.innerHTML = viewHome(); renderFeed(); loadFeed(); }
  else if (S.view === 'community' && COMM_URL) { app.innerHTML = viewCommunity(); loadCommunity(); commUnreadCheck(30e3); }
  else { S.view = 'list'; app.innerHTML = viewList(); renderGrid(); centerChip(false); }
  hydratePhotos(app);
}

function syncBtn() {
  return `<button class="iconbtn" data-a="syncTap" aria-label="Sincronizza">${ic('cloud')}<i class="sync-dot ${S.syncState}"></i></button>`;
}

function counts() {
  const L = live(); const c = { tutti: 0, libro: 0, vinile: 0, cd: 0, cassetta: 0, film: 0, desideri: 0, prestito: 0, scoprire: 0, valore: 0, pagato: 0 };
  L.forEach(i => {
    if (i.desiderio) c.desideri++; else { c.tutti++; c[i.tipo]++; c.valore += valueOf(i); c.pagato += num(i.prezzo); if (i.stato === 'da' || i.stato === 'in') c.scoprire++; }
    if (i.prestatoA) c.prestito++;
  });
  return c;
}

// Intestazione comune a Novità e Collezione, con le due schede
function mainHeader(active) {
  return `<header class="top">
    <div class="grow"><h1>Spinyl</h1></div>
    <button class="iconbtn" data-a="check" aria-label="Ce l'ho già?">${ic('check')}</button>
    ${ID_URL ? `<button class="iconbtn" data-a="listen" aria-label="Che canzone è?">${ic('note')}</button>` : ''}
    <button class="iconbtn" data-a="stats" aria-label="Statistiche">${ic('chart')}</button>
    ${syncBtn()}
    <button class="iconbtn" data-a="settings" aria-label="Impostazioni">${ic('gear')}</button>
  </header>
  <nav class="maintabs ${COMM_URL ? 'three' : ''}" role="tablist">
    <button role="tab" class="${active === 'home' ? 'on' : ''}" data-a="mainTab" data-v="home">Novità</button>
    ${COMM_URL ? `<button role="tab" class="${active === 'community' ? 'on' : ''}" data-a="mainTab" data-v="community">Community${commTotal() ? `<i class="badge">${commTotal()}</i>` : ''}</button>` : ''}
    <button role="tab" class="${active === 'list' ? 'on' : ''}" data-a="mainTab" data-v="list">Collezione<b>${live().filter(i => !i.desiderio).length}</b></button>
  </nav>`;
}

function viewList() {
  const c = counts();
  const compact = v => new Intl.NumberFormat(LOC(), { style: 'currency', currency: 'EUR', notation: 'compact', maximumFractionDigits: v >= 1000 ? 1 : 0 }).format(v);
  const chips = [['tutti', 'Tutti'], ...Object.entries(TIPI).map(([k, v]) => [k, v.plural]), ['valore', 'Valore'], ['scoprire', 'Da scoprire'], ['desideri', 'Desideri'], ['prestito', 'In prestito']]
    .filter(([k]) => !['desideri', 'prestito', 'scoprire'].includes(k) || c[k] > 0 || S.filter === k)
    .map(([k, l]) => `<button class="chip ${S.filter === k ? 'on' : ''}" data-a="filter" data-v="${k}">${l}<b>${k === 'valore' ? (c.pagato ? compact(c.pagato) : '€') : c[k]}</b></button>`).join('');
  const needLogin = cfg('clientId') && S.syncState === 'login' && S.dirty;
  const queued = S.batch.length;
  return `
  ${mainHeader('list')}
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
  $('#countLbl').textContent = `${L.length} ${tr(L.length === 1 ? 'pezzo' : 'pezzi')}`;
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
    <button class="card t-${esc(i.tipo)}" data-a="open" data-id="${esc(i.id)}" data-card="${esc(i.id)}">
      ${coverHTML(i)}
      <i class="stripe"></i>
      ${i.prestatoA ? `<span class="tag loan ${loanLate(i) ? 'late' : ''}">${esc(loanTag(i))}</span>` : i.desiderio ? `<span class="tag">Desiderio</span>` : i.stato === 'in' ? `<span class="tag now">${esc(statoLabel(i))}</span>` : ''}
      ${S.sort === 'serie' && i.serie && i.volume ? `<span class="tag vol" translate="no">#${esc(i.volume)}</span>` : ''}
      <div class="meta"><b translate="no">${esc(i.titolo || tr('Senza titolo'))}</b><span translate="no">${esc((S.sort === 'serie' && i.serie ? [i.serie, i.volume && 'vol. ' + i.volume] : [i.autore, i.anno]).filter(Boolean).join(' · ') || '—')}</span><em>${esc(label(i))}</em>${rangeHTML(i)}</div>
    </button>`).join('');
  hydratePhotos(g);
  priceFill();
}

// Prezzi per condizione dei dischi che non li hanno ancora: piano piano, in sottofondo, mentre guardi la Collezione.
// Discogs permette 60 richieste al minuto; ogni disco ne usa al massimo 3, quindi uno ogni 4 secondi.
const PRICE_TRIED = new Set(); let priceFillOn = false;
const priceMisses = () => { try { return JSON.parse(localStorage.getItem('priceMiss') || '{}'); } catch (e) { return {}; } };
function priceMiss(id) { const m = priceMisses(); m[id] = Date.now(); for (const k of Object.keys(m)) if (Date.now() - m[k] > 30 * 864e5) delete m[k]; try { localStorage.setItem('priceMiss', JSON.stringify(m)); } catch (e) {} }
async function priceFill() {
  if (priceFillOn || !cfg('discogsToken') || !navigator.onLine) return;
  const stale = it => priceStale(it.valoreDiscogs);
  priceFillOn = true;
  try {
    await sleep(1500);
    const miss = priceMisses(); Object.keys(miss).forEach(id => { if (Date.now() - miss[id] < 30 * 864e5) PRICE_TRIED.add(id); });
    for (let n = 0; n < 60; n++) {
      if (S.view !== 'list' || document.visibilityState !== 'visible' || S.valuing || !navigator.onLine) break;
      const it = live().find(i => isMusic(i.tipo) && stale(i) && !PRICE_TRIED.has(i.id));
      if (!it) break;
      PRICE_TRIED.add(it.id);
      try {
        const ok = await discogsValue(it);
        if (!ok) priceMiss(it.id); // non trovato su Discogs: non riprovo per 30 giorni
        const card = document.querySelector(`[data-card="${CSS.escape(it.id)}"] .meta`);
        if (card) { const old = card.querySelector('.prange'); const h = rangeHTML(byId(it.id) || it); if (old) old.outerHTML = h || ''; else if (h) card.insertAdjacentHTML('beforeend', h); }
      } catch (e) { if (/HTTP 429/.test(e.message)) await sleep(60000); }
      await sleep(4000);
    }
  } finally { priceFillOn = false; }
}

// Tab "Valore": totale per categoria, diviso per condizione, con il valore di ogni pezzo
function valueTableHTML(L) {
  const tot = L.reduce((t, i) => t + valueOf(i), 0); const valued = L.filter(i => valueOf(i) > 0).length;
  const paid = L.reduce((t, i) => t + num(i.prezzo), 0); const nPaid = L.filter(i => num(i.prezzo) > 0).length;
  const music = L.filter(i => isMusic(i.tipo)).length;
  const SRC = { manuale: 'stimato da te', discogs: 'Discogs', minimo: 'min. Discogs' };
  let h = `<div class="vt" style="grid-column:1/-1">
    <div class="vt-total"><span>Hai speso</span><b>${esc(money(paid))}</b><small>${nPaid === L.length ? (L.length === 1 ? 'Prezzo pagato indicato per 1 pezzo' : `Prezzo pagato indicato per tutti i ${L.length} pezzi`) : `Prezzo pagato indicato per ${nPaid} pezzi su ${L.length}`}</small></div>
    <div class="vt-total vt-market"><span>Valore di mercato</span><b>${esc(money(tot))}</b>${paid && tot ? `<small class="${tot >= paid ? 'up' : 'down'}">${tot >= paid ? '▲' : '▼'} <span translate="no">${esc(money(Math.abs(tot - paid)))}</span> <span>${tot >= paid ? 'più di quanto hai speso' : 'meno di quanto hai speso'}</span></small>` : ''}<small>${valued === L.length ? (L.length === 1 ? '1 pezzo con valore' : `tutti i ${L.length} pezzi hanno un valore`) : `${valued} pezzi su ${L.length} con valore`}</small></div>
    ${music && cfg('discogsToken') ? `<button id="valueAllBtn" class="btn block" data-a="valueAll">${S.valuing && S.valuing.all ? `Aggiorno ${S.valuing.done} di ${S.valuing.tot}… (tocca per fermare)` : 'Aggiorna i prezzi dei dischi da Discogs'}</button>` : ''}`;
  Object.keys(TIPI).forEach(k => {
    const items = L.filter(i => i.tipo === k); if (!items.length) return;
    const sum = items.reduce((t, i) => t + valueOf(i), 0); const sumPaid = items.reduce((t, i) => t + num(i.prezzo), 0);
    const by = {}; items.forEach(i => { const c = CONDIZIONI.includes(i.condizione) ? i.condizione : ''; (by[c] = by[c] || [0, 0]); by[c][0]++; by[c][1] += valueOf(i); });
    const conds = [...CONDIZIONI, ''].filter(c => by[c]);
    const rows = items.slice().sort((a, b) => num(b.prezzo) - num(a.prezzo) || valueOf(b) - valueOf(a) || String(a.titolo).localeCompare(String(b.titolo), LOC())).map(i => {
      const m = marketValue(i);
      return `<button class="vrow" data-a="open" data-id="${esc(i.id)}">
        <span class="vt-t"><b translate="no">${esc(i.titolo)}</b><small translate="no">${esc([i.autore, i.anno].filter(Boolean).join(' · '))}</small></span>
        <span class="vt-c">${i.condizione ? `<span>${esc(i.condizione)}</span>` : '<span class="muted">—</span>'}${isMusic(i.tipo) && GRADE_OF[i.condizione] ? `<i translate="no">${esc(gradeShort(GRADE_OF[i.condizione]))}</i>` : ''}</span>
        <span class="vt-v">${num(i.prezzo) ? `<b>${esc(money(num(i.prezzo)))}</b><i>pagato</i>` : '<b class="muted">—</b><i>pagato</i>'}${m.v ? `<small><span translate="no">${esc(money(m.v, m.cur))}</span> · ${SRC[m.src]}</small>` : ''}</span>
      </button>`;
    }).join('');
    h += `<section class="vgroup t-${k}">
      <header><b>${TIPI[k].plural}</b><small>${items.length === 1 ? '1 pezzo' : items.length + ' pezzi'}</small><span>${esc(money(sumPaid))}</span></header>
      <div class="vsub"><span>Speso</span> <b translate="no">${esc(money(sumPaid))}</b> · <span>Valore di mercato</span> <b translate="no">${esc(money(sum))}</b></div>
      <div class="vconds">${conds.map(c => `<div class="vc"><span>${c ? esc(c) : 'Condizione non indicata'}</span><small>× ${by[c][0]}</small><b>${by[c][1] ? esc(money(by[c][1])) : '—'}</b></div>`).join('')}</div>
      <div class="vrows">${rows}</div>
    </section>`;
  });
  h += `<p class="note vt-note">Hai speso: la somma dei prezzi pagati che scrivi nella scheda (Modifica › Prezzo pagato). Valore di mercato — dischi: prezzo suggerito da Discogs per la condizione della tua copia (se la condizione manca, viene calcolato come Ottimo · VG+). Libri e film: il valore stimato che scrivi tu nella scheda. Il valore che inserisci a mano vale sempre più di quello automatico.</p></div>`;
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
      ${starsHTML(it.valutazione || 0, 'rateDetail')}${webRateHTML(it)}
    </div>
  </div>
  <div class="detail">
    ${it.desiderio ? `<button class="btn primary block" style="margin-top:14px" data-a="gotIt">L'ho comprato!</button>` : ''}
    ${stati.length && !it.desiderio ? `<div class="seg statseg" style="grid-template-columns:repeat(${stati.length},1fr)">${stati.map(([k, l]) => `<button type="button" class="${it.stato === k ? 'on' : ''}" data-a="setStato" data-v="${k}">${it.stato === k ? '✓ ' : ''}${l}</button>`).join('')}</div>` : ''}
    ${it.prestatoA ? `<div class="loanbox ${loanLate(it) ? 'late' : ''}"><div>In prestito a <b translate="no">${esc(it.prestatoA)}</b>${it.prestatoIl ? `<small>${days === 0 ? 'da oggi' : days === 1 ? 'da 1 giorno' : 'da ' + days + ' giorni'}</small>` : ''}${dueHTML(it)}</div>
      <div class="loanacts"><button data-a="remind">Ricordaglielo</button>${it.restituireEntro ? '<button data-a="loanIcs">📅 <span>Promemoria</span></button>' : ''}<button data-a="returned">Restituito</button></div></div>` : ''}
    ${desc ? `<div class="section"><h3>Descrizione</h3><div translate="no" class="prose ${longDesc && !S.expanded ? 'clamp' : ''}">${esc(desc)}</div>${longDesc && !S.expanded ? '<button class="more" data-a="expand">Leggi tutto</button>' : ''}</div>` : ''}
    ${isMusic(it.tipo) && it.tracklist ? `<div class="section"><h3>Tracce</h3><div class="tracks" translate="no">${esc(it.tracklist)}</div></div>` : ''}
    ${valueHTML(it)}
    ${facts.length ? `<div class="section"><dl class="facts">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>` : ''}
    ${(it.tags || []).length ? `<div class="section"><h3>Etichette</h3><div class="tagrow">${it.tags.map(t => `<button class="tagchip" data-a="tag" data-v="${esc(t)}" translate="no">#${esc(t)}</button>`).join('')}</div></div>` : ''}
    ${seriesHTML(it)}
    ${linksHTML(it)}
    ${it.foto && it.foto.length ? `<div class="section"><h3>Foto</h3><div class="photos">${it.foto.map(p => `<button class="photo" data-a="viewPhoto" data-v="${esc(p)}"><img data-photo="${esc(p)}" alt="" hidden></button>`).join('')}</div></div>` : ''}
    ${it.note ? `<div class="section"><h3>Note</h3><div class="prose" translate="no">${esc(it.note)}</div></div>` : ''}
    <div class="section community" id="commBox">${commHTML(it)}</div>
    <div class="section"><h3>I miei appunti</h3>
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
  else if (S.autoBusy === it.id) body += `<p class="note pnote">Cerco il prezzo su Discogs…</p>`;
  else body += `<p class="note pnote">Prezzo non trovato in automatico. Con il token Discogs (Impostazioni) la ricerca è più precisa.</p>`;
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
        ${d.foto.map(p => `<div class="photo"><img data-photo="${esc(p)}" alt="" hidden><button type="button" class="x" data-a="rmPhoto" data-v="${esc(p)}" aria-label="Rimuovi foto">✕</button><button type="button" class="crop" data-a="cropPhoto" data-v="${esc(p)}" aria-label="Ritaglia">✂</button></div>`).join('')}
        <button type="button" class="addphoto" data-a="addPhoto">${ic('camera')}Aggiungi</button>
      </div>
    </div>

    <div class="section">
      <h3>La mia copia</h3>
      ${statiFor(d.tipo).length ? `<div class="field"><span>${d.tipo === 'libro' ? 'Lettura' : d.tipo === 'film' ? 'Visione' : 'Ascolto'}</span><div class="seg" style="grid-template-columns:repeat(${statiFor(d.tipo).length},1fr);margin-top:6px">${statiFor(d.tipo).map(([k, l]) => `<button type="button" class="${d.stato === k ? 'on' : ''}" data-a="draftStato" data-v="${k}">${l}</button>`).join('')}</div></div>` : ''}
      ${M ? `<div class="two">${sel('condizione', 'Condizione ' + T.supporto.toLowerCase(), CONDIZIONI)}${sel('condCustodia', 'Condizione ' + T.custodia.toLowerCase(), CONDIZIONI)}</div>`
        : sel('condizione', 'Condizione', CONDIZIONI)}
      <div class="two">${f('prezzo', 'Prezzo pagato', 'inputmode="decimal"')}${f('valore', 'Valore stimato', `inputmode="decimal" placeholder="${(() => { const m = marketValue({ ...d, valore: '' }); return m.v ? esc(money(m.v, m.cur)) + ' (Discogs)' : ''; })()}"`)}</div>
      <label class="field"><span>Posizione (es. Salotto, scaffale 2)</span><input data-f="posizione" list="dl-pos" value="${esc(d.posizione)}"></label>
      <label class="field"><span>Etichette (separate da virgola, es. Prima stampa, Autografato)</span><input data-f="tagsTxt" value="${esc(d.tagsTxt != null ? d.tagsTxt : (d.tags || []).join(', '))}" autocomplete="off" translate="no"></label>
      ${allTags.filter(t => !parseTags(d.tagsTxt != null ? d.tagsTxt : (d.tags || []).join(',')).includes(t)).length ? `<div class="tagrow suggest">${allTags.filter(t => !parseTags(d.tagsTxt != null ? d.tagsTxt : (d.tags || []).join(',')).includes(t)).slice(0, 12).map(t => `<button type="button" class="tagchip" data-a="addTag" data-v="${esc(t)}" translate="no">+ ${esc(t)}</button>`).join('')}</div>` : ''}
      <div class="field"><span>Il mio voto</span>${starsHTML(d.valutazione || 0, 'rateDraft')}</div>
      <label class="field"><span>Note</span><textarea data-f="note" rows="3">${esc(d.note)}</textarea></label>
      <div class="two">
        ${f('prestatoA', 'Prestato a')}
        <label class="field"><span>Dal</span><input type="date" data-f="prestatoIl" value="${esc(d.prestatoIl)}"></label>
      </div>
      <label class="field"><span>Da restituire entro (facoltativo)</span><input type="date" data-f="restituireEntro" value="${esc(d.restituireEntro || '')}"></label>
      <label class="field inline"><span>Lista desideri (non ancora posseduto)</span><input type="checkbox" data-f="desiderio" ${d.desiderio ? 'checked' : ''}></label>
      ${shareFormHTML(d)}
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
        ${S.driveFullAt ? `<p class="note">${S.driveQuota ? `<span>Spazio Google usato:</span> <b>${esc(S.driveQuota)}</b>. ` : ''}<span>Lo spazio è condiviso tra Gmail, Google Foto e Drive. Liberane un po' (o aumentalo), poi tocca «Sincronizza ora». Spinyl occupa pochissimo.</span></p>
          <a class="btn block" href="https://one.google.com/storage" target="_blank" rel="noopener">Gestisci lo spazio di Google</a>` : ''}
        ${S.syncState === 'error' && /pezzi da Drive/.test(S.syncError) ? `<button class="btn primary block" data-a="allowMass">Sì, elimina anche da Drive</button>` : ''}
        ${has && tok ? `<button class="btn dark block" data-a="syncNow">Sincronizza ora</button><button class="btn block" data-a="showCopies">Copie di sicurezza su Drive</button><button class="btn block" data-a="logout">Esci da Google</button>` : ''}
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
        ${cfg('discogsToken') ? '<button class="more" data-a="discogsCheck">Controlla il token e i prezzi Discogs</button><div id="dgCheck"></div>' : ''}
        <label class="field"><span>Chiave Google Cloud Vision (riconosce anche le copertine senza scritte, facoltativa)</span><input id="cfg-visionKey" value="${esc(cfg('visionKey'))}" autocomplete="off"></label>
        ${cfg('visionKey') ? `<p class="note" style="margin:6px 0 10px">Google Vision questo mese: ${visionUsed()} di ${VISION_MONTHLY} foto su questo telefono</p>` : ''}
        <label class="field"><span>Client ID Google</span><input id="cfg-clientId" value="${esc(cfg('clientId'))}" autocomplete="off"></label>
        <div class="stack" style="padding-top:12px"><button class="btn block" data-a="saveCfg">Salva impostazioni</button></div>
      </details>
    </div>
    ${commSettingsHTML()}
    <div class="section"><h3>Aiuto e suggerimenti</h3>
      <p class="note">Qualcosa non va o ti manca qualcosa? Scrivici: leggiamo tutto.</p>
      <div class="stack"><button class="btn block" data-a="feedback" data-v="bug">🐞 <span>Segnala un problema</span></button><button class="btn block" data-a="feedback" data-v="idea">💡 <span>Proponi un'idea</span></button>
        ${commMe() && commMe().admin ? '<button class="btn block" data-a="feedbackAdmin">📮 <span>Segnalazioni ricevute</span></button>' : ''}</div>
      ${FEEDBACK_URL ? `<label class="field inline"><span>Invia in automatico gli errori tecnici dell'app (anonimi, ci aiutano a correggerli)</span><input type="checkbox" id="errT" ${errOn() ? 'checked' : ''}></label>` : ''}</div>
    <div class="section"><h3>Privacy e termini</h3>
      <p class="note">La tua collezione resta sul telefono e sul tuo Google Drive. Niente pubblicità, niente tracciamento.</p>
      <div class="stack"><button class="btn block" data-a="legal" data-v="privacy">Informativa privacy</button><button class="btn block" data-a="legal" data-v="terms">Termini d'uso</button><button class="btn block" data-a="legal" data-v="rules">Regole della community</button></div></div>
    <div class="stack"><button class="btn block" data-a="welcome">Guida introduttiva</button><button class="btn block" data-a="forceUpdate">${ic('download', 18)}Cerca aggiornamenti</button></div>
    <p class="note" style="text-align:center">Spinyl ${VERSION} · ${live().length} pezzi</p>
  </div>`;
}

/* ── Sheet ─────────────────────────────────────────────────── */
function openSheet(html) {
  $('#sheet').innerHTML = html; $('#sheetWrap').classList.remove('hidden');
  hydratePhotos($('#sheet'));
}
function closeSheet() { if (S.listenStop) S.listenStop(true); $('#sheetWrap').classList.add('hidden'); $('#sheet').innerHTML = ''; }

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
// Paese di stampa (dischi): nome usato da Discogs, codice usato da MusicBrainz, parole che si leggono sul retro
const COUNTRIES = [['Italia', 'Italy', 'IT', /^ital(y|ia|ie)/], ['Regno Unito', 'UK', 'GB', /^(uk|england|great britain|united kingdom)/], ['Stati Uniti', 'US', 'US', /^(usa?|united states)/],
  ['Germania', 'Germany', 'DE', /^(w ?germany|west germany|germany|deutschland)/], ['Francia', 'France', 'FR', /^france/], ['Europa', 'Europe', 'XE', /^(eu|eec|europe)/],
  ['Paesi Bassi', 'Netherlands', 'NL', /^(holland|the netherlands|netherlands)/], ['Spagna', 'Spain', 'ES', /^(spain|españa|espana)/], ['Giappone', 'Japan', 'JP', /^japan/],
  ['Canada', 'Canada', 'CA', /^canada/], ['Belgio', 'Belgium', 'BE', /^belgi(um|que)/], ['Svezia', 'Sweden', 'SE', /^sweden/], ['Grecia', 'Greece', 'GR', /^greece/],
  ['Portogallo', 'Portugal', 'PT', /^portugal/], ['Australia', 'Australia', 'AU', /^australia/], ['Brasile', 'Brazil', 'BR', /^bra[sz]il/], ['Argentina', 'Argentina', 'AR', /^argentina/],
  ['Jugoslavia', 'Yugoslavia', 'YU', /^(yugoslavia|jugoslavija)/], ['URSS', 'USSR', 'SU', /^(ussr|cccp)/]];
const countryOf = name => COUNTRIES.find(c => c[1] === name);
// "Made in Italy", "Printed in U.K.", "Manufactured in Germany"… sul retro o sull'etichetta
function detectCountry(text) {
  const m = String(text || '').match(/\b(made|printed|manufactured|pressed|fabriqu[ée]|hergestellt|stampato|fabbricato|prodotto)\s+(in|en)\s+([a-zñ .]{2,20})/i);
  if (!m) return '';
  const w = m[3].toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
  const c = COUNTRIES.find(c => c[3].test(w)); return c ? c[1] : '';
}
const pressCountry = () => { try { return localStorage.getItem('pressCountry') || ''; } catch (e) { return ''; } };
function countryRowHTML(tipo, sel) {
  return `<label class="field countryrow ${isMusic(tipo) ? '' : 'hidden'}" id="countryRow"><span>Paese di stampa</span><select id="titleCountry">
    <option value="">Qualsiasi paese</option>${COUNTRIES.map(c => `<option value="${c[1]}" ${sel === c[1] ? 'selected' : ''}>${c[0]}</option>`).join('')}</select></label>`;
}
function sheetSearch(tipo, prefill = '', code = '', opts = {}) {
  S.searchCtx = { tipo, code, cover: !!opts.cover };
  const title = opts.cover ? 'Dalla copertina' : `Cerca ${tipo === 'cd' ? 'CD' : TIPI[tipo].label.toLowerCase()}`;
  openSheet(`<h2>${title}</h2>
    ${opts.cover ? `<div class="coverhead">${S.coverShotUrl ? `<img src="${S.coverShotUrl}" alt="">` : ''}<p class="note">${prefill ? (opts.how === 'vision' ? 'Ho riconosciuto la copertina: correggi il testo se serve.' : 'Ho letto le scritte della copertina: correggi il testo se serve.') : 'Non sono riuscito a leggere la copertina: scrivi titolo e autore.'}</p></div>
      <div class="seg seg5" style="margin-bottom:4px">${Object.entries(TIPI).map(([k, v]) => `<button type="button" class="${tipo === k ? 'on' : ''}" data-a="searchTipo" data-v="${k}">${v.label}</button>`).join('')}</div>` : ''}
    ${code ? `<p class="lead">Codice ${esc(code)} non trovato. Prova con il titolo${isMusic(tipo) ? ' e l’artista' : ''}.</p>` : ''}
    <form class="searchform" id="titleSearch"><input id="titleQ" type="search" placeholder="${searchPlaceholder(tipo)}" value="${esc(prefill)}" autocomplete="off" translate="no"><button class="btn primary" type="submit">Cerca</button></form>
    ${countryRowHTML(tipo, opts.country || (opts.cover ? '' : pressCountry()))}
    ${opts.cover && isMusic(tipo) ? `<p class="note" id="countryHint" style="margin:-4px 2px 10px">${opts.country ? 'Ho letto il paese sul disco: controlla e tocca Cerca.' : 'Scegli il paese di stampa (sul retro o sull’etichetta: «Made in…»), poi tocca Cerca: trovo prima l’edizione giusta.'}</p>` : ''}
    ${opts.cover && !cfg('visionKey') ? '<p class="note" style="margin:-4px 2px 10px">Suggerimento iPhone: tocca il campo, poi “Scansiona testo” per copiare le scritte con la fotocamera.</p>' : ''}
    <div id="results" class="results"></div>
    ${code ? `<button class="btn block" style="margin-top:12px" data-a="manualWithCode">Inserisci a mano</button>` : ''}`);
  if (opts.auto && prefill && !(opts.cover && isMusic(tipo))) setTimeout(() => { const f = $('#titleSearch'); if (f) f.requestSubmit ? f.requestSubmit() : f.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true })); }, 50);
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
  const url = 'https://www.googleapis.com/books/v1/volumes?maxResults=12&printType=books&q=' + encodeURIComponent(q);
  let d;
  // se la chiave non è abilitata per Google Books, si riprova senza: la ricerca non si blocca
  try { d = await fj(url + (key ? '&key=' + encodeURIComponent(key) : '')); }
  catch (e) { if (!key || !/HTTP (400|403)/.test(e.message)) throw e; d = await fj(url); }
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

async function searchByTitle(tipo, q, country = '') {
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
    const C = countryOf(country);
    const [cat, dcC, dc, mb, it] = await Promise.all([
      looksCat ? settled([discogs('catno=' + encodeURIComponent(catQ)), musicBrainz(`catno:"${catQ}"`)]) : Promise.resolve([]),
      C ? settled([discogs('q=' + encodeURIComponent(q) + '&format=' + fmt + '&country=' + encodeURIComponent(C[1])), musicBrainz(`${q} AND country:${C[2]}`)]) : Promise.resolve([]),
      settled([discogs('q=' + encodeURIComponent(q) + '&format=' + fmt)]),
      settled([musicBrainz(`${q} AND format:${mbFmt}`)]).then(r => r.length ? r : settled([musicBrainz(q)])),
      settled([itunes(q, 'album')]),
    ]);
    cat.forEach(c => { c.sub = ['N. catalogo ' + (c.catalogo || catQ), c.sub].filter(Boolean).join(' · '); });
    // prima le edizioni del paese scelto
    const inC = c => C && (c.paese === C[1] || c.paese === C[2]);
    const rest = [...dc.slice(0, 6), ...mb.slice(0, 6)];
    const seen = new Set(); const all = [...cat, ...dcC.slice(0, 8), ...rest.filter(inC), ...rest.filter(c => !inC(c)), ...it.slice(0, 4)].filter(c => { const k = (c._discogsId || c._mbid || '') + ''; if (k && seen.has(k)) return false; if (k) seen.add(k); return true; });
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
      c.votoWeb = discogsRating(r);
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
      if (m.vote_count >= 5) c.votoWeb = { v: Math.round(m.vote_average * 5) / 10, n: m.vote_count, src: 'TMDB', at: Date.now() };
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
  // Rinnovo silenzioso: se l'accesso a Google è scaduto ma sei ancora collegato a Google su questo telefono,
  // un passaggio lampo su Google restituisce un nuovo accesso senza chiedere niente.
  silentLogin() {
    const cid = cfg('clientId');
    if (!cid || !navigator.onLine || !localStorage.getItem('gEverLogged') || this.token()) return false;
    const last = +localStorage.getItem('gSilentAt') || 0; if (Date.now() - last < 10 * 60000) return false; // al massimo ogni 10 minuti
    localStorage.setItem('gSilentAt', String(Date.now()));
    const st = uid(); localStorage.setItem('oauthState', st); localStorage.setItem('oauthSilent', '1');
    const p = new URLSearchParams({ client_id: cid, redirect_uri: this.redirectUri(), response_type: 'token', scope: SCOPE, include_granted_scopes: 'true', state: st, prompt: 'none' });
    const hint = localStorage.getItem('gHint'); if (hint) p.set('login_hint', hint);
    location.replace('https://accounts.google.com/o/oauth2/v2/auth?' + p.toString());
    return true;
  },
  handleRedirect() {
    if (!/access_token=|error=/.test(location.hash)) return false;
    const h = new URLSearchParams(location.hash.slice(1));
    const silent = localStorage.getItem('oauthSilent') === '1'; localStorage.removeItem('oauthSilent');
    history.replaceState({ view: 'list' }, '', location.pathname + location.search);
    if (h.get('error')) { if (!silent) setTimeout(() => toast('Accesso a Google annullato'), 300); return false; }
    if (h.get('state') !== localStorage.getItem('oauthState')) return false;
    localStorage.setItem('gtoken', JSON.stringify({ t: h.get('access_token'), exp: Date.now() + (parseInt(h.get('expires_in'), 10) || 3600) * 1000 }));
    localStorage.setItem('gEverLogged', '1');
    return silent ? 'silent' : true;
  },
  logout() { const t = this.token(); localStorage.removeItem('gtoken'); localStorage.removeItem('gEverLogged'); localStorage.removeItem('gHint'); if (t) fetch('https://oauth2.googleapis.com/revoke?token=' + t, { method: 'POST' }).catch(() => {}); },
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
  async copy(id, name, parent) {
    const r = await this.api(`https://www.googleapis.com/drive/v3/files/${id}/copy?fields=id`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, parents: [parent] }) });
    return (await r.json()).id;
  },
  async list(parent) {
    const q = `'${parent}' in parents and trashed=false`;
    const r = await this.api('https://www.googleapis.com/drive/v3/files?spaces=drive&pageSize=100&orderBy=name%20desc&fields=files(id,name,size,modifiedTime)&q=' + encodeURIComponent(q));
    return (await r.json()).files || [];
  },
  remove(id) { return this.api(`https://www.googleapis.com/drive/v3/files/${id}`, { method: 'DELETE' }); },
};

/* ── Copie giornaliere su Drive (le ultime 10) ─────────────── */
const COPIES_KEEP = 10;
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
async function dailyCopy(m) {
  if ((await getMeta('lastCopyDay')) === today()) return;
  if (!m.copies) { m.copies = await Drive.folder('copie', m.folder); await setMeta('drive', m); }
  const files = await Drive.list(m.copies);
  if (!files.some(f => f.name === `scaffale-${today()}.json`)) await Drive.copy(m.file, `scaffale-${today()}.json`, m.copies);
  const all = (await Drive.list(m.copies)).filter(f => /^scaffale-\d{4}-\d{2}-\d{2}\.json$/.test(f.name)).sort((a, b) => b.name.localeCompare(a.name));
  for (const f of all.slice(COPIES_KEEP)) await Drive.remove(f.id).catch(() => {});
  await setMeta('lastCopyDay', today());
}
async function listCopies() {
  const m = (await getMeta('drive')) || {};
  if (!m.folder) return [];
  if (!m.copies) { const f = await Drive.find(`name='copie' and mimeType='application/vnd.google-apps.folder' and '${m.folder}' in parents and trashed=false`); if (!f[0]) return []; m.copies = f[0].id; await setMeta('drive', m); }
  return (await Drive.list(m.copies)).filter(f => /^scaffale-\d{4}-\d{2}-\d{2}\.json$/.test(f.name));
}
// Ripristina una copia: la collezione torna com'era quel giorno (anche sugli altri telefoni, dopo la sincronizzazione)
async function restoreCopy(id, label) {
  if (!confirm(tr(`Ripristinare la collezione com'era il ${label}? Le modifiche fatte dopo andranno perse.`))) return;
  toast('Ripristino…', 4000);
  try {
    const data = await (await Drive.download(id)).json();
    if (!Array.isArray(data.items)) throw new Error('formato');
    const now = Date.now();
    const keep = new Map(data.items.map(i => [i.id, i]));
    const local = await DB.all('items');
    const out = data.items.map(i => { const c = { ...normalize(i), updatedAt: now }; delete c._fu; delete c._fub; return c; });
    local.filter(i => !keep.has(i.id) && !i.deleted).forEach(i => out.push({ id: i.id, deleted: true, createdAt: i.createdAt, updatedAt: now }));
    if (data.foto) await setMeta('photoMap', { ...((await getMeta('photoMap')) || {}), ...data.foto });
    await DB.putMany('items', out); await loadItems();
    S.allowMass = true; closeSheet(); toast(`Ripristinata la copia del ${label}`, 3500); markDirty(); go('list');
  } catch (e) { toast('Copia non leggibile'); }
}

// Si può lasciare la pagina un attimo (per il rinnovo dell'accesso) senza perdere niente?
function safeToLeave() {
  return (S.view === 'list' || S.view === 'home') && !S.draft && !Scanner.active && $('#sheetWrap').classList.contains('hidden') && !(S.valuing) && !batchRunning;
}

/* ── Sincronizzazione ──────────────────────────────────────── */
const Sync = { running: false, again: false, timer: null };
function setSync(state, err) {
  S.syncState = state; S.syncError = err || '';
  document.querySelectorAll('.sync-dot').forEach(d => { d.className = 'sync-dot ' + state; });
  if (S.view === 'settings' && state !== 'syncing') render();
}
function scheduleSync(ms = 2500) { clearTimeout(Sync.timer); Sync.timer = setTimeout(() => sync(), ms); }
async function markDirty() { S.dirty = true; await setMeta('dirty', true); scheduleSync(); }

// Data di modifica di un singolo campo (i pezzi salvati prima della 2.4 usano la data del pezzo)
const META_KEYS = new Set(['id', 'updatedAt', 'createdAt', '_fu', '_fub']);
const fieldTs = (it, k) => (it._fu && it._fu[k]) || it._fub || it.updatedAt || 0;
const stable = o => JSON.stringify(o, Object.keys(o).sort());
// Unisce due versioni dello stesso pezzo campo per campo: se due telefoni cambiano campi diversi, si tengono entrambe le modifiche
function mergeOne(l, r) {
  if ((l.updatedAt || 0) === (r.updatedAt || 0) && stable(l) === stable(r)) return l;
  if (l.deleted || r.deleted) return (r.updatedAt || 0) > (l.updatedAt || 0) ? r : l; // eliminazione: vince il più recente
  const out = {}; const fu = {};
  for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
    if (META_KEYS.has(k)) continue;
    const tl = fieldTs(l, k), tr = fieldTs(r, k);
    const useR = tr > tl || (tr === tl && (r.updatedAt || 0) > (l.updatedAt || 0));
    const src = useR ? r : l;
    if (k in src) out[k] = src[k];
    if ((l._fu && l._fu[k]) || (r._fu && r._fu[k])) fu[k] = Math.max(tl, tr);
  }
  out.id = l.id; out.createdAt = Math.min(l.createdAt || Infinity, r.createdAt || Infinity); if (!isFinite(out.createdAt)) out.createdAt = Date.now();
  out.updatedAt = Math.max(l.updatedAt || 0, r.updatedAt || 0);
  if (Object.keys(fu).length) { out._fu = fu; out._fub = Math.min(l._fub || l.updatedAt || 0, r._fub || r.updatedAt || 0); }
  return out;
}
function mergeItems(localList, remoteList) {
  const map = new Map(localList.map(i => [i.id, i])); const changed = []; let remoteBehind = false;
  const seen = new Set();
  for (const r of (remoteList || []).map(normalize)) {
    seen.add(r.id);
    const l = map.get(r.id);
    if (!l) { map.set(r.id, r); changed.push(r); continue; }
    const m = mergeOne(l, r);
    if (stable(m) !== stable(l)) { map.set(r.id, m); changed.push(m); }
    if (stable(m) !== stable(r)) remoteBehind = true;
  }
  if (localList.some(i => !seen.has(i.id))) remoteBehind = true;
  return { all: [...map.values()], changed, remoteBehind };
}

// quanto spazio Google è usato (per spiegare l'errore "Drive pieno")
async function driveQuota() {
  try {
    const q = (await (await Drive.api('https://www.googleapis.com/drive/v3/about?fields=storageQuota')).json()).storageQuota || {};
    const gb = n => (n / 1073741824).toLocaleString(LOC(), { maximumFractionDigits: 1 }) + ' GB';
    S.driveQuota = q.limit ? `${gb(+q.usage)} / ${gb(+q.limit)}` : gb(+q.usage || 0);
    if (S.view === 'settings') render();
  } catch (e) {}
}
async function sync(manual) {
  if (!cfg('clientId')) { setSync('off'); return; }
  // Drive pieno: non riprovo di continuo, solo ogni 30 minuti o quando lo chiede l'utente
  if (!manual && S.driveFullAt && Date.now() - S.driveFullAt < 30 * 60e3) return;
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
    const { all, changed, remoteBehind } = mergeItems(await DB.all('items'), remote.items);
    // Protezione: se questo telefono sta per cancellare molti pezzi in una volta, chiede conferma
    const remoteLive = new Set((remote.items || []).filter(i => !i.deleted).map(i => i.id));
    const goingAway = all.filter(i => i.deleted && remoteLive.has(i.id)).length;
    if (goingAway >= 15 && goingAway > remoteLive.size * 0.3 && !S.allowMass) {
      const e = new Error('mass'); e.mass = goingAway; throw e;
    }
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

    if (S.dirty || uploaded || remoteBehind || !m.file) {
      if (m.file && remoteLive.size) await dailyCopy(m).catch(e => console.warn('copia', e)); // copia del giorno prima di sovrascrivere
      const data = { app: 'Scaffale', versione: 1, aggiornato: new Date().toISOString(), items: all, foto: photoMap };
      const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
      try { m.file = await Drive.upload('scaffale.json', m.folder, blob, 'application/json', m.file); }
      catch (e) { if (e.status === 404) { m.file = await Drive.upload('scaffale.json', m.folder, blob, 'application/json'); } else throw e; }
      await setMeta('drive', m);
    }
    if (!localStorage.getItem('gHint')) {
      try { const a = await (await Drive.api('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)')).json(); if (a.user && a.user.emailAddress) localStorage.setItem('gHint', a.user.emailAddress); } catch (e) {}
    }
    S.dirty = false; S.allowMass = false; await setMeta('dirty', false);
    S.lastSync = Date.now(); await setMeta('lastSync', S.lastSync);
    if (changed.length) { await loadItems(); if (S.view !== 'edit') render(); }
    S.driveFullAt = 0; setSync('ok');
  } catch (e) {
    if (e instanceof NeedLogin) setSync('login');
    else if (e.mass) setSync('error', `Questo telefono sta per eliminare ${e.mass} pezzi da Drive: conferma nelle Impostazioni`);
    else if (e.status === 404 && /folder|File not found/i.test(e.detail || '')) { await setMeta('drive', {}); setSync('error', 'Cartella su Drive non trovata, riprova'); }
    else if (e.status === 403 && /storageQuotaExceeded|quota has been exceeded/i.test(e.detail || '')) { S.driveFullAt = Date.now(); setSync('error', 'Il tuo Google Drive è pieno: Spinyl non riesce a salvarci la copia. La collezione è al sicuro sul telefono.'); driveQuota(); }
    else { console.error(e); setSync('error', (e.message || 'Errore') + (e.detail ? ' — ' + String(e.detail).slice(0, 120) : '')); }
  } finally {
    Sync.running = false;
    if (Sync.again) { Sync.again = false; scheduleSync(500); }
  }
}

/* ── Salvataggio ───────────────────────────────────────────── */
async function saveItem(it) {
  const now = Date.now();
  if (!it.deleted) {
    // ricorda quali campi sono cambiati e quando, per unire bene le modifiche fatte su telefoni diversi
    let prev = null; try { prev = await DB.get('items', it.id); } catch (e) {}
    if (prev && !prev.deleted) {
      if (!it._fu) { it._fu = {}; it._fub = prev.updatedAt || 0; }
      for (const k of new Set([...Object.keys(it), ...Object.keys(prev)])) {
        if (META_KEYS.has(k)) continue;
        if (JSON.stringify(it[k]) !== JSON.stringify(prev[k])) it._fu[k] = now;
      }
    }
  }
  it.updatedAt = now;
  await DB.put('items', it);
  const idx = S.items.findIndex(x => x.id === it.id);
  idx >= 0 ? (S.items[idx] = it) : S.items.push(it);
  markDirty();
  if (commMe()) commSharesSoon();
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
    sugg: Object.keys(sugg).length ? sugg : null, scur: scur || 'EUR', suggErr: sg.status === 'rejected' ? (String((sg.reason && sg.reason.message) || 'errore').replace('HTTP ', '') || true) : false, at: Date.now() };
}
// Diagnosi: a chi appartiene il token e se Discogs dà i prezzi per condizione (prova con un disco molto venduto)
async function discogsCheck() {
  const box = $('#dgCheck'); if (!box) return; const tok = encodeURIComponent(cfg('discogsToken'));
  box.innerHTML = loadingHTML('Controllo su Discogs…');
  const get = async url => { try { const r = await fetch(url); let j = null; try { j = await r.json(); } catch (e) {} return { st: r.status, j }; } catch (e) { return { st: 0, j: { message: String(e.message || e) } }; } };
  const [id, ps] = await Promise.all([get(`https://api.discogs.com/oauth/identity?token=${tok}`), get(`https://api.discogs.com/marketplace/price_suggestions/1873013?token=${tok}`)]);
  const n = ps.st === 200 && ps.j ? Object.values(ps.j).filter(v => v && v.value != null).length : 0;
  const line = (ok, html) => `<p class="note pnote">${ok ? '✓' : '✗'} ${html}</p>`;
  let h = id.st === 200 && id.j ? line(true, `<span>Token valido, account</span> <b translate="no">${esc(id.j.username || '?')}</b>`) : line(false, `<span>Token non valido</span> <span translate="no">(${esc(id.st)}${id.j && id.j.message ? ': ' + esc(id.j.message) : ''})</span>`);
  if (n) h += line(true, `<span>Prezzi per condizione disponibili</span> <span translate="no">(${n})</span>`);
  else {
    h += line(false, `<span>Prezzi per condizione non disponibili</span> <span translate="no">(${esc(ps.st)}${ps.j && ps.j.message ? ': ' + esc(ps.j.message) : ps.st === 200 ? ': {}' : ''})</span>`);
    h += `<p class="note pnote">Su Discogs, con questo account: Settings › Seller Settings: scegli valuta e paese, compila i campi obbligatori e salva. Poi ricontrolla qui.</p>`;
  }
  box.innerHTML = h;
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
  } else if (p.noTok) {
    h += `<p class="note pnote">Con il token Discogs (Impostazioni) vedi anche il prezzo per ogni condizione.</p>`;
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
  // Popsike: aste concluse di dischi da collezione (nessuna API: apre la ricerca già fatta)
  if (isMusic(it.tipo)) { const pq = [it.autore, it.titolo].filter(Boolean).join(' ') + (it.tipo === 'vinile' ? '' : it.tipo === 'cd' ? ' CD' : ' cassette'); if (pq.trim()) out.push(['Popsike', `https://www.popsike.com/php/quicksearch.php?searchtext=${enc(pq.trim())}`]); }
  return `<div class="links">${out.map(([n, u]) => `<a class="linkbtn" href="${esc(u)}" target="_blank" rel="noopener"><span>${esc(n)}</span><span aria-hidden="true">↗</span></a>`).join('')}</div>`;
}
// Voto medio della community Discogs (0–5)
function discogsRating(r) {
  const x = r && r.community && r.community.rating;
  return x && x.count ? { v: Math.round(+x.average * 10) / 10, n: x.count, src: 'Discogs', at: Date.now() } : null;
}
function webRateHTML(it) {
  const w = it.votoWeb; if (!w || !w.v) return '';
  return `<div class="webrate"><b>★ ${esc(String(w.v).replace('.', LNG() === 'en' ? '.' : ','))}</b><span class="wsrc">${esc(w.src)}</span><span class="wn" translate="no">(${esc(w.n)})</span></div>`;
}
// Senza token: trova l'edizione Discogs tramite MusicBrainz (codice a barre)
async function mbDiscogsId(it) {
  const code = String(it.codice || '').replace(/\D/g, ''); if (code.length < 8) return null;
  const d = await fj('https://musicbrainz.org/ws/2/release/?fmt=json&limit=3&query=' + encodeURIComponent('barcode:' + code));
  for (const rel of (d.releases || []).slice(0, 2)) {
    await sleep(1100);
    const r = await fj(`https://musicbrainz.org/ws/2/release/${rel.id}?inc=url-rels&fmt=json`);
    const u = (r.relations || []).map(x => (x.url || {}).resource || '').find(x => /discogs\.com\/release\/\d+/.test(x));
    if (u) return { id: u.match(/release\/(\d+)/)[1], match: 'barcode' };
  }
  return null;
}
// Voto medio online per libri (Open Library, poi Google Libri) e film (TMDB)
async function bookRating(it) {
  const isbn = String(it.codice || '').replace(/[^\dX]/gi, '');
  const q = isbn.length >= 10 ? 'isbn=' + isbn : 'title=' + encodeURIComponent(it.titolo || '') + (it.autore ? '&author=' + encodeURIComponent(it.autore.split(',')[0]) : '');
  try {
    const d = await fj(`https://openlibrary.org/search.json?limit=1&fields=key,ratings_average,ratings_count&${q}`);
    const b = (d.docs || [])[0];
    if (b && b.ratings_count >= 3) return { v: Math.round(b.ratings_average * 10) / 10, n: b.ratings_count, src: 'Open Library', at: Date.now() };
  } catch (e) {}
  const key = cfg('booksKey');
  const gq = isbn.length >= 10 ? 'isbn:' + isbn : `intitle:${it.titolo || ''}${it.autore ? ' inauthor:' + it.autore.split(',')[0] : ''}`;
  const url = 'https://www.googleapis.com/books/v1/volumes?maxResults=3&q=' + encodeURIComponent(gq);
  let d; try { d = await fj(url + (key ? '&key=' + encodeURIComponent(key) : '')); } catch (e) { d = await fj(url); }
  const v = ((d.items || []).map(x => x.volumeInfo || {}).find(x => x.ratingsCount));
  return v ? { v: Math.round(v.averageRating * 10) / 10, n: v.ratingsCount, src: 'Google Libri', at: Date.now() } : null;
}
async function filmRating(it) {
  const k = cfg('tmdbKey'); if (!k || !it.titolo) return null;
  const d = await fj(`https://api.themoviedb.org/3/search/movie?api_key=${encodeURIComponent(k)}&language=${LOC()}&query=${encodeURIComponent(it.titolo)}${it.anno ? '&year=' + encodeURIComponent(it.anno) : ''}`);
  const m = (d.results || []).find(x => x.vote_count >= 5);
  return m ? { v: Math.round(m.vote_average * 5) / 10, n: m.vote_count, src: 'TMDB', at: Date.now() } : null;
}
async function autoRating(it) {
  if (it.votoWeb && Date.now() - (it.votoWeb.at || 0) < 30 * 864e5) return;
  AUTO_TRIED.add(it.id); S.autoBusy = it.id;
  try {
    const w = it.tipo === 'libro' ? await bookRating(it) : await filmRating(it);
    const now = byId(it.id);
    if (w && now && !now.deleted) { now.votoWeb = w; await saveItem(now); }
  } catch (e) { console.warn('autoRating', e); }
  finally { S.autoBusy = null; if (S.view === 'detail' && S.id === it.id && $('#sheetWrap').classList.contains('hidden')) render(); }
}
// Prezzo e voto online in automatico quando apri un disco (al massimo una volta ogni 2 settimane)
const AUTO_TRIED = new Set();
async function autoOnline(it) {
  if (!it || S.autoBusy || S.valuing || AUTO_TRIED.has(it.id) || !navigator.onLine) return;
  if (!isMusic(it.tipo)) return (it.tipo === 'libro' || it.tipo === 'film') ? autoRating(it) : undefined;
  const old = x => priceStale(x, 14);
  if (!old(it.valoreDiscogs) && it.votoWeb) return;
  AUTO_TRIED.add(it.id); S.autoBusy = it.id;
  const tok = cfg('discogsToken'); const T = tok ? `?token=${encodeURIComponent(tok)}` : '';
  try {
    const m = it.discogsId ? { id: String(it.discogsId), match: 'id' } : tok ? await discogsLookupId(it) : await mbDiscogsId(it);
    if (!m) return;
    const cur = byId(it.id) || it;
    const [rel, pr] = await Promise.allSettled([
      fj(`https://api.discogs.com/releases/${encodeURIComponent(m.id)}${T}`),
      old(cur.valoreDiscogs) ? (tok ? discogsPrices(m.id) : fj(`https://api.discogs.com/marketplace/stats/${encodeURIComponent(m.id)}?curr_abbr=EUR`).then(s => ({
        min: s.lowest_price && s.lowest_price.value != null ? +s.lowest_price.value : null, cur: (s.lowest_price && s.lowest_price.currency) || 'EUR', n: s.num_for_sale || 0,
        sugg: null, scur: 'EUR', noTok: true, at: Date.now() }))) : Promise.resolve(null),
    ]);
    const now = byId(it.id); if (!now || now.deleted) return;
    let ch = false;
    if (rel.status === 'fulfilled') { const w = discogsRating(rel.value); if (w) { now.votoWeb = w; ch = true; } }
    if (pr.status === 'fulfilled' && pr.value) { const prev = now.valoreDiscogs && now.valoreDiscogs.match; now.valoreDiscogs = { ...pr.value, match: m.match === 'id' ? (prev || 'id') : m.match }; ch = true; }
    if (ch || !now.discogsId) { now.discogsId = m.id; await saveItem(now); }
  } catch (e) { console.warn('autoOnline', e); }
  finally { S.autoBusy = null; if (S.view === 'detail' && S.id === it.id && $('#sheetWrap').classList.contains('hidden')) render(); }
}
async function valueNow() {
  const it = byId(S.id); if (!it || S.valuing) return;
  S.valuing = { id: it.id }; render();
  try { const ok = await discogsValue(it); toast(!ok ? 'Edizione non trovata su Discogs' : it.valoreDiscogs && it.valoreDiscogs.suggErr ? `${tr('Discogs non dà ancora i prezzi per condizione')} (${it.valoreDiscogs.suggErr})` : 'Valore aggiornato', 4000);
    if (ok) { try { const w = discogsRating(await fj(`https://api.discogs.com/releases/${encodeURIComponent(it.discogsId)}?token=${encodeURIComponent(cfg('discogsToken'))}`)); if (w) { it.votoWeb = w; await saveItem(it); } } catch (e) {} } }
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
  if (S.view === 'stats' || S.view === 'list' || S.view === 'home') render();
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
  const late = live().filter(loanLate).sort((a, b) => loanDays(b) - loanDays(a));
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
      ${loans ? `<p class="note" style="margin:10px 0">${loans === 1 ? '1 pezzo in prestito' : loans + ' pezzi in prestito'}${late.length ? ` · ${late.length === 1 ? '1 in ritardo' : late.length + ' in ritardo'}` : ''}</p>` : '<p class="note" style="margin:10px 0 12px">Nessun pezzo in prestito.</p>'}
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
function dueHTML(it) {
  const due = loanDue(it); if (due == null) return '';
  const d = new Date(it.restituireEntro + 'T12:00').toLocaleDateString(LOC(), { day: 'numeric', month: 'long' });
  return `<small class="due">${due < 0 ? `<span>${-due === 1 ? 'In ritardo di 1 giorno' : 'In ritardo di ' + -due + ' giorni'}</span> · <span>era il</span> ${esc(d)}` : due === 0 ? '<span>Da restituire oggi</span>' : `<span>Da restituire entro il</span> ${esc(d)}`}</small>`;
}
// promemoria nel calendario del telefono per la data di restituzione
function loanIcs() {
  const it = byId(S.id); if (!it || !it.restituireEntro) return;
  const day = it.restituireEntro.replace(/-/g, ''); const x = v => String(v || '').replace(/[\\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const title = tr('Restituzione') + ': ' + it.titolo + ' (' + it.prestatoA + ')';
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Spinyl//IT', 'BEGIN:VEVENT', `UID:loan-${it.id}-${day}@spinyl`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
    `DTSTART;VALUE=DATE:${day}`, `SUMMARY:${x(title)}`, `DESCRIPTION:${x('Spinyl')}`, 'BEGIN:VALARM', 'TRIGGER:PT10H', 'ACTION:DISPLAY', `DESCRIPTION:${x(title)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  if (isIOS()) { location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics); return; }
  saveFile(new File([ics], 'spinyl-prestito.ics', { type: 'text/calendar' }), title);
}
function remindLoan() {
  const it = byId(S.id); if (!it || !it.prestatoA) return;
  const name = String(it.prestatoA).trim().split(/\s+/)[0];
  const d = it.prestatoIl ? new Date(it.prestatoIl).toLocaleDateString(LOC(), { day: 'numeric', month: 'long' }) : '';
  const due = it.restituireEntro ? new Date(it.restituireEntro + 'T12:00').toLocaleDateString(LOC(), { day: 'numeric', month: 'long' }) : '';
  if (due) return shareText({
    it: `Ciao ${name}! Ti ricordo "${it.titolo}" che ti ho prestato${d ? ' il ' + d : ''}: eravamo d'accordo per il ${due}. Quando me lo riporti? Grazie 😊`,
    en: `Hi ${name}! Just a reminder about "${it.titolo}", which I lent you${d ? ' on ' + d : ''}: we said ${due}. When can you bring it back? Thanks 😊`,
    es: `¡Hola ${name}! Te recuerdo "${it.titolo}", que te presté${d ? ' el ' + d : ''}: quedamos para el ${due}. ¿Cuándo me lo devuelves? Gracias 😊`,
  }[LNG()] || '', it.titolo);
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
    ['Prestato a', i => i.prestatoA], ['Prestato il', i => i.prestatoIl], ['Da restituire entro', i => i.restituireEntro], ['Note', i => i.note], ['Aggiunto il', i => { if (!i.createdAt) return ''; const d = new Date(i.createdAt); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }],
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
// Scarica subito l'ultima versione: svuota la cache dell'app e ricarica (i dati restano sul telefono)
async function forceUpdate() {
  if (!safeToLeave()) return toast('Attendi la fine del salvataggio e riprova');
  toast('Scarico l\'ultima versione…', 4000);
  try { const ks = await caches.keys(); await Promise.all(ks.filter(k => k.startsWith('scaffale-')).map(k => caches.delete(k))); } catch (e) {}
  try { const rs = await navigator.serviceWorker.getRegistrations(); await Promise.all(rs.map(r => r.unregister())); } catch (e) {}
  setTimeout(() => location.replace(location.pathname + '?v=' + Date.now()), 400);
}
function showUpdateBar() {
  if ($('#updateBar')) return;
  const b = document.createElement('div'); b.id = 'updateBar'; b.className = 'updatebar'; b.setAttribute('role', 'status');
  b.innerHTML = `<span>È pronta una nuova versione di Spinyl.</span><button data-a="reloadApp">Aggiorna</button>`;
  document.body.appendChild(b);
}
const NEWS = {
  '2.26': [
    ['Quanto hai speso', "Il filtro Valore mostra il totale che hai pagato (il Prezzo pagato che scrivi nella scheda). Dentro trovi «Hai speso», il valore di mercato e la differenza, anche per ogni categoria."],
  ],
  '2.25.3': [
    ['Controllo Discogs', "In Impostazioni › Chiavi facoltative, sotto il token Discogs: «Controlla il token e i prezzi Discogs» dice a quale account appartiene il token e se Discogs dà i prezzi per condizione."],
  ],
  '2.25.2': [
    ['Popsike', "Nella scheda di un disco, accanto a eBay e Discogs, il pulsante Popsike apre le aste concluse di quel disco: utile per le stampe rare e da collezione."],
  ],
  '2.25.1': [
    ['Prezzi per condizione più rapidi', "Se Discogs non dava i prezzi per condizione (valuta e paese non impostati nelle Seller Settings), Spinyl riprova da solo dopo 2 ore invece che dopo 30 giorni."],
  ],
  '2.25': [
    ['Prezzi sulle copertine', "In Collezione ogni disco mostra la fascia di prezzo Discogs, dalla condizione peggiore alla migliore (es. 6,50 € – 42 €). I prezzi mancanti arrivano da soli, poco alla volta, mentre guardi la Collezione (serve il token Discogs)."],
  ],
  '2.24': [
    ['Rispondi a un messaggio', "Nelle chat di gruppo, private e degli eventi tocca «Rispondi» sotto un messaggio: la tua risposta lo cita, e toccando la citazione si torna al messaggio. Nei gruppi chi riceve la risposta ha una notifica dedicata."],
    ['Novità più affidabili', "Se una fonte non risponde, la Home tiene le novità di prima e riprova da sola dopo poco."],
  ],
  '2.23': [
    ['Che canzone è?', "Il tasto con la nota in alto ascolta la musica che sta suonando (come Shazam), riconosce la canzone e ti dice se è in uno dei tuoi dischi, con la traccia. Puoi anche scrivere il titolo."],
    ['Paese di stampa', "Dopo la foto della copertina di un disco scegli il paese di stampa (es. Italia, Regno Unito): la ricerca mostra prima l'edizione giusta. Se sulla foto c'è «Made in…», lo riconosco da solo."],
  ],
  '2.22': [
    ['Chat di gruppo', "In Community › Nuovo › Nuovo gruppo: una chat con più membri (fino a 50). Si aggiungono persone, si rinomina, si esce quando si vuole; con le notifiche anche ad app chiusa."],
  ],
  '2.21': [
    ['Ritaglia le foto', "Dopo la foto della copertina, o quando aggiungi una foto a un pezzo, puoi ritagliarla: trascina gli angoli, scegli quadrato o formato libro e ruotala. Le foto già salvate si ritagliano dal pulsante ✂ in Modifica."],
  ],
  '2.20': [
    ['Link cliccabili', 'I link scritti nei messaggi, nei commenti e negli articoli ora si aprono con un tocco.'],
    ['Condividi con Spinyl', "Su Android, da Chrome, YouTube o qualsiasi app: Condividi › Spinyl, e lo mandi a un membro, ci scrivi un articolo o lo cerchi per la collezione (serve reinstallare l'app una volta)."],
  ],
  '2.19': [
    ['Modifica i tuoi messaggi', "Messaggi privati, commenti, chat degli eventi e articoli: tocca «Modifica» sotto quello che hai scritto (o «Elimina»). Gli altri vedono la scritta «modificato»."],
  ],
  '2.18.1': [
    ['Notifiche più affidabili', "A ogni apertura Spinyl rinnova l'iscrizione alle notifiche: se sullo stesso telefono si cambia account, arrivano alla persona giusta."],
  ],
  '2.18': [
    ["Numero sull'icona", "Con le notifiche attive, l'icona di Spinyl nella schermata Home mostra quante novità ti aspettano (su iPhone serve iOS 16.4 o più recente)."],
    ['Inviti più semplici', "Invita un amico prepara un messaggio con il codice e i tre passi per installare l'app ed entrare. Chi apre il link trova una guida passo passo."],
  ],
  '2.17': [
    ['Profili', 'Tocca il nome di un membro per vedere il suo profilo: città, due righe su di sé, valutazioni e pezzi disponibili. Il tuo lo modifichi toccando il tuo nome in Community.'],
    ['Nella mia città', 'Negli Scambi e negli Eventi puoi vedere solo chi è nella tua città.'],
    ['Valutazioni dopo gli scambi', 'Dopo uno scambio o un prestito potete lasciarvi una valutazione con le stelle: si vede nel profilo.'],
    ['Data di restituzione', 'Nei prestiti puoi segnare entro quando ti va riportato il pezzo, con promemoria nel calendario. Avvisi in Novità quando si avvicina o è in ritardo.'],
  ],
  '2.16': [
    ['Scrivici', "Impostazioni › Aiuto e suggerimenti (o in fondo alla Home): segnala un problema o proponi un'idea. Leggiamo tutto."],
    ['Errori corretti più in fretta', "Se l'app va in errore ci arriva una segnalazione tecnica anonima. Puoi disattivarla nelle Impostazioni."],
    ['Prova delle notifiche', 'Nelle Impostazioni della community puoi inviarti una notifica di prova, anche ad app chiusa.'],
  ],
  '2.15': [
    ['Benvenuto', "Chi apre Spinyl per la prima volta trova una guida in 3 passi (la rivedi da Impostazioni › Guida introduttiva)."],
    ['Sezioni vuote più utili', 'Bacheca, Eventi, Scambi e Messaggi, quando sono vuoti, ti suggeriscono cosa fare: condividere un pezzo, aggiungere un desiderio, invitare un amico.'],
    ['Meno consumo', "L'app controlla le novità della community meno spesso; con le notifiche attive arrivano subito col push."],
  ],
  '2.5': [
    ['Home Novità', 'La prima pagina mostra i nuovi album dei tuoi artisti, i nuovi libri dei tuoi autori, i film al cinema e cosa stai leggendo.'],
  ],
  '2.14': [
    ['Privacy e termini', "Nelle Impostazioni: informativa privacy, termini d'uso e regole della community. In Community puoi scaricare i tuoi dati o eliminare l'account."],
  ],
  '2.13': [
    ['Notifiche sul telefono', "Attivale in Community: commenti, messaggi, inviti e offerte arrivano anche con l'app chiusa. Su iPhone serve aggiungere Spinyl alla schermata Home."],
  ],
  '2.12': [
    ['Notifiche', 'La campanella in Community ti avvisa di commenti ai tuoi post, risposte, inviti, chi partecipa ai tuoi eventi e pezzi che cerchi messi in vendita, in prestito o in regalo. Con suono e vibrazione (si possono spegnere nelle Impostazioni).'],
  ],
  '2.11': [
    ['Commenti in bacheca', 'Tocca una recensione o un pezzo condiviso nella Bacheca per commentarlo con la community.'],
  ],
  '2.10': [
    ['Eventi', 'Crea serate, club del libro, mercatini di scambio o ascolti online: invita chi vuoi, ognuno risponde Partecipo / Forse / Non vengo e può aggiungerlo al calendario.'],
    ['Nuovo nella Community', 'Il pulsante Nuovo avvia una conversazione, condivide un pezzo con un commento, scrive un articolo o crea un evento. Aggiungi ora compare solo in Collezione.'],
    ['Ascolti in diretta', "All'ora stabilita tutti mettono lo stesso disco e commentano traccia per traccia; dopo, i commenti restano da rileggere."],
  ],
  '2.9': [
    ['Condividi e scambia', 'Condividi pezzi e lista desideri con la community: chi ha quello che cerchi può vendertelo, prestartelo o regalartelo, con messaggi privati.'],
    ['Blog di ogni opera', 'Scrivi articoli su un disco, un libro o un film e discutine con gli altri.'],
  ],
  '2.8': [
    ['Community', 'Recensioni, voti e commenti tra amici su ogni libro, disco e film, nella nuova scheda Community accanto a Novità. Si entra su invito.'],
  ],
  '2.7': [
    ['Articoli', 'Nella Home gli articoli più recenti su libri, musica, vinili e cinema dalle riviste.'],
    ['Una sola riga cinema', 'Film in sala e in arrivo insieme, con la data di uscita.'],
  ],
  '2.6': [
    ['Nuovi album e nuovi libri', 'Nella Home anche le uscite della settimana, non solo quelle dei tuoi artisti e autori.'],
    ['Prezzo e voto in automatico', 'Quando apri un disco, Spinyl cerca da solo il prezzo su Discogs e il voto medio della community.'],
    ['Locandine dei film', 'La foto della copertina di un film trova il titolo giusto anche con scritte stilizzate, attori e slogan.'],
    ['Cerca aggiornamenti', 'Nelle Impostazioni, per scaricare subito l\'ultima versione.'],
    ['Voto online anche per libri e film', 'Sotto le tue stelle compare il voto medio dei lettori (Open Library o Google Libri) e degli spettatori (TMDB).'],
  ],
  '2.4': [
    ['Copie automatiche', 'Ogni giorno Spinyl tiene una copia della collezione su Drive (le ultime 10): da Impostazioni puoi tornare indietro.'],
    ['Accesso a Google più comodo', 'Quando l’accesso scade, Spinyl lo rinnova da solo se sei ancora collegato a Google. E le modifiche fatte su due telefoni non si sovrascrivono più.'],
  ],
  '2.2': [
    ['Foto copertina', 'Fotografa la copertina di un disco o di un libro: Spinyl lo riconosce e cerca dati e prezzi.'],
  ],
  '2.1': [
    ['Quanto vale?', 'Scansionando un disco con “Ce l’ho già?” vedi subito i prezzi Discogs per ogni condizione; per libri e film i venduti su eBay e AbeBooks.'],
    ['Tab Valore', 'Nella lista, il filtro “Valore”: totale per categoria, diviso per condizione, con il prezzo di ogni pezzo.'],
  ],
  '2.0': [
    ['Ce l’ho già?', 'Il tasto con la spunta in alto: scansioni un codice in negozio e scopri subito se ce l’hai.'],
    ['Che canzone è?', 'Il tasto con la nota in alto: ascolta la musica che suona e ti dice in quale tuo disco c’è quella canzone.'],
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
// ── Benvenuto in 3 passi: solo al primo avvio (collezione vuota), poi dalle Impostazioni ──
const WELCOME = [
  ['📚 💿 🎬', 'Cataloga in un attimo', 'Scansiona il codice a barre, fotografa la copertina o cerca per titolo: copertina, autore, anno, valore e voti online si compilano da soli.'],
  ['☁️', 'Al sicuro sul tuo Drive', "La collezione resta sul telefono e si copia nella cartella Scaffale del tuo Google Drive. Funziona anche offline: niente account nuovi, niente pubblicità."],
  ['👋', 'Una community tra appassionati', 'Recensioni, blog, scambi, prestiti ed eventi, solo su invito. La tua collezione resta privata finché non scegli tu cosa condividere.'],
];
function maybeWelcome() {
  let done = true; try { done = localStorage.getItem('welcomed') === '1'; localStorage.setItem('welcomed', '1'); } catch (e) {}
  if (done || live().length || S.openJoin) return false;
  try { localStorage.setItem('seenVersion', VERSION); } catch (e) {}
  setTimeout(() => welcomeOpen(0), 500);
  return true;
}
function welcomeOpen(step) {
  S.welcomeStep = step = Math.max(0, Math.min(WELCOME.length - 1, +step || 0));
  const [em, t, d] = WELCOME[step]; const last = step === WELCOME.length - 1;
  const extra = step === 1 && cfg('clientId') && !Drive.token() ? `<button class="btn block" data-a="login">${ic('cloud', 18)}Collega Google Drive</button>` : '';
  const end = last ? `<button class="btn primary block" data-a="welcomeAdd">${ic('scan', 18)}Aggiungi il primo pezzo</button>${COMM_URL && !commMe() ? '<button class="btn block" data-a="welcomeJoin">Ho un codice invito</button>' : ''}` : '';
  openSheet(`<div class="welcome"><div class="wem" aria-hidden="true">${em}</div><h2>${t}</h2><p>${d}</p>
    <div class="wdots">${WELCOME.map((_, i) => `<i class="${i === step ? 'on' : ''}"></i>`).join('')}</div>
    <div class="stack">${extra}${end}${last ? '' : `<button class="btn primary block" data-a="welcomeStep" data-v="${step + 1}">Avanti</button>`}
      <button class="more" data-a="closeSheet">${last ? 'Esplora da solo' : 'Salta'}</button></div></div>`);
}

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
    ocrWorkerP = Tesseract.createWorker({ it: 'eng+ita', es: 'eng+spa' }[LNG()] || 'eng', 1, {
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
const FILM_JUNK = /\b(film|movie|pel[ií]cula|poster|locandina|trailer|cast|official|ufficiale|dvd|blu-?ray|4k|uhd|steelbook|cover|copertina|(19|20)\d\d)\b/gi;
const cleanFilm = s => String(s || '').replace(FILM_JUNK, ' ').replace(VISION_JUNK, ' ').replace(/\s+/g, ' ').trim();
async function filmFromCover(cands, ctx) {
  const seen = new Set(); const list = [];
  for (const c of cands.map(cleanFilm)) { const k = norm(c); if (c.length >= 2 && k.length >= 2 && !seen.has(k)) { seen.add(k); list.push(c); } }
  const C = norm(ctx); let best = null;
  for (const c of list.slice(0, 6)) {
    const res = await tmdb(c).catch(() => []);
    res.slice(0, 6).forEach((r, i) => {
      let sc = (6 - i) / 2;
      for (const t of [r.titolo, r.sub].map(norm).filter(t => t.length >= 3)) {
        if (t === norm(c)) sc += 20;
        if (C.includes(t)) sc += 10 + Math.min(t.length, 20);
      }
      if (!best || sc > best.sc) best = { sc, t: r.titolo };
    });
    if (best && best.sc >= 35) break; // trovato con sicurezza
  }
  return best && best.sc >= 12 ? best.t : '';
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
  // ritaglio prima della lettura: la copertina sola si legge meglio ed è più bella come foto del pezzo
  try { const c = await cropImage(blob, { title: 'Ritaglia la copertina', skipLabel: 'Usa così', max: 1600, quality: 0.9 }); if (c) blob = c; } catch (e) {}
  if (S.coverShotUrl) URL.revokeObjectURL(S.coverShotUrl);
  S.coverShot = blob; S.coverShotUrl = URL.createObjectURL(blob); S.coverMode = mode;
  const overLimit = !!cfg('visionKey') && visionUsed() >= VISION_MONTHLY;
  const useVision = !!cfg('visionKey') && !overLimit;
  if (overLimit) toast('Limite mensile di Google Vision raggiunto: leggo le scritte sul telefono', 3500);
  const token = S.coverToken = uid();
  openSheet(`<h2>Leggo la copertina…</h2><div class="coverhead"><img src="${S.coverShotUrl}" alt=""></div>
    <div id="ocrStatus">${loadingHTML(useVision ? 'Riconosco la copertina…' : 'Leggo le scritte sulla copertina…')}</div>`);
  let q = '', how = '', cands = [], ctx = '';
  if (useVision) {
    try {
      const v = await visionAnnotate(blob); visionCount(); q = visionQuery(v); how = 'vision';
      cands = [cleanFilm(v.guess[0] || ''), ...v.entities, ...String(v.text).split('\n').slice(0, 6)];
      ctx = [v.guess.join(' '), v.entities.join(' '), v.text].join(' ');
    } catch (e) { console.warn(e); toast('Google Vision non risponde: provo a leggere le scritte', 3000); }
  }
  if (!q) {
    try {
      const lines = await ocrImage(blob); q = ocrQuery(lines); how = 'ocr';
      cands = [q, ...lines.slice().sort((a, b) => b.h - a.h).slice(0, 5).map(l => ocrQuery([l]))];
      ctx = lines.map(l => l.text).join(' ');
    } catch (e) { console.warn(e); }
  }
  // Film: le locandine hanno scritte stilizzate, attori e slogan. Provo ogni pezzo letto su TMDB e tengo il titolo che torna
  if (tipo === 'film' && cfg('tmdbKey') && cands.length && S.coverToken === token) {
    ocrStatus('Cerco il film…');
    try { const t = await filmFromCover(cands, ctx); if (t) q = t; } catch (e) { console.warn(e); }
  }
  if (S.coverToken !== token || $('#sheetWrap').classList.contains('hidden')) return; // annullato
  S.coverMode = mode;
  sheetSearch(tipo, q, '', { cover: true, auto: !!q, how, country: isMusic(tipo) ? detectCountry(ctx) : '' });
}
function startCover(mode, tipo) {
  S.coverMode = mode; S.coverTipo = tipo;
  const inp = $('#coverInput'); if (inp) inp.click();
}

/* ── Community (recensioni e commenti tra amici) ───────────── */
// Server: una funzione Supabase che riconosce l'utente dal token Google già usato per Drive. Si entra solo con un invito.
const COMM_URL = BASE.COMMUNITY_URL || '';
const COMM_KEY = BASE.COMMUNITY_KEY || '';
const commMe = () => { try { return JSON.parse(localStorage.getItem('commMe') || 'null'); } catch (e) { return null; } };
const setCommMe = m => { try { m ? localStorage.setItem('commMe', JSON.stringify(m)) : localStorage.removeItem('commMe'); } catch (e) {} };
class CommErr extends Error { constructor(code, msg) { super(msg); this.code = code; } }
async function comm(action, data = {}) {
  if (!COMM_URL) throw new CommErr(0, 'off');
  const tok = Drive.token(); if (!tok) throw new CommErr(401, 'login');
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(COMM_URL, { method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + COMM_KEY, apikey: COMM_KEY, 'x-google-token': tok },
      body: JSON.stringify({ action, ...data }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { if (r.status === 403 && j.error === 'membro') setCommMe(null); throw new CommErr(r.status, j.error || 'errore'); }
    return j;
  } finally { clearTimeout(t); }
}
const COMM_ERR = { login: 'Accedi a Google per usare la community', invito: 'Codice invito non valido o già usato', nick: 'Nome non valido: da 2 a 24 lettere o numeri',
  'nick-preso': 'Questo nome è già preso', vuota: 'Scrivi qualcosa o dai un voto', inviti: 'Hai già creato molti inviti', off: 'Community non disponibile' };
const commErrMsg = e => COMM_ERR[e && e.message] || (e && e.code === 429 ? 'Troppi messaggi: riprova più tardi' : 'La community non risponde: riprova');
// Stessa opera per tutti, qualunque edizione: tipo + autore + titolo senza parentesi
function workKey(it) {
  const g = it.tipo === 'libro' ? 'libro' : it.tipo === 'film' ? 'film' : 'musica';
  const t = norm(String(it.titolo || '').replace(/[([].*?[)\]]/g, ' ')); const a = norm(String(it.autore || '').split(/[,;&]/)[0]);
  return [g, a, t || norm(it.titolo)].join('|') + (g === 'film' && !a && it.anno ? '|' + it.anno : '');
}
function commHTML(it) {
  if (!COMM_URL) return '';
  const me = commMe();
  if (!me) return `<h3>Community</h3><p class="note pnote">Leggi e scrivi recensioni con gli amici che usano Spinyl.</p>
    <div class="stack"><button class="btn block" data-a="commJoin">Entra nella community</button></div>`;
  return `<h3>Community</h3><div id="commBody">${loadingHTML('Carico le recensioni…')}</div>`;
}
const commAgo = ts => { const d = Math.round((Date.now() - Date.parse(ts)) / 864e5); return d <= 0 ? 'oggi' : d === 1 ? 'ieri' : new Date(ts).toLocaleDateString(LOC(), { day: 'numeric', month: 'short' }); };
async function loadComm(it, force) {
  if (!it || !commMe() || !COMM_URL) return;
  const key = workKey(it); S.comm = S.comm || {};
  const c = S.comm[key];
  if (c && !force && Date.now() - c.t < 120e3) return renderComm(it);
  try { S.comm[key] = { t: Date.now(), d: await comm('work', { work: key }) }; }
  catch (e) { S.comm[key] = { t: Date.now(), err: e }; }
  renderComm(it);
}
function renderComm(it) {
  const box = $('#commBody'); if (!box || S.view !== 'detail' || S.id !== it.id) return;
  const c = (S.comm || {})[workKey(it)]; if (!c) return;
  if (c.err) {
    box.innerHTML = c.err.code === 401 ? `<p class="note pnote">${esc(commErrMsg(c.err))}</p><div class="stack"><button class="btn block" data-a="commLogin">Accedi con Google</button></div>`
      : c.err.code === 403 ? `<p class="note pnote">Non fai più parte della community.</p>` : `<p class="note pnote">${esc(commErrMsg(c.err))}</p>`;
    return;
  }
  const d = c.d; const mine = d.reviews.find(r => r.mine);
  if (S.commFor !== it.id) { S.commFor = it.id; S.commStars = mine ? mine.stars || 0 : 0; S.commAll = false; }
  const list = S.commAll ? d.reviews : d.reviews.slice(0, 5);
  const rev = r => `<div class="crev"><div class="chead"><b translate="no">${esc(r.nick)}</b>${r.stars ? `<span class="cstars">${'★'.repeat(r.stars)}<i>${'★'.repeat(5 - r.stars)}</i></span>` : ''}<small>${esc(commAgo(r.at))}</small></div>
      ${r.body ? `<p translate="no">${lk(r.body)}</p>` : ''}
      ${r.comments.map(cm => `<div class="ccom"><b translate="no">${esc(cm.nick)}</b> <span translate="no">${lk(cm.body)}</span>${editedTag(cm)}
        <span class="cacts">${cm.mine ? editBtn('comment', cm.id, cm.body, 'work') : ''}${cm.mine || commMe().admin ? `<button data-a="commDel" data-kind="comment" data-id="${esc(cm.id)}">Elimina</button>` : `<button data-a="commReport" data-kind="comment" data-id="${esc(cm.id)}">Segnala</button>`}</span></div>`).join('')}
      <div class="cacts"><button data-a="commReply" data-id="${esc(r.id)}">Rispondi</button>${r.mine || commMe().admin ? `<button data-a="commDel" data-kind="review" data-id="${esc(r.id)}">Elimina</button>` : `<button data-a="commReport" data-kind="review" data-id="${esc(r.id)}">Segnala</button>`}</div>
      <form class="composer creply hidden" data-review="${esc(r.id)}"><textarea rows="1" maxlength="1000" placeholder="Rispondi…"></textarea><button type="submit">Invia</button></form></div>`;
  box.innerHTML = `${d.avg ? `<div class="cavg"><b>★ ${esc(String(d.avg).replace('.', LNG() === 'en' ? '.' : ','))}</b><span>${d.n === 1 ? '1 voto' : d.n + ' voti'} nella community</span></div>` : ''}
    <div class="cmine"><span class="note">${mine ? 'La tua recensione' : 'Scrivi una recensione'}</span>${starsHTML(S.commStars || 0, 'commStar')}
      <textarea id="commText" rows="3" maxlength="2000" placeholder="Cosa ne pensi? (facoltativo)">${esc(mine ? mine.body : '')}</textarea>
      <button class="btn primary block" data-a="commSend">${mine ? 'Aggiorna' : 'Pubblica'}</button></div>
    ${list.map(rev).join('') || '<p class="note pnote">Ancora nessuna recensione: scrivi la prima!</p>'}
    ${!S.commAll && d.reviews.length > 5 ? `<button class="more" data-a="commMore">Mostra tutte (${d.reviews.length})</button>` : ''}
    <div class="cshare"><span>${isShared(it) ? `✓ <span>Condiviso con la community</span>${!it.desiderio && it.offerta ? ' · ' + esc(offerTxt(it.offerta, it.offerta === 'vendo' ? num(it.prezzoRichiesto) || null : null)) : ''}` : '<span>Non condiviso con la community</span>'}</span><button class="more" data-a="edit" data-id="${esc(it.id)}">Cambia</button></div>
    ${commPeopleHTML(d, { own: !it.desiderio })}${commPostsHTML(d)}`;
  box.querySelectorAll('form.creply').forEach(f => f.addEventListener('submit', async e => {
    e.preventDefault(); const ta = f.querySelector('textarea'); const body = ta.value.trim(); if (!body) return;
    f.querySelector('button').disabled = true;
    try { await comm('comment', { review: f.dataset.review, body }); await loadComm(it, true); }
    catch (er) { toast(commErrMsg(er)); f.querySelector('button').disabled = false; }
  }));
}
async function commSend() {
  const it = byId(S.id); if (!it) return;
  const body = ($('#commText') || {}).value || '';
  if (!S.commStars && !body.trim()) return toast(COMM_ERR.vuota);
  try {
    await comm('review', { work: workKey(it), tipo: it.tipo, titolo: it.titolo, autore: it.autore || '', cover: /^https:/.test(it.coverUrl || '') ? it.coverUrl : '', stars: S.commStars || null, body });
    toast('Pubblicata'); await loadComm(it, true); S.commRecent = null;
  } catch (e) { toast(commErrMsg(e)); }
}
function commReply(id) { const f = $(`form.creply[data-review="${id}"]`); if (f) { f.classList.toggle('hidden'); const ta = f.querySelector('textarea'); if (!f.classList.contains('hidden')) ta.focus(); } }
async function commDel(kind, id) {
  if (!confirm(tr(kind === 'comment' ? 'Eliminare il commento?' : 'Eliminare la recensione?'))) return;
  try { await comm('delete', { kind, id }); if (S.postOpenId && $('.post')) return postOpen(S.postOpenId); const it = byId(S.id); if (it) { if (kind === 'review') S.commFor = null; await loadComm(it, true); } } catch (e) { toast(commErrMsg(e)); }
}
async function commReport(kind, id) {
  const reason = prompt(tr('Perché lo segnali? (facoltativo)'));
  if (reason === null) return;
  try { await comm('report', { kind, id, reason }); toast('Grazie: segnalazione inviata'); if (S.postOpenId && $('.post')) return; const it = byId(S.id); if (it) await loadComm(it, true); } catch (e) { toast(commErrMsg(e)); }
}
function commJoinSheet() {
  if (!Drive.token()) { toast(COMM_ERR.login); if (cfg('clientId')) Drive.login(); return; }
  const code = localStorage.getItem('invito') || '';
  openSheet(`<h2>Entra nella community</h2>
    <p class="note">Recensioni, voti e commenti tra amici che usano Spinyl. Si entra solo con un codice invito: chiedilo a chi ti ha fatto conoscere l'app.</p>
    <label class="field"><span>Il tuo nome nella community</span><input id="commNick" maxlength="24" autocomplete="nickname" placeholder="es. Marco_vinili"></label>
    <label class="field"><span>Codice invito</span><input id="commCode" maxlength="12" value="${esc(code)}" autocapitalize="characters" autocomplete="off"></label>
    <label class="field"><span>La tua città (facoltativa: per scambi e serate vicino a te)</span><input id="commCity" maxlength="60" autocomplete="address-level2" placeholder="es. Alessandria"></label>
    <ul class="news crules"><li><span>Gli altri membri vedono il tuo nome, le tue recensioni e i tuoi commenti. La tua collezione resta privata.</span></li>
      <li><span>Sii gentile, niente insulti, spam o dati personali. I contenuti segnalati da 3 persone vengono nascosti.</span></li>
      <li><span>Devi avere almeno 14 anni.</span></li></ul>
    <p class="note legallinks"><button class="more" data-a="legal" data-v="rules">Regole della community</button> · <button class="more" data-a="legal" data-v="terms">Termini d'uso</button> · <button class="more" data-a="legal" data-v="privacy">Informativa privacy</button></p>
    <label class="check"><input type="checkbox" id="commOk"> <span>Ho letto e accetto regole, termini e informativa privacy</span></label>
    <div class="stack"><button class="btn primary block" data-a="commJoinGo">Entra</button></div>`);
}
async function commJoin() {
  const nick = ($('#commNick') || {}).value || ''; const code = ($('#commCode') || {}).value || '';
  if (!($('#commOk') || {}).checked) return toast('Accetta le regole per entrare');
  try {
    const r = await comm('join', { nick: nick.trim(), code: code.trim(), city: (($('#commCity') || {}).value || '').trim() });
    setCommMe(r.member); localStorage.removeItem('invito'); closeSheet(); toast('Benvenuto nella community!');
    commSyncShares(true).catch(() => {});
    render();
  } catch (e) { toast(commErrMsg(e), 3500); }
}
function commSettingsHTML() {
  if (!COMM_URL) return '';
  const me = commMe();
  return `<div class="section"><h3>Community</h3>
    ${me ? `<p class="note">Sei dentro come <b translate="no">${esc(me.nick)}</b>${me.admin ? ' · amministratore' : ''}. Ogni invito vale per 5 amici.</p>
      ${pushSupported() ? `<label class="field inline"><span>Notifiche sul telefono (anche ad app chiusa)</span><input type="checkbox" id="pushT" ${pushOn() ? 'checked' : ''}></label>` : (isIOS() && !isStandalone() ? '<p class="note">Per le notifiche sul telefono aggiungi Spinyl alla schermata Home e aprila da lì.</p>' : '')}
      ${pushOn() ? '<div class="stack"><button class="btn block" data-a="pushTest">Invia una notifica di prova</button><button class="btn block" data-a="pushTest" data-v="later">Prova ad app chiusa (tra 10 secondi)</button></div>' : ''}
      ${pushOn() && /Android/i.test(navigator.userAgent) ? '<p class="note">Su Android, se le notifiche arrivano solo quando apri Spinyl, il telefono sta mettendo Chrome a riposo: Impostazioni del telefono › App › Chrome › Batteria › Senza restrizioni. Per il pallino sull\'icona: Impostazioni › Notifiche › Pallino di notifica sull\'icona.</p>' : ''}
      <label class="field inline"><span>Suono e vibrazione per le notifiche</span><input type="checkbox" id="commSoundT" ${soundOn() ? 'checked' : ''}></label>
      <div class="stack"><button class="btn block" data-a="commInvite">${ic('share', 18)}Invita un amico</button>
        <button class="btn block" data-a="commExport">${ic('download', 18)}Scarica i miei dati</button>
        <button class="btn danger block" data-a="commDelete">Elimina il mio account</button></div>`
    : `<p class="note">Recensioni e commenti tra amici. Si entra con un codice invito.</p><div class="stack"><button class="btn block" data-a="commJoin">Entra nella community</button></div>`}</div>`;
}
// Messaggio d'invito: già pronto, con il codice e i 3 passi per entrare
function inviteText(code, link) {
  const me = (commMe() || {}).nick || '';
  return {
    it: `Ciao! Ti invito a provare Spinyl${me ? ` (sono ${me})` : ''}: un'app per catalogare libri, vinili, CD e film, con una piccola community di amici per recensioni, scambi e prestiti. È in prova, solo su invito.

1. Apri il link dal telefono: ${link}
   Su iPhone: Condividi › Aggiungi alla schermata Home, poi aprila dall'icona.
2. Tocca la nuvola e accedi con Google (i tuoi dati restano sul tuo Drive).
3. Community › Entra nella community, codice: ${code}

Se qualcosa non va: Impostazioni › Segnala un problema. Grazie! 🙏`,
    en: `Hi! I'm inviting you to try Spinyl${me ? ` (it's ${me})` : ''}: an app to catalogue books, vinyl, CDs and films, with a small community of friends for reviews, swaps and loans. It's in testing, invite only.

1. Open the link on your phone: ${link}
   On iPhone: Share › Add to Home Screen, then open it from the icon.
2. Tap the cloud and sign in with Google (your data stays on your Drive).
3. Community › Join the community, code: ${code}

If something doesn't work: Settings › Report a problem. Thanks! 🙏`,
    es: `¡Hola! Te invito a probar Spinyl${me ? ` (soy ${me})` : ''}: una app para catalogar libros, vinilos, CD y películas, con una pequeña comunidad de amigos para reseñas, intercambios y préstamos. Está en pruebas, solo por invitación.

1. Abre el enlace en el móvil: ${link}
   En iPhone: Compartir › Añadir a pantalla de inicio, y ábrela desde el icono.
2. Toca la nube e inicia sesión con Google (tus datos se quedan en tu Drive).
3. Comunidad › Entrar en la comunidad, código: ${code}

Si algo no funciona: Ajustes › Informar de un problema. ¡Gracias! 🙏`,
  }[LNG()] || '';
}
async function commInvite() {
  let code; try { code = (await comm('invite')).code; } catch (e) { return toast(commErrMsg(e)); }
  const link = location.origin + location.pathname.replace(/index\.html$/, '') + '?invito=' + code;
  S.inviteMsg = inviteText(code, link);
  openSheet(`<h2>Invita un amico</h2>
    <div class="invcode"><span>Codice invito</span><b translate="no">${esc(code)}</b><small>Vale per 5 persone</small></div>
    <label class="field"><span>Messaggio (puoi modificarlo)</span><textarea id="invText" rows="12" translate="no">${esc(S.inviteMsg)}</textarea></label>
    <div class="stack"><button class="btn primary block" data-a="inviteSend">${ic('share', 18)}Invia</button><button class="btn block" data-a="inviteCopy">Copia il messaggio</button></div>
    <p class="note">Invita poche persone fidate: è una prova. Il messaggio spiega già come installare l'app ed entrare.</p>`);
}
// Chi apre un link d'invito: spiega i passi (su iPhone l'app installata non vede il link, quindi il codice va riscritto)
function inviteLanding() {
  const code = (() => { try { return localStorage.getItem('invito') || ''; } catch (e) { return ''; } })();
  const ios = isIOS() && !isStandalone(); const logged = !!Drive.token();
  openSheet(`<h2>Sei stato invitato!</h2>
    <p class="note">Spinyl è in prova solo su invito: benvenuto. Bastano tre passi.</p>
    ${code ? `<div class="invcode"><span>Il tuo codice</span><b translate="no">${esc(code)}</b><small>Segnalo: ti servirà al passo 3</small></div>` : ''}
    <ol class="steps">
      <li class="${ios ? '' : 'done'}"><b>Installa l'app</b><span>${ios ? 'Tocca Condividi (il quadrato con la freccia) › Aggiungi alla schermata Home, poi apri Spinyl dalla nuova icona.' : 'Fatto, oppure aggiungila alla schermata Home dal menu del browser.'}</span></li>
      <li class="${logged ? 'done' : ''}"><b>Accedi con Google</b><span>La collezione si salva sul tuo Google Drive: solo tu la vedi.</span>${!ios && !logged && cfg('clientId') ? '<button class="btn sm" data-a="login">Accedi con Google</button>' : ''}</li>
      <li><b>Entra nella community</b><span>Scegli un nome e scrivi il codice.</span>${!ios && logged ? '<button class="btn sm primary" data-a="commJoin">Entra nella community</button>' : ''}</li>
    </ol>
    <div class="stack"><button class="more" data-a="closeSheet">Più tardi</button></div>`);
}
// ── Condivisione: quali pezzi vanno in community ──
const sharePref = d => { try { return d.desiderio ? localStorage.getItem('shareWish') === '1' : localStorage.getItem('shareNew') === '1'; } catch (e) { return false; } };
const isShared = it => it.desiderio ? (it.condiviso != null ? !!it.condiviso : (() => { try { return localStorage.getItem('shareWish') === '1'; } catch (e) { return false; } })()) : !!it.condiviso;
const OFFERTE = [['', 'Solo da mostrare'], ['vendo', 'Lo vendo'], ['presto', 'Lo presto'], ['regalo', 'Lo regalo']];
function shareFormHTML(d) {
  if (!COMM_URL || !commMe()) return '';
  const on = d.condiviso != null ? !!d.condiviso : (S.draftIsNew ? sharePref(d) : isShared(d));
  return `<div class="sharebox"><label class="field inline"><span>Condividi con la community</span><input type="checkbox" data-f="condiviso" ${on ? 'checked' : ''}></label>
    ${d.desiderio ? '<p class="note">Chi ce l\'ha potrà proporti di vendertelo, prestartelo o regalartelo.</p>' : `<div class="two"><label class="field"><span>Disponibile per</span><select data-f="offerta">${OFFERTE.map(([k, l]) => `<option value="${k}" ${d.offerta === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    ${f2('prezzoRichiesto', 'Prezzo richiesto (€)', d)}</div>`}</div>`;
}
const f2 = (name, label, d) => `<label class="field"><span>${label}</span><input data-f="${name}" value="${esc(d[name] || '')}" inputmode="decimal"></label>`;
const shareRow = it => ({ work: workKey(it), kind: it.desiderio ? 'wish' : 'own', tipo: it.tipo, titolo: it.titolo, autore: it.autore || '', anno: String(it.anno || ''), formato: it.formato || '',
  cover: /^https:/.test(it.coverUrl || '') ? it.coverUrl : '', offer: it.desiderio ? '' : (it.offerta || ''), price: it.offerta === 'vendo' && num(it.prezzoRichiesto) ? num(it.prezzoRichiesto) : null, note: String(it.notaCommunity || '').slice(0, 300) });
let commSharesT = null;
function commSharesSoon(ms = 2500) { clearTimeout(commSharesT); commSharesT = setTimeout(() => commSyncShares().catch(() => {}), ms); }
async function commSyncShares(force) {
  if (!commMe() || !Drive.token()) return;
  const items = live().filter(isShared).map(shareRow);
  const h = JSON.stringify(items); let prev = ''; try { prev = localStorage.getItem('sharesHash') || ''; } catch (e) {}
  const sig = String(h.length) + ':' + [...h].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
  if (!force && sig === prev) return;
  await comm('shares', { items });
  try { localStorage.setItem('sharesHash', sig); } catch (e) {}
}
const OFFER_LABEL = { vendo: '💶 In vendita', presto: '🤝 In prestito', regalo: '🎁 In regalo', compro: '🛒 Vuole comprarlo', prestito: '🙏 Chiede in prestito' };
const offerTxt = (o, price) => o ? `${tr(OFFER_LABEL[o] || '')}${price != null && (o === 'vendo' || o === 'compro') ? ' · ' + money(+price) : ''}` : '';

// ── Persone che hanno o cercano la stessa opera + blog, nella scheda e nel foglio opera ──
function commPeopleHTML(d, ctx) {
  const others = (d.shares || []).filter(x => !x.mine);
  const has = others.filter(x => x.kind === 'own'), want = others.filter(x => x.kind === 'wish');
  const btn = (x, mode) => `<button class="btn sm" data-a="offerSheet" data-to="${esc(x.member)}" data-nick="${esc(x.nick)}" data-mode="${mode}">${mode === 'give' ? 'Offri' : 'Chiedi'}</button>`;
  const row = (x, mode) => `<div class="prow2"><div><b translate="no">${esc(x.nick)}</b><span>${mode === 'ask' ? (x.offer ? esc(offerTxt(x.offer, x.price)) : 'Ce l\'ha') : 'Lo cerca'}${x.formato ? ` · <span translate="no">${esc(x.formato)}</span>` : ''}</span></div>${btn(x, mode)}</div>`;
  if (!has.length && !want.length) return '';
  return `<h4 class="csub">Nella community</h4>${has.map(x => row(x, 'ask')).join('')}${ctx.own ? want.map(x => row(x, 'give')).join('') : ''}`;
}
function commPostsHTML(d) {
  return `<h4 class="csub">Blog</h4>${(d.posts || []).map(p => `<button class="postrow" data-a="postOpen" data-id="${esc(p.id)}"><b translate="no">${esc(p.title)}</b><span><span translate="no">${esc(p.nick)}</span> · ${esc(commAgo(p.at))}</span><p translate="no">${esc(p.excerpt)}${p.excerpt.length >= 160 ? '…' : ''}</p></button>`).join('') || '<p class="note pnote">Nessun articolo ancora.</p>'}
    <button class="more" data-a="postSheet">+ Scrivi un articolo</button> <button class="more" data-a="eventFromWork">+ Crea un evento</button>`;
}
// l'opera su cui si sta lavorando (scheda aperta o foglio di un'opera che non hai)
function commCtx() {
  const it = S.view === 'detail' && byId(S.id);
  if (S.commWork && !$('#sheetWrap').classList.contains('hidden')) return S.commWork;
  return it ? { work: workKey(it), tipo: it.tipo, titolo: it.titolo, autore: it.autore || '', cover: /^https:/.test(it.coverUrl || '') ? it.coverUrl : '', own: !it.desiderio, it } : null;
}

// Sezione vuota: spiega cosa fare e propone l'azione giusta (btns: [azione, etichetta, principale?])
// testo scritto dagli utenti: i link diventano cliccabili (si aprono fuori dall'app)
const lk = t => esc(t).replace(/\b(?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)\]'"»]/gi, u => {
  const href = /^www\./i.test(u) ? 'https://' + u : u; const show = u.replace(/^https?:\/\//i, '');
  return `<a class="ulink" href="${href}" target="_blank" rel="noopener nofollow ugc">${show.length > 48 ? show.slice(0, 45) + '…' : show}</a>`;
});
// nome di un membro che apre il suo profilo
const nickBtn = (id, nick) => id ? `<button class="nick" data-a="profileOpen" data-id="${esc(id)}" translate="no">${esc(nick)}</button>` : `<b translate="no">${esc(nick)}</b>`;
const sameCity = (a, b) => !!a && !!b && norm(a) === norm(b);
const myCity = () => (commMe() || {}).city || '';
function emptyHTML(em, title, text, btns = []) {
  return `<div class="cempty">${em ? `<div class="cem" aria-hidden="true">${em}</div>` : ''}${title ? `<b>${title}</b>` : ''}<p>${text}</p>
    ${btns.length ? `<div class="cebtns">${btns.map(([a, l, p]) => `<button class="btn sm ${p ? 'primary' : ''}" data-a="${a}">${l}</button>`).join('')}</div>` : ''}</div>`;
}
// ── Scheda "Community": Bacheca · Scambi · Messaggi ──
function viewCommunity() {
  const me = commMe(); const seg = S.commSeg || 'bacheca';
  let body;
  if (!me) body = `<div class="hint chero"><b>La community di Spinyl</b><span>Recensioni, blog, scambi e prestiti tra amici su libri, dischi e film. Si entra con un codice invito; la tua collezione resta privata finché non decidi di condividere.</span>
      <button class="btn primary" data-a="commJoin">Entra nella community</button></div>`;
  else body = `<div class="cme"><button class="cmeme" data-a="profileOpen" data-id="${esc(me.id)}"><span class="note">Sei dentro come</span><b translate="no">${esc(me.nick)}</b><small>${me.city ? `📍 <span translate="no">${esc(me.city)}</span> · ` : ''}<span>Il mio profilo</span> ›</small></button>
      <div class="cmebtns"><button class="iconbtn bell" data-a="notifsOpen" aria-label="Notifiche">🔔${S.commNotifs ? `<i class="badge">${S.commNotifs}</i>` : ''}</button><button class="btn" data-a="commInvite">${ic('share', 18)}Invita</button></div></div>
    ${pushHintHTML()}
    <div class="seg cseg four">${[['bacheca', 'Bacheca'], ['eventi', 'Eventi'], ['scambi', 'Scambi'], ['messaggi', 'Messaggi']].map(([k, l]) => `<button class="${seg === k ? 'on' : ''}" data-a="commSeg" data-v="${k}">${l}${k === 'messaggi' && S.commUnread ? `<i class="badge">${S.commUnread}</i>` : k === 'eventi' && S.commInvites ? `<i class="badge">${S.commInvites}</i>` : ''}</button>`).join('')}</div>
    <div id="commList">${loadingHTML('Carico…')}</div>`;
  return `${mainHeader('community')}<div class="home commtab">${body}</div>${me ? `<button class="fab" data-a="commNew">${ic('plus')}Nuovo</button>` : ''}`;
}
const coverMini = c => coverHTML({ tipo: c.tipo || 'libro', titolo: c.titolo, coverUrl: c.cover });
async function loadCommunity() {
  if (!commMe()) return;
  if (!S.meFresh) { S.meFresh = true; comm('me').then(r => { if (r.member) { const old = JSON.stringify(commMe()); setCommMe({ ...commMe(), ...r.member }); if (old !== JSON.stringify(commMe()) && S.view === 'community') render(); } }).catch(() => {}); }
  const seg = S.commSeg || 'bacheca'; const b = () => $('#commList');
  const fail = e => { const x = b(); if (x) x.innerHTML = e.code === 401 ? `<p class="note">${esc(commErrMsg(e))}</p><div class="stack"><button class="btn block" data-a="commLogin">Accedi con Google</button></div>` : `<p class="note">${esc(commErrMsg(e))}</p>`; };
  try {
    if (seg === 'bacheca') {
      const [d, ev] = await Promise.all([comm('board'), comm('events').catch(() => ({ upcoming: [] }))]); S.commBoard = d.items || [];
      if (!b() || S.commSeg && S.commSeg !== 'bacheca') return;
      const soon = (ev.upcoming || []).slice(0, 2);
      b().innerHTML = (soon.length ? `<h3 class="chtitle">Prossimi eventi</h3>${soon.map(evCard).join('')}<button class="more" data-a="commSeg" data-v="eventi">Tutti gli eventi</button><h3 class="chtitle">Ultime novità</h3>` : '') + S.commBoard.map((x, i) => {
        const head = x.type === 'review' ? `<div class="chead"><b translate="no">${esc(x.nick)}</b>${x.stars ? `<span class="cstars">${'★'.repeat(x.stars)}<i>${'★'.repeat(5 - x.stars)}</i></span>` : ''}<small>${esc(commAgo(x.at))}</small></div>${x.body ? `<p translate="no">${esc(x.body)}</p>` : ''}`
          : x.type === 'post' ? `<div class="chead"><span class="ctag">📝 <span>Blog</span></span><b translate="no">${esc(x.nick)}</b><small>${esc(commAgo(x.at))}</small></div><p><b translate="no">${esc(x.title)}</b></p>`
          : `<div class="chead"><span class="ctag">${x.kind === 'wish' ? '🔎 <span>Lo cerca</span>' : x.offer ? esc(offerTxt(x.offer, x.price)) : '📀 <span>Ce l\'ha</span>'}</span><b translate="no">${esc(x.nick)}</b><small>${esc(commAgo(x.at))}</small></div>${x.note ? `<p translate="no">${esc(x.note)}</p>` : ''}`;
        return `<button class="crow t-${esc(x.tipo)}" data-a="boardOpen" data-i="${i}">${coverMini(x)}<div><b translate="no">${esc(x.titolo)}</b><span translate="no">${esc(x.autore || '')}</span>${head}
          <span class="ccount">💬 ${x.comments ? `<span translate="no">${x.comments}</span> · ` : ''}<span>${x.comments ? 'Commenta' : 'Commenta per primo'}</span></span></div></button>`;
      }).join('') || emptyHTML('🌱', 'La bacheca è ancora vuota', 'Rompi il ghiaccio: condividi un pezzo della tua collezione o scrivi un articolo su un disco, un libro o un film che ami.',
        [['newShare', 'Condividi un pezzo', 1], ['newPost', 'Scrivi un articolo'], ['commInvite', 'Invita un amico']]);
      if (S.commBoard.length && S.commBoard.length < 6) b().insertAdjacentHTML('beforeend', emptyHTML('', 'La community cresce con te', 'Più amici ci sono, più scambi, recensioni ed eventi. Ogni invito vale per 5 persone.', [['commInvite', 'Invita un amico']]));
      hydratePhotos(b());
    } else if (seg === 'eventi') {
      await loadEvents(b);
    } else if (seg === 'scambi') {
      const own = [...new Set(live().filter(i => !i.desiderio).map(workKey))], wish = [...new Set(live().filter(i => i.desiderio).map(workKey))];
      const d = await comm('match', { own, wish }); S.commMatch = d;
      if (!b() || S.commSeg !== 'scambi') return;
      let sw = false; try { sw = localStorage.getItem('shareWish') === '1'; } catch (e) {}
      let near = false; try { near = localStorage.getItem('nearMe') === '1' && !!myCity(); } catch (e) {}
      const inCity = x => !near || sameCity(x.city, myCity());
      const wantedL = d.wanted.map((x, i) => [x, i]).filter(([x]) => inCity(x)), availL = d.available.map((x, i) => [x, i]).filter(([x]) => inCity(x));
      const card = (x, i, mode) => `<div class="crow t-${esc(x.tipo)}">${coverMini(x)}<div><b translate="no">${esc(x.titolo)}</b><span translate="no">${esc(x.autore || '')}</span>
          <div class="chead">${nickBtn(x.member, x.nick)}${x.city ? `<small translate="no">📍 ${esc(x.city)}</small>` : ''}<span class="ctag">${mode === 'give' ? '🔎 <span>Lo cerca</span>' : x.offer ? esc(offerTxt(x.offer, x.price)) : '📀 <span>Ce l\'ha</span>'}</span></div>
          <div class="cacts"><button class="btn sm" data-a="offerSheet" data-to="${esc(x.member)}" data-nick="${esc(x.nick)}" data-mode="${mode}" data-m="${mode === 'give' ? 'wanted' : 'available'}" data-i="${i}">${mode === 'give' ? 'Offri' : 'Chiedi'}</button></div></div></div>`;
      b().innerHTML = `<label class="field inline swtoggle"><span>Condividi la mia lista desideri</span><input type="checkbox" id="shareWishToggle" ${sw ? 'checked' : ''}></label>
        ${myCity() ? `<label class="field inline swtoggle"><span><span>Solo nella mia città</span> · <span translate="no">${esc(myCity())}</span></span><input type="checkbox" id="nearToggle" ${near ? 'checked' : ''}></label>`
          : `<div class="pushhint"><span>📍 <span>Aggiungi la tua città al profilo per trovare scambi e prestiti vicino a te.</span></span><button class="btn sm" data-a="profileEdit">Aggiungi la città</button></div>`}
        <h3 class="chtitle">Cercano cose che hai</h3>${wantedL.map(([x, i]) => card(x, i, 'give')).join('') || (near && d.wanted.length ? emptyHTML('', '', 'Nessuno nella tua città, per ora. Togli il filtro per vedere tutti.') : own.length
          ? emptyHTML('', '', 'Nessuno cerca, per ora, qualcosa della tua collezione. Hai un doppione o qualcosa che non ascolti più? Mettilo in vendita, in prestito o in regalo.', [['newShare', 'Offri un pezzo']])
          : emptyHTML('', '', 'Aggiungi i tuoi pezzi alla collezione: ti diremo chi li sta cercando.', [['add', 'Aggiungi alla collezione']]))}
        <h3 class="chtitle">Hanno cose che cerchi</h3>${availL.map(([x, i]) => card(x, i, 'ask')).join('') || (near && d.available.length ? emptyHTML('', '', 'Nessuno nella tua città, per ora. Togli il filtro per vedere tutti.') : wish.length
          ? emptyHTML('', '', 'Nessuno ha condiviso, per ora, qualcosa della tua lista desideri. Condividila: chi ce l\'ha potrà scriverti.', sw ? [['wishSearch', 'Aggiungi un desiderio']] : [['shareWishOn', 'Condividi la lista desideri', 1]])
          : emptyHTML('', '', 'Cosa stai cercando? Aggiungi un disco, un libro o un film alla lista desideri: ti avvisiamo quando qualcuno ce l\'ha.', [['wishSearch', 'Aggiungi un desiderio', 1]]))}
        <p class="note home-foot">Per mettere in vendita, in prestito o in regalo un pezzo: aprilo › Modifica › Condividi con la community.</p>`;
      hydratePhotos(b());
      const nt = $('#nearToggle'); if (nt) nt.addEventListener('change', () => { try { localStorage.setItem('nearMe', nt.checked ? '1' : '0'); } catch (e) {} loadCommunity(); });
      const t = $('#shareWishToggle'); if (t) t.addEventListener('change', () => { try { localStorage.setItem('shareWish', t.checked ? '1' : '0'); } catch (e) {} commSyncShares(true).then(() => toast(t.checked ? 'Lista desideri condivisa' : 'Lista desideri non più condivisa')).catch(er => toast(commErrMsg(er))); });
    } else {
      const [d, gd] = await Promise.all([comm('threads'), comm('groups').catch(() => ({ groups: [] }))]); S.commThreads = d.threads || []; S.commGroups = gd.groups || [];
      S.commUnread = S.commThreads.filter(t => t.unread).length + S.commGroups.filter(g => g.unread).length;
      if (!b() || S.commSeg !== 'messaggi') return;
      const rows = [...S.commThreads.map(t => ({ t, at: t.at })), ...S.commGroups.map(g => ({ g, at: g.at }))].sort((x, y) => String(y.at).localeCompare(String(x.at)));
      const groupRow = g => `<button class="crow thrd grp ${g.unread ? 'unread' : ''}" data-a="groupOpen" data-id="${esc(g.id)}"><div class="gava" aria-hidden="true">👥</div><div><b translate="no">${esc(g.name)}</b><span>${g.members} membri</span>
          <p>${g.last ? (g.last.mine ? '<span>Tu:</span> ' : g.last.nick ? `<span translate="no">${esc(g.last.nick)}:</span> ` : '') + `<span translate="no">${esc(g.last.body)}</span>` : '<span>Nessun messaggio ancora</span>'}</p></div></button>`;
      b().innerHTML = (rows.length ? `<div class="stack msgnew"><button class="btn sm" data-a="newChat">💬 <span>Nuova conversazione</span></button><button class="btn sm" data-a="groupNew">👥 <span>Nuovo gruppo</span></button></div>` : '') + rows.map(({ t, g }) => g ? groupRow(g) : `<button class="crow thrd ${t.unread ? 'unread' : ''}" data-a="threadOpen" data-id="${esc(t.id)}">${coverMini({ tipo: 'vinile', titolo: t.titolo, cover: t.cover })}<div><b translate="no">${esc(t.nick)}</b>${t.titolo ? `<span translate="no">${esc(t.titolo)}</span>` : ''}
          <p>${t.last ? (t.last.mine ? '<span>Tu:</span> ' : '') + (t.last.offer ? esc(offerTxt(t.last.offer, t.last.price)) + (t.last.body ? ' · ' : '') : '') + `<span translate="no">${esc(t.last.body)}</span>` : ''}</p></div></button>`).join('')
        || emptyHTML('💬', 'Nessun messaggio', 'Scrivi a un membro della community, crea un gruppo con più persone, oppure vai negli Scambi per contattare chi ha o cerca i tuoi pezzi.', [['newChat', 'Nuova conversazione', 1], ['groupNew', 'Nuovo gruppo'], ['goScambi', 'Vai agli Scambi']]);
      hydratePhotos(b());
      commBadges();
    }
  } catch (e) { fail(e); }
}
// Opera dalla bacheca o dagli scambi: se ce l'hai apre la scheda, altrimenti un foglio con recensioni, persone e blog
function boardOpen(i) {
  const x = (S.commBoard || [])[i]; if (!x) return;
  if (x.type === 'post') return postOpen(x.id);
  discussionOpen(x.type === 'review' ? { type: 'review', id: x.id } : { type: 'share', member: x.member, work: x.work, kind: x.kind });
}
// Discussione su una recensione o su un pezzo condiviso: la community commenta quello che l'utente ha condiviso
async function discussionOpen(q, keepScroll) {
  let d; try { d = await comm('discussion', q); } catch (e) { return toast(commErrMsg(e)); }
  const x = d.item; S.disc = { q, item: x }; const me = commMe() || {};
  const what = x.type === 'review' ? (x.stars ? `<span class="cstars">${'★'.repeat(x.stars)}<i>${'★'.repeat(5 - x.stars)}</i></span>` : '')
    : `<span class="ctag">${x.kind === 'wish' ? '🔎 <span>Lo cerca</span>' : x.offer ? esc(offerTxt(x.offer, x.price)) : '📀 <span>Ce l\'ha</span>'}</span>`;
  const own = live().find(i => workKey(i) === x.work && !i.desiderio);
  openSheet(`<div class="pickcard">${coverMini(x)}<div><b translate="no">${esc(x.titolo)}</b><span translate="no">${esc(x.autore || '')}</span><button class="more" data-a="discWork">Apri l'opera ›</button></div></div>
    <div class="crev"><div class="chead">${nickBtn(x.member, x.nick)}${x.city ? `<small translate="no">📍 ${esc(x.city)}</small>` : ''}${what}<small>${esc(commAgo(x.at))}</small></div>${(x.type === 'review' ? x.body : x.note) ? `<p translate="no">${lk(x.type === 'review' ? x.body : x.note)}</p>` : ''}</div>
    ${!x.mine && x.type === 'share' ? `<div class="stack"><button class="btn block" data-a="discOffer">${x.kind === 'wish' ? (own ? 'Offri il tuo' : 'Scrivi') : 'Chiedi'}</button></div>` : ''}
    <h4 class="csub">Commenti</h4>
    <div id="discList">${d.comments.map(c => `<div class="ccom"><b translate="no">${esc(c.nick)}</b> <span translate="no">${lk(c.body)}</span><small> · ${esc(commAgo(c.at))}${editedTag(c)}</small>
      <span class="cacts">${c.mine ? editBtn('comment', c.id, c.body, 'disc') : ''}${c.mine || me.admin ? `<button data-a="discDel" data-id="${esc(c.id)}">Elimina</button>` : `<button data-a="commReport" data-kind="comment" data-id="${esc(c.id)}">Segnala</button>`}</span></div>`).join('') || '<p class="note">Ancora nessun commento: scrivi il primo!</p>'}</div>
    <form class="composer" id="discForm"><textarea rows="1" maxlength="1000" placeholder="Commenta…"></textarea><button type="submit">Invia</button></form>`);
  hydratePhotos($('#sheet'));
  $('#discForm').addEventListener('submit', async e => {
    e.preventDefault(); const ta = e.target.querySelector('textarea'); const body = ta.value.trim(); if (!body) return;
    const payload = q.type === 'review' ? { review: q.id, body } : { share: { member: q.member, work: q.work, kind: q.kind }, body };
    try { await comm('comment', payload); discussionOpen(q, true); if (S.view === 'community') loadCommunity(); } catch (er) { toast(commErrMsg(er)); }
  });
  if (keepScroll) { const l = $('#discList'); if (l) l.lastElementChild && l.lastElementChild.scrollIntoView({ block: 'nearest' }); }
}
function workSheet(x) {
  const it = live().find(i => workKey(i) === x.work);
  if (it) return go('detail', it.id);
  S.commWork = { work: x.work, tipo: x.tipo, titolo: x.titolo, autore: x.autore || '', cover: x.cover || '', own: false };
  openSheet(`<div class="pickcard">${coverMini(x)}<div><b translate="no">${esc(x.titolo)}</b><span translate="no">${esc(x.autore || '')}</span></div></div>
    <div id="commSheet">${loadingHTML('Carico…')}</div>
    <div class="stack"><button class="btn block" data-a="workWish">${ic('plus', 18)}Aggiungi ai desideri</button></div>`);
  comm('work', { work: x.work }).then(d => {
    const b = $('#commSheet'); if (!b) return;
    b.innerHTML = `${d.avg ? `<div class="cavg"><b>★ ${esc(String(d.avg).replace('.', LNG() === 'en' ? '.' : ','))}</b><span>${d.n === 1 ? '1 voto nella community' : d.n + ' voti nella community'}</span></div>` : ''}` +
      d.reviews.slice(0, 10).map(r => `<div class="crev"><div class="chead"><b translate="no">${esc(r.nick)}</b>${r.stars ? `<span class="cstars">${'★'.repeat(r.stars)}<i>${'★'.repeat(5 - r.stars)}</i></span>` : ''}<small>${esc(commAgo(r.at))}</small></div>${r.body ? `<p translate="no">${lk(r.body)}</p>` : ''}</div>`).join('') +
      commPeopleHTML(d, { own: false }) + commPostsHTML(d);
  }).catch(e => { const b = $('#commSheet'); if (b) b.innerHTML = `<p class="note">${esc(commErrMsg(e))}</p>`; });
}

// ── Profilo dei membri: città, due righe su di sé, valutazioni dopo gli scambi, pezzi disponibili ──
async function profileOpen(id) {
  if (!id) return;
  let d; try { d = (await comm('profile', { id })).profile; } catch (e) { return toast(commErrMsg(e)); }
  S.profile = d;
  const stars = n => `<span class="cstars">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`;
  const since = new Date(d.since).toLocaleDateString(LOC(), { month: 'long', year: 'numeric' });
  const dec = v => String(v).replace('.', LNG() === 'en' ? '.' : ',');
  openSheet(`<div class="prof"><div class="pava" aria-hidden="true">${esc((d.nick || '?').slice(0, 1).toUpperCase())}</div>
      <div><h2 translate="no">${esc(d.nick)}</h2>${d.city ? `<span translate="no">📍 ${esc(d.city)}</span>` : ''}<small><span>Nella community da</span> ${esc(since)}</small></div></div>
    ${d.bio ? `<p class="prose" translate="no">${lk(d.bio)}</p>` : d.mine ? '<p class="note">Scrivi due righe su di te: cosa collezioni, cosa cerchi.</p>' : ''}
    <div class="pstats"><div><b>${d.rating.avg != null ? '★ ' + esc(dec(d.rating.avg)) : '—'}</b><span>${d.rating.n === 1 ? '1 valutazione' : d.rating.n + ' valutazioni'}</span></div>
      <div><b>${d.counts.reviews}</b><span>recensioni</span></div><div><b>${d.counts.own}</b><span>pezzi condivisi</span></div><div><b>${d.counts.wish}</b><span>desideri</span></div></div>
    <div class="stack">${d.mine ? '<button class="btn primary block" data-a="profileEdit">Modifica il profilo</button>'
      : `<button class="btn primary block" data-a="profileChat">💬 <span>Scrivi a</span> <span translate="no">${esc(d.nick)}</span></button>`}</div>
    ${d.offers.length ? `<h4 class="csub">Disponibili per scambio</h4>${d.offers.map((x, i) => `<div class="crow t-${esc(x.tipo)}">${coverMini(x)}<div><b translate="no">${esc(x.titolo)}</b><span translate="no">${esc(x.autore || '')}</span>
      <div class="chead"><span class="ctag">${esc(offerTxt(x.offer, x.price))}</span></div>${d.mine ? '' : `<div class="cacts"><button class="btn sm" data-a="profileAsk" data-i="${i}">Chiedi</button></div>`}</div></div>`).join('')}` : ''}
    <h4 class="csub">Valutazioni</h4>
    ${d.ratings.map(r => `<div class="crev"><div class="chead"><b translate="no">${esc(r.nick)}</b>${stars(r.stars)}<small>${esc(commAgo(r.at))}</small></div>${r.body ? `<p translate="no">${lk(r.body)}</p>` : ''}
      ${r.mine ? '' : `<span class="cacts"><button data-a="commReport" data-kind="rating" data-id="${esc(r.id)}">Segnala</button></span>`}</div>`).join('')
      || `<p class="note">${d.mine ? 'Dopo uno scambio o un prestito, chi ha trattato con te può lasciarti una valutazione.' : 'Ancora nessuna valutazione.'}</p>`}
    ${d.mine ? '' : `<p class="note legallinks"><button class="more" data-a="profileBlock">${d.blocked ? 'Sblocca' : 'Blocca'}</button></p>`}`);
  hydratePhotos($('#sheet'));
}
function profileEdit() {
  const me = commMe() || {};
  const p = S.profile && S.profile.mine ? S.profile : {};
  openSheet(`<h2>Il mio profilo</h2>
    <label class="field"><span>Città</span><input id="pfCity" maxlength="60" value="${esc(p.city ?? me.city ?? '')}" autocomplete="address-level2" placeholder="es. Alessandria"></label>
    <p class="note">Gli altri membri vedono la città: serve per scambi, prestiti e serate vicino a te. Metti solo la città, non l'indirizzo.</p>
    <label class="field"><span>Due righe su di te</span><textarea id="pfBio" rows="3" maxlength="300" placeholder="Cosa collezioni, cosa cerchi, cosa ascolti in questo periodo…">${esc(p.bio || '')}</textarea></label>
    <div class="stack"><button class="btn primary block" data-a="profileSave">Salva</button></div>`);
}
async function profileSave() {
  try {
    const r = await comm('profileSave', { city: $('#pfCity').value.trim(), bio: $('#pfBio').value.trim() });
    setCommMe({ ...commMe(), ...r.member }); toast('Profilo salvato'); if (S.view === 'community') render(); profileOpen(r.member.id);
  } catch (e) { toast(commErrMsg(e)); }
}
function rateSheet() {
  const t = S.thread; if (!t) return;
  S.rateStars = (t.myRating || {}).stars || 0;
  openSheet(`<h2>Com'è andata con <span translate="no">${esc(t.nick)}</span>?</h2>
    ${t.titolo ? `<p class="note" translate="no">${esc(t.titolo)}</p>` : ''}
    <div class="field"><span>Il tuo voto</span><div id="rateStars">${starsHTML(S.rateStars, 'rateStar')}</div></div>
    <label class="field"><span>Un commento (facoltativo, lo vedono tutti)</span><textarea id="rateBody" rows="3" maxlength="500" placeholder="Puntuale, disco come descritto, gentilissimo…">${esc((t.myRating || {}).body || '')}</textarea></label>
    <p class="note">Valuta solo come si è comportata la persona nello scambio o nel prestito. Le valutazioni offensive si possono segnalare.</p>
    <div class="stack"><button class="btn primary block" data-a="rateSend">Invia la valutazione</button><button class="more" data-a="rateBack">Torna alla conversazione</button></div>`);
}
async function rateSend() {
  const t = S.thread; if (!t) return;
  if (!S.rateStars) return toast('Scegli da 1 a 5 stelle');
  try { await comm('rate', { thread: t.id, stars: S.rateStars, body: $('#rateBody').value.trim() }); toast('Grazie per la valutazione!'); S.threadOpenId = null; threadOpen(t.id); }
  catch (e) { toast(e.message === 'scambio' ? 'Potete valutarvi dopo che avete scritto entrambi' : commErrMsg(e)); }
}

// ── Ricevuto da un'altra app con Condividi › Spinyl: mandalo a qualcuno, scrivine, o cercalo per la collezione ──
function sharedOpen() {
  const s = S.shared; if (!s) return;
  const link = (s.url || (String(s.text).match(/https?:\/\/\S+/) || [''])[0]).trim();
  const words = String(s.title || s.text || '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
  S.sharedMsg = [words, link].filter(Boolean).join('\n');
  openSheet(`<h2>Condiviso con Spinyl</h2>
    <div class="crev"><p translate="no">${lk(S.sharedMsg || '')}</p></div>
    <div class="newopts">
      ${commMe() ? `<button data-a="sharedChat"><b>💬 <span>Invia a un membro</span></b><span>In un messaggio privato</span></button>
      <button data-a="sharedPost"><b>📝 <span>Scrivi un articolo</span></b><span>Sul blog di un'opera della tua collezione, con il link</span></button>` : ''}
      ${words ? `<button data-a="sharedSearch"><b>🔎 <span>Cerca per la collezione</span></b><span translate="no">${esc(words.slice(0, 80))}</span></button>` : ''}
    </div>`);
}

// ── Modificare ed eliminare i propri commenti, messaggi e articoli ──
const EDIT = new Map(); // id → testo attuale (per riempire il modulo di modifica)
const editedTag = x => x && x.edited ? ' · <i class="edited">modificato</i>' : '';
const editBtn = (kind, id, body, ctx, mini) => { EDIT.set(id, body); return `<button class="${mini ? 'mini' : ''}" data-a="editOpen" data-kind="${kind}" data-id="${esc(id)}" data-ctx="${ctx}">Modifica</button>`; };
const delBtn = (kind, id, ctx) => `<button class="mini" data-a="msgDel" data-kind="${kind}" data-id="${esc(id)}" data-ctx="${ctx}">Elimina</button>`;
// ── Rispondere a un messaggio preciso (chat private, di gruppo e degli eventi) ──
const REPLY = new Map(); // id → { nick, body } del messaggio a cui si può rispondere
const short = (t, n = 90) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const replyBtn = (ctx, m, nick) => { REPLY.set(m.id, { nick: m.mine ? tr('Tu') : nick, body: m.body || offerTxt(m.offer, m.price) || '' }); return `<button class="mini" data-a="replyTo" data-ctx="${ctx}" data-id="${esc(m.id)}">Rispondi</button>`; };
const quoteHTML = m => !m.reply ? '' : m.reply.gone ? `<span class="quote gone">Messaggio eliminato</span>`
  : `<button class="quote" data-a="quoteJump" data-id="${esc(m.reply.id)}"><b translate="no">${m.reply.mine ? '<span>Tu</span>' : esc(m.reply.nick)}</b><span translate="no">${esc(short(m.reply.body))}</span></button>`;
function replyTo(el) {
  const { ctx, id } = el.dataset; const r = REPLY.get(id); if (!r) return;
  S.reply = { ctx, id };
  const bar = $('#replyBar'); if (!bar) return;
  bar.innerHTML = `<div><b>↩ <span>Rispondi a</span> <span translate="no">${esc(r.nick)}</span></b><span translate="no">${esc(short(r.body, 70))}</span></div><button type="button" data-a="replyCancel" aria-label="Annulla">✕</button>`;
  bar.classList.remove('hidden');
  const ta = bar.nextElementSibling && bar.nextElementSibling.querySelector('textarea'); if (ta) ta.focus();
}
function replyCancel() { S.reply = null; const bar = $('#replyBar'); if (bar) { bar.classList.add('hidden'); bar.innerHTML = ''; } }
const replyFor = ctx => (S.reply && S.reply.ctx === ctx ? S.reply.id : undefined);
function quoteJump(el) {
  const t = document.querySelector(`[data-mid="${CSS.escape(el.dataset.id)}"]`);
  if (!t) return toast('Messaggio non più visibile');
  t.scrollIntoView({ behavior: 'smooth', block: 'center' }); t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash');
}
// dopo la modifica si torna dov'eri
function editBack(ctx) {
  if (ctx === 'thread' && S.thread) { S.threadOpenId = null; return threadOpen(S.thread.id); }
  if (ctx === 'event' && S.event) { S.eventOpenId = null; return eventOpen(S.event.event.id); }
  if (ctx === 'group' && S.group) { S.groupOpenId = null; return groupOpen(S.group.id); }
  if (ctx === 'disc' && S.disc) return discussionOpen(S.disc.q);
  if (ctx === 'post' && S.postOpenId) return postOpen(S.postOpenId);
  closeSheet(); const it = byId(S.id); if (it) loadComm(it, true);
}
function editOpen(el) {
  const { kind, id, ctx } = el.dataset; const cur = EDIT.get(id); if (cur == null) return;
  S.edit = { kind, id, ctx };
  const post = kind === 'post'; const body = post ? cur.body : cur;
  const max = { comment: 1000, message: 2000, eventmsg: 1000, post: 8000, gmessage: 2000 }[kind] || 1000;
  openSheet(`<h2>${post ? "Modifica l'articolo" : kind === 'comment' ? 'Modifica il commento' : 'Modifica il messaggio'}</h2>
    ${post ? `<label class="field"><span>Titolo</span><input id="editTitle" maxlength="150" value="${esc(cur.title)}"></label>` : ''}
    <label class="field"><span>Testo</span><textarea id="editText" rows="${post ? 10 : 4}" maxlength="${max}">${esc(body)}</textarea></label>
    <p class="note">Gli altri vedranno la scritta «modificato».</p>
    <div class="stack"><button class="btn primary block" data-a="editSave">Salva</button><button class="more" data-a="editCancel">Annulla</button></div>`);
  const t = $('#editText'); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
}
async function editSave() {
  const e = S.edit; if (!e) return;
  const body = ($('#editText') || {}).value.trim(); const title = ($('#editTitle') || {}).value;
  try { await comm('edit', { kind: e.kind, id: e.id, body, title }); toast('Modificato'); S.edit = null; editBack(e.ctx); }
  catch (er) { toast(er.message === 'vuoto' ? 'Il testo non può essere vuoto' : commErrMsg(er)); }
}
async function msgDel(el) {
  const { kind, id, ctx } = el.dataset;
  if (!confirm(tr('Eliminare il messaggio?'))) return;
  try { await comm('delete', { kind, id }); toast('Eliminato'); editBack(ctx); } catch (e) { toast(commErrMsg(e)); }
}

// ── Proposte e messaggi privati ──
function offerSheet(el) {
  const ctx = el.dataset.m ? (() => { const x = ((S.commMatch || {})[el.dataset.m] || [])[+el.dataset.i]; return x && { work: x.work, tipo: x.tipo, titolo: x.titolo, autore: x.autore, cover: x.cover }; })() : commCtx();
  if (!ctx) return;
  const mode = el.dataset.mode;
  S.offer = { to: el.dataset.to, nick: el.dataset.nick, ctx, kind: mode === 'give' ? 'vendo' : 'compro' };
  const opts = mode === 'give' ? [['vendo', 'Lo vendo'], ['presto', 'Te lo presto'], ['regalo', 'Te lo regalo']] : [['compro', 'Lo compro'], ['prestito', 'Me lo presti?'], ['', 'Solo un messaggio']];
  const mine = ctx.it || live().find(i => workKey(i) === ctx.work && !i.desiderio);
  const pre = mode === 'give' && mine && mine.offerta === 'vendo' && num(mine.prezzoRichiesto) ? num(mine.prezzoRichiesto) : '';
  openSheet(`<h2>${mode === 'give' ? 'Proponi' : 'Chiedi'} a <span translate="no">${esc(el.dataset.nick)}</span></h2>
    <div class="pickcard">${coverMini(ctx)}<div><b translate="no">${esc(ctx.titolo)}</b><span translate="no">${esc(ctx.autore || '')}</span></div></div>
    <div class="seg" id="offerKind">${opts.map(([k, l], i) => `<button type="button" class="${i === 0 ? 'on' : ''}" data-a="offerKind" data-v="${k}">${l}</button>`).join('')}</div>
    <label class="field" id="offerPriceF"><span>Prezzo (€)</span><input id="offerPrice" inputmode="decimal" value="${esc(pre)}"></label>
    <label class="field"><span>Messaggio</span><textarea id="offerText" rows="3" maxlength="2000" placeholder="Ciao! …"></textarea></label>
    <p class="note">Spinyl non gestisce pagamenti né spedizioni: mettetevi d'accordo tra voi e, se vi vedete, scegliete un luogo pubblico.</p>
    <div class="stack"><button class="btn primary block" data-a="offerSend">Invia</button></div>`);
}
function offerKind(el) {
  S.offer.kind = el.dataset.v; el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el));
  const f = $('#offerPriceF'); if (f) f.classList.toggle('hidden', !['vendo', 'compro'].includes(S.offer.kind));
}
async function offerSend() {
  const o = S.offer; if (!o) return;
  const body = ($('#offerText') || {}).value || ''; const price = num(($('#offerPrice') || {}).value);
  if (!o.kind && !body.trim()) return toast('Scrivi un messaggio');
  try {
    const r = await comm('offer', { to: o.to, work: o.ctx.work, titolo: o.ctx.titolo, cover: o.ctx.cover || '', offer: o.kind, price: ['vendo', 'compro'].includes(o.kind) && price ? price : null, body });
    toast('Inviato'); threadOpen(r.thread);
  } catch (e) { toast(e.message === 'bloccato' ? 'Non puoi scrivere a questa persona' : commErrMsg(e)); }
}
let threadPoll = null;
async function threadOpen(id, quiet) {
  let d; try { d = await comm('thread', { id }); } catch (e) { if (!quiet) toast(commErrMsg(e)); return; }
  S.thread = d.thread;
  const canWrite = !d.thread.blocked;
  const msgs = d.messages.map(m => `<div class="msg ${m.mine ? 'mine' : ''}" data-mid="${esc(m.id)}">${quoteHTML(m)}${m.offer ? `<b class="moffer">${esc(offerTxt(m.offer, m.price))}</b>` : ''}${m.body ? `<p translate="no">${lk(m.body)}</p>` : ''}<small>${esc(fmtDateTime(Date.parse(m.at)))}${editedTag(m)}${canWrite ? ' · ' + replyBtn('thread', m, d.thread.nick) : ''}${m.mine ? ' · ' + editBtn('message', m.id, m.body, 'thread', true) + ' · ' + delBtn('message', m.id, 'thread') : ''}</small></div>`).join('');
  const rateBox = d.thread.canRate && !d.thread.blocked ? `<div class="raterow">${d.thread.myRating ? `<span><span>La tua valutazione:</span> <span class="cstars">${'★'.repeat(d.thread.myRating.stars)}<i>${'★'.repeat(5 - d.thread.myRating.stars)}</i></span></span><button class="more" data-a="rateSheet">Modifica</button>`
      : `<span>Vi siete accordati? Com'è andata?</span><button class="btn sm" data-a="rateSheet">⭐ <span>Valuta lo scambio</span></button>`}</div>` : '';
  const html = `<div class="thead2"><div><h2><button class="nick big" data-a="profileOpen" data-id="${esc(d.thread.other)}" translate="no">${esc(d.thread.nick)}</button></h2>${d.thread.titolo ? `<span translate="no">${esc(d.thread.titolo)}</span>` : ''}</div>
      <button class="more" data-a="threadBlock">${d.thread.blocked ? 'Sblocca' : 'Blocca'}</button></div>
    <div id="rateBox">${rateBox}</div>
    <div class="msgs" id="msgs">${msgs}</div>
    ${d.thread.blocked ? '<p class="note">Hai bloccato questa persona: non può scriverti.</p>' : `<div class="replybar hidden" id="replyBar"></div><form class="composer" id="msgForm"><textarea id="msgText" rows="1" maxlength="2000" placeholder="Scrivi…"></textarea><button type="submit">Invia</button></form>`}
    <p class="note">Spinyl non gestisce pagamenti né spedizioni: mettetevi d'accordo tra voi e, se vi vedete, scegliete un luogo pubblico.</p>`;
  const open = $('#msgs') && S.threadOpenId === id;
  if (open) { const m = $('#msgs'); const atEnd = m.scrollTop + m.clientHeight >= m.scrollHeight - 30; m.innerHTML = msgs; if (atEnd) m.scrollTop = m.scrollHeight; const rb = $('#rateBox'); if (rb && rb.innerHTML !== rateBox) rb.innerHTML = rateBox; }
  else {
    S.threadOpenId = id; S.reply = null; openSheet(html);
    const m = $('#msgs'); if (m) m.scrollTop = m.scrollHeight;
    const f = $('#msgForm'); if (f) f.addEventListener('submit', async e => {
      e.preventDefault(); const ta = $('#msgText'); const body = ta.value.trim(); if (!body) return;
      const reply = replyFor('thread');
      ta.value = ''; try { await comm('send', { thread: id, body, reply }); replyCancel(); threadOpen(id, true); } catch (er) { ta.value = body; toast(er.message === 'bloccato' ? 'Non puoi scrivere a questa persona' : commErrMsg(er)); }
    });
    clearInterval(threadPoll);
    threadPoll = setInterval(() => { if ($('#sheetWrap').classList.contains('hidden') || S.threadOpenId !== id || !$('#msgs')) { clearInterval(threadPoll); S.threadOpenId = null; return; } if (document.visibilityState === 'visible') threadOpen(id, true); }, 20000);
  }
  if (S.view === 'community' && S.commSeg === 'messaggi' && !quiet) loadCommunity();
}
// ── Chat di gruppo: più membri nella stessa conversazione ──
let groupPoll = null;
async function groupNew(preselect) {
  let mem; try { mem = (await comm('members')).members || []; } catch (e) { return toast(commErrMsg(e)); }
  S.groupPick = new Set(preselect ? [preselect] : []);
  openSheet(`<h2>Nuovo gruppo</h2>
    <label class="field"><span>Nome del gruppo</span><input id="grpName" maxlength="60" placeholder="es. Vinili jazz Alessandria"></label>
    <h4 class="csub">Chi aggiungi</h4>
    <div class="picklist">${mem.map(m => `<label class="check"><input type="checkbox" data-gpick="${esc(m.id)}" ${S.groupPick.has(m.id) ? 'checked' : ''}> <span translate="no">${esc(m.nick)}</span>${m.city ? ` <small translate="no">· ${esc(m.city)}</small>` : ''}</label>`).join('') || '<p class="note">Nessun altro membro, per ora: invita i tuoi amici nella community.</p>'}</div>
    <p class="note">Fino a 50 persone. Chi è nel gruppo può aggiungere altri membri.</p>
    <div class="stack"><button class="btn primary block" data-a="groupCreate">Crea il gruppo</button></div>`);
  document.querySelectorAll('[data-gpick]').forEach(c => c.addEventListener('change', () => c.checked ? S.groupPick.add(c.dataset.gpick) : S.groupPick.delete(c.dataset.gpick)));
}
async function groupCreate() {
  const name = ($('#grpName') || {}).value.trim();
  if (name.length < 2) return toast('Dai un nome al gruppo');
  if (!S.groupPick || !S.groupPick.size) return toast('Scegli almeno una persona');
  try { const r = await comm('groupCreate', { name, members: [...S.groupPick] }); toast('Gruppo creato'); S.commSeg = 'messaggi'; if (S.view === 'community') loadCommunity(); groupOpen(r.id); }
  catch (e) { toast(e.message === 'troppi' ? 'Hai creato molti gruppi oggi: riprova domani' : commErrMsg(e)); }
}
async function groupOpen(id, quiet) {
  let d; try { d = await comm('group', { id }); } catch (e) { if (!quiet) toast(e.message === 'gruppo' ? 'Non fai più parte di questo gruppo' : commErrMsg(e)); return; }
  S.group = d.group;
  const msgs = d.messages.map(m => `<div class="msg ${m.mine ? 'mine' : ''}" data-mid="${esc(m.id)}">${m.mine ? '' : `<b class="gnick">${nickBtn(m.member, m.nick)}</b>`}${quoteHTML(m)}<p translate="no">${lk(m.body)}</p><small>${esc(fmtDateTime(Date.parse(m.at)))}${editedTag(m)} · ${replyBtn('group', m, m.nick)}${m.mine ? ' · ' + editBtn('gmessage', m.id, m.body, 'group', true) + ' · ' + delBtn('gmessage', m.id, 'group') : ''}</small></div>`).join('')
    || '<p class="note" style="text-align:center">Scrivi il primo messaggio del gruppo.</p>';
  const names = d.group.members.filter(x => !x.me).map(x => x.nick);
  const html = `<div class="thead2"><div><h2 translate="no">👥 ${esc(d.group.name)}</h2><button class="more" data-a="groupInfo"><span translate="no">${esc(names.slice(0, 4).join(', '))}${names.length > 4 ? '…' : ''}</span> · <span>${d.group.members.length} membri</span> ›</button></div></div>
    <div class="msgs" id="gmsgs">${msgs}</div>
    <div class="replybar hidden" id="replyBar"></div><form class="composer" id="gmsgForm"><textarea id="gmsgText" rows="1" maxlength="2000" placeholder="Scrivi al gruppo…"></textarea><button type="submit">Invia</button></form>`;
  if ($('#gmsgs') && S.groupOpenId === id) { const m = $('#gmsgs'); const atEnd = m.scrollTop + m.clientHeight >= m.scrollHeight - 30; m.innerHTML = msgs; if (atEnd) m.scrollTop = m.scrollHeight; }
  else {
    S.groupOpenId = id; S.reply = null; openSheet(html);
    const m = $('#gmsgs'); if (m) m.scrollTop = m.scrollHeight;
    $('#gmsgForm').addEventListener('submit', async e => {
      e.preventDefault(); const ta = $('#gmsgText'); const body = ta.value.trim(); if (!body) return;
      const reply = replyFor('group');
      ta.value = ''; try { await comm('groupSend', { id, body, reply }); replyCancel(); groupOpen(id, true); } catch (er) { ta.value = body; toast(commErrMsg(er)); }
    });
    clearInterval(groupPoll);
    groupPoll = setInterval(() => { if ($('#sheetWrap').classList.contains('hidden') || S.groupOpenId !== id || !$('#gmsgs')) { clearInterval(groupPoll); S.groupOpenId = null; return; } if (document.visibilityState === 'visible') groupOpen(id, true); }, 15000);
  }
  if (S.view === 'community' && S.commSeg === 'messaggi' && !quiet) loadCommunity();
}
async function groupInfo() {
  const g = S.group; if (!g) return;
  S.groupOpenId = null;
  openSheet(`<h2 translate="no">👥 ${esc(g.name)}</h2>
    ${g.admin ? '<div class="stack"><button class="btn block" data-a="groupRename">Rinomina il gruppo</button></div>' : ''}
    <h4 class="csub"><span>Membri</span> (${g.members.length})</h4>
    ${g.members.map(x => `<div class="prow2"><div>${x.me ? `<b translate="no">${esc(x.nick)}</b> <small>(tu)</small>` : nickBtn(x.id, x.nick)}${x.admin ? ' <small>· amministratore</small>' : ''}</div>${g.admin && !x.me ? `<button class="btn sm" data-a="groupRemove" data-id="${esc(x.id)}" data-nick="${esc(x.nick)}">Rimuovi</button>` : ''}</div>`).join('')}
    <div class="stack"><button class="btn primary block" data-a="groupAddSheet">➕ <span>Aggiungi persone</span></button>
      <button class="btn block" data-a="groupBack">Torna alla chat</button>
      <button class="btn danger block" data-a="groupLeave">Esci dal gruppo</button></div>`);
}
async function groupAddSheet() {
  const g = S.group; if (!g) return;
  let mem; try { mem = (await comm('members')).members || []; } catch (e) { return toast(commErrMsg(e)); }
  const inside = new Set(g.members.map(x => x.id)); const sel = new Set();
  const others = mem.filter(m => !inside.has(m.id));
  openSheet(`<h2>Aggiungi al gruppo</h2>${others.map(m => `<label class="check"><input type="checkbox" data-gadd="${esc(m.id)}"> <span translate="no">${esc(m.nick)}</span></label>`).join('') || '<p class="note">Sono già tutti nel gruppo.</p>'}
    <div class="stack"><button class="btn primary block" id="gAddGo">Aggiungi</button><button class="more" data-a="groupInfo">Annulla</button></div>`);
  document.querySelectorAll('[data-gadd]').forEach(c => c.addEventListener('change', () => c.checked ? sel.add(c.dataset.gadd) : sel.delete(c.dataset.gadd)));
  $('#gAddGo').addEventListener('click', async () => {
    if (!sel.size) return toast('Scegli almeno una persona');
    try { const r = await comm('groupAdd', { id: g.id, members: [...sel] }); toast(r.added ? 'Aggiunti al gruppo' : 'Nessuno aggiunto'); groupOpen(g.id); } catch (e) { toast(commErrMsg(e)); }
  });
}
async function threadBlock() {
  const t = S.thread; if (!t) return;
  if (!t.blocked && !confirm(tr('Bloccare questa persona? Non potrà più scriverti e non vedrai più i suoi contenuti.'))) return;
  try { await comm('block', { member: t.other, off: t.blocked }); toast(t.blocked ? 'Sbloccato' : 'Bloccato'); S.threadOpenId = null; closeSheet(); if (S.view === 'community') loadCommunity(); } catch (e) { toast(commErrMsg(e)); }
}
// Controllo leggero di messaggi, inviti e notifiche. Con le notifiche push attive basta raramente:
// le novità arrivano col push (e il service worker avvisa l'app aperta).
const COMM_GAP = () => (pushOn() ? 5 : 3) * 60e3;
async function commUnreadCheck(minGap) {
  if (!commMe() || !Drive.token() || Date.now() - (S.commUnreadAt || 0) < (minGap ?? COMM_GAP() - 5e3)) return;
  S.commUnreadAt = Date.now();
  try { const r = await comm('unread'); S.commUnread = r.unread || 0; S.commInvites = r.invites || 0; S.commNotifs = r.notifs || 0; commBadges(); } catch (e) {}
}

// ── Eventi: dal vivo, online o ascolto in diretta, con inviti e risposte ──
const EV_KIND = { vivo: ['📍', 'Dal vivo'], online: ['💻', 'Online'], ascolto: ['🎧', 'Ascolto in diretta'] };
const evDate = iso => new Date(iso);
const evWhen = iso => evDate(iso).toLocaleString(LOC(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const evLive = e => { const t = +evDate(e.starts); return Date.now() > t - 15 * 60e3 && Date.now() < t + 3 * 3600e3; };
const RSVP = [['si', 'Partecipo'], ['forse', 'Forse'], ['no', 'Non vengo']];
function evCard(e) {
  const d = evDate(e.starts); const [ico, kl] = EV_KIND[e.kind] || EV_KIND.vivo;
  const chip = e.my === 'si' ? '<i class="evchip ok">✓ <span>Partecipi</span></i>' : e.my === 'forse' ? '<i class="evchip">Forse</i>' : e.invited && !e.my ? '<i class="evchip inv">Sei invitato</i>' : '';
  return `<button class="evcard" data-a="eventOpen" data-id="${esc(e.id)}"><div class="evdate"><b>${d.getDate()}</b><span>${esc(d.toLocaleDateString(LOC(), { month: 'short' }))}</span></div>
    <div class="evbody"><b translate="no">${esc(e.title)}</b><span>${ico} <span>${kl}</span> · ${esc(d.toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit' }))}${e.place ? ` · <span translate="no">${esc(e.place)}</span>` : ''}</span>
    <span>${evLive(e) ? '<i class="evchip live">● <span>In corso</span></i> ' : ''}${chip} <span>${e.going === 1 ? '1 partecipa' : e.going + ' partecipano'}</span></span></div>
    ${e.cover ? coverMini(e) : ''}</button>`;
}
async function loadEvents(box) {
  const d = await comm('events'); S.commEvents = d;
  if (!box() || S.commSeg !== 'eventi') return;
  let near = false; try { near = localStorage.getItem('nearEv') === '1' && !!myCity(); } catch (e) {}
  const here = e => !near || e.kind !== 'vivo' || sameCity(e.city, myCity()) || norm(e.place || '').includes(norm(myCity()));
  const up = d.upcoming.filter(here);
  box().innerHTML = `<div class="stack"><button class="btn primary block" data-a="eventNew">${ic('plus', 18)}Crea un evento</button></div>
    ${myCity() ? `<label class="field inline swtoggle"><span>Dal vivo solo nella mia città</span><input type="checkbox" id="nearEvT" ${near ? 'checked' : ''}></label>` : ''}
    ${up.map(evCard).join('') || emptyHTML('📅', 'Nessun evento in programma', 'Crea il primo: un ascolto in diretta di un disco, un club del libro, un cineforum, un mercatino di scambio… e invita chi vuoi.', [['commInvite', 'Invita un amico']])}
    ${d.past.length ? `<h3 class="chtitle">Passati</h3>${d.past.map(evCard).join('')}` : ''}`;
  const nt = $('#nearEvT'); if (nt) nt.addEventListener('change', () => { try { localStorage.setItem('nearEv', nt.checked ? '1' : '0'); } catch (e) {} loadEvents(box); });
  hydratePhotos(box());
}
function eventNew(prefill) {
  const ctx = prefill || null;
  const t = new Date(Date.now() + 7 * 864e5); t.setHours(21, 0, 0, 0);
  const local = new Date(t - t.getTimezoneOffset() * 60e3).toISOString().slice(0, 16);
  S.evDraft = { kind: ctx && isMusic(ctx.tipo) ? 'ascolto' : 'vivo', visibility: 'all', ctx, invite: new Set() };
  const mine = live().slice().sort((a, b) => String(a.titolo).localeCompare(String(b.titolo)));
  openSheet(`<h2>Nuovo evento</h2>
    <label class="field"><span>Titolo</span><input id="evTitle" maxlength="120" value="${ctx ? esc((isMusic(ctx.tipo) ? tr('Ascoltiamo') : ctx.tipo === 'film' ? tr('Guardiamo') : tr('Club del libro:')) + ' ' + ctx.titolo) : ''}" placeholder="es. Serata vinili anni '70"></label>
    <div class="seg" id="evKind">${Object.entries(EV_KIND).map(([k, [i, l]]) => `<button type="button" class="${S.evDraft.kind === k ? 'on' : ''}" data-a="evKind" data-v="${k}">${i} ${l}</button>`).join('')}</div>
    <label class="field"><span>Quando</span><input id="evWhen" type="datetime-local" value="${local}"></label>
    <label class="field ${S.evDraft.kind === 'vivo' ? '' : 'hidden'}" id="evPlaceF"><span>Dove</span><input id="evPlace" maxlength="200" placeholder="es. Bar Roma, Alessandria"></label>
    <label class="field ${S.evDraft.kind === 'vivo' ? 'hidden' : ''}" id="evLinkF"><span>Link della videochiamata (facoltativo)</span><input id="evLink" maxlength="500" inputmode="url" placeholder="https://meet.google.com/…"></label>
    <label class="field"><span>Opera collegata (facoltativo)</span><input id="evWork" list="evWorks" value="${ctx ? esc(ctx.titolo) : ''}" autocomplete="off"></label>
    <datalist id="evWorks" translate="no">${mine.map(i => `<option value="${esc(i.titolo)}">`).join('')}</datalist>
    <label class="field"><span>Descrizione</span><textarea id="evBody" rows="4" maxlength="4000" placeholder="Cosa faremo, cosa portare…"></textarea></label>
    <div class="seg" id="evVis"><button type="button" class="on" data-a="evVis" data-v="all">Tutta la community</button><button type="button" data-a="evVis" data-v="invite">Solo invitati</button></div>
    <h4 class="csub">Invita</h4><div id="evMembers">${loadingHTML('Carico i membri…')}</div>
    <div class="stack"><button class="btn primary block" data-a="eventCreate">Crea evento</button></div>`);
  comm('members').then(d => {
    const b = $('#evMembers'); if (!b) return;
    b.innerHTML = (d.members || []).map(m => `<label class="check"><input type="checkbox" data-mem="${esc(m.id)}"> <span translate="no">${esc(m.nick)}</span></label>`).join('') || '<p class="note">Nessun altro membro, per ora: invita i tuoi amici nella community.</p>';
    b.querySelectorAll('[data-mem]').forEach(c => c.addEventListener('change', () => c.checked ? S.evDraft.invite.add(c.dataset.mem) : S.evDraft.invite.delete(c.dataset.mem)));
  }).catch(() => { const b = $('#evMembers'); if (b) b.innerHTML = ''; });
}
function evPick(group, el) { el.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === el)); S.evDraft[group] = el.dataset.v;
  if (group === 'kind') { $('#evPlaceF').classList.toggle('hidden', el.dataset.v !== 'vivo'); $('#evLinkF').classList.toggle('hidden', el.dataset.v === 'vivo'); } }
async function eventCreate() {
  const d = S.evDraft; if (!d) return;
  const title = $('#evTitle').value.trim(); const when = $('#evWhen').value;
  if (title.length < 2) return toast('Scrivi un titolo');
  if (!when || isNaN(+new Date(when))) return toast('Scegli data e ora');
  if (d.visibility === 'invite' && !d.invite.size) return toast('Scegli chi invitare');
  const wt = $('#evWork').value.trim();
  const it = wt && (d.ctx && d.ctx.titolo === wt ? (d.ctx.it || d.ctx) : live().find(i => i.titolo === wt));
  const w = it ? { work: it.work || workKey(it), tipo: it.tipo, titolo: it.titolo, autore: it.autore || '', cover: it.cover || (/^https:/.test(it.coverUrl || '') ? it.coverUrl : '') } : {};
  const link = ($('#evLink').value || '').trim();
  if (link && !/^https:\/\//.test(link)) return toast('Il link deve iniziare con https://');
  try {
    const r = await comm('eventCreate', { title, kind: d.kind, starts: new Date(when).toISOString(), place: d.kind === 'vivo' ? $('#evPlace').value : '', link: d.kind === 'vivo' ? '' : link,
      body: $('#evBody').value, visibility: d.visibility, invite: [...d.invite], ...w });
    toast('Evento creato'); S.commSeg = 'eventi'; eventOpen(r.id); if (S.view === 'community') loadCommunity();
  } catch (e) { toast(e.message === 'data' ? 'Data non valida' : commErrMsg(e)); }
}
let evPoll = null;
async function eventOpen(id, quiet) {
  let d; try { d = await comm('eventGet', { id }); } catch (e) { if (!quiet) toast(commErrMsg(e)); return; }
  const e = d.event; S.event = d; const live = evLive(e); const [ico, kl] = EV_KIND[e.kind] || EV_KIND.vivo;
  const my = (d.rsvps.find(r => r.mine) || {}).status || '';
  const going = d.rsvps.filter(r => r.status === 'si'), maybe = d.rsvps.filter(r => r.status === 'forse');
  const mineItem = e.work && live && liveItemsByWork(e.work);
  const tracks = mineItem && mineItem.tracklist ? String(mineItem.tracklist).split('\n').map(t => t.trim()).filter(Boolean).slice(0, 60) : [];
  const admin = (commMe() || {}).admin;
  const msgs = d.messages.map(m => `<div class="emsg ${m.mine ? 'mine' : ''}" data-mid="${esc(m.id)}">${quoteHTML(m)}<b translate="no">${esc(m.nick)}</b> <span translate="no">${lk(m.body)}</span><small>${esc(new Date(m.at).toLocaleTimeString(LOC(), { hour: '2-digit', minute: '2-digit' }))}${editedTag(m)} · ${replyBtn('event', m, m.nick)}${m.mine ? ' · ' + editBtn('eventmsg', m.id, m.body, 'event', true) : ''}${m.mine || admin ? ' · ' + delBtn('eventmsg', m.id, 'event') : ''}</small></div>`).join('');
  if (quiet && $('#emsgs') && S.eventOpenId === id) { const m = $('#emsgs'); const end = m.scrollTop + m.clientHeight >= m.scrollHeight - 30; m.innerHTML = msgs || ''; if (end) m.scrollTop = m.scrollHeight; return; }
  S.eventOpenId = id;
  openSheet(`<div class="evhead">${e.cover ? coverMini(e) : ''}<div><span class="ctag">${ico} <span>${kl}</span>${live ? ' · <i class="evchip live">● <span>In corso</span></i>' : ''}</span><h2 translate="no">${esc(e.title)}</h2>
      <span>${esc(evWhen(e.starts))}</span>${e.place ? `<span translate="no">📍 ${esc(e.place)}</span>` : ''}${e.titolo ? `<span translate="no">${esc([e.titolo, e.autore].filter(Boolean).join(' · '))}</span>` : ''}
      <span><span>Organizza</span> ${nickBtn(e.member, e.nick)}${e.visibility === 'invite' ? ' · <span>solo invitati</span>' : ''}</span></div></div>
    ${e.body ? `<p class="prose" translate="no">${lk(e.body)}</p>` : ''}
    ${e.link ? `<a class="btn block" href="${esc(e.link)}" target="_blank" rel="noopener">${ic('play', 18)}Entra nella videochiamata</a>` : ''}
    <div class="seg evrsvp">${RSVP.map(([k, l]) => `<button class="${my === k ? 'on' : ''}" data-a="rsvp" data-v="${k}">${l}</button>`).join('')}</div>
    <p class="note">${going.length ? `<span>Partecipano:</span> <span translate="no">${going.map(r => esc(r.nick)).join(', ')}</span>` : '<span>Ancora nessuno ha confermato.</span>'}${maybe.length ? `<br><span>Forse:</span> <span translate="no">${maybe.map(r => esc(r.nick)).join(', ')}</span>` : ''}</p>
    <div class="cacts evacts"><button data-a="eventIcs">📅 <span>Aggiungi al calendario</span></button>${e.mine ? '<button data-a="eventInvite">➕ <span>Invita</span></button>' : ''}<button data-a="eventShare">↗ <span>Condividi</span></button>
      ${e.mine || (commMe() || {}).admin ? '<button data-a="eventDel">Elimina</button>' : '<button data-a="commReport" data-kind="event" data-id="' + esc(e.id) + '">Segnala</button>'}</div>
    <h4 class="csub">${live && e.kind === 'ascolto' ? '🎧 <span>Commenti in diretta</span>' : 'Chat dell\'evento'}</h4>
    <div class="emsgs" id="emsgs">${msgs || ''}</div>
    ${tracks.length ? `<select id="evTrack" class="evtrack"><option value="">Traccia…</option>${tracks.map(t => `<option translate="no">${esc(t.replace(/\s*\(\d+:\d+\)$/, ''))}</option>`).join('')}</select>` : ''}
    <div class="replybar hidden" id="replyBar"></div><form class="composer" id="evForm"><textarea id="evText" rows="1" maxlength="1000" placeholder="${live && e.kind === 'ascolto' ? tr('Cosa ti dice questo pezzo?') : tr('Scrivi…')}"></textarea><button type="submit">Invia</button></form>`);
  S.reply = null;
  const m = $('#emsgs'); if (m) m.scrollTop = m.scrollHeight;
  $('#evForm').addEventListener('submit', async ev => {
    ev.preventDefault(); const ta = $('#evText'); let body = ta.value.trim(); if (!body) return;
    const tr_ = $('#evTrack'); if (tr_ && tr_.value) body = '[' + tr_.value + '] ' + body;
    const reply = replyFor('event');
    ta.value = ''; try { await comm('eventMsg', { id, body, reply }); replyCancel(); eventOpen(id, true); } catch (er) { ta.value = body; toast(commErrMsg(er)); }
  });
  clearInterval(evPoll);
  evPoll = setInterval(() => { if ($('#sheetWrap').classList.contains('hidden') || S.eventOpenId !== id || !$('#emsgs')) { clearInterval(evPoll); S.eventOpenId = null; return; } if (document.visibilityState === 'visible') eventOpen(id, true); }, live ? 5000 : 60000);
}
const liveItemsByWork = w => live().find(i => workKey(i) === w && !i.desiderio);
async function rsvp(v) {
  const d = S.event; if (!d) return;
  try { await comm('rsvp', { id: d.event.id, status: v }); toast(v === 'si' ? 'Ci sarai!' : v === 'forse' ? 'Segnato come forse' : 'Segnato: non vieni'); S.eventOpenId = null; eventOpen(d.event.id); S.commUnreadAt = 0; commUnreadCheck(); if (S.view === 'community') loadCommunity(); }
  catch (e) { toast(commErrMsg(e)); }
}
function eventIcs() {
  const e = S.event && S.event.event; if (!e) return;
  const f = t => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const x = s => String(s || '').replace(/[\;,]/g, m => '\\' + m).replace(/\n/g, '\\n');
  const start = Date.parse(e.starts);
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Spinyl//IT', 'BEGIN:VEVENT', `UID:${e.id}@spinyl`, `DTSTAMP:${f(Date.now())}`, `DTSTART:${f(start)}`, `DTEND:${f(start + 2 * 3600e3)}`,
    `SUMMARY:${x(e.title)}`, `DESCRIPTION:${x([e.body, e.titolo && (e.titolo + (e.autore ? ' — ' + e.autore : '')), 'Spinyl'].filter(Boolean).join('\n\n'))}`,
    e.place ? `LOCATION:${x(e.place)}` : '', e.link ? `URL:${e.link}` : '', 'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:${x(e.title)}`, 'END:VALARM',
    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', `DESCRIPTION:${x(e.title)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].filter(Boolean).join('\r\n');
  if (/iPhone|iPad|iPod/.test(navigator.userAgent)) { location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics); return; }
  saveFile(new File([ics], 'spinyl-evento.ics', { type: 'text/calendar' }), e.title);
}
async function eventInvite() {
  const d = S.event; if (!d) return;
  const already = new Set(d.invited.map(i => i.id));
  let mem; try { mem = (await comm('members')).members || []; } catch (e) { return toast(commErrMsg(e)); }
  const sel = new Set();
  openSheet(`<h2>Invita</h2>${mem.filter(m => !already.has(m.id)).map(m => `<label class="check"><input type="checkbox" data-mem="${esc(m.id)}"> <span translate="no">${esc(m.nick)}</span></label>`).join('') || '<p class="note">Hai già invitato tutti.</p>'}
    <div class="stack"><button class="btn primary block" id="invGo">Invita</button></div>`);
  document.querySelectorAll('[data-mem]').forEach(c => c.addEventListener('change', () => c.checked ? sel.add(c.dataset.mem) : sel.delete(c.dataset.mem)));
  $('#invGo').addEventListener('click', async () => {
    const e = d.event;
    try { await comm('eventEdit', { id: e.id, title: e.title, body: e.body, kind: e.kind, starts: e.starts, place: e.place, link: e.link, work: e.work, tipo: e.tipo, titolo: e.titolo, autore: e.autore, cover: e.cover, visibility: e.visibility, invite: [...sel] });
      toast('Invitati'); S.eventOpenId = null; eventOpen(e.id); } catch (er) { toast(commErrMsg(er)); }
  });
}
async function eventDel() {
  const d = S.event; if (!d || !confirm(tr('Eliminare l\'evento?'))) return;
  try { await comm('eventDelete', { id: d.event.id }); closeSheet(); toast('Eliminato'); if (S.view === 'community') loadCommunity(); } catch (e) { toast(commErrMsg(e)); }
}
function eventShare() {
  const e = S.event && S.event.event; if (!e) return;
  shareText(`${e.title} — ${evWhen(e.starts)}${e.place ? ' · ' + e.place : ''}\n${tr('Rispondi su Spinyl, nella Community › Eventi')}: ${location.origin + location.pathname.replace(/index\.html$/, '')}`, e.title);
}

// ── "Nuovo" nella Community: conversazione, condividi un pezzo, articolo, evento ──
function commNew() {
  openSheet(`<h2>Nuovo</h2><div class="newopts">
    <button data-a="newChat"><b>💬 <span>Nuova conversazione</span></b><span>Scrivi a un membro della community</span></button>
    <button data-a="groupNew"><b>👥 <span>Nuovo gruppo</span></b><span>Una chat con più membri: club del libro, amici del vinile, organizzare uno scambio</span></button>
    <button data-a="newShare"><b>📀 <span>Condividi un pezzo</span></b><span>Mostra un pezzo della tua collezione con un commento, o mettilo in vendita, in prestito, in regalo</span></button>
    <button data-a="newPost"><b>📝 <span>Scrivi un articolo</span></b><span>Nel blog di un disco, libro o film</span></button>
    <button data-a="eventNew"><b>📅 <span>Crea un evento</span></b><span>Serata, club del libro, mercatino o ascolto in diretta</span></button></div>`);
}
async function newChat(toId) {
  let mem; try { mem = (await comm('members')).members || []; } catch (e) { return toast(commErrMsg(e)); }
  openSheet(`<h2>Nuova conversazione</h2>
    <label class="field"><span>A chi</span><select id="chatTo"><option value=""></option>${mem.map(m => `<option value="${esc(m.id)}" ${m.id === toId ? 'selected' : ''} translate="no">${esc(m.nick)}${m.city ? ' · ' + esc(m.city) : ''}</option>`).join('')}</select></label>
    ${mem.length ? '' : '<p class="note">Nessun altro membro, per ora: invita i tuoi amici nella community.</p>'}
    <label class="field"><span>Messaggio</span><textarea id="chatText" rows="4" maxlength="2000"></textarea></label>
    <div class="stack"><button class="btn primary block" id="chatGo">Invia</button></div>`);
  $('#chatGo').addEventListener('click', async () => {
    const to = $('#chatTo').value, body = $('#chatText').value.trim();
    if (!to) return toast('Scegli a chi scrivere'); if (!body) return toast('Scrivi un messaggio');
    try { const r = await comm('offer', { to, work: '', titolo: '', body }); toast('Inviato'); S.commSeg = 'messaggi'; threadOpen(r.thread); if (S.view === 'community') loadCommunity(); }
    catch (e) { toast(e.message === 'bloccato' ? 'Non puoi scrivere a questa persona' : commErrMsg(e)); }
  });
}
// scegli un pezzo della collezione (con ricerca)
function pickItem(title, onPick) {
  const L = live().slice().sort((a, b) => String(a.titolo).localeCompare(String(b.titolo)));
  if (!L.length) return toast('La collezione è vuota: aggiungi prima qualche pezzo');
  S.pickCb = onPick;
  openSheet(`<h2>${title}</h2><label class="field"><input id="pickQ" placeholder="Cerca nella collezione…" autocomplete="off"></label><div id="pickList" class="picklist"></div>`);
  const draw = () => {
    const q = norm($('#pickQ').value);
    $('#pickList').innerHTML = L.filter(i => !q || norm(i.titolo + ' ' + (i.autore || '')).includes(q)).slice(0, 60).map(i => `<button class="crow t-${esc(i.tipo)}" data-a="pickDo" data-id="${esc(i.id)}">${coverHTML(i)}<div><b translate="no">${esc(i.titolo)}</b><span translate="no">${esc([i.autore, i.anno].filter(Boolean).join(' · '))}</span>${i.desiderio ? '<span>Desiderio</span>' : ''}</div></button>`).join('');
    hydratePhotos($('#pickList'));
  };
  $('#pickQ').addEventListener('input', draw); draw();
}
function newShare() {
  pickItem(tr('Quale pezzo vuoi condividere?'), it => {
    S.shareId = it.id;
    openSheet(`<h2>Condividi</h2><div class="pickcard">${coverHTML(it)}<div><b translate="no">${esc(it.titolo)}</b><span translate="no">${esc(it.autore || '')}</span></div></div>
      <label class="field"><span>Il tuo commento</span><textarea id="shNote" rows="3" maxlength="300" placeholder="Perché lo ami, com'è la stampa, un ricordo…">${esc(it.notaCommunity || '')}</textarea></label>
      ${it.desiderio ? '' : `<label class="field"><span>Disponibile per</span><select id="shOffer">${OFFERTE.map(([k, l]) => `<option value="${k}" ${it.offerta === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <label class="field"><span>Prezzo richiesto (€)</span><input id="shPrice" inputmode="decimal" value="${esc(it.prezzoRichiesto || '')}"></label>`}
      <div class="stack"><button class="btn primary block" id="shGo">Condividi</button></div>`);
    hydratePhotos($('#sheet'));
    $('#shGo').addEventListener('click', async () => {
      const x = byId(S.shareId); if (!x) return;
      x.condiviso = true; x.notaCommunity = $('#shNote').value.trim();
      if (!x.desiderio) { x.offerta = $('#shOffer').value; x.prezzoRichiesto = $('#shPrice').value; }
      await saveItem(x); clearTimeout(commSharesT);
      try { await commSyncShares(true); toast('Condiviso con la community'); closeSheet(); S.commSeg = 'bacheca'; if (S.view === 'community') loadCommunity(); } catch (e) { toast(commErrMsg(e)); }
    });
  });
}
function newPost() {
  pickItem(tr('Su quale opera vuoi scrivere?'), it => { S.commWork = { work: workKey(it), tipo: it.tipo, titolo: it.titolo, autore: it.autore || '', cover: /^https:/.test(it.coverUrl || '') ? it.coverUrl : '', own: !it.desiderio, it }; postSheet(); });
}

// ── Notifiche: campanella in Community, pallino sulla linguetta, suono quando arriva qualcosa di nuovo ──
const commTotal = () => (S.commUnread || 0) + (S.commInvites || 0) + (S.commNotifs || 0);
function commBadges() {
  const n = commTotal();
  const tab = $('.maintabs [data-v=community]'); if (tab) tab.innerHTML = 'Community' + (n ? `<i class="badge">${n}</i>` : '');
  const bell = $('.bell'); if (bell) bell.innerHTML = '🔔' + (S.commNotifs ? `<i class="badge">${S.commNotifs}</i>` : '');
  const seg = $('.cseg [data-v=messaggi]'); if (seg) seg.innerHTML = tr('Messaggi') + (S.commUnread ? `<i class="badge">${S.commUnread}</i>` : '');
  if (S.commPrevTotal != null && n > S.commPrevTotal) commDing();
  S.commPrevTotal = n;
  appBadge(n);
}
// Numero rosso sull'icona dell'app nella schermata Home (iPhone con iOS 16.4+ e app aggiunta alla Home, Android, computer)
function appBadge(n) {
  try {
    if (!('setAppBadge' in navigator)) return;
    if (n > 0) navigator.setAppBadge(n).catch(() => {}); else navigator.clearAppBadge().catch(() => {});
  } catch (e) {}
}
const soundOn = () => { try { return localStorage.getItem('commSound') !== '0'; } catch (e) { return true; } };
let audioCtx = null;
// il telefono permette i suoni solo dopo un tocco: preparo l'audio al primo tocco
document.addEventListener('pointerdown', () => { if (!audioCtx && (window.AudioContext || window.webkitAudioContext)) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} } else if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {}); }, { passive: true });
function commDing() {
  if (navigator.vibrate) try { navigator.vibrate([60, 40, 60]); } catch (e) {}
  if (!soundOn() || !audioCtx) return;
  try {
    const t = audioCtx.currentTime;
    [[880, 0], [1320, 0.12]].forEach(([f, d]) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.25, t + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.35);
      o.connect(g).connect(audioCtx.destination); o.start(t + d); o.stop(t + d + 0.4);
    });
  } catch (e) {}
}
setInterval(() => { if (document.visibilityState === 'visible') commUnreadCheck(); }, 60e3); // controlla ogni minuto se è passato abbastanza tempo
const OFFER_VERB = { vendo: 'in vendita', presto: 'in prestito', regalo: 'in regalo' };
function notifText(x) {
  const d = x.data || {}; const t = `«${d.titolo || d.title || ''}»`; const who = `<b translate="no">${esc(x.nick || '?')}</b>`;
  const what = { review: 'la tua recensione di', post: 'il tuo articolo su', share: 'il tuo pezzo condiviso' }[d.type] || '';
  const T = `<span translate="no">${esc(t)}</span>`;
  if (x.kind === 'comment') return `${who} <span>ha commentato ${what}</span> ${T}${d.body ? `: <i translate="no">“${esc(d.body)}”</i>` : ''}`;
  if (x.kind === 'reply') return `${who} <span>ha commentato anche lui su</span> ${T}${d.body ? `: <i translate="no">“${esc(d.body)}”</i>` : ''}`;
  if (x.kind === 'invite') return `${who} <span>ti ha invitato a</span> <span translate="no">«${esc(d.title || '')}»</span>${d.starts ? ` · ${esc(evWhen(d.starts))}` : ''}`;
  if (x.kind === 'rsvp') return `${who} <span>partecipa al tuo evento</span> <span translate="no">«${esc(d.title || '')}»</span>`;
  if (x.kind === 'offer') return `${who} <span>ha messo ${OFFER_VERB[d.offer] || 'a disposizione'}</span> ${T}${d.price != null && d.offer === 'vendo' ? ' · ' + esc(money(+d.price)) : ''} <span>che cerchi</span>`;
  if (x.kind === 'post') return `${who} <span>ha scritto un articolo su</span> ${T}`;
  if (x.kind === 'rating') return `${who} <span>ha valutato lo scambio con te</span> <span class="cstars">${'★'.repeat(d.stars || 0)}<i>${'★'.repeat(5 - (d.stars || 0))}</i></span>${d.body ? `: <i translate="no">“${esc(d.body)}”</i>` : ''}`;
  if (x.kind === 'feedback') return `<b>${d.type === 'idea' ? 'Nuova idea' : 'Nuova segnalazione'}</b>${d.body ? `: <i translate="no">“${esc(d.body)}”</i>` : ''}`;
  return who;
}
const NOTIF_ICO = { rating: '⭐', comment: '💬', reply: '💬', invite: '📅', rsvp: '✅', offer: '🏷️', post: '📝', feedback: '📮' };
async function notifsOpen() {
  openSheet(`<h2>Notifiche</h2><div id="notifList">${loadingHTML('Carico…')}</div>`);
  let d; try { d = await comm('notifs', { markRead: true }); } catch (e) { const b = $('#notifList'); if (b) b.innerHTML = `<p class="note">${esc(commErrMsg(e))}</p>`; return; }
  S.notifs = d.items || []; S.commNotifs = 0; commBadges();
  const b = $('#notifList'); if (!b) return;
  b.innerHTML = S.notifs.map((x, i) => `<button class="notif ${x.read ? '' : 'new'}" data-a="notifGo" data-i="${i}"><span class="nico">${NOTIF_ICO[x.kind] || '🔔'}</span><span class="ntxt">${notifText(x)}<small>${esc(commAgo(x.at))}</small></span></button>`).join('')
    || '<p class="note">Nessuna notifica. Qui arrivano i commenti ai tuoi post, gli inviti agli eventi, chi partecipa ai tuoi e i pezzi che cerchi messi a disposizione.</p>';
}
function notifGo(i) {
  const x = (S.notifs || [])[i]; if (!x) return; const d = x.data || {};
  if (x.kind === 'feedback') return feedbackAdmin();
  if (x.kind === 'rating') return profileOpen((commMe() || {}).id);
  if (x.kind === 'invite' || x.kind === 'rsvp') return eventOpen(d.id);
  if (d.type === 'post' || x.kind === 'post') return postOpen(d.id);
  if (d.type === 'review') return discussionOpen({ type: 'review', id: d.id });
  if (d.type === 'share' || x.kind === 'offer') return discussionOpen({ type: 'share', member: d.member, work: d.work, kind: d.kind || 'own' });
}


// ── Segnalazioni: problemi e idee scritti dagli utenti, errori tecnici anonimi dell'app ──
const FEEDBACK_URL = BASE.FEEDBACK_URL || '';
async function fbCall(body, withName) {
  const h = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + COMM_KEY, apikey: COMM_KEY };
  const tok = withName && Drive.token(); if (tok) h['x-google-token'] = tok;
  const r = await fetch(FEEDBACK_URL, { method: 'POST', headers: h, body: JSON.stringify(body), keepalive: body.action === 'error' });
  if (!r.ok) throw new CommErr(r.status, (await r.json().catch(() => ({}))).error || 'errore');
  return r.json();
}
/* ── Che canzone è? Ascolta la musica, la riconosce (AudD, come Shazam) e controlla se è nei tuoi dischi ── */
const ID_URL = BASE.IDENTIFY_URL || (FEEDBACK_URL ? FEEDBACK_URL.replace(/\/feedback$/, '/identify') : '');
const LISTEN_SECS = 10;
// "B2. Titolo (3:45)" → "Titolo"
function trackName(line) {
  const t = String(line || '').trim();
  const x = t.replace(/^(?:[A-Z]{0,2}\d{1,3}[a-z]?\s*[.)\-–:]?|[A-Z]{1,2}\s*[.)\-–:])\s+/, '').replace(/\s*\(\d{1,2}:\d{2}(:\d{2})?\)\s*$/, '').trim();
  return x || t;
}
const trackPos = line => (String(line || '').trim().match(/^([A-Z]{0,2}\d{1,3}[a-z]?|[A-Z]{1,2})\s*[.)\-–:]?\s+/) || ['', ''])[1];
const songKey = s => norm(String(s || '').replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/\s+[-–]\s+.*\b(remaster(ed)?|live|mono|stereo|single|version|edit|mix)\b.*$/i, ''));
const sameSong = (a, b) => !!a && !!b && (a === b || (Math.min(a.length, b.length) >= 6 && (a.startsWith(b) || b.startsWith(a))));
const COMPILATION = /\b(various|vari|aa\.?\s?vv\.?|v\/a|compilation|artistes divers|varios)\b/i;
function sameArtist(itemAutore, artist) {
  const I = norm(itemAutore); if (!I || !artist) return false;
  return String(artist).split(/,|&|\bfeat\.?|\bft\.?|\bwith\b|\be\b|\band\b|\by\b/i).map(norm).filter(a => a.length >= 3).some(a => I.includes(a) || (I.length >= 3 && a.includes(I)));
}
// Cerca la canzone nei dischi: nelle tracce, oppure (senza elenco tracce) come titolo dell'album
function findSong(title, artist, album) {
  const T = songKey(title), A = songKey(album);
  const order = { vinile: 0, cd: 1, cassetta: 2 };
  const music = live().filter(i => isMusic(i.tipo)).sort((a, b) => order[a.tipo] - order[b.tipo]);
  const hits = [], hit = new Set();
  for (const i of music) {
    const am = !artist || sameArtist(i.autore, artist) || COMPILATION.test(i.autore || '');
    const line = String(i.tracklist || '').split('\n').find(l => sameSong(songKey(trackName(l)), T));
    if (line && am) { hits.push({ i, pos: trackPos(line), how: 'track' }); hit.add(i.id); continue; }
    if (artist && A && sameArtist(i.autore, artist) && sameSong(songKey(i.titolo), A)) { hits.push({ i, how: 'album' }); hit.add(i.id); }
  }
  const byArtist = artist ? music.filter(i => !hit.has(i.id) && !i.desiderio && sameArtist(i.autore, artist)) : [];
  return { own: hits.filter(h => !h.i.desiderio), wish: hits.filter(h => h.i.desiderio), byArtist, noTracks: byArtist.filter(i => !String(i.tracklist || '').trim()).length };
}
function listenSheet() {
  if (!ID_URL) return toast('Riconoscimento non disponibile');
  openSheet(`<h2>Che canzone è?</h2>
    <p class="lead">Avvicina il telefono alla musica: ascolto per 10 secondi, riconosco la canzone e ti dico se è in uno dei tuoi dischi.</p>
    <div class="listen"><button class="listenbtn" data-a="listenGo" aria-label="Ascolta">${ic('note', 40)}</button><p class="note" id="listenMsg">Tocca per ascoltare</p></div>
    <form class="searchform" id="songForm"><input id="songQ" type="search" placeholder="Oppure scrivi il titolo della canzone" autocomplete="off" translate="no"><button class="btn" type="submit">Cerca</button></form>
    <div id="listenRes"></div>`);
}
const LISTEN_ERR = { limite: 'Hai fatto molti riconoscimenti oggi: riprova domani', 'servizio-limite': 'Il servizio di riconoscimento ha raggiunto il limite: riprova più tardi',
  audio: 'Audio non valido: riprova più vicino alla musica', grande: 'Registrazione troppo grande' };
async function listenGo() {
  if (S.listening) return S.listenStop && S.listenStop(); // secondo tocco: smette prima e riconosce subito
  const msg = () => $('#listenMsg');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) { const m = msg(); if (m) m.textContent = tr('Questo browser non permette di registrare l’audio'); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
  catch (e) { const m = msg(); if (m) m.textContent = tr('Serve il permesso del microfono: consentilo nelle impostazioni del browser e riprova'); return; }
  const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
  let rec;
  try { rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined); } catch (e) { rec = new MediaRecorder(stream); }
  const parts = []; rec.ondataavailable = e => { if (e.data && e.data.size) parts.push(e.data); };
  const stopped = new Promise(r => { rec.onstop = r; });
  const token = S.listenToken = uid(); let cancel = false, left = LISTEN_SECS;
  S.listening = true; rec.start(1000);
  $('.listenbtn')?.classList.add('on'); $('#listenRes') && ($('#listenRes').innerHTML = '');
  const show = () => { const m = msg(); if (m) m.innerHTML = `<span>Ascolto…</span> <b translate="no">${left}</b>`; };
  show();
  const tick = setInterval(() => { left--; show(); if (left <= 0) S.listenStop(); }, 1000);
  S.listenStop = c => { cancel = cancel || !!c; clearInterval(tick); if (rec.state !== 'inactive') rec.stop(); };
  await stopped;
  stream.getTracks().forEach(t => t.stop()); S.listening = false; S.listenStop = null;
  $('.listenbtn')?.classList.remove('on');
  if (cancel || S.listenToken !== token || $('#sheetWrap').classList.contains('hidden')) return;
  const blob = new Blob(parts, { type: rec.mimeType || type || 'audio/webm' });
  const m = msg(); if (m) m.innerHTML = `<span>Riconosco la canzone…</span>`;
  try {
    const fd = new FormData();
    fd.append('file', blob, 'clip.' + (/mp4|aac/.test(blob.type) ? 'm4a' : /ogg/.test(blob.type) ? 'ogg' : 'webm'));
    fd.append('market', { en: 'gb', es: 'es' }[LNG()] || 'it');
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 30000);
    const r = await fetch(ID_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + COMM_KEY, apikey: COMM_KEY }, body: fd, signal: ctrl.signal }).finally(() => clearTimeout(t));
    const j = await r.json().catch(() => ({}));
    if (S.listenToken !== token || !$('#listenRes')) return;
    if (!r.ok) throw new Error(j.error || 'errore');
    const mm = msg(); if (mm) mm.textContent = tr('Tocca per ascoltare un’altra canzone');
    if (!j.found) { $('#listenRes').innerHTML = `<p class="note pnote">Non ho riconosciuto la canzone. Avvicinati alla musica e riprova, oppure scrivi il titolo qui sopra.</p>`; return; }
    S.song = j; songResult(j);
  } catch (e) {
    const mm = msg(); if (mm) mm.textContent = tr(LISTEN_ERR[e.message] || (navigator.onLine ? 'Il riconoscimento non risponde: riprova' : 'Sei offline: il riconoscimento ha bisogno di internet'));
  }
}
function songRow(h) {
  const i = h.i || h; const T = TIPI[i.tipo];
  const what = h.how === 'track' ? `<span class="trk"><i>Traccia</i>${h.pos ? ` <b translate="no">${esc(h.pos)}</b>` : ''}</span>` : h.how === 'album' ? `<span>È l’album (senza elenco delle tracce)</span>` : '';
  return `<button class="result" data-a="open" data-id="${esc(i.id)}"><div class="th">${/^https:/.test(i.coverUrl || '') ? `<img src="${esc(i.coverUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</div>
    <div><b translate="no">${esc(i.titolo || tr('Senza titolo'))}</b><span translate="no">${esc([i.autore, i.anno].filter(Boolean).join(' · '))}</span><span>${esc([T && T.label, i.formato, i.posizione].filter(Boolean).join(' · '))}</span>${what}</div></button>`;
}
function songResult(song, typed) {
  const box = $('#listenRes'); if (!box) return;
  const f = findSong(song.title, song.artist, song.album);
  const card = typed ? '' : `<div class="songcard">${song.cover ? `<img src="${esc(song.cover)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}
    <div><b translate="no">${esc(song.title)}</b><span translate="no">${esc(song.artist)}</span>${song.album ? `<span translate="no">${esc([song.album, song.year].filter(Boolean).join(' · '))}</span>` : ''}
    ${song.link ? `<a class="ulink" href="${esc(song.link)}" target="_blank" rel="noopener">Ascoltala</a>` : ''}</div></div>`;
  let h = card;
  if (f.own.length) h += `<h3 class="songok">✓ <span>Ce l’hai</span></h3><div class="results">${f.own.map(songRow).join('')}</div>`;
  else h += `<h3 class="songno">${typed ? 'Non l’ho trovata nelle tracce dei tuoi dischi' : 'Non è in nessuno dei tuoi dischi'}</h3>`;
  if (f.wish.length) h += `<p class="note pnote">È nei tuoi desideri:</p><div class="results">${f.wish.map(songRow).join('')}</div>`;
  if (f.byArtist.length) h += `<p class="note pnote">${f.own.length ? 'Altri dischi dello stesso artista:' : 'Dello stesso artista hai:'}</p><div class="results">${f.byArtist.slice(0, 8).map(songRow).join('')}</div>`;
  if (!f.own.length && f.noTracks) h += `<p class="note pnote">${f.noTracks === 1 ? 'Un disco di questo artista non ha l’elenco delle tracce: aggiungile in Modifica per controllarlo.' : 'Alcuni dischi di questo artista non hanno l’elenco delle tracce: aggiungile in Modifica per controllarli.'}</p>`;
  if (!f.own.length && !typed && song.album) h += `<div class="stack"><button class="btn block" data-a="songSearch">${ic('search', 18)}Cerca l’album per aggiungerlo</button></div>`;
  box.innerHTML = h;
}
const errOn = () => { try { return localStorage.getItem('errReport') !== '0'; } catch (e) { return true; } };
const ERRQ = []; let errSent = 0;
// rumore che non dipende dall'app: estensioni, rete assente, script di altri siti
const ERR_SKIP = /^Script error\.?$|ResizeObserver loop|Load failed|NetworkError|Failed to fetch|AbortError|aborted|(chrome|moz|safari(-web)?)-extension:|webkit-masked-url/i;
function errCatch(message, source, stack) {
  message = String(message || '').slice(0, 500); source = String(source || ''); stack = String(stack || '');
  if (!FEEDBACK_URL || !COMM_KEY || !message || ERR_SKIP.test([message, source, stack].join(' '))) return;
  const key = message + '|' + source; S.errSeen = S.errSeen || new Set();
  if (S.errSeen.has(key) || errSent + ERRQ.length >= 8) return; // al massimo 8 errori diversi per sessione
  S.errSeen.add(key); S.lastErrors = [...(S.lastErrors || []), message].slice(-5);
  if (!errOn()) return;
  const strip = x => x.split(location.origin).join('');
  ERRQ.push({ message, source: strip(source), stack: strip(stack).slice(0, 2000), view: String(S.view || '') });
  clearTimeout(S.errT); S.errT = setTimeout(errFlush, 3000);
}
async function errFlush() {
  if (!ERRQ.length) return;
  if (!navigator.onLine) { S.errT = setTimeout(errFlush, 60e3); return; }
  const batch = ERRQ.splice(0); errSent += batch.length;
  try { await fbCall({ action: 'error', errors: batch, version: VERSION, ua: navigator.userAgent }); } catch (e) {}
}
window.addEventListener('error', e => { if (e.message) errCatch(e.message, e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : '', e.error && e.error.stack); });
window.addEventListener('unhandledrejection', e => { const r = e.reason; if (r == null) return; errCatch(r.message || String(r), '', r.stack); });

function fbDiag() {
  let push = 'no'; try { push = pushSupported() ? (pushOn() ? 'on' : Notification.permission) : (isIOS() && !isStandalone() ? 'serve Home' : 'no'); } catch (e) {}
  return { version: VERSION, ua: navigator.userAgent, lang: LNG(), app: isStandalone() ? 'installata' : 'browser', schermo: `${innerWidth}x${innerHeight}`,
    pezzi: live().length, drive: !cfg('clientId') ? 'off' : Drive.token() ? 'ok' : S.syncState || 'login', sync: S.syncError || '', community: !!commMe(), push, online: navigator.onLine, errori: S.lastErrors || [] };
}
function feedbackSheet(kind, keep) {
  S.fbKind = kind === 'idea' ? 'idea' : 'bug';
  openSheet(`<h2>Scrivici</h2>
    <div class="seg" id="fbKind"><button type="button" class="${S.fbKind === 'bug' ? 'on' : ''}" data-a="fbKind" data-v="bug">🐞 <span>Un problema</span></button><button type="button" class="${S.fbKind === 'idea' ? 'on' : ''}" data-a="fbKind" data-v="idea">💡 <span>Un'idea</span></button></div>
    <label class="field"><span>${S.fbKind === 'bug' ? 'Cosa è successo? Cosa stavi facendo?' : 'Cosa ti piacerebbe trovare in Spinyl?'}</span><textarea id="fbText" rows="5" maxlength="4000">${esc((keep || {}).text || '')}</textarea></label>
    <label class="field"><span>Come ricontattarti (facoltativo)</span><input id="fbContact" maxlength="200" value="${esc((keep || {}).contact || '')}" placeholder="email, telefono o nome nella community"></label>
    <label class="field inline"><span>Allega i dati tecnici (versione, telefono, ultimi errori; niente della tua collezione)</span><input type="checkbox" id="fbDiag" ${S.fbKind === 'bug' ? 'checked' : ''}></label>
    ${commMe() ? '<label class="field inline"><span>Firma con il mio nome nella community</span><input type="checkbox" id="fbName" checked></label>' : ''}
    <div class="stack"><button class="btn primary block" data-a="fbSend">Invia</button></div>
    <p class="note">Leggiamo tutto. Le segnalazioni sono private: gli altri utenti non le vedono.</p>`);
}
async function fbSend(btn) {
  const text = ($('#fbText') || {}).value.trim(), contact = ($('#fbContact') || {}).value.trim();
  if (text.length < 3) return toast('Scrivi qualche parola in più');
  if (!navigator.onLine) return toast('Sei offline: riprova quando torna la connessione');
  btn.disabled = true;
  try {
    await fbCall({ action: 'send', kind: S.fbKind, message: text, contact, version: VERSION, lang: LNG(), diag: $('#fbDiag').checked ? fbDiag() : null }, !!($('#fbName') || {}).checked);
    closeSheet(); toast(S.fbKind === 'idea' ? "Grazie per l'idea!" : 'Grazie! Ci guardiamo al più presto', 4000);
  } catch (e) { btn.disabled = false; toast(e.message === 'troppi' ? 'Hai inviato molte segnalazioni: riprova tra un po\'' : 'Invio non riuscito, riprova'); }
}
// Amministratore: segnalazioni ricevute ed errori dell'app
async function feedbackAdmin() {
  openSheet(`<h2>Segnalazioni ricevute</h2><div id="fbList">${loadingHTML('Carico…')}</div>`);
  let d; try { d = await comm('feedbackList'); } catch (e) { const b = $('#fbList'); if (b) b.innerHTML = `<p class="note">${esc(commErrMsg(e))}</p>`; return; }
  const b = $('#fbList'); if (!b) return;
  const pre = x => `<details><summary>Dati tecnici</summary><pre translate="no">${esc(typeof x === 'string' ? x : JSON.stringify(x, null, 1))}</pre></details>`;
  const fb = d.feedback.map(x => `<div class="fbrow ${x.status === 'fatto' ? 'done' : ''}"><div class="chead"><span class="ctag">${x.kind === 'idea' ? '💡 <span>Idea</span>' : '🐞 <span>Problema</span>'}</span><b translate="no">${esc(x.nick || x.contact || '—')}</b><small>${esc(commAgo(x.created_at))} · <span translate="no">${esc(x.version)}</span></small></div>
      <p translate="no">${esc(x.message)}</p>${x.contact ? `<small translate="no">${esc(x.contact)}</small>` : ''}${x.diag ? pre(x.diag) : ''}
      <div class="cacts">${x.status === 'fatto' ? '<span>✓ Fatto</span>' : `<button data-a="fbStatus" data-id="${esc(x.id)}">Segna come fatto</button>`}</div></div>`).join('') || '<p class="note">Nessuna segnalazione, per ora.</p>';
  const er = d.errors.map(x => `<div class="fbrow"><div class="chead"><b translate="no">${esc(x.message)}</b><small translate="no">×${x.count} · ${esc(x.version)} · ${esc(commAgo(x.last_seen))}</small></div>
      <small translate="no">${esc([x.source, x.view].filter(Boolean).join(' · '))}</small>${x.stack ? pre(x.stack + '\n\n' + x.ua) : ''}
      <div class="cacts"><button data-a="fbErrDone" data-id="${esc(x.hash)}">Risolto</button></div></div>`).join('') || '<p class="note">Nessun errore aperto.</p>';
  b.innerHTML = `<h4 class="csub">Problemi e idee</h4>${fb}<h4 class="csub">Errori dell'app</h4>${er}`;
}
// Prova delle notifiche push: subito o tra 10 secondi (per provarle ad app chiusa)
async function pushTest(delay) {
  try {
    const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription();
    if (!sub) return pushEnable();
    const r = await pushCall({ sub: sub.toJSON(), lang: LNG(), test: true, delay: !!delay });
    toast(delay ? 'Ora chiudi Spinyl o blocca il telefono: la notifica arriva tra 10 secondi' : r.test && r.test < 300 ? 'Notifica inviata' : 'Il servizio di notifiche ha risposto ' + r.test, 6000);
  } catch (e) { toast(e.code === 401 ? COMM_ERR.login : 'Prova non riuscita: ' + (e.message || e)); }
}

// ── Notifiche push (anche ad app chiusa) ──
const PUSH_URL = BASE.PUSH_URL || '', VAPID = BASE.VAPID_PUBLIC || '';
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent);
const isStandalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
const pushSupported = () => !!(PUSH_URL && VAPID && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window);
const pushOn = () => { try { return localStorage.getItem('pushOn') === '1' && Notification.permission === 'granted'; } catch (e) { return false; } };
const u8 = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
async function pushCall(body) {
  const tok = Drive.token(); if (!tok) throw new CommErr(401, 'login');
  const r = await fetch(PUSH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + COMM_KEY, apikey: COMM_KEY, 'x-google-token': tok }, body: JSON.stringify(body) });
  if (!r.ok) throw new CommErr(r.status, (await r.json().catch(() => ({}))).error || 'errore');
  return r.json();
}
function pushHintHTML() {
  if (!commMe() || pushOn()) return '';
  if (isIOS() && !isStandalone()) return `<div class="pushhint"><b>🔔 <span>Notifiche sul telefono</span></b><span>Su iPhone: tocca Condividi › Aggiungi alla schermata Home, poi apri Spinyl da lì e attiva le notifiche.</span></div>`;
  if (!pushSupported()) return '';
  if (Notification.permission === 'denied') return `<div class="pushhint"><b>🔔 <span>Notifiche bloccate</span></b><span>Le hai bloccate: riattivale dalle impostazioni del telefono per questo sito.</span></div>`;
  return `<div class="pushhint"><b>🔔 <span>Notifiche sul telefono</span></b><span>Ricevi commenti, messaggi, inviti e offerte anche con l'app chiusa.</span><button class="btn primary" data-a="pushEnable">Attiva le notifiche</button></div>`;
}
async function pushEnable(quiet) {
  if (!pushSupported()) { if (!quiet) toast(isIOS() && !isStandalone() ? 'Prima aggiungi Spinyl alla schermata Home' : 'Questo telefono non supporta le notifiche'); return; }
  try {
    const perm = quiet ? Notification.permission : await Notification.requestPermission();
    if (perm !== 'granted') { if (!quiet) toast('Notifiche non permesse'); return; }
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: u8(VAPID) });
    await pushCall({ sub: sub.toJSON(), lang: LNG(), test: !quiet });
    try { localStorage.setItem('pushOn', '1'); localStorage.setItem('pushAt', String(Date.now())); } catch (e) {}
    if (!quiet) { toast('Notifiche attive'); if (S.view === 'community' || S.view === 'settings') render(); }
  } catch (e) { console.warn('push', e); if (!quiet) toast(e.code === 401 ? COMM_ERR.login : 'Non riesco ad attivare le notifiche'); }
}
// Iscrizione alle notifiche rinnovata a ogni avvio (e al ritorno nell'app dopo 6 ore): se sullo stesso telefono
// si cambia account, o l'iscrizione è scaduta, le notifiche tornano ad arrivare alla persona giusta.
function pushRefresh() {
  let off = false, at = 0; try { off = localStorage.getItem('pushOn') === '0'; at = +localStorage.getItem('pushAt') || 0; } catch (e) {}
  if (!commMe() || off || !pushSupported() || Notification.permission !== 'granted') return;
  if (S.pushRefreshed && Date.now() - at < 6 * 3600e3) return;
  S.pushRefreshed = true; pushEnable(true);
}
async function pushDisable() {
  try {
    const reg = await navigator.serviceWorker.ready; const sub = await reg.pushManager.getSubscription();
    if (sub) { await pushCall({ action: 'unsub', sub: sub.toJSON() }).catch(() => {}); await sub.unsubscribe(); }
  } catch (e) {}
  try { localStorage.setItem('pushOn', '0'); } catch (e) {}
  toast('Notifiche disattivate'); render();
}
// Apre il punto giusto quando si tocca una notifica
async function pushGo(go) {
  if (!go || !commMe()) return;
  const [k, id] = String(go).split(':');
  if (S.view !== 'community') { S.main = 'community'; try { localStorage.setItem('mainTab', 'community'); } catch (e) {} go_('community'); }
  if (k === 'event') return eventOpen(id);
  if (k === 'thread') { S.commSeg = 'messaggi'; render(); return threadOpen(id); }
  if (k === 'group') { S.commSeg = 'messaggi'; render(); return groupOpen(id); }
  if (k === 'post') return postOpen(id);
  if (k === 'review') return discussionOpen({ type: 'review', id });
  if (k === 'feedback') return feedbackAdmin();
  return notifsOpen();
}
const go_ = (v) => go(v, null, true);
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => {
  if (e.data && e.data.type === 'push-go') pushGo(e.data.go);
  if (e.data && e.data.type === 'push') commUnreadCheck(0); // è arrivata una notifica mentre l'app è aperta: aggiorna i pallini
});

// ── Privacy, termini, regole; i miei dati (scarica, elimina) ──
function legalHTML(kind) {
  const L = (window.SPINYL_LEGAL || {})[LNG()] || (window.SPINYL_LEGAL || {}).it; if (!L) return '';
  return String(L[kind] || '').replace(/\{contatto\}/g, esc(BASE.PRIVACY_CONTACT || '')).replace(/\{gestore\}/g, esc(BASE.OPERATOR || 'Spinyl'));
}
function legalOpen(kind) {
  const T = { privacy: 'Informativa privacy', terms: "Termini d'uso", rules: 'Regole della community' };
  const L = (window.SPINYL_LEGAL || {})[LNG()] || {};
  openSheet(`<h2>${T[kind]}</h2><div class="legal" translate="no">${legalHTML(kind)}<p class="note">${esc(L.updated || '')}</p></div>
    <div class="stack"><button class="btn block" data-a="closeSheet">Chiudi</button></div>`);
}
async function commExport() {
  try {
    const d = await comm('export');
    await saveFile(new File([JSON.stringify(d, null, 2)], `spinyl-community-${isoDay(Date.now())}.json`, { type: 'application/json' }), 'Spinyl');
  } catch (e) { toast(commErrMsg(e)); }
}
function commDeleteSheet() {
  const me = commMe(); if (!me) return;
  openSheet(`<h2>Elimina il mio account</h2>
    <p class="note">Verranno cancellati subito dalla community il tuo nome, le recensioni, i commenti, gli articoli, i pezzi condivisi, i messaggi, gli eventi e le notifiche. La tua collezione sul telefono e su Google Drive resta com'è.</p>
    <label class="field"><span>Per confermare scrivi il tuo nome: <b translate="no">${esc(me.nick)}</b></span><input id="delNick" autocomplete="off" autocapitalize="off"></label>
    <div class="stack"><button class="btn danger block" data-a="commDeleteGo">Elimina definitivamente</button><button class="btn block" data-a="closeSheet">Annulla</button></div>`);
}
async function commDeleteGo() {
  const me = commMe(); const v = ($('#delNick') || {}).value || '';
  if (!me || v.trim() !== me.nick) return toast('Il nome non corrisponde');
  try {
    await comm('deleteAccount', { confirm: v.trim() });
    try { const reg = 'serviceWorker' in navigator && await navigator.serviceWorker.getRegistration(); const sub = reg && reg.pushManager && await reg.pushManager.getSubscription(); if (sub) await sub.unsubscribe(); } catch (e) {}
    try { ['commMe', 'sharesHash', 'pushOn', 'pushAt', 'invito'].forEach(k => localStorage.removeItem(k)); } catch (e) {}
    S.commUnread = S.commInvites = S.commNotifs = 0; S.commPrevTotal = null;
    closeSheet(); toast('Account eliminato'); render();
  } catch (e) { toast(e.message === 'conferma' ? 'Il nome non corrisponde' : commErrMsg(e)); }
}

// ── Blog dell'opera ──
function postSheet() {
  const ctx = commCtx(); if (!ctx) return;
  S.postCtx = ctx;
  setTimeout(() => { S.postPrefill = ''; });
  openSheet(`<h2>Nuovo articolo</h2><div class="pickcard">${coverMini(ctx)}<div><b translate="no">${esc(ctx.titolo)}</b><span translate="no">${esc(ctx.autore || '')}</span></div></div>
    <label class="field"><span>Titolo</span><input id="postTitle" maxlength="150" placeholder="es. La stampa giapponese del 1978"></label>
    <label class="field"><span>Testo</span><textarea id="postBody" rows="8" maxlength="8000" placeholder="Storia, ricordi, edizioni, curiosità…">${esc(S.postPrefill || '')}</textarea></label>
    <div class="stack"><button class="btn primary block" data-a="postSend">Pubblica</button></div>`);
}
async function postSend() {
  const c = S.postCtx; const title = ($('#postTitle') || {}).value || ''; const body = ($('#postBody') || {}).value || '';
  if (title.trim().length < 2 || !body.trim()) return toast('Scrivi titolo e testo');
  try { const r = await comm('post', { work: c.work, tipo: c.tipo, titolo: c.titolo, autore: c.autore, cover: c.cover, title, body }); toast('Pubblicato'); postOpen(r.id); const it = byId(S.id); if (it && S.view === 'detail') loadComm(it, true); }
  catch (e) { toast(commErrMsg(e)); }
}
async function postOpen(id) {
  let d; try { d = await comm('postGet', { id }); } catch (e) { return toast(commErrMsg(e)); }
  const p = d.post; S.postOpenId = id;
  const admin = (commMe() || {}).admin;
  openSheet(`<article class="post"><span class="ctag">📝 <span translate="no">${esc(p.titolo)}</span></span><h2 translate="no">${esc(p.title)}</h2>
      <div class="chead"><b translate="no">${esc(p.nick)}</b><small>${esc(commAgo(p.at))}${editedTag(p)}</small></div>
      <div class="prose" translate="no">${lk(p.body)}</div>
      <div class="cacts">${p.mine ? editBtn('post', p.id, { body: p.body, title: p.title }, 'post') : ''}${p.mine || admin ? `<button data-a="postDel" data-id="${esc(p.id)}">Elimina</button>` : `<button data-a="commReport" data-kind="post" data-id="${esc(p.id)}">Segnala</button>`}</div></article>
    <h4 class="csub">Commenti</h4>
    ${d.comments.map(c => `<div class="ccom"><b translate="no">${esc(c.nick)}</b> <span translate="no">${lk(c.body)}</span>${editedTag(c)}<span class="cacts">${c.mine ? editBtn('comment', c.id, c.body, 'post') : ''}${c.mine || admin ? `<button data-a="commDel" data-kind="comment" data-id="${esc(c.id)}">Elimina</button>` : `<button data-a="commReport" data-kind="comment" data-id="${esc(c.id)}">Segnala</button>`}</span></div>`).join('') || '<p class="note">Nessun commento.</p>'}
    <form class="composer" id="postCForm"><textarea rows="1" maxlength="1000" placeholder="Commenta…"></textarea><button type="submit">Invia</button></form>`);
  $('#postCForm').addEventListener('submit', async e => {
    e.preventDefault(); const ta = e.target.querySelector('textarea'); const body = ta.value.trim(); if (!body) return;
    try { await comm('comment', { post: id, body }); postOpen(id); } catch (er) { toast(commErrMsg(er)); }
  });
}
async function postDel(id) {
  if (!confirm(tr('Eliminare l\'articolo?'))) return;
  try { await comm('delete', { kind: 'post', id }); closeSheet(); toast('Eliminato'); const it = byId(S.id); if (it && S.view === 'detail') loadComm(it, true); else if (S.view === 'community') loadCommunity(); } catch (e) { toast(commErrMsg(e)); }
}

/* ── Home "Novità" ─────────────────────────────────────────── */
// Righe dalla tua collezione (calcolate al momento) + righe online (aggiornate al massimo ogni 12 ore)
const FEED_TTL = 12 * 3600e3;
const FEED_ROWS = [
  { key: 'artisti', title: 'Dai tuoi artisti', icon: '💿', need: () => topNames(i => isMusic(i.tipo)).length },
  { key: 'autori', title: 'Dai tuoi autori', icon: '📚', need: () => topNames(i => i.tipo === 'libro').length },
  { key: 'registi', title: 'Dai tuoi registi', icon: '🎞️', need: () => cfg('tmdbKey') && topNames(i => i.tipo === 'film').length },
  { key: 'album', title: 'Nuovi album', icon: '🎧', need: () => true },
  { key: 'libri', title: 'Nuovi libri', icon: '📖', need: () => true },
  { key: 'cinema', title: 'Al cinema', icon: '🎬', need: () => cfg('tmdbKey') },
  { key: 'articoli', title: 'Articoli', icon: '📰', need: () => true },
  { key: 'offerte', title: 'Desideri in vendita', icon: '⭐', need: () => cfg('discogsToken') && live().some(i => i.desiderio && isMusic(i.tipo)) },
  { key: 'continua', title: 'Continua', icon: '🔖', local: true },
  { key: 'ricorda', title: 'Da ricordare', icon: '⏰', local: true },
  { key: 'annofa', title: 'Un anno fa', icon: '🕰️', local: true },
];
const isoDay = ms => new Date(ms).toISOString().slice(0, 10);
const owned = c => live().some(i => !i.desiderio && sameWork(i, c) && (i.tipo === c.tipo || (isMusic(i.tipo) && isMusic(c.tipo))));
const wished = c => live().some(i => i.desiderio && sameWork(i, c));
// Gli autori / artisti / registi più presenti nella collezione
function topNames(filter, n = 8) {
  const m = new Map();
  live().filter(i => !i.desiderio && filter(i) && i.autore).forEach(i => {
    const name = String(i.autore).split(/,|;| & | feat\. /i)[0].trim(); if (!name || /^(various|vari|aa\.? ?vv\.?)/i.test(name)) return;
    const k = norm(name); const e = m.get(k) || [name, 0]; e[1]++; m.set(k, e);
  });
  return [...m.values()].sort((a, b) => b[1] - a[1]).slice(0, n).map(e => e[0]);
}
function localRow(key) {
  const own = live().filter(i => !i.desiderio);
  if (key === 'continua') return own.filter(i => i.stato === 'in').concat(own.filter(i => i.stato === 'da')).slice(0, 15);
  if (key === 'ricorda') return own.filter(i => loanLate(i) || (loanDue(i) != null && loanDue(i) <= 3)).sort((a, b) => (loanDue(a) ?? -loanDays(a)) - (loanDue(b) ?? -loanDays(b)));
  if (key === 'annofa') {
    const target = Date.now() - 365 * 864e5;
    return own.filter(i => Math.abs((i.createdAt || 0) - target) < 21 * 864e5).slice(0, 15);
  }
  return [];
}
// Fonti online
async function feedTmdb(kind) {
  const k = cfg('tmdbKey'); const reg = { it: 'IT', en: 'GB', es: 'ES' }[LNG()] || 'IT';
  const d = await fj(`https://api.themoviedb.org/3/movie/${kind}?region=${reg}&language=${LOC()}&api_key=${encodeURIComponent(k)}`);
  const todayIso = isoDay(Date.now());
  return (d.results || []).filter(m => kind !== 'upcoming' || (m.release_date || '') >= todayIso)
    .sort((a, b) => kind === 'upcoming' ? String(a.release_date).localeCompare(String(b.release_date)) : (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 15).map(m => ({ tipo: 'film', titolo: m.title, anno: year(m.release_date), uscita: m.release_date || '', descrizione: m.overview || '',
      coverUrl: m.poster_path ? 'https://image.tmdb.org/t/p/w342' + m.poster_path : '', _tmdbId: m.id, fonte: 'TMDB' }));
}
// Una sola riga cinema: prima i film in sala, poi quelli in arrivo (con la data)
async function feedCinema() {
  const [now, next] = await Promise.all([feedTmdb('now_playing').catch(() => []), feedTmdb('upcoming').catch(() => [])]);
  const seen = new Set(); return [...now.slice(0, 10), ...next.slice(0, 8)].filter(m => !seen.has(m._tmdbId) && seen.add(m._tmdbId));
}
// Articoli da riviste e blog su libri, musica, vinili e cinema (RSS letti tramite rss2json, che permette la lettura dal telefono)
const ARTICLE_FEEDS = {
  it: [['libri', 'Il Libraio', 'https://www.illibraio.it/feed/'], ['libri', 'Il Post', 'https://www.ilpost.it/cultura/libri/feed/'],
    ['musica', 'Rolling Stone Italia', 'https://www.rollingstone.it/musica/feed/'], ['musica', 'Il Post', 'https://www.ilpost.it/cultura/musica/feed/'],
    ['cinema', 'BadTaste', 'https://www.badtaste.it/feed/'], ['cinema', 'Il Post', 'https://www.ilpost.it/cultura/cinema/feed/'], ['vinili', 'Discogs Digs', 'https://www.discogs.com/digs/feed/']],
  en: [['vinili', 'Discogs Digs', 'https://www.discogs.com/digs/feed/'], ['musica', 'Pitchfork', 'https://pitchfork.com/feed/feed-news/rss'], ['libri', 'Literary Hub', 'https://lithub.com/feed/'], ['cinema', 'IndieWire', 'https://www.indiewire.com/feed/']],
  es: [['musica', 'Jenesaispop', 'https://jenesaispop.com/feed/'], ['cinema', 'Espinof', 'https://www.espinof.com/index.xml'], ['libri', 'Zenda', 'https://www.zendalibros.com/feed/'], ['vinili', 'Discogs Digs', 'https://www.discogs.com/digs/feed/']],
};
const ART_KIND = { libri: 'Libri', musica: 'Musica', cinema: 'Cinema', vinili: 'Vinili' };
const firstImg = h => (String(h || '').match(/<img[^>]+src=["']([^"']+)/i) || [])[1] || '';
async function feedArticles() {
  const weeks = Date.now() - 21 * 864e5;
  const rss = async () => {
    const res = await Promise.allSettled((ARTICLE_FEEDS[LNG()] || ARTICLE_FEEDS.it).map(async ([kind, src, url]) => {
      const d = await fj('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(url));
      if (d.status !== 'ok') throw new Error(d.message || 'rss');
      return (d.items || []).map(a => ({ tipo: 'articolo', kind, fonte: src, titolo: stripHtml(a.title), link: a.link, at: Date.parse(String(a.pubDate || '').replace(' ', 'T') + 'Z') || 0,
        coverUrl: [a.thumbnail, a.enclosure && /image|jpe?g|png|webp/i.test((a.enclosure.type || '') + a.enclosure.link) ? a.enclosure.link : '', firstImg(a.content), firstImg(a.description)].find(x => /^https?:/.test(x || '')) || '' }))
        .filter(a => a.link && a.titolo && (!a.at || a.at > weeks)).slice(0, 6);
    }));
    const lists = res.filter(r => r.status === 'fulfilled').map(r => r.value);
    if (!lists.length) throw new Error((res.find(r => r.reason) || {}).reason || 'rss');
    // alterna le fonti, così non c'è solo cinema o solo musica
    const out = []; for (let i = 0; i < 6; i++) lists.forEach(l => l[i] && out.push(l[i]));
    return out;
  };
  const guardian = async () => {
    const res = await Promise.all([['libri', 'books'], ['musica', 'music'], ['cinema', 'film']].map(([kind, sec]) =>
      fj(`https://content.guardianapis.com/search?section=${sec}&order-by=newest&page-size=6&show-fields=thumbnail&api-key=test`).then(d => ((d.response || {}).results || []).map(a => ({
        tipo: 'articolo', kind, fonte: 'The Guardian', titolo: a.webTitle, link: a.webUrl, at: Date.parse(a.webPublicationDate) || 0, coverUrl: (a.fields || {}).thumbnail || '' }))).catch(() => [])));
    const out = []; for (let i = 0; i < 6; i++) res.forEach(l => l[i] && out.push(l[i]));
    return out;
  };
  return (await firstOf('articoli', [['RSS', rss], ['Guardian', guardian]])).slice(0, 24);
}
async function feedArtists() {
  const since = isoDay(Date.now() - 150 * 864e5); const out = [];
  for (const a of topNames(i => isMusic(i.tipo))) {
    try {
      const q = `artist:"${a.replace(/"/g, '')}" AND firstreleasedate:[${since} TO *] AND (primarytype:album OR primarytype:ep)`;
      const d = await fj('https://musicbrainz.org/ws/2/release-group/?fmt=json&limit=6&query=' + encodeURIComponent(q));
      (d['release-groups'] || []).filter(g => (g.score || 0) >= 85 && (g['artist-credit'] || []).some(c => norm(c.name || (c.artist || {}).name) === norm(a)))
        .forEach(g => out.push({ tipo: 'vinile', titolo: g.title, autore: a, anno: year(g['first-release-date']), uscita: g['first-release-date'] || '',
          coverUrl: `https://coverartarchive.org/release-group/${g.id}/front-250`, fonte: 'MusicBrainz', sub: g['primary-type'] || '' }));
    } catch (e) { if (!navigator.onLine) break; }
    await sleep(1100); // MusicBrainz: una richiesta al secondo
  }
  return dedupeFeed(out).sort((a, b) => String(b.uscita).localeCompare(String(a.uscita))).slice(0, 15);
}
async function feedAuthors() {
  const since = isoDay(Date.now() - 365 * 864e5); const out = []; const key = cfg('booksKey');
  await Promise.all(topNames(i => i.tipo === 'libro').map(async a => {
    const url = 'https://www.googleapis.com/books/v1/volumes?maxResults=10&printType=books&orderBy=newest&q=' + encodeURIComponent(`inauthor:"${a}"`);
    let d; try { d = await fj(url + (key ? '&key=' + encodeURIComponent(key) : '')); } catch (e) { try { d = await fj(url); } catch (e2) { return; } }
    (d.items || []).forEach(it => {
      const v = it.volumeInfo || {}; const pub = String(v.publishedDate || '');
      if (pub.length < 7 || pub < since.slice(0, pub.length) || !(v.authors || []).some(x => norm(x).includes(norm(a)) || norm(a).includes(norm(x)))) return;
      let img = v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail); if (img) img = img.replace('http://', 'https://').replace('&edge=curl', '');
      const ids = v.industryIdentifiers || []; const isbn = ids.find(x => x.type === 'ISBN_13') || ids[0];
      out.push({ tipo: 'libro', titolo: [v.title, v.subtitle].filter(Boolean).join(': '), autore: (v.authors || []).join(', '), anno: year(pub), uscita: pub,
        editore: v.publisher || '', descrizione: stripHtml(v.description), coverUrl: img || '', codice: isbn ? isbn.identifier : '', pagine: v.pageCount || '', fonte: 'Google Libri' });
    });
  }));
  return dedupeFeed(out).sort((a, b) => String(b.uscita).localeCompare(String(a.uscita))).slice(0, 15);
}
async function feedDirectors() {
  const k = encodeURIComponent(cfg('tmdbKey')); const since = isoDay(Date.now() - 240 * 864e5); const out = [];
  for (const name of topNames(i => i.tipo === 'film', 6)) {
    try {
      const p = await fj(`https://api.themoviedb.org/3/search/person?query=${encodeURIComponent(name)}&api_key=${k}`);
      const person = (p.results || []).find(x => x.known_for_department === 'Directing') || (p.results || [])[0]; if (!person) continue;
      const c = await fj(`https://api.themoviedb.org/3/person/${person.id}/movie_credits?language=${LOC()}&api_key=${k}`);
      (c.crew || []).filter(m => m.job === 'Director' && (m.release_date || '9999') >= since).forEach(m => out.push({ tipo: 'film', titolo: m.title, autore: name,
        anno: year(m.release_date), uscita: m.release_date || '', descrizione: m.overview || '', coverUrl: m.poster_path ? 'https://image.tmdb.org/t/p/w342' + m.poster_path : '', _tmdbId: m.id, fonte: 'TMDB' }));
    } catch (e) { if (!navigator.onLine) break; }
  }
  return dedupeFeed(out).sort((a, b) => String(b.uscita || '9999').localeCompare(String(a.uscita || '9999'))).slice(0, 15);
}
async function feedOffers() {
  const out = [];
  for (const it of live().filter(i => i.desiderio && isMusic(i.tipo)).slice(0, 10)) {
    try {
      const m = await discogsLookupId(it); if (!m) continue;
      const p = await discogsPrices(m.id);
      if (p.min != null && p.n > 0) out.push({ id: it.id, local: true, prezzo: p.min, cur: p.cur, n: p.n });
    } catch (e) { if (!navigator.onLine) break; }
    await sleep(2200);
  }
  return out.sort((a, b) => a.prezzo - b.prezzo);
}
// Prova più fonti in fila: la prima che risponde con qualcosa vince. Gli errori restano in S.feedErr per la diagnosi
async function firstOf(key, sources) {
  const errs = [];
  for (const [name, fn] of sources) {
    try { const L = await fn(); if (L && L.length) { delete S.feedErr[key]; return L; } errs.push(name + ': vuoto'); }
    catch (e) { errs.push(name + ': ' + String((e && e.message) || e).slice(0, 40)); }
  }
  S.feedErr[key] = errs.join(' · '); return [];
}
const CC = () => ({ it: 'it', en: 'gb', es: 'es' }[LNG()] || 'it');
// Nuovi album della settimana: Deezer (JSONP), poi classifica Apple Music, poi MusicBrainz
async function feedAlbums() {
  const dz = a => ({ tipo: 'vinile', titolo: a.title, autore: (a.artist || {}).name || '', anno: year(a.release_date), uscita: a.release_date || '', coverUrl: a.cover_big || a.cover_medium || '', fonte: 'Deezer' });
  const apple = r => ((r.feed || {}).results || []).map(a => ({ tipo: 'vinile', titolo: a.name, autore: a.artistName || '', anno: year(a.releaseDate), uscita: a.releaseDate || '',
    coverUrl: String(a.artworkUrl100 || '').replace(/\d+x\d+bb/, '600x600bb'), fonte: 'Apple Music' }));
  const L = await firstOf('album', [
    ['Deezer', async () => { const d = await jsonp('https://api.deezer.com/editorial/0/releases?limit=25&output=jsonp'); if (d.error) throw new Error(d.error.message || 'errore'); return (d.data || []).map(dz); }],
    ['Deezer top', async () => { const d = await jsonp('https://api.deezer.com/chart/0/albums?limit=25&output=jsonp'); if (d.error) throw new Error(d.error.message || 'errore'); return (d.data || []).map(dz); }],
    ['Apple', async () => apple(await fj(`https://rss.applemarketingtools.com/api/v2/${CC()}/music/most-played/25/albums.json`))],
    ['MusicBrainz', async () => {
      const since = isoDay(Date.now() - 14 * 864e5);
      const d = await fj('https://musicbrainz.org/ws/2/release-group/?fmt=json&limit=50&query=' + encodeURIComponent(`primarytype:album AND status:official AND firstreleasedate:[${since} TO *] AND tag:(rock OR pop OR jazz OR "hip hop" OR electronic OR indie)`));
      return (d['release-groups'] || []).filter(r => (r['first-release-date'] || '') <= isoDay(Date.now())).map(r => ({ tipo: 'vinile', titolo: r.title, autore: ((r['artist-credit'] || [])[0] || {}).name || '',
        anno: year(r['first-release-date']), uscita: r['first-release-date'] || '', coverUrl: `https://coverartarchive.org/release-group/${r.id}/front-250`, fonte: 'MusicBrainz' }));
    }],
  ]);
  return L.sort((a, b) => String(b.uscita).localeCompare(String(a.uscita))).slice(0, 18);
}
// Nuovi libri: Google Libri nella lingua dell'app e nei tuoi generi, poi Open Library
async function feedBooks() {
  const since = isoDay(Date.now() - 365 * 864e5); const key = cfg('booksKey'); const today = isoDay(Date.now() + 90 * 864e5);
  const g = new Map(); live().filter(i => i.tipo === 'libro' && i.genere).forEach(i => String(i.genere).split(/[,/]/).map(x => x.trim()).filter(x => /^[\p{L} ]{3,30}$/u.test(x)).forEach(x => g.set(x, (g.get(x) || 0) + 1)));
  const subjects = [...g.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(e => e[0]);
  if (!subjects.length) subjects.push('fiction');
  const gb = async (q, lang) => {
    const url = `https://www.googleapis.com/books/v1/volumes?maxResults=40&printType=books&orderBy=newest${lang ? '&langRestrict=' + LNG() : ''}&q=` + encodeURIComponent(q);
    let d; try { d = await fj(url + (key ? '&key=' + encodeURIComponent(key) : '')); } catch (e) { d = await fj(url); }
    return (d.items || []).map(it => {
      const v = it.volumeInfo || {}; const pub = String(v.publishedDate || '');
      const img = v.imageLinks && (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail);
      if (!img || pub.length < 4 || pub < since.slice(0, pub.length) || pub > today) return null;
      const ids = v.industryIdentifiers || []; const isbn = ids.find(x => x.type === 'ISBN_13') || ids[0];
      return { tipo: 'libro', titolo: [v.title, v.subtitle].filter(Boolean).join(': '), autore: (v.authors || []).join(', '), anno: year(pub), uscita: pub, editore: v.publisher || '',
        descrizione: stripHtml(v.description), coverUrl: img.replace('http://', 'https://').replace('&edge=curl', ''), codice: isbn ? isbn.identifier : '', pagine: v.pageCount || '', fonte: 'Google Libri' };
    }).filter(Boolean);
  };
  const ol = async () => {
    const lang = { it: 'ita', en: 'eng', es: 'spa' }[LNG()] || 'ita'; const y = new Date().getFullYear();
    const d = await fj(`https://openlibrary.org/search.json?limit=40&sort=new&fields=key,title,author_name,first_publish_year,cover_i,isbn&q=${encodeURIComponent(`first_publish_year:[${y - 1} TO ${y}] language:${lang}`)}`);
    return (d.docs || []).filter(b => b.cover_i).map(b => ({ tipo: 'libro', titolo: b.title, autore: (b.author_name || []).join(', '), anno: String(b.first_publish_year || ''), uscita: String(b.first_publish_year || ''),
      coverUrl: `https://covers.openlibrary.org/b/id/${b.cover_i}-L.jpg`, codice: (b.isbn || [])[0] || '', fonte: 'Open Library' }));
  };
  const L = await firstOf('libri', [
    ['Google Libri', async () => (await Promise.all(subjects.map(sub => gb('subject:' + sub, true).catch(() => [])))).flat()],
    ['Google Libri (tutte le lingue)', () => gb('subject:' + subjects[0], false)],
    ['Open Library', ol],
  ]);
  return dedupeFeed(L).sort((a, b) => String(b.uscita).localeCompare(String(a.uscita))).slice(0, 18);
}
const dedupeFeed = L => { const seen = new Set(); return L.filter(c => { const k = c.tipo + '|' + norm(c.titolo) + '|' + norm(String(c.autore || '').split(',')[0]); if (seen.has(k)) return false; seen.add(k); return true; }); };
const FEED_FETCH = { album: feedAlbums, libri: feedBooks, cinema: feedCinema, articoli: feedArticles, artisti: feedArtists, autori: feedAuthors, registi: feedDirectors, offerte: feedOffers };

let feedLoading = false, feedAgain = false;
// "Firma" della collezione: se cambiano artisti, autori, registi o desideri, le novità si ricalcolano
const feedSig = () => JSON.stringify([VERSION, topNames(i => isMusic(i.tipo)), topNames(i => i.tipo === 'libro'), topNames(i => i.tipo === 'film', 6), live().filter(i => i.desiderio && isMusic(i.tipo)).length, !!cfg('tmdbKey'), !!cfg('discogsToken')]);
async function loadFeed(force) {
  if (feedLoading) { if (force || (S.feed && S.feed.sig !== feedSig())) feedAgain = true; return; }
  if (!S.feed) S.feed = (await getMeta('feed')) || null;
  const fresh = S.feed && S.feed.lang === LNG() && S.feed.sig === feedSig() && Date.now() - S.feed.at < FEED_TTL && !(S.feed.retryAt && Date.now() > S.feed.retryAt);
  if (fresh && !force) { renderFeed(); return; }
  if (!navigator.onLine) { renderFeed(); return; }
  feedLoading = true;
  const prev = (S.feed && S.feed.rows) || {};
  S.feed = { at: Date.now(), lang: LNG(), sig: feedSig(), rows: { ...prev }, loading: {} }; S.feedErr = {};
  const rows = FEED_ROWS.filter(r => !r.local && r.need());
  rows.forEach(r => { S.feed.loading[r.key] = true; });
  renderFeed();
  // se il telefono mette l'app in pausa durante il caricamento, le richieste scadono tutte insieme: lo annoto per riprovare al ritorno
  let paused = document.visibilityState !== 'visible';
  const onVis = () => { if (document.visibilityState !== 'visible') paused = true; };
  document.addEventListener('visibilitychange', onVis);
  // TMDB e Google Libri in parallelo; MusicBrainz e Discogs vanno piano per i loro limiti
  await Promise.all(rows.map(async r => {
    try {
      const L = await FEED_FETCH[r.key]();
      // fonte che non risponde: tengo le novità di prima invece di svuotare la riga
      if ((L && L.length) || !(prev[r.key] || []).length) S.feed.rows[r.key] = L;
    } catch (e) { console.warn('feed', r.key, e); }
    delete S.feed.loading[r.key]; renderFeed(r.key);
  }));
  document.removeEventListener('visibilitychange', onVis);
  feedLoading = false;
  const failed = Object.keys(S.feedErr).length > 0;
  // fonti che non hanno risposto: riprovo presto (dopo un minuto se l'app era in pausa, altrimenti dopo 10) invece che tra 12 ore
  S.feed.retryAt = failed && paused ? Date.now() + 60e3 : failed || rows.some(r => !(S.feed.rows[r.key] || []).length && ['album', 'libri', 'cinema'].includes(r.key)) ? Date.now() + 10 * 60e3 : 0;
  S.feed.err = { ...S.feedErr };
  const { loading, ...save } = S.feed; await setMeta('feed', save).catch(() => {});
  renderFeed();
  if (feedAgain) { feedAgain = false; if (S.view === 'home') loadFeed(true); }
}
function viewHome() {
  const empty = !live().filter(i => !i.desiderio).length;
  return `${mainHeader('home')}
  <div class="home">
    ${empty ? `<div class="hint"><b>Benvenuto in Spinyl!</b><span>Aggiungi i tuoi primi libri, dischi e film: qui compariranno le novità dei tuoi autori, artisti e registi.</span><button class="btn primary" data-a="add">${ic('plus', 18)}Aggiungi</button></div>` : ''}
    <div id="feedRows"></div>
    <p class="note home-foot" id="feedFoot"></p>
    ${FEEDBACK_URL ? '<p class="note home-foot"><button class="more" data-a="feedback" data-v="idea">Un problema o un\'idea? Scrivici</button></p>' : ''}
  </div>`;
}
function feedCard(c, rowKey, i) {
  if (c.link) {
    const ago = c.at ? Math.max(0, Math.round((Date.now() - c.at) / 864e5)) : null;
    return `<a class="fcard art" href="${esc(c.link)}" target="_blank" rel="noopener">${c.coverUrl ? `<img class="cover" src="${esc(c.coverUrl)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'cover noimg',textContent:'📰'}))">` : '<div class="cover noimg">📰</div>'}
      <i class="akind">${esc(ART_KIND[c.kind] || '')}</i><b translate="no">${esc(c.titolo)}</b><span><span translate="no">${esc(c.fonte)}</span>${ago != null ? ` · ${ago === 0 ? 'oggi' : ago === 1 ? 'ieri' : ago + ' gg fa'}` : ''}</span></a>`;
  }
  if (c.local || c.id) {
    const it = byId(c.id) || c; if (!it || it.deleted) return '';
    const sub = rowKey === 'offerte' ? `da ${money(c.prezzo, c.cur)}` : rowKey === 'ricorda' ? `${it.prestatoA} · ${loanDue(it) != null ? loanTag(it) : loanDays(it) + ' gg'}` : [it.autore, it.anno].filter(Boolean).join(' · ');
    return `<button class="fcard t-${esc(it.tipo)}" data-a="open" data-id="${esc(it.id)}">${coverHTML(it)}<b translate="no">${esc(it.titolo)}</b><span ${rowKey === 'offerte' || rowKey === 'ricorda' ? '' : 'translate="no"'}>${esc(sub)}</span></button>`;
  }
  const badge = owned(c) ? `<i class="fbadge own">Ce l'hai</i>` : wished(c) ? `<i class="fbadge">★</i>` : '';
  const when = c.uscita && c.uscita > isoDay(Date.now()) ? new Date(c.uscita + 'T12:00:00').toLocaleDateString(LOC(), { day: 'numeric', month: 'short' }) : '';
  return `<button class="fcard t-${esc(c.tipo)}" data-a="feedOpen" data-row="${rowKey}" data-i="${i}">${coverHTML(c)}${badge}<b translate="no">${esc(c.titolo)}</b><span translate="no">${esc(when || [c.autore, c.anno].filter(Boolean).join(' · '))}</span></button>`;
}
function renderFeed(onlyKey) {
  const box = $('#feedRows'); if (!box || S.view !== 'home') return;
  const rowHTML = r => {
    const list = r.local ? localRow(r.key) : ((S.feed && S.feed.rows && S.feed.rows[r.key]) || []);
    const loading = S.feed && S.feed.loading && S.feed.loading[r.key];
    if (!list.length && !loading) return '';
    const cards = list.length ? list.map((c, i) => feedCard(c, r.key, i)).join('') : Array.from({ length: 4 }, () => '<div class="fcard skel"><div class="cover"></div><b></b><span></span></div>').join('');
    return `<section class="feedrow" data-row="${r.key}"><h3><span aria-hidden="true">${r.icon}</span> ${esc(r.title)}${loading && list.length ? ' <i class="spinner sm"></i>' : ''}</h3><div class="hscroll">${cards}</div></section>`;
  };
  if (onlyKey) {
    const r = FEED_ROWS.find(x => x.key === onlyKey); const old = box.querySelector(`[data-row="${onlyKey}"]`);
    const html = rowHTML(r);
    if (old) { if (html) old.outerHTML = html; else old.remove(); }
    else if (html) { box.innerHTML = FEED_ROWS.map(rowHTML).join(''); }
  } else box.innerHTML = FEED_ROWS.map(rowHTML).join('');
  hydratePhotos(box);
  const foot = $('#feedFoot');
  if (foot) foot.innerHTML = S.feed && S.feed.at && !feedLoading ? `<span>Aggiornato il ${esc(fmtDateTime(S.feed.at))}</span> · <button class="more" data-a="feedRefresh">Aggiorna</button>${Object.keys(S.feed.err || {}).length ? ((commMe() || {}).admin ? `<br><small class="feederr" translate="no">${esc(Object.entries(S.feed.err).map(([k, v]) => k + ' → ' + v).join(' | '))}</small>` : `<br><small class="feederr">Alcune fonti non hanno risposto: riprovo tra poco.</small>`) : ''}` : feedLoading ? '' : (!navigator.onLine ? '<span>Sei offline: le novità arrivano appena torna la connessione.</span>' : '');
  if (!box.innerHTML.trim() && !feedLoading) box.innerHTML = `<p class="note" style="padding:20px 4px">Ancora nessuna novità: aggiungi qualche pezzo alla collezione e torna qui.</p>`;
}
async function feedOpen(el) {
  const row = el.dataset.row; const c = ((S.feed.rows || {})[row] || [])[+el.dataset.i]; if (!c) return;
  S.feedItem = c;
  const when = c.uscita ? new Date(c.uscita + (c.uscita.length === 10 ? 'T12:00:00' : '')).toLocaleDateString(LOC(), c.uscita.length >= 10 ? { day: 'numeric', month: 'long', year: 'numeric' } : { month: 'long', year: 'numeric' }) : '';
  const own = owned(c), wish = wished(c);
  openSheet(`<div class="pickcard">${coverHTML(c)}<div><b translate="no">${esc(c.titolo)}</b><span translate="no">${esc([c.autore, c.editore].filter(Boolean).join(' · '))}</span>
      ${when ? `<small>${c.uscita > isoDay(Date.now()) ? 'Esce il' : 'Uscito il'} <span translate="no">${esc(when)}</span></small>` : ''}</div></div>
    ${c.descrizione ? `<div class="prose clamp" translate="no" style="margin-top:12px">${esc(c.descrizione)}</div>` : ''}
    ${own ? `<div class="verdict ok" style="margin-top:12px"><b>✓</b>Ce l'hai già</div>` : wish ? `<div class="verdict wish" style="margin-top:12px"><b>★</b>È nella tua lista desideri</div>` : ''}
    ${linksHTML(c).replace('class="section"', 'class="section" style="margin-top:12px"')}
    <div class="stack" style="padding-top:12px">
      ${!own && !wish ? `<button class="btn primary block" data-a="feedWish">Aggiungi ai desideri</button>` : ''}
      ${!own ? `<button class="btn block" data-a="feedOwn">Ce l'ho: aggiungi alla collezione</button>` : ''}
    </div>`);
}
async function feedAdd(wish) {
  const c = S.feedItem; if (!c) return;
  openSheet(`<h2>Un attimo…</h2>${loadingHTML('Recupero i dettagli')}`);
  const data = await enrich({ ...c }); delete data.uscita;
  if (!data.formato && TIPI[data.tipo]) data.formato = '';
  closeSheet();
  if (wish) { const it = normalize({ ...EMPTY(), ...data, desiderio: true }); await saveItem(it); toast('Aggiunto ai desideri'); renderFeed(); return; }
  S.intoDraft = false; startDraft(data, false);
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
  cropPhoto: el => cropStoredPhoto(el.dataset.v),
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
    if (isNew && commMe()) { if (d.condiviso == null) d.condiviso = sharePref(d); else try { localStorage.setItem('shareNew', d.condiviso ? '1' : '0'); } catch (e) {} }
    if (!isNew) { const orig = byId(d.id); (orig?.foto || []).filter(p => !d.foto.includes(p)).forEach(p => DB.del('photos', p)); }
    await saveItem(d);
    toast(isNew ? 'Aggiunto allo scaffale' : 'Salvato');
    if (isNew) { history.replaceState({ view: 'detail', id: d.id }, ''); S.view = 'detail'; S.id = d.id; render(); window.scrollTo(0, 0); }
    else history.back();
  },

  edit: el => { const it = byId(el.dataset.id); S.draft = { ...EMPTY(), ...JSON.parse(JSON.stringify(it)) }; S.draft.foto = S.draft.foto || []; S.draft.commenti = S.draft.commenti || []; S.draft.tags = S.draft.tags || []; S.draftIsNew = false; S.newPhotos = []; go('edit'); },
  rateDetail: async el => { const it = byId(S.id); const v = +el.dataset.v; it.valutazione = it.valutazione === v ? 0 : v; await saveItem(it); el.parentElement.outerHTML = starsHTML(it.valutazione, 'rateDetail'); },
  expand: () => { S.expanded = true; render(); },
  returned: async () => { const it = byId(S.id); it.prestatoA = ''; it.prestatoIl = ''; it.restituireEntro = ''; await saveItem(it); render(); toast('Segnato come restituito'); },
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
  syncNow: () => sync(true),
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
  listen: () => { listenSheet(); listenGo(); },
  listenGo: () => listenGo(),
  replyTo: el => replyTo(el),
  replyCancel: () => replyCancel(),
  quoteJump: el => quoteJump(el),
  songSearch: () => { const x = S.song; if (!x) return; S.coverMode = null; S.pickWish = false; sheetSearch('vinile', [x.artist, x.album].filter(Boolean).join(' '), '', { auto: true }); },
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
  discogsCheck: () => discogsCheck(),
  addBatch: () => { S.batchTipo = S.addTipo; closeSheet(); startBatch(); },
  openBatch: () => go('batch'),
  batchScan: () => startBatch(),
  batchTipo: el => { S.batchTipo = el.dataset.v; render(); },
  batchRemove: el => { S.batch = S.batch.filter(r => r.id !== el.dataset.v); saveBatch(); render(); },
  batchClear: () => { if (!confirm(tr('Svuotare la coda?'))) return; S.batch = []; saveBatch(); render(); },
  batchChoose: el => { const r = S.batch.find(x => x.id === el.dataset.v); if (!r || !r.alts) return; S.batchTarget = r.id; S.candidates = r.alts; openSheet(`<h2>Quale di questi?</h2><div class="results">${resultsHTML(r.alts)}</div>`); },
  batchSearch: el => { const r = S.batch.find(x => x.id === el.dataset.v); if (!r) return; S.intoDraft = false; S.pickWish = false; sheetSearch(r.tipo, '', r.code); S.batchTarget = r.id; },
  batchSave: () => batchSave(),
  mainTab: el => { S.main = el.dataset.v; try { localStorage.setItem('mainTab', S.main); } catch (e) {} go(S.main, null, true); },
  feedOpen: el => feedOpen(el),
  feedWish: () => feedAdd(true),
  feedOwn: () => feedAdd(false),
  feedRefresh: () => loadFeed(true),
  allowMass: () => { S.allowMass = true; sync(); toast('Sincronizzazione…', 1200); },
  showCopies: async () => {
    openSheet(`<h2>Copie di sicurezza</h2>${loadingHTML('Leggo le copie su Drive…')}`);
    let files = [];
    try { files = await listCopies(); } catch (e) { return openSheet(`<h2>Copie di sicurezza</h2><p class="lead">Non riesco a leggere Drive: controlla la connessione o accedi di nuovo.</p>`); }
    const fmt = n => new Date(n.slice(9, 19) + 'T12:00:00').toLocaleDateString(LOC(), { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
    openSheet(`<h2>Copie di sicurezza</h2>
      <p class="lead">Ogni giorno in cui modifichi la collezione, Spinyl tiene una copia su Drive (cartella Scaffale › copie). Restano le ultime ${COPIES_KEEP}.</p>
      ${files.length ? `<div class="results">${files.map(f => `<div class="result static"><div class="grow"><b>${esc(fmt(f.name))}</b><span>${f.size ? Math.round(f.size / 1024) + ' KB' : ''}</span></div><button class="btn" style="min-height:40px" data-a="restoreCopy" data-v="${esc(f.id)}" data-label="${esc(fmt(f.name))}">Ripristina</button></div>`).join('')}</div>`
        : '<p class="note">Ancora nessuna copia: la prima viene creata alla prossima modifica.</p>'}`);
  },
  restoreCopy: el => restoreCopy(el.dataset.v, el.dataset.label),
  addCover: () => { closeSheet(); startCover('add', S.addTipo); },
  checkCover: () => { closeSheet(); startCover('check', S.coverTipo || localStorage.getItem('coverTipo') || 'vinile'); },
  scanCover: () => { const check = Scanner.mode === 'check'; Scanner.stop(); startCover(check ? 'check' : 'add', check ? (S.coverTipo || localStorage.getItem('coverTipo') || 'vinile') : S.addTipo); },
  searchTipo: el => {
    const t = el.dataset.v; S.searchCtx.tipo = t; S.coverTipo = t; try { localStorage.setItem('coverTipo', t); } catch (e) {}
    document.querySelectorAll('[data-a=searchTipo]').forEach(b => b.classList.toggle('on', b === el));
    const cr = $('#countryRow'); if (cr) cr.classList.toggle('hidden', !isMusic(t));
    const ch = $('#countryHint'); if (ch) ch.classList.toggle('hidden', !isMusic(t));
    const q = $('#titleQ'); if (q) { q.placeholder = tr(searchPlaceholder(t)); if (q.value.trim()) $('#titleSearch').requestSubmit(); }
  },
  batchForce: el => { const r = S.batch.find(x => x.id === el.dataset.v); if (r) { r.force = !r.force; saveBatch(); render(); } },
  exportCsv: () => exportCsv(),
  importCsv: () => $('#csvInput').click(),
  importDiscogs: () => importDiscogs(),
  importGo,
  reloadApp: () => location.reload(),
  commJoin: () => commJoinSheet(),
  commJoinGo: () => commJoin(),
  commLogin: () => Drive.login(),
  commStar: el => { const v = +el.dataset.v; S.commStars = S.commStars === v ? 0 : v; el.parentElement.outerHTML = starsHTML(S.commStars, 'commStar'); },
  commSend: () => commSend(),
  commReply: el => commReply(el.dataset.id),
  commDel: el => commDel(el.dataset.kind, el.dataset.id),
  commReport: el => commReport(el.dataset.kind, el.dataset.id),
  commInvite: () => commInvite(),
  welcomeStep: el => welcomeOpen(el.dataset.v),
  groupNew: () => groupNew(),
  groupCreate: () => groupCreate(),
  groupOpen: el => groupOpen(el.dataset.id),
  groupInfo: () => groupInfo(),
  groupBack: () => { const g = S.group; if (g) groupOpen(g.id); },
  groupAddSheet: () => groupAddSheet(),
  groupRename: async () => { const g = S.group; if (!g) return; const n = prompt(tr('Nuovo nome del gruppo'), g.name); if (!n || n.trim().length < 2) return;
    try { await comm('groupRename', { id: g.id, name: n.trim() }); toast('Gruppo rinominato'); groupOpen(g.id); } catch (e) { toast(commErrMsg(e)); } },
  groupRemove: async el => { const g = S.group; if (!g || !confirm(tr('Togliere dal gruppo?') + ' ' + el.dataset.nick)) return;
    try { await comm('groupRemove', { id: g.id, member: el.dataset.id }); g.members = g.members.filter(x => x.id !== el.dataset.id); groupInfo(); } catch (e) { toast(commErrMsg(e)); } },
  groupLeave: async () => { const g = S.group; if (!g || !confirm(tr('Uscire dal gruppo? Non riceverai più i suoi messaggi.'))) return;
    try { await comm('groupLeave', { id: g.id }); toast('Sei uscito dal gruppo'); closeSheet(); S.group = null; if (S.view === 'community') loadCommunity(); } catch (e) { toast(commErrMsg(e)); } },
  sharedChat: async () => { await newChat(); const t = $('#chatText'); if (t) t.value = S.sharedMsg || ''; },
  sharedPost: () => { newPost(); S.postPrefill = S.sharedMsg || ''; },
  sharedSearch: () => { const s = S.shared || {}; const w = String(s.title || s.text || '').replace(/https?:\/\/\S+/g, '').trim(); S.intoDraft = false; S.pickWish = false; S.coverMode = null; sheetSearch(S.addTipo || 'libro', w.slice(0, 120)); },
  editOpen: el => editOpen(el),
  editSave: () => editSave(),
  editCancel: () => { const e = S.edit; S.edit = null; if (e) editBack(e.ctx); else closeSheet(); },
  msgDel: el => msgDel(el),
  inviteSend: () => shareText(($('#invText') || {}).value || S.inviteMsg || '', 'Spinyl'),
  inviteCopy: async () => { try { await navigator.clipboard.writeText(($('#invText') || {}).value || ''); toast('Copiato'); } catch (e) { const t = $('#invText'); if (t) { t.select(); document.execCommand('copy'); toast('Copiato'); } } },
  profileOpen: el => profileOpen(el.dataset.id),
  profileEdit: () => profileEdit(),
  profileSave: () => profileSave(),
  profileChat: () => { const p = S.profile; if (p) newChat(p.id); },
  profileAsk: el => { const p = S.profile; const x = p && p.offers[+el.dataset.i]; if (!x) return; S.commMatch = { available: [x] }; offerSheet({ dataset: { to: p.id, nick: p.nick, mode: 'ask', m: 'available', i: '0' } }); },
  profileBlock: async () => { const p = S.profile; if (!p) return; if (!p.blocked && !confirm(tr('Bloccare questa persona? Non potrà più scriverti e non vedrai più i suoi contenuti.'))) return;
    try { await comm('block', { member: p.id, off: p.blocked }); toast(p.blocked ? 'Sbloccato' : 'Bloccato'); profileOpen(p.id); } catch (e) { toast(commErrMsg(e)); } },
  rateSheet: () => rateSheet(),
  rateStar: el => { S.rateStars = +el.dataset.v; $('#rateStars').innerHTML = starsHTML(S.rateStars, 'rateStar'); },
  rateSend: () => rateSend(),
  rateBack: () => { const t = S.thread; S.threadOpenId = null; if (t) threadOpen(t.id); },
  loanIcs: () => loanIcs(),
  feedback: el => feedbackSheet(el.dataset.v),
  fbKind: el => feedbackSheet(el.dataset.v, { text: ($('#fbText') || {}).value, contact: ($('#fbContact') || {}).value }),
  fbSend: el => fbSend(el),
  feedbackAdmin: () => feedbackAdmin(),
  fbStatus: el => comm('feedbackStatus', { id: el.dataset.id, status: 'fatto' }).then(feedbackAdmin).catch(e => toast(commErrMsg(e))),
  fbErrDone: el => comm('feedbackStatus', { error: el.dataset.id }).then(feedbackAdmin).catch(e => toast(commErrMsg(e))),
  pushTest: el => pushTest(el.dataset.v === 'later'),
  goScambi: () => { S.commSeg = 'scambi'; render(); },
  shareWishOn: () => { try { localStorage.setItem('shareWish', '1'); } catch (e) {} commSyncShares(true).then(() => { toast('Lista desideri condivisa'); loadCommunity(); }).catch(er => toast(commErrMsg(er))); },
  welcome: () => welcomeOpen(0),
  welcomeAdd: () => sheetAdd(),
  welcomeJoin: () => { closeSheet(); if (!Drive.token()) return toast('Prima collega Google Drive: la community usa lo stesso accesso', 5000); commJoinSheet(); },
  wishSearch: () => { S.intoDraft = false; S.coverMode = null; sheetSearch(S.addTipo); S.pickWish = true; },
  discWork: () => { const x = S.disc && S.disc.item; if (x) workSheet(x); },
  discOffer: () => { const x = S.disc && S.disc.item; if (!x) return; S.commMatch = { tmp: [x] }; offerSheet({ dataset: { m: 'tmp', i: '0', to: x.member, nick: x.nick, mode: x.kind === 'wish' ? 'give' : 'ask' } }); },
  discDel: async el => { if (!confirm(tr('Eliminare il commento?'))) return; try { await comm('delete', { kind: 'comment', id: el.dataset.id }); discussionOpen(S.disc.q); } catch (e) { toast(commErrMsg(e)); } },
  notifsOpen: () => notifsOpen(),
  pushEnable: () => pushEnable(),
  notifGo: el => notifGo(+el.dataset.i),
  legal: el => legalOpen(el.dataset.v),
  commExport: () => commExport(),
  commDelete: () => commDeleteSheet(),
  commDeleteGo: () => commDeleteGo(),
  commNew: () => commNew(),
  newChat: () => newChat(),
  newShare: () => newShare(),
  newPost: () => newPost(),
  pickDo: el => { const it = byId(el.dataset.id); const cb = S.pickCb; if (it && cb) cb(it); },
  eventNew: () => eventNew(),
  eventFromWork: () => { const c = commCtx(); if (c) eventNew(c); },
  evKind: el => evPick('kind', el),
  evVis: el => evPick('visibility', el),
  eventCreate: () => eventCreate(),
  eventOpen: el => eventOpen(el.dataset.id),
  rsvp: el => rsvp(el.dataset.v),
  eventIcs: () => eventIcs(),
  eventInvite: () => eventInvite(),
  eventDel: () => eventDel(),
  eventShare: () => eventShare(),
  commSeg: el => { S.commSeg = el.dataset.v; render(); },
  boardOpen: el => boardOpen(+el.dataset.i),
  offerSheet: el => offerSheet(el),
  offerKind: el => offerKind(el),
  offerSend: () => offerSend(),
  threadOpen: el => threadOpen(el.dataset.id),
  threadBlock: () => threadBlock(),
  postSheet: () => postSheet(),
  postSend: () => postSend(),
  postOpen: el => postOpen(el.dataset.id),
  postDel: el => postDel(el.dataset.id),
  workWish: () => { const c = S.commWork; if (!c) return; S.feedItem = { tipo: c.tipo, titolo: c.titolo, autore: c.autore, coverUrl: c.cover }; feedAdd(true); },
  commMore: () => { S.commAll = true; const it = byId(S.id); if (it) renderComm(it); },
  forceUpdate: () => forceUpdate(),
});
// "Aggiungi un'altra copia": procedi ignorando il duplicato
actions.dupAnyway = () => { const p = S.pendingCode; closeSheet(); handleCode(p.code, p.tipo, 'force'); };

document.addEventListener('click', e => {
  if (e.target.closest('a.ulink')) return; // link scritto da un utente: si apre e basta
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
  if (t.id === 'pushT') { t.checked ? pushEnable() : pushDisable(); return; }
  if (t.id === 'errT') { try { localStorage.setItem('errReport', t.checked ? '1' : '0'); } catch (er) {} return; }
  if (t.id === 'commSoundT') { try { localStorage.setItem('commSound', t.checked ? '1' : '0'); } catch (er) {} if (t.checked) commDing(); }
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
    const country = isMusic(S.searchCtx.tipo) ? (($('#titleCountry') || {}).value || '') : '';
    if (isMusic(S.searchCtx.tipo)) try { localStorage.setItem('pressCountry', country); } catch (er) {}
    const list = await searchByTitle(S.searchCtx.tipo, q, country).catch(() => []);
    if (S.searchCtx.code) list.forEach(c => { c.codice = S.searchCtx.code; });
    box.innerHTML = list.length ? resultsHTML(list) : `<p class="note" style="padding:12px 4px">Nessun risultato. Prova con parole diverse${navigator.onLine ? '' : ' (sei offline)'}.</p>`;
  }
  if (e.target.id === 'songForm') {
    const q = $('#songQ').value.trim(); if (!q) return; $('#songQ').blur();
    if (S.listenStop) S.listenStop(true);
    songResult({ title: q, artist: '', album: '' }, true);
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
    try {
      let blob;
      if (files.length === 1) { const big = await compressImage(f, 2000, 0.9); blob = await cropImage(big, { skipLabel: 'Usa così' }) || await compressImage(big); } // una foto: si può ritagliare subito
      else blob = await compressImage(f);
      const id = uid(); await DB.put('photos', { id, blob }); S.draft.foto.push(id); S.newPhotos.push(id); }
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
  if (cfg('clientId') && !Drive.token() && S.dirty && safeToLeave()) { Drive.silentLogin(); return; }
  scheduleSync(800);
  if (S.swReg) S.swReg.update().catch(() => {}); // controlla se è uscita una nuova versione
  commUnreadCheck(60e3); // tornando nell'app: aggiorna se è passato almeno un minuto
  pushRefresh();
  if (S.view === 'home' && S.feed && S.feed.retryAt && Date.now() > S.feed.retryAt) setTimeout(() => loadFeed(), 1500); // novità non caricate: riprova
});

/* ── Avvio ─────────────────────────────────────────────────── */
(async function init() {
  await DB.open();
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  try { const g = new URLSearchParams(location.search).get('go'); if (g) { S.pushGo = g; history.replaceState(null, '', location.pathname + location.hash); } } catch (e) {}
  // condivisione da un'altra app (Android: Condividi › Spinyl)
  try { const q = new URLSearchParams(location.search); if (q.has('url') || q.has('text') || q.has('title')) { S.shared = { title: q.get('title') || '', text: q.get('text') || '', url: q.get('url') || '' }; history.replaceState(null, '', location.pathname + location.hash); } } catch (e) {}
  try { const inv = new URLSearchParams(location.search).get('invito'); if (inv) { localStorage.setItem('invito', inv.toUpperCase().slice(0, 12)); history.replaceState(null, '', location.pathname + location.hash); S.openJoin = true; } } catch (e) {}
  const justLogged = Drive.handleRedirect();
  await loadItems();
  S.dirty = !!(await getMeta('dirty'));
  S.lastSync = (await getMeta('lastSync')) || 0;
  S.batch = ((await getMeta('batch')) || []).map(r => (r.status === 'busy' ? { ...r, status: 'wait' } : r));
  S.main = ['list', 'community'].includes(localStorage.getItem('mainTab')) ? localStorage.getItem('mainTab') : 'home'; S.view = S.main;
  history.replaceState({ view: S.main }, '');
  if (window.I18N) I18N.start();
  render();
  if (commMe()) setTimeout(() => {
    commUnreadCheck(); commSharesSoon(100);
    if (S.pushGo) { const g = S.pushGo; S.pushGo = null; pushGo(g); }
    pushRefresh(); // a ogni avvio: questo telefono riceve le notifiche di chi lo sta usando ora
  }, 1500);
  if (S.shared) setTimeout(sharedOpen, 700);
  if (S.openJoin && !commMe() && COMM_URL) setTimeout(() => Drive.token() && !(isIOS() && !isStandalone()) ? commJoinSheet() : inviteLanding(), 900);
  if (localStorage.getItem('gtoken')) localStorage.setItem('gEverLogged', '1'); // chi ha già fatto l'accesso in passato
  if (cfg('clientId')) {
    if (Drive.token()) { sync(); if (justLogged === true) toast('Collegato a Google Drive'); }
    else { setSync('login'); setTimeout(() => { if (safeToLeave()) Drive.silentLogin(); }, 600); }
  }
  if (!maybeWelcome()) maybeWhatsNew();
  runBatch(); runCovers();
  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
      S.swReg = reg; S.swChecked = Date.now();
      reg.addEventListener('updatefound', () => {
        const w = reg.installing; if (!w) return;
        w.addEventListener('statechange', () => { if (w.state === 'activated' && hadController) showUpdateBar(); });
      });
    }).catch(() => {});
    // l'app installata resta aperta per giorni: controlla gli aggiornamenti quando torna in primo piano
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && S.swReg && Date.now() - (S.swChecked || 0) > 10 * 60e3) { S.swChecked = Date.now(); S.swReg.update().catch(() => {}); }
    });
  }
})();
