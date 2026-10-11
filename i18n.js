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

    // Versione 2.0 — controllo veloce
    ["Ce l'ho già?", 'Do I have it?', '¿Ya lo tengo?'], ['Statistiche', 'Statistics', 'Estadísticas'],
    ['Controlla un altro', 'Check another', 'Comprobar otro'], ['È nella tua lista desideri', 'It’s on your wishlist', 'Está en tu lista de deseos'],
    ["L'ho comprato!", 'I bought it!', '¡Lo he comprado!'], ['Non è nella collezione: cerco cos’è', 'Not in your collection: finding out what it is', 'No está en tu colección: busco qué es'],
    ["Non ce l'hai", 'You don’t have it', 'No lo tienes'],
    ['Ci sono più edizioni con questo codice: scegli la tua quando lo aggiungi.', 'Several editions share this code: pick yours when you add it.', 'Hay varias ediciones con este código: elige la tuya al añadirlo.'],
    ["Hai già lo stesso titolo in un'altra edizione:", 'You already have the same title in another edition:', 'Ya tienes el mismo título en otra edición:'],
    ['Aggiungi alla collezione', 'Add to collection', 'Añadir a la colección'], ['Aggiungi ai desideri', 'Add to wishlist', 'Añadir a deseos'],
    ['Spostato nella collezione', 'Moved to your collection', 'Movido a tu colección'], ['Aggiunto ai desideri', 'Added to wishlist', 'Añadido a deseos'],
    ['Controllo veloce: inquadra il codice', 'Quick check: point at the barcode', 'Comprobación rápida: apunta al código'],

    // Scansione a raffica
    ['Scansione a raffica', 'Batch scan', 'Escaneo en serie'], ['Tanti pezzi di fila, li controlli alla fine', 'Many items in a row, check them at the end', 'Muchos artículos seguidos, los revisas al final'],
    ['Fine', 'Done', 'Listo'], ['Raffica: inquadra un codice dopo l’altro', 'Batch: scan one code after another', 'En serie: escanea un código tras otro'],
    ['Già in coda', 'Already in the queue', 'Ya en la cola'], ['In attesa', 'Waiting', 'En espera'], ['Cerco…', 'Searching…', 'Buscando…'],
    ['Trovato', 'Found', 'Encontrado'], ['Più edizioni', 'Several editions', 'Varias ediciones'], ['Non trovato', 'Not found', 'No encontrado'],
    ["Scegli l'edizione", 'Choose the edition', 'Elige la edición'], ['Togli dalla coda', 'Remove from queue', 'Quitar de la cola'], ['Svuota la coda', 'Clear the queue', 'Vaciar la cola'],
    ['Svuotare la coda?', 'Clear the queue?', '¿Vaciar la cola?'],
    ['Scegli il tipo e tocca “Scansiona”: leggi un codice dopo l’altro, senza fermarti.', 'Choose the type and tap “Scan”: read one code after another without stopping.', 'Elige el tipo y toca “Escanear”: lee un código tras otro sin parar.'],
    ['Cerco i dati un codice alla volta: puoi aspettare qui o continuare a scansionare.', 'Looking up one code at a time: wait here or keep scanning.', 'Busco los datos de un código cada vez: espera aquí o sigue escaneando.'],
    ['Controlla l’elenco, poi aggiungi tutto con un tocco.', 'Check the list, then add everything with one tap.', 'Revisa la lista y añádelo todo con un toque.'],
    ['Sei offline: la ricerca riparte appena torna la connessione.', 'You’re offline: the search resumes when the connection is back.', 'Estás sin conexión: la búsqueda se reanuda al volver la conexión.'],
    ['Aggiungi 1 pezzo', 'Add 1 item', 'Añadir 1 artículo'], ["Importato 1 pezzo", 'Imported 1 item', 'Importado 1 artículo'],
    ['1 dai desideri alla collezione', '1 moved from wishlist to collection', '1 pasa de deseos a la colección'], ['Aggiunto 1 pezzo', 'Added 1 item', 'Añadido 1 artículo'],

    // Stato, serie, etichette
    ['Da scoprire', 'To discover', 'Por descubrir'], ['Da leggere', 'To read', 'Por leer'], ['In lettura', 'Reading', 'Leyendo'], ['Letto', 'Read', 'Leído'],
    ['Da vedere', 'To watch', 'Por ver'], ['Visto', 'Watched', 'Visto'], ['Da ascoltare', 'To listen', 'Por escuchar'], ['Ascoltato', 'Listened', 'Escuchado'],
    ['Lettura', 'Reading', 'Lectura'], ['Visione', 'Watching', 'Visionado'], ['Ascolto', 'Listening', 'Escucha'],
    ['Serie', 'Series', 'Serie'], ['Serie / saga', 'Series / saga', 'Serie / saga'], ['Volume n.', 'Volume no.', 'Volumen n.º'], ['Ti mancano i volumi:', 'Missing volumes:', 'Te faltan los volúmenes:'],
    ['Etichette', 'Tags', 'Etiquetas'], ['Filtro', 'Filter', 'Filtro'],
    ['Etichette (separate da virgola, es. Prima stampa, Autografato)', 'Tags (comma separated, e.g. First pressing, Signed)', 'Etiquetas (separadas por comas, p. ej. Primera edición, Firmado)'],
    ['Valore', 'Value', 'Valor'], ['Valore stimato', 'Estimated value', 'Valor estimado'],

    // Prestiti e condivisione
    ['Ricordaglielo', 'Remind them', 'Recuérdaselo'], ['da oggi', 'since today', 'desde hoy'], ['da 1 giorno', 'for 1 day', 'desde hace 1 día'],
    ['Condividi la lista desideri', 'Share the wishlist', 'Compartir la lista de deseos'], ['La mia lista desideri', 'My wishlist', 'Mi lista de deseos'],
    ['Creata con Spinyl', 'Made with Spinyl', 'Creada con Spinyl'], ['Testo copiato: incollalo dove vuoi', 'Text copied: paste it wherever you like', 'Texto copiado: pégalo donde quieras'],
    ['La lista desideri è vuota', 'The wishlist is empty', 'La lista de deseos está vacía'],

    // Valore di mercato
    ['Valore di mercato', 'Market value', 'Valor de mercado'],
    ['Scopri quanto vale questa edizione: prezzo più basso in vendita oggi su Discogs.', 'See what this edition is worth: the lowest price on sale today on Discogs.', 'Descubre cuánto vale esta edición: el precio más bajo a la venta hoy en Discogs.'],
    ['1 copia in vendita', '1 copy for sale', '1 copia a la venta'], ['Nessuna copia in vendita su Discogs', 'No copies for sale on Discogs', 'Ninguna copia a la venta en Discogs'],
    ['prezzo minimo', 'lowest price', 'precio mínimo'], ['Vedi su Discogs', 'View on Discogs', 'Ver en Discogs'],
    ['Edizione trovata per titolo: controlla che sia la tua.', 'Edition matched by title: check it’s yours.', 'Edición encontrada por título: comprueba que sea la tuya.'],
    ['Controllo su Discogs…', 'Checking Discogs…', 'Consultando Discogs…'], ['Aggiorna da Discogs', 'Update from Discogs', 'Actualizar desde Discogs'],
    ['Controlla il valore su Discogs', 'Check the value on Discogs', 'Consultar el valor en Discogs'],
    ['Valore aggiornato', 'Value updated', 'Valor actualizado'], ['Edizione non trovata su Discogs', 'Edition not found on Discogs', 'Edición no encontrada en Discogs'],
    ['Discogs non risponde: riprova tra poco', 'Discogs isn’t responding: try again shortly', 'Discogs no responde: inténtalo en un rato'],
    ['Aggiornato 1 valore', 'Updated 1 value', 'Actualizado 1 valor'],

    // Ascolta / guarda
    ['Ascolta', 'Listen', 'Escuchar'], ['Guarda', 'Watch', 'Ver'], ['Leggi di più', 'Read more', 'Leer más'], ['Trailer', 'Trailer', 'Tráiler'],
    ['Google Libri', 'Google Books', 'Google Books'],

    // Statistiche e pesca a caso
    ['La tua collezione', 'Your collection', 'Tu colección'], ['pezzo', 'item', 'artículo'], ['pezzi', 'items', 'artículos'], ['desideri', 'wishlist', 'deseos'],
    ['spesi', 'spent', 'gastado'], ['valore stimato', 'estimated value', 'valor estimado'], ['Nessun dato ancora.', 'No data yet.', 'Aún no hay datos.'],
    ['Non sai cosa scegliere?', 'Can’t decide?', '¿No sabes qué elegir?'], ['Pesca a caso', 'Pick at random', 'Elegir al azar'],
    ['Per tipo', 'By type', 'Por tipo'], ['Per decennio', 'By decade', 'Por década'], ['Generi più presenti', 'Top genres', 'Géneros principales'],
    ['Autori e artisti più presenti', 'Top authors and artists', 'Autores y artistas principales'], ['Lettura, visione, ascolto', 'Reading, watching, listening', 'Lectura, visionado, escucha'],
    ['Libri letti', 'Books read', 'Libros leídos'], ['Film visti', 'Films watched', 'Películas vistas'], ['Dischi ascoltati', 'Records listened to', 'Discos escuchados'],
    ['Prestiti', 'Loans', 'Préstamos'], ['1 pezzo in prestito', '1 item on loan', '1 artículo prestado'], ['Nessun pezzo in prestito.', 'Nothing on loan.', 'Nada prestado.'],
    ['Valore dei dischi', 'Value of your records', 'Valor de los discos'], ['Aggiorna tutti i valori', 'Update all values', 'Actualizar todos los valores'],
    ['Niente da pescare qui', 'Nothing to pick here', 'Nada que elegir aquí'], ['Stasera ascolta…', 'Tonight, listen to…', 'Esta noche escucha…'],
    ['Stasera guarda…', 'Tonight, watch…', 'Esta noche mira…'], ['Adesso leggi…', 'Now read…', 'Ahora lee…'], ['Lo trovi in:', 'You’ll find it in:', 'Lo encontrarás en:'], ['Un altro', 'Another one', 'Otro'],

    // Esportare e importare
    ['Backup ed esportazione', 'Backup and export', 'Copia y exportación'], ['Esporta tabella CSV (Excel, Numbers)', 'Export CSV table (Excel, Numbers)', 'Exportar tabla CSV (Excel, Numbers)'],
    ['Importa da altre app', 'Import from other apps', 'Importar desde otras apps'],
    ['Porta qui una collezione che hai già catalogato altrove. I doppioni vengono saltati.', 'Bring in a collection you’ve already catalogued elsewhere. Duplicates are skipped.', 'Trae aquí una colección que ya hayas catalogado en otro sitio. Los duplicados se omiten.'],
    ['Collezione Discogs', 'Discogs collection', 'Colección de Discogs'], ['Per Discogs serve il token (qui sotto, in Ricerca online).', 'Discogs needs the token (below, under Online search).', 'Para Discogs hace falta el token (abajo, en Búsqueda en línea).'],
    ['File CSV: Goodreads, Letterboxd, Discogs', 'CSV file: Goodreads, Letterboxd, Discogs', 'Archivo CSV: Goodreads, Letterboxd, Discogs'],
    ['Goodreads: My Books › Import and export › Export Library. Letterboxd: Settings › Data › Export (usa watched.csv, ratings.csv o watchlist.csv). Discogs: Collection › Export.',
      'Goodreads: My Books › Import and export › Export Library. Letterboxd: Settings › Data › Export (use watched.csv, ratings.csv or watchlist.csv). Discogs: Collection › Export.',
      'Goodreads: My Books › Import and export › Export Library. Letterboxd: Settings › Data › Export (usa watched.csv, ratings.csv o watchlist.csv). Discogs: Collection › Export.'],
    ['1 pezzo nuovo', '1 new item', '1 artículo nuevo'], ['1 già presente', '1 already there', '1 ya presente'],
    ['Questi film li hai in DVD o Blu-ray, o li metto nei desideri?', 'Do you own these films on DVD or Blu-ray, or shall I put them on your wishlist?', '¿Tienes estas películas en DVD o Blu-ray, o las pongo en deseos?'],
    ['Li ho in collezione', 'I own them', 'Las tengo'], ['Mettili nei desideri', 'Put them on my wishlist', 'Ponlas en deseos'], ['Importa 1 pezzo', 'Import 1 item', 'Importar 1 artículo'],
    ['File CSV non leggibile', 'CSV file not readable', 'Archivo CSV ilegible'],
    ['Formato non riconosciuto: servono i CSV di Goodreads, Letterboxd o Discogs', 'Format not recognised: use the Goodreads, Letterboxd or Discogs CSV', 'Formato no reconocido: usa el CSV de Goodreads, Letterboxd o Discogs'],
    ['Serve il token Discogs', 'The Discogs token is needed', 'Hace falta el token de Discogs'], ['Leggo la tua collezione…', 'Reading your collection…', 'Leyendo tu colección…'],
    ['La collezione di', 'The collection of', 'La colección de'], ['su Discogs è vuota.', 'on Discogs is empty.', 'en Discogs está vacía.'],
    ['Non riesco a leggere la collezione. Controlla il token e la connessione, poi riprova.', 'I can’t read the collection. Check the token and connection, then try again.', 'No puedo leer la colección. Revisa el token y la conexión e inténtalo de nuevo.'],
    // Intestazioni CSV
    ['Tipo', 'Type', 'Tipo'], ['Titolo', 'Title', 'Título'], ['Autore / artista', 'Author / artist', 'Autor / artista'], ['Editore / etichetta', 'Publisher / label', 'Editorial / sello'],
    ['Volume', 'Volume', 'Volumen'], ['Codice', 'Code', 'Código'], ['Valore Discogs', 'Discogs value', 'Valor en Discogs'], ['Stato', 'Progress', 'Progreso'],
    ['Lista desideri', 'Wishlist', 'Lista de deseos'], ['Prestato il', 'Lent on', 'Prestado el'], ['Sì', 'Yes', 'Sí'],

    // Aggiornamento e novità
    ['È pronta una nuova versione di Spinyl.', 'A new version of Spinyl is ready.', 'Hay una nueva versión de Spinyl lista.'], ['Aggiorna', 'Update', 'Actualizar'], ['Inizia', 'Start', 'Empezar'],
    ['Ce l’ho già?', 'Do I have it?', '¿Ya lo tengo?'],
    ['Il tasto con la spunta in alto: scansioni un codice in negozio e scopri subito se ce l’hai.', 'The tick button at the top: scan a code in a shop and see at once whether you have it.', 'El botón con la marca arriba: escanea un código en la tienda y sabrás al momento si lo tienes.'],
    ['Da “Aggiungi”: leggi tanti codici di fila e li controlli alla fine.', 'From “Add”: scan lots of codes in a row and check them at the end.', 'Desde “Añadir”: lee muchos códigos seguidos y los revisas al final.'],
    ['Per vinili, CD e cassette: il prezzo minimo in vendita su Discogs.', 'For vinyl, CDs and tapes: the lowest price on sale on Discogs.', 'Para vinilos, CD y casetes: el precio mínimo a la venta en Discogs.'],
    ['Statistiche e pesca a caso', 'Statistics and random pick', 'Estadísticas y elección al azar'],
    ['Il tasto con il grafico: i numeri della collezione e cosa ascoltare stasera.', 'The chart button: your collection in numbers and what to play tonight.', 'El botón del gráfico: tu colección en cifras y qué escuchar esta noche.'],
    ['Letto, visto, ascoltato', 'Read, watched, listened', 'Leído, visto, escuchado'],
    ['Segna a che punto sei: trovi tutto nel filtro “Da scoprire”.', 'Mark where you’re up to: everything waits in the “To discover” filter.', 'Marca por dónde vas: lo encuentras todo en el filtro “Por descubrir”.'],
    ['Serie ed etichette', 'Series and tags', 'Series y etiquetas'],
    ['Volumi di una saga (con quelli che mancano) ed etichette libere come “Autografato”.', 'Volumes of a saga (including the missing ones) and free tags like “Signed”.', 'Volúmenes de una saga (con los que faltan) y etiquetas libres como “Firmado”.'],
    ['Condividi e ricorda', 'Share and remind', 'Comparte y recuerda'],
    ['Manda la lista desideri e ricorda i prestiti con un messaggio.', 'Send your wishlist and remind people about loans with a message.', 'Envía la lista de deseos y recuerda los préstamos con un mensaje.'],
    ['Importa ed esporta', 'Import and export', 'Importa y exporta'],
    ['Da Goodreads, Letterboxd e Discogs; tabella CSV per Excel.', 'From Goodreads, Letterboxd and Discogs; CSV table for Excel.', 'Desde Goodreads, Letterboxd y Discogs; tabla CSV para Excel.'],

    // Versione 2.2 — foto della copertina
    ['Foto della copertina', 'Cover photo', 'Foto de la portada'], ['🖼️ Foto della copertina', '🖼️ Cover photo', '🖼️ Foto de la portada'],
    ['Riconosce titolo e autore dalla copertina', 'Recognises title and author from the cover', 'Reconoce título y autor por la portada'],
    ['Limite mensile di Google Vision raggiunto: leggo le scritte sul telefono', 'Monthly Google Vision limit reached: reading the text on the phone instead', 'Límite mensual de Google Vision alcanzado: leo el texto en el teléfono'],
    ['Dalla copertina', 'From the cover', 'Desde la portada'], ['Altro codice', 'Another code', 'Otro código'], ['Copertina', 'Cover', 'Portada'],
    ['Ho riconosciuto la copertina: correggi il testo se serve.', 'Cover recognised: fix the text if needed.', 'He reconocido la portada: corrige el texto si hace falta.'],
    ['Ho letto le scritte della copertina: correggi il testo se serve.', 'I read the text on the cover: fix it if needed.', 'He leído el texto de la portada: corrígelo si hace falta.'],
    ['Non sono riuscito a leggere la copertina: scrivi titolo e autore.', 'I couldn’t read the cover: type the title and author.', 'No he podido leer la portada: escribe título y autor.'],
    ['Suggerimento iPhone: tocca il campo, poi “Scansiona testo” per copiare le scritte con la fotocamera.', 'iPhone tip: tap the field, then “Scan Text” to copy the words with the camera.', 'Consejo para iPhone: toca el campo y luego “Escanear texto” para copiar el texto con la cámara.'],
    ['Leggo la copertina…', 'Reading the cover…', 'Leyendo la portada…'], ['Riconosco la copertina…', 'Recognising the cover…', 'Reconociendo la portada…'],
    ['Leggo le scritte sulla copertina…', 'Reading the text on the cover…', 'Leyendo el texto de la portada…'],
    ['Preparo il lettore di testo (solo la prima volta)…', 'Preparing the text reader (first time only)…', 'Preparando el lector de texto (solo la primera vez)…'],
    ['Google Vision non risponde: provo a leggere le scritte', 'Google Vision isn’t responding: trying to read the text instead', 'Google Vision no responde: intento leer el texto'],
    ['Chiave Google Cloud Vision (riconosce anche le copertine senza scritte, facoltativa)', 'Google Cloud Vision key (also recognises covers without text, optional)', 'Clave de Google Cloud Vision (reconoce también portadas sin texto, opcional)'],
    ['Foto copertina', 'Cover photo', 'Foto de portada'],
    ['Riconosci dalla copertina', 'Recognise from the cover', 'Reconocer por la portada'],
    ['Fotografa la copertina di un disco o di un libro: Spinyl lo riconosce e cerca dati e prezzi.', 'Photograph a record or book cover: Spinyl recognises it and looks up details and prices.', 'Fotografía la portada de un disco o un libro: Spinyl lo reconoce y busca datos y precios.'],
    // Versione 2.1 — prezzi
    ['Tab Valore', 'Value tab', 'Pestaña Valor'],
    ['Scansionando un disco con “Ce l’ho già?” vedi subito i prezzi Discogs per ogni condizione; per libri e film i venduti su eBay e AbeBooks.', 'Scan a record with “Do I have it?” to see Discogs prices for every condition straight away; for books and films, sold listings on eBay and AbeBooks.', 'Al escanear un disco con “¿Ya lo tengo?” ves al momento los precios de Discogs por estado; para libros y películas, los vendidos en eBay y AbeBooks.'],
    ['Nella lista, il filtro “Valore”: totale per categoria, diviso per condizione, con il prezzo di ogni pezzo.', 'In the list, the “Value” filter: totals per category, split by condition, with the price of every item.', 'En la lista, el filtro “Valor”: total por categoría, dividido por estado, con el precio de cada artículo.'],
    ['Mediocre', 'Worn', 'Regular'], ['Pessimo', 'Very poor', 'Muy malo'], ['la tua copia', 'your copy', 'tu copia'], ['per la tua copia', 'for your copy', 'para tu copia'],
    ['Prezzi suggeriti da Discogs in base alle vendite, secondo la condizione del disco.', 'Prices suggested by Discogs from past sales, by the record’s condition.', 'Precios sugeridos por Discogs según las ventas, por estado del disco.'],
    ['Mancano i prezzi per condizione: su Discogs apri Settings › Seller Settings, scegli valuta e paese e salva (basta una volta).', 'Prices by condition are missing: on Discogs open Settings › Seller Settings, choose currency and country and save (once is enough).', 'Faltan los precios por estado: en Discogs abre Settings › Seller Settings, elige moneda y país y guarda (basta una vez).'],
    ['In vendita ora, da', 'On sale now, from', 'A la venta ahora, desde'], ['(1 copia)', '(1 copy)', '(1 copia)'],
    ['Nessuna copia in vendita ora su Discogs', 'No copies on sale on Discogs right now', 'Ninguna copia a la venta ahora en Discogs'],
    ['Venduti su eBay', 'Sold on eBay', 'Vendidos en eBay'], ['valore inserito da te', 'value you entered', 'valor que has introducido'],
    ['prezzo minimo in vendita su Discogs', 'lowest price on sale on Discogs', 'precio mínimo a la venta en Discogs'],
    ['condizione non indicata: calcolato come Ottimo (VG+)', 'no condition set: valued as Excellent (VG+)', 'estado no indicado: calculado como Excelente (VG+)'],
    ['Quanto vale?', 'What’s it worth?', '¿Cuánto vale?'],
    ['Per libri e film non esiste un listino gratuito: guarda a quanto sono stati venduti davvero, poi scrivi il valore nella scheda (Modifica › Valore stimato).', 'There’s no free price list for books and films: see what they actually sold for, then enter the value on the item (Edit › Estimated value).', 'Para libros y películas no hay una lista de precios gratuita: mira a cuánto se han vendido de verdad y escribe el valor en la ficha (Editar › Valor estimado).'],
    ['Per libri e film non esiste un listino gratuito: guarda a quanto sono stati venduti davvero.', 'There’s no free price list for books and films: see what they actually sold for.', 'Para libros y películas no hay una lista de precios gratuita: mira a cuánto se han vendido de verdad.'],
    ['Scopri quanto vale questa edizione: Discogs suggerisce un prezzo per ogni condizione, in base alle vendite.', 'See what this edition is worth: Discogs suggests a price for each condition, based on sales.', 'Descubre cuánto vale esta edición: Discogs sugiere un precio para cada estado, según las ventas.'],
    ['Per i prezzi dei dischi inserisci il token Discogs nelle Impostazioni.', 'For record prices, add the Discogs token in Settings.', 'Para los precios de los discos, añade el token de Discogs en Ajustes.'],
    ['Chiedo i prezzi a Discogs…', 'Asking Discogs for prices…', 'Pidiendo precios a Discogs…'], ['Edizione non trovata su Discogs.', 'Edition not found on Discogs.', 'Edición no encontrada en Discogs.'],
    ['Discogs non risponde: riprova tra poco.', 'Discogs isn’t responding: try again shortly.', 'Discogs no responde: inténtalo en un rato.'],
    ['Valore totale', 'Total value', 'Valor total'], ['1 pezzo con valore', '1 item with a value', '1 artículo con valor'],
    ['Aggiorna i prezzi dei dischi da Discogs', 'Update record prices from Discogs', 'Actualizar precios de discos desde Discogs'],
    ['stimato da te', 'your estimate', 'tu estimación'], ['min. Discogs', 'Discogs min.', 'mín. Discogs'], ['Condizione non indicata', 'No condition set', 'Estado no indicado'],
    ['Dischi: prezzo suggerito da Discogs per la condizione della tua copia (se la condizione manca, viene calcolato come Ottimo · VG+). Libri e film: il valore stimato che scrivi tu nella scheda. Il valore che inserisci a mano vale sempre più di quello automatico.',
      'Records: price suggested by Discogs for the condition of your copy (with no condition set, it’s valued as Excellent · VG+). Books and films: the estimated value you enter on the item. A value you enter by hand always takes priority over the automatic one.',
      'Discos: precio sugerido por Discogs para el estado de tu copia (si falta el estado, se calcula como Excelente · VG+). Libros y películas: el valor estimado que escribes en la ficha. El valor que introduces a mano siempre tiene prioridad sobre el automático.'],
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
    // Versione 2.0
    [/^(\d+) codici in coda dalla scansione a raffica\.$/, (m, l) => l === 'en' ? `${m[1]} codes queued from batch scanning.` : `${m[1]} códigos en cola del escaneo en serie.`],
    [/^1 codice in coda dalla scansione a raffica\.$/, (m, l) => l === 'en' ? '1 code queued from batch scanning.' : '1 código en cola del escaneo en serie.'],
    [/^Da (\d+) giorni$/, (m, l) => l === 'en' ? `${m[1]} days` : `${m[1]} días`],
    [/^da (\d+) giorni$/, (m, l) => l === 'en' ? `for ${m[1]} days` : `desde hace ${m[1]} días`],
    [/^✓ (.+)$/, (m) => '✓ ' + tr(m[1])],
    [/^(\d+) copie in vendita$/, (m, l) => l === 'en' ? `${m[1]} copies for sale` : `${m[1]} copias a la venta`],
    [/^Aggiornato il (.+)$/, (m, l) => (l === 'en' ? 'Updated ' : 'Actualizado el ') + m[1]],
    [/^(\d+) in coda$/, (m, l) => l === 'en' ? `${m[1]} queued` : `${m[1]} en cola`],
    [/^(\d+) trovati$/, (m, l) => l === 'en' ? `${m[1]} found` : `${m[1]} encontrados`],
    [/^Controllo (\d+)…$/, (m, l) => (l === 'en' ? 'Checking ' : 'Comprobando ') + m[1] + '…'],
    [/^Codice (\d+) non trovato nei database online\.$/, (m, l) => l === 'en' ? `Code ${m[1]} not found in the online databases.` : `Código ${m[1]} no encontrado en las bases de datos en línea.`],
    [/^Aggiungi (\d+) pezzi$/, (m, l) => l === 'en' ? `Add ${m[1]} items` : `Añadir ${m[1]} artículos`],
    [/^Aggiunti (\d+) pezzi$/, (m, l) => l === 'en' ? `Added ${m[1]} items` : `Añadidos ${m[1]} artículos`],
    [/^Aggiorno (\d+) di (\d+)… \(tocca per fermare\)$/, (m, l) => l === 'en' ? `Updating ${m[1]} of ${m[2]}… (tap to stop)` : `Actualizando ${m[1]} de ${m[2]}… (toca para parar)`],
    [/^Aggiornati (\d+) valori$/, (m, l) => l === 'en' ? `Updated ${m[1]} values` : `Actualizados ${m[1]} valores`],
    [/^su (\d+) con prezzo$/, (m, l) => l === 'en' ? `across ${m[1]} with a price` : `en ${m[1]} con precio`],
    [/^su (\d+) con valore$/, (m, l) => l === 'en' ? `across ${m[1]} with a value` : `en ${m[1]} con valor`],
    [/^(\d+) pezzi in prestito$/, (m, l) => l === 'en' ? `${m[1]} items on loan` : `${m[1]} artículos prestados`],
    [/^(\d+) da più di (\d+) giorni$/, (m, l) => l === 'en' ? `${m[1]} for over ${m[2]} days` : `${m[1]} desde hace más de ${m[2]} días`],
    [/^Controlla su Discogs il prezzo minimo di (1 disco|\d+ dischi)\. Ci vuole circa un minuto ogni 30: puoi continuare a usare l'app\.$/, (m, l) => {
      const n = m[1].split(' ')[0]; const one = n === '1';
      return l === 'en' ? `Check the lowest Discogs price of ${n} record${one ? '' : 's'}. It takes about a minute per 30: you can keep using the app.`
        : `Consulta en Discogs el precio mínimo de ${n} disco${one ? '' : 's'}. Tarda alrededor de un minuto cada 30: puedes seguir usando la app.`; }],
    [/^Importa da (.+)$/, (m, l) => (l === 'en' ? 'Import from ' : 'Importar desde ') + m[1]],
    [/^(\d+) pezzi nuovi$/, (m, l) => l === 'en' ? `${m[1]} new items` : `${m[1]} artículos nuevos`],
    [/^(\d+) già presenti$/, (m, l) => l === 'en' ? `${m[1]} already there` : `${m[1]} ya presentes`],
    [/^…e altri (\d+)$/, (m, l) => (l === 'en' ? '…and ' : '…y ') + m[1] + (l === 'en' ? ' more' : ' más')],
    [/^(\d+) dai desideri alla collezione$/, (m, l) => l === 'en' ? `${m[1]} moved from wishlist to collection` : `${m[1]} pasan de deseos a la colección`],
    [/^Importa (\d+) pezzi$/, (m, l) => l === 'en' ? `Import ${m[1]} items` : `Importar ${m[1]} artículos`],
    [/^Novità di Spinyl (.+)$/, (m, l) => (l === 'en' ? 'What’s new in Spinyl ' : 'Novedades de Spinyl ') + m[1]],
    [/^Google Vision questo mese: (\d+) di (\d+) foto su questo telefono$/, (m, l) => l === 'en' ? `Google Vision this month: ${m[1]} of ${m[2]} photos on this phone` : `Google Vision este mes: ${m[1]} de ${m[2]} fotos en este teléfono`],
    [/^Leggo le scritte… (\d+)%$/, (m, l) => (l === 'en' ? 'Reading the text… ' : 'Leyendo el texto… ') + m[1] + '%'],

    [/^\((\d+) copie\)$/, (m, l) => l === 'en' ? `(${m[1]} copies)` : `(${m[1]} copias)`],
    [/^tutti i (\d+) pezzi hanno un valore$/, (m, l) => l === 'en' ? `all ${m[1]} items have a value` : `los ${m[1]} artículos tienen valor`],
    [/^(\d+) pezzi su (\d+) con valore$/, (m, l) => l === 'en' ? `${m[1]} of ${m[2]} items have a value` : `${m[1]} de ${m[2]} artículos con valor`],
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
