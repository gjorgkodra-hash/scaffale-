/* Spinyl — traduzioni (italiano → inglese, spagnolo).
   L'interfaccia è scritta in italiano; questo file la traduce sullo schermo.
   I dati salvati restano invariati: cambia solo come vengono mostrati. */
(function () {
  'use strict';
  const LANGS = { it: 'Italiano', en: 'English', es: 'Español' };
  const LOCALES = { it: 'it-IT', en: 'en-GB', es: 'es-ES' };

  // [italiano, inglese, spagnolo]
  const T = [
    // Generale e navigazione
    ['Aggiungi', 'Add', 'Añadir'], ['Annulla', 'Cancel', 'Cancelar'], ['Salva', 'Save', 'Guardar'], ['Apri', 'Open', 'Abrir'],
    ['Chiudi', 'Close', 'Cerrar'], ['Cerca', 'Search', 'Buscar'], ['Modifica', 'Edit', 'Editar'], ['Elimina', 'Delete', 'Eliminar'],
    ['Indietro', 'Back', 'Atrás'], ['Impostazioni', 'Settings', 'Ajustes'], ['Sincronizza', 'Sync', 'Sincronizar'], ['Invia', 'Send', 'Enviar'],
    ['Accedi', 'Sign in', 'Iniciar sesión'], ['Ordina', 'Sort', 'Ordenar'], ['Restituito', 'Returned', 'Devuelto'],
    ['Un attimo…', 'One moment…', 'Un momento…'], ['Pronto', 'Ready', 'Listo'], ['Errore', 'Error', 'Error'],

    // Lista
    ['Cerca titolo, autore, codice, note…', 'Search title, author, code, notes…', 'Buscar título, autor, código, notas…'],
    ['Tutti', 'All', 'Todo'], ['Libri', 'Books', 'Libros'], ['Vinili', 'Vinyl', 'Vinilos'], ['Cassette', 'Tapes', 'Casetes'],
    ['Film', 'Film', 'Cine'], ['Desideri', 'Wishlist', 'Deseos'], ['In prestito', 'On loan', 'Prestado'], ['Desiderio', 'Wishlist', 'Deseo'],
    ['Aggiunti di recente', 'Recently added', 'Añadidos recientemente'], ['Titolo A–Z', 'Title A–Z', 'Título A–Z'],
    ['Autore A–Z', 'Author A–Z', 'Autor A–Z'], ['Anno', 'Year', 'Año'], ['Voto', 'Rating', 'Valoración'],
    ['Ci sono modifiche da salvare su Drive.', 'Some changes still need saving to Drive.', 'Hay cambios por guardar en Drive.'],
    ['Lo scaffale è vuoto', 'Your shelf is empty', 'Tu estantería está vacía'],
    ['Scansiona il codice a barre di un libro, un disco o un film: i dati si compilano da soli.', 'Scan the barcode of a book, record or film: the details fill in by themselves.', 'Escanea el código de barras de un libro, un disco o una película: los datos se rellenan solos.'],
    ['Aggiungi il primo', 'Add the first one', 'Añade el primero'], ['Nessun risultato.', 'No results.', 'Sin resultados.'],
    ['Senza titolo', 'Untitled', 'Sin título'],

    // Tipi
    ['Libro', 'Book', 'Libro'], ['Vinile', 'Vinyl', 'Vinilo'], ['Cassetta', 'Cassette', 'Casete'], ['Disco', 'Record', 'Disco'],
    ['Autore', 'Author', 'Autor'], ['Artista', 'Artist', 'Artista'], ['Regista', 'Director', 'Director'],
    ['Editore', 'Publisher', 'Editorial'], ['Etichetta', 'Label', 'Sello'], ['Distributore', 'Distributor', 'Distribuidora'],
    ['ISBN', 'ISBN', 'ISBN'], ['Codice a barre', 'Barcode', 'Código de barras'],

    // Aggiungi
    ['Scansiona il codice a barre', 'Scan the barcode', 'Escanear el código de barras'],
    ['Il modo più veloce: compila tutto da solo', 'The fastest way: fills everything in for you', 'La forma más rápida: lo rellena todo solo'],
    ['Cerca per titolo', 'Search by title', 'Buscar por título'],
    ['Se il codice manca o non viene trovato', 'If there is no code or it is not found', 'Si no hay código o no se encuentra'],
    ['Inserisci a mano', 'Enter manually', 'Introducir a mano'], ['Per edizioni rare o fatte in casa', 'For rare or home-made editions', 'Para ediciones raras o caseras'],
    ['Cerca libro', 'Search book', 'Buscar libro'], ['Cerca vinile', 'Search vinyl', 'Buscar vinilo'], ['Cerca CD', 'Search CD', 'Buscar CD'],
    ['Cerca cassetta', 'Search cassette', 'Buscar casete'], ['Cerca film', 'Search film', 'Buscar película'],
    ['Artista e titolo', 'Artist and title', 'Artista y título'], ['Titolo o autore', 'Title or author', 'Título o autor'], ['Titolo del film', 'Film title', 'Título de la película'],
    ['Quale di questi?', 'Which one?', '¿Cuál de estos?'], ['Nessuno, inserisco a mano', 'None, I’ll enter it manually', 'Ninguno, lo introduzco a mano'],
    ["Ce l'hai già", 'You already have it', 'Ya lo tienes'], ["Aggiungi un'altra copia", 'Add another copy', 'Añadir otra copia'],
    ['Sto cercando nei database online', 'Searching online databases', 'Buscando en bases de datos en línea'], ['Recupero i dettagli', 'Fetching details', 'Obteniendo detalles'],
    ['Inquadra il codice a barre', 'Point at the barcode', 'Apunta al código de barras'],
    ['📷 Scatta una foto del codice', '📷 Take a photo of the code', '📷 Haz una foto del código'],
    ['…oppure digita il codice', '…or type the code', '…o escribe el código'],
    ['Avvio la fotocamera…', 'Starting camera…', 'Iniciando cámara…'], ['Carico il lettore…', 'Loading scanner…', 'Cargando lector…'],
    ['Inquadra il codice a 15–20 cm, con buona luce', 'Hold the code 15–20 cm away, in good light', 'Coloca el código a 15–20 cm, con buena luz'],
    ['Leggo la foto…', 'Reading photo…', 'Leyendo la foto…'],
    ['Codice non leggibile nella foto. Riprova più vicino e dritto, oppure digitalo.', 'Code not readable in the photo. Try closer and straight on, or type it.', 'Código ilegible en la foto. Inténtalo más cerca y recto, o escríbelo.'],
    ['Lettore non disponibile: digita il codice qui sotto.', 'Scanner unavailable: type the code below.', 'Lector no disponible: escribe el código abajo.'],
    ['Fotocamera non disponibile: usa “Scatta una foto” o digita il codice.', 'Camera unavailable: use “Take a photo” or type the code.', 'Cámara no disponible: usa “Haz una foto” o escribe el código.'],
    ['Accesso alla fotocamera negato. Abilitalo in Impostazioni › Safari › Fotocamera, oppure usa “Scatta una foto”.', 'Camera access denied. Allow it in Settings › Safari › Camera, or use “Take a photo”.', 'Acceso a la cámara denegado. Actívalo en Ajustes › Safari › Cámara, o usa “Haz una foto”.'],
    ['Codice troppo corto', 'Code too short', 'Código demasiado corto'],
    ['Questo codice è di un vinile: l\'ho spostato lì', 'This code belongs to a vinyl: moved it there', 'Este código es de un vinilo: lo he movido allí'],
    ['Questo codice è di un CD: l\'ho spostato lì', 'This code belongs to a CD: moved it there', 'Este código es de un CD: lo he movido allí'],
    ['Questo codice è di una cassetta: l\'ho spostato lì', 'This code belongs to a cassette: moved it there', 'Este código es de un casete: lo he movido allí'],
    ['Sei offline: compila a mano, potrai cercare dopo', 'You are offline: fill it in by hand, you can search later', 'Estás sin conexión: rellénalo a mano, podrás buscar después'],
    ['Dati compilati', 'Details filled in', 'Datos rellenados'],

    // Modulo
    ['Nuovo pezzo', 'New item', 'Nuevo artículo'], ['Scansiona', 'Scan', 'Escanear'], ['Cerca online', 'Search online', 'Buscar en línea'],
    ['Dati', 'Details', 'Datos'], ['Titolo *', 'Title *', 'Título *'], ['Formato', 'Format', 'Formato'], ['Genere', 'Genre', 'Género'],
    ['Pagine', 'Pages', 'Páginas'], ['Durata', 'Running time', 'Duración'], ['Descrizione', 'Description', 'Descripción'], ['Tracce', 'Tracks', 'Pistas'],
    ['N. catalogo', 'Catalogue no.', 'N.º de catálogo'], ['Paese', 'Country', 'País'], ['Edizione', 'Edition', 'Edición'],
    ['Confezione', 'Packaging', 'Embalaje'], ['N. dischi', 'No. of discs', 'N.º de discos'], ['N. cassette', 'No. of tapes', 'N.º de casetes'], ['Dischi', 'Discs', 'Discos'],
    ['Codice SPARS', 'SPARS code', 'Código SPARS'], ['Tipo di nastro', 'Tape type', 'Tipo de cinta'], ['Riduzione rumore', 'Noise reduction', 'Reducción de ruido'],
    ['Durata nastro', 'Tape length', 'Duración de la cinta'], ['Marca nastro', 'Tape brand', 'Marca de la cinta'], ['Origine', 'Origin', 'Origen'], ['Nastro', 'Tape', 'Cinta'],
    ['Dettagli avanzati (per collezionisti)', 'Advanced details (for collectors)', 'Detalles avanzados (para coleccionistas)'],
    ['Matrice / runout (scritte incise vicino al centro)', 'Matrix / runout (etched near the centre)', 'Matriz / runout (grabado cerca del centro)'],
    ['Codici IFPI (mastering / mould SID)', 'IFPI codes (mastering / mould SID)', 'Códigos IFPI (mastering / mould SID)'],
    ['Matrice / runout', 'Matrix / runout', 'Matriz / runout'], ['Codici IFPI', 'IFPI codes', 'Códigos IFPI'],
    ['+ Modello Lato A / Lato B', '+ Side A / Side B template', '+ Plantilla Cara A / Cara B'],
    ['Lato A\n1. …\n\nLato B\n1. …', 'Side A\n1. …\n\nSide B\n1. …', 'Cara A\n1. …\n\nCara B\n1. …'],
    ['Foto', 'Photos', 'Fotos'], ['Copertina', 'Cover', 'Portada'], ['Rimuovi copertina', 'Remove cover', 'Quitar portada'], ['Rimuovi foto', 'Remove photo', 'Quitar foto'],
    ['La mia copia', 'My copy', 'Mi copia'], ['Condizione', 'Condition', 'Estado'], ['Prezzo pagato', 'Price paid', 'Precio pagado'],
    ['Condizione disco', 'Disc condition', 'Estado del disco'], ['Condizione copertina', 'Sleeve condition', 'Estado de la funda'],
    ['Condizione custodia e booklet', 'Case and booklet condition', 'Estado de la caja y el libreto'],
    ['Condizione nastro', 'Tape condition', 'Estado de la cinta'], ['Condizione j-card e custodia', 'J-card and case condition', 'Estado de la J-card y la caja'],
    ['Posizione (es. Salotto, scaffale 2)', 'Location (e.g. Living room, shelf 2)', 'Ubicación (p. ej. Salón, estante 2)'], ['Posizione', 'Location', 'Ubicación'],
    ['Il mio voto', 'My rating', 'Mi valoración'], ['Note', 'Notes', 'Notas'], ['Prestato a', 'Lent to', 'Prestado a'], ['Dal', 'Since', 'Desde'],
    ['Lista desideri (non ancora posseduto)', 'Wishlist (not owned yet)', 'Lista de deseos (aún no lo tengo)'],
    ['Serve almeno il titolo', 'A title is required', 'Hace falta al menos el título'],
    ['Aggiunto allo scaffale', 'Added to your shelf', 'Añadido a la estantería'], ['Salvato', 'Saved', 'Guardado'],
    ['Elaboro le foto…', 'Processing photos…', 'Procesando fotos…'], ['Formato foto non supportato', 'Photo format not supported', 'Formato de foto no compatible'],

    // Scheda
    ['Commenti', 'Comments', 'Comentarios'], ['Scrivi un commento…', 'Write a comment…', 'Escribe un comentario…'], ['Elimina commento', 'Delete comment', 'Eliminar comentario'],
    ['Eliminare questo commento?', 'Delete this comment?', '¿Eliminar este comentario?'], ['Leggi tutto', 'Read more', 'Leer más'],
    ['In prestito a', 'Lent to', 'Prestado a'], ['Segnato come restituito', 'Marked as returned', 'Marcado como devuelto'], ['Eliminato', 'Deleted', 'Eliminado'],
    ['Aggiunto il', 'Added on', 'Añadido el'], ['Dettagli', 'Details', 'Detalles'], ['Modifica', 'Edit', 'Editar'],

    // Valori
    ['Nuovo / sigillato', 'New / sealed', 'Nuevo / precintado'], ['Come nuovo', 'Like new', 'Como nuevo'], ['Ottimo', 'Excellent', 'Excelente'],
    ['Buono', 'Good', 'Bueno'], ['Discreto', 'Fair', 'Aceptable'], ['Rovinato', 'Poor', 'Deteriorado'],
    ['Copertina rigida', 'Hardcover', 'Tapa dura'], ['Brossura', 'Paperback', 'Rústica'], ['Tascabile', 'Pocket edition', 'Edición de bolsillo'],
    ['Edizione speciale', 'Special edition', 'Edición especial'], ['Fumetto', 'Comic', 'Cómic'],
    ['LP 33 giri', 'LP 33 rpm', 'LP 33 rpm'], ['45 giri (7")', '7" single (45 rpm)', 'Single 7" (45 rpm)'], ['Maxi 12"', '12" maxi', 'Maxi 12"'],
    ['Copertina singola', 'Single sleeve', 'Funda sencilla'], ['Busta interna stampata', 'Printed inner sleeve', 'Funda interior impresa'], ['Box', 'Box', 'Caja'],
    ['CD 8 cm', '8 cm CD', 'CD de 8 cm'], ['SACD ibrido', 'Hybrid SACD', 'SACD híbrido'],
    ['Microcassetta', 'Microcassette', 'Microcasete'], ['Custodia standard', 'Standard case', 'Caja estándar'],
    ['Tipo I (normale)', 'Type I (normal)', 'Tipo I (normal)'], ['Tipo II (cromo)', 'Type II (chrome)', 'Tipo II (cromo)'], ['Tipo IV (metal)', 'Type IV (metal)', 'Tipo IV (metal)'],
    ['Nessuna', 'None', 'Ninguna'], ['Originale stampata', 'Original release', 'Edición original'], ['Registrata in casa', 'Home recorded', 'Grabada en casa'],
    ['Inserti / poster presenti', 'Inserts / poster included', 'Con encartes / póster'], ['Booklet presente', 'Booklet included', 'Con libreto'],
    ['Custodia da sostituire', 'Case needs replacing', 'Caja para cambiar'], ['J-card presente', 'J-card included', 'Con J-card'],
    ['Linguette anti-registrazione intatte', 'Record-protect tabs intact', 'Pestañas antigrabación intactas'],
    ['Nastro testato, suona bene', 'Tape tested, plays well', 'Cinta probada, suena bien'],

    // Impostazioni
    ['Lingua', 'Language', 'Idioma'], ['Google Drive', 'Google Drive', 'Google Drive'],
    ['Google Drive non configurato', 'Google Drive not set up', 'Google Drive no configurado'], ['Serve il Client ID Google (vedi la guida).', 'A Google Client ID is needed (see the guide).', 'Hace falta el Client ID de Google (ver la guía).'],
    ['Errore di sincronizzazione', 'Sync error', 'Error de sincronización'], ['Collegato a Google Drive', 'Connected to Google Drive', 'Conectado a Google Drive'],
    ['Accesso scaduto o non effettuato', 'Signed out or session expired', 'Sesión caducada o no iniciada'], ['Tocca "Accedi" per salvare su Drive.', 'Tap "Sign in" to save to Drive.', 'Toca "Iniciar sesión" para guardar en Drive.'],
    ['Accedi con Google', 'Sign in with Google', 'Iniciar sesión con Google'], ['Sincronizza ora', 'Sync now', 'Sincronizar ahora'], ['Esci da Google', 'Sign out of Google', 'Cerrar sesión de Google'],
    ['I dati sono salvati nel telefono e copiati nella cartella', 'Your data is stored on the phone and copied to the folder', 'Los datos se guardan en el teléfono y se copian en la carpeta'],
    ['del tuo Google Drive (file', 'in your Google Drive (file', 'de tu Google Drive (archivo'], ['e cartella', 'and folder', 'y carpeta'],
    ["). Puoi usare l'app anche offline: si sincronizza appena possibile.", '). You can use the app offline too: it syncs as soon as it can.', '). Puedes usar la app sin conexión: se sincroniza en cuanto puede.'],
    ['Backup', 'Backup', 'Copia de seguridad'], ['Esporta backup completo (con foto)', 'Export full backup (with photos)', 'Exportar copia completa (con fotos)'],
    ['Importa da backup', 'Import from backup', 'Importar desde copia'], ['Preparo il backup…', 'Preparing backup…', 'Preparando la copia…'],
    ['File di backup non valido', 'Invalid backup file', 'Archivo de copia no válido'], ['Ricerca online', 'Online search', 'Búsqueda en línea'],
    ['Libri: Google Libri + Open Library. Vinili, CD e cassette: MusicBrainz + Apple Music (+ Discogs con il token). Film: Apple TV. Con le chiavi facoltative qui sotto la ricerca migliora.',
      'Books: Google Books + Open Library. Vinyl, CDs and tapes: MusicBrainz + Apple Music (+ Discogs with the token). Films: Apple TV + Wikidata. The optional keys below improve the search.',
      'Libros: Google Books + Open Library. Vinilos, CD y casetes: MusicBrainz + Apple Music (+ Discogs con el token). Películas: Apple TV + Wikidata. Las claves opcionales de abajo mejoran la búsqueda.'],
    ['Chiavi facoltative e configurazione avanzata', 'Optional keys and advanced setup', 'Claves opcionales y configuración avanzada'],
    ['Chiave Google Libri (libri, facoltativa)', 'Google Books key (books, optional)', 'Clave de Google Books (libros, opcional)'],
    ['Chiave API TMDB (film, consigliata)', 'TMDB API key (films, recommended)', 'Clave API de TMDB (películas, recomendada)'],
    ['Token Discogs (vinili, CD, cassette)', 'Discogs token (vinyl, CDs, tapes)', 'Token de Discogs (vinilos, CD, casetes)'],
    ['Client ID Google', 'Google Client ID', 'Client ID de Google'], ['Salva impostazioni', 'Save settings', 'Guardar ajustes'],
    ['Impostazioni salvate', 'Settings saved', 'Ajustes guardados'], ['Accesso a Google annullato', 'Google sign-in cancelled', 'Inicio de sesión de Google cancelado'],
    ['Collegato a Google Drive', 'Connected to Google Drive', 'Conectado a Google Drive'], ['Manca il Client ID Google: vedi Impostazioni', 'Google Client ID missing: see Settings', 'Falta el Client ID de Google: ver Ajustes'],
    ['Sincronizzazione…', 'Syncing…', 'Sincronizando…'], ['Cartella su Drive non trovata, riprova', 'Drive folder not found, try again', 'Carpeta de Drive no encontrada, inténtalo de nuevo'],
  ];

  // Testi con parti variabili
  const P = [
    [/^(\d+) pezzi?$/, (m, l) => l === 'en' ? `${m[1]} item${m[1] === '1' ? '' : 's'}` : `${m[1]} artículo${m[1] === '1' ? '' : 's'}`],
    [/^Cerco (.+)…$/, (m, l) => (l === 'en' ? 'Searching ' : 'Buscando ') + m[1] + '…'],
    [/^Codice (.+) non trovato\. Prova con il titolo e l’artista\.$/, (m, l) => l === 'en' ? `Code ${m[1]} not found. Try the title and artist.` : `Código ${m[1]} no encontrado. Prueba con el título y el artista.`],
    [/^Codice (.+) non trovato\. Prova con il titolo\.$/, (m, l) => l === 'en' ? `Code ${m[1]} not found. Try the title.` : `Código ${m[1]} no encontrado. Prueba con el título.`],
    [/^Trovati (\d+) risultati per (.+)\.$/, (m, l) => l === 'en' ? `${m[1]} results for ${m[2]}.` : `${m[1]} resultados para ${m[2]}.`],
    [/^Importati (\d+) pezzi$/, (m, l) => l === 'en' ? `Imported ${m[1]} items` : `Importados ${m[1]} artículos`],
    [/^Eliminare "(.+)" dallo scaffale\?$/s, (m, l) => l === 'en' ? `Delete "${m[1]}" from your shelf?` : `¿Eliminar "${m[1]}" de la estantería?`],
    [/^dal (.+)$/, (m, l) => (l === 'en' ? 'since ' : 'desde ') + m[1]],
    [/^Spinyl (\S+) · (\d+) pezzi$/, (m, l) => l === 'en' ? `Spinyl ${m[1]} · ${m[2]} items` : `Spinyl ${m[1]} · ${m[2]} artículos`],
    [/^Ultima sincronizzazione: (.+)$/, (m, l) => (l === 'en' ? 'Last sync: ' : 'Última sincronización: ') + m[1]],
    [/^(\d) stelle$/, (m, l) => l === 'en' ? `${m[1]} star${m[1] === '1' ? '' : 's'}` : `${m[1]} estrella${m[1] === '1' ? '' : 's'}`],
    [/^N\. catalogo (.+)$/, (m, l) => (l === 'en' ? 'Catalogue no. ' : 'N.º de catálogo ') + m[1]],
  ];
  // "Film" da solo è una categoria; dentro "Film · DVD" indica un singolo pezzo
  const SING = { Film: { en: 'Film', es: 'Película' } };

  const dict = { en: new Map(), es: new Map() };
  T.forEach(([it, en, es]) => { if (en !== it) dict.en.set(it, en); if (es !== it) dict.es.set(it, es); });

  function detect() {
    try { const s = localStorage.getItem('cfg_lang'); if (s && LANGS[s]) return s; } catch (e) {}
    for (const l of (navigator.languages || [navigator.language || 'en'])) { const c = String(l).slice(0, 2).toLowerCase(); if (LANGS[c]) return c; }
    return 'en';
  }
  let lang = detect();

  function tr(s, segment) {
    if (lang === 'it' || s == null) return s;
    const str = String(s); const key = str.trim(); if (!key) return str;
    const d = dict[lang];
    let out = null;
    if (segment && SING[key]) out = SING[key][lang];
    else if (d.has(key)) out = d.get(key);
    else {
      for (const [rx, fn] of P) { const m = key.match(rx); if (m) { out = fn(m, lang); break; } }
      if (out == null && key.includes(' · ')) {
        const parts = key.split(' · '); const tp = parts.map(p => tr(p, true));
        if (tp.some((p, i) => p !== parts[i])) out = tp.join(' · ');
      }
    }
    if (out == null) return str;
    return str.replace(key, out);
  }

  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'NOSCRIPT']);
  const NOWALK = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);
  const ATTRS = ['placeholder', 'aria-label', 'title'];
  function translateTree(root) {
    if (lang === 'it' || !root) return;
    if (root.nodeType === 3) { translateText(root); return; }
    if (root.nodeType !== 1) return;
    if (root.closest && root.closest('[translate="no"]')) return;
    translateEl(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: n => (n.nodeType === 1 && (NOWALK.has(n.tagName) || n.getAttribute('translate') === 'no')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
    });
    let n; while ((n = w.nextNode())) { if (n.nodeType === 3) translateText(n); else translateEl(n); }
  }
  // Ricorda cosa è già stato tradotto, così una parola tradotta non viene ritradotta
  // (es. "Cassetta" → "Cassette", che in italiano è anche il plurale)
  const doneText = new WeakMap(), doneAttr = new WeakMap();
  function translateText(n) {
    const p = n.parentElement; if (!p || SKIP.has(p.tagName) || (p.closest && p.closest('[translate="no"]'))) return;
    const v = n.nodeValue; if (!v || !/[A-Za-zÀ-ú]/.test(v) || doneText.get(n) === v) return;
    const t = tr(v); if (t !== v) { doneText.set(n, t); n.nodeValue = t; }
  }
  function setAttr(el, a, v) {
    const done = doneAttr.get(el) || {}; if (done[a] === v) return;
    const t = tr(v); if (t !== v) { done[a] = t; doneAttr.set(el, done); el.setAttribute(a, t); }
  }
  function translateEl(el) {
    if (!el.getAttribute) return;
    for (const a of ATTRS) { const v = el.getAttribute(a); if (v) setAttr(el, a, v); }
    if (el.tagName === 'OPTION' && el.parentElement && el.parentElement.tagName === 'DATALIST') { const v = el.getAttribute('value'); if (v) setAttr(el, 'value', v); }
  }

  let obs = null;
  function start() {
    document.documentElement.lang = lang;
    if (obs) obs.disconnect();
    if (lang === 'it') return;
    translateTree(document.body);
    obs = new MutationObserver(list => {
      for (const m of list) {
        if (m.type === 'characterData') translateText(m.target);
        else m.addedNodes.forEach(translateTree);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  window.I18N = {
    LANGS, tr, start,
    lang: () => lang,
    locale: () => LOCALES[lang] || 'en-GB',
    set(l) { if (!LANGS[l]) return; lang = l; try { localStorage.setItem('cfg_lang', l); } catch (e) {} },
  };
})();
