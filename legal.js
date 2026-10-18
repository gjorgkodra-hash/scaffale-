// Spinyl — informativa privacy, termini d'uso e regole della community (IT / EN / ES).
// {contatto} e {gestore} vengono sostituiti dall'app con i valori di config.js.
window.SPINYL_LEGAL = {
  it: {
    updated: 'Ultimo aggiornamento: 18 ottobre 2026',
    privacy: `
<h3>Chi è responsabile dei dati</h3>
<p>Spinyl è gestita da {gestore}. Per qualsiasi domanda sui tuoi dati scrivi a <b>{contatto}</b>.</p>
<h3>La tua collezione resta tua</h3>
<p>Libri, dischi, film, foto, note e prestiti sono salvati <b>sul tuo telefono</b> e, se colleghi Google Drive, in una cartella del <b>tuo Google Drive</b> (Scaffale). Spinyl chiede a Google solo il permesso di gestire i file che crea lei stessa: non vede il resto del tuo Drive. Il gestore non ha accesso alla tua collezione.</p>
<h3>Ricerche su servizi esterni</h3>
<p>Per trovare dati, copertine e prezzi il telefono interroga direttamente servizi pubblici: Google Libri, Open Library, MusicBrainz, Cover Art Archive, Discogs, Apple (iTunes), Deezer, TMDB, Wikipedia, UPCitemdb e, per gli articoli, rss2json. A questi servizi arrivano solo il codice a barre o le parole cercate, oltre ai dati tecnici di ogni collegamento internet (come l'indirizzo IP). Se usi il riconoscimento dalla copertina con Google Vision, la foto viene inviata a Google per l'analisi. Se usi «Che canzone è?», i 10 secondi di audio registrati passano dal nostro server Supabase (UE) al servizio AudD per riconoscere la canzone: l'audio non viene salvato, e il confronto con la tua collezione avviene sul telefono. Il token Discogs, se lo inserisci, resta sul tuo telefono.</p>
<h3>Community (solo se ci entri)</h3>
<p>Se entri nella community salviamo su un server Supabase in Unione Europea (Francoforte): il tuo indirizzo email e l'identificativo Google (servono solo a riconoscerti e non sono mostrati agli altri), il nome che scegli, la città e la presentazione se le inserisci, le recensioni, le valutazioni dopo gli scambi, i commenti, gli articoli, i pezzi e i desideri che decidi di condividere, i messaggi, gli eventi e le risposte, le segnalazioni, i blocchi e le notifiche. Gli altri membri vedono il tuo nome e ciò che pubblichi; i messaggi privati li vedono solo i partecipanti alla conversazione.</p>
<p>Per suggerirti scambi, il telefono invia al server l'elenco delle opere che possiedi e desideri (autore e titolo semplificati), solo per il confronto: non viene salvato né mostrato a nessuno, a meno che tu non scelga di condividere.</p>
<h3>Notifiche</h3>
<p>Se attivi le notifiche sul telefono salviamo l'indirizzo di consegna fornito dal browser. Le notifiche passano dai servizi push di Google, Apple o Mozilla.</p>
<p>Se ci scrivi da «Segnala un problema» o «Proponi un'idea» salviamo il messaggio, il contatto che scegli di lasciare e, se lo spunti, i dati tecnici (versione dell'app, modello di telefono e browser, lingua, ultimi errori: nulla della tua collezione). Se l'app va in errore inviamo in automatico una segnalazione tecnica anonima (messaggio d'errore, versione, browser), che puoi disattivare nelle Impostazioni. Non salviamo il tuo indirizzo IP, solo un'impronta che cambia ogni giorno e serve a bloccare gli abusi.</p>
<h3>Cosa non facciamo</h3>
<p>Niente pubblicità, niente profilazione, nessuna vendita o cessione di dati a terzi, nessun sistema di tracciamento.</p>
<h3>Perché e per quanto tempo</h3>
<p>Usiamo i dati della community solo per farla funzionare (esecuzione del servizio che chiedi entrando) e per la sicurezza e la moderazione (legittimo interesse). Li conserviamo finché resti nella community; quando elimini l'account vengono cancellati subito. Le copie di sicurezza del fornitore vengono sovrascritte entro pochi giorni.</p>
<h3>I tuoi diritti</h3>
<p>Puoi vedere, correggere, scaricare e cancellare i tuoi dati: in <b>Impostazioni › Community</b> trovi <b>Scarica i miei dati</b> ed <b>Elimina il mio account</b>. Per tutto il resto scrivi a {contatto}. Puoi anche presentare reclamo al Garante per la protezione dei dati personali (garanteprivacy.it).</p>
<h3>Età</h3>
<p>La community è riservata a chi ha almeno 14 anni.</p>`,
    terms: `
<h3>Il servizio</h3>
<p>Spinyl è gratuita e offerta così com'è, senza garanzie di funzionamento continuo. Prezzi, valori e dati provengono da servizi esterni e sono indicativi.</p>
<h3>I tuoi contenuti</h3>
<p>Sei responsabile di ciò che pubblichi. Pubblicando autorizzi Spinyl a mostrarlo agli altri membri della community, finché non lo cancelli o elimini l'account. Pubblica solo testi e immagini tuoi o che puoi usare.</p>
<h3>Scambi, vendite e prestiti</h3>
<p>Spinyl mette in contatto i membri ma non partecipa agli accordi: non gestisce pagamenti, spedizioni né garanzie. Accordi e rischi sono tra chi scambia. Se vi incontrate, scegliete un luogo pubblico.</p>
<h3>Moderazione</h3>
<p>Il gestore può nascondere o rimuovere contenuti contrari a queste regole o alla legge e sospendere gli account che le violano. I contenuti segnalati da 3 membri vengono nascosti in automatico. Se pensi che una decisione sia sbagliata scrivi a {contatto}: la rivediamo.</p>
<h3>Modifiche</h3>
<p>Questi termini possono cambiare; le novità importanti vengono annunciate nell'app. Vale la legge italiana.</p>`,
    rules: `
<ul>
<li>Sii gentile: niente insulti, molestie, odio o minacce.</li>
<li>Niente spam, pubblicità non richiesta o link ingannevoli.</li>
<li>Non pubblicare dati personali tuoi o di altri (indirizzi, telefoni, documenti).</li>
<li>Negli scambi sii onesto su condizioni e prezzi, e rispetta gli accordi.</li>
<li>Niente oggetti illegali, contraffatti o rubati.</li>
<li>Usa <b>Segnala</b> per i contenuti che violano le regole e <b>Blocca</b> per chi ti disturba.</li>
</ul>`,
  },
  en: {
    updated: 'Last updated: 18 October 2026',
    privacy: `
<h3>Who is responsible for your data</h3>
<p>Spinyl is run by {gestore}. For any question about your data write to <b>{contatto}</b>.</p>
<h3>Your collection stays yours</h3>
<p>Books, records, films, photos, notes and loans are stored <b>on your phone</b> and, if you connect Google Drive, in a folder in <b>your own Google Drive</b> (Scaffale). Spinyl only asks Google for access to the files it creates itself: it cannot see the rest of your Drive. The operator has no access to your collection.</p>
<h3>Searches on external services</h3>
<p>To find details, covers and prices your phone queries public services directly: Google Books, Open Library, MusicBrainz, Cover Art Archive, Discogs, Apple (iTunes), Deezer, TMDB, Wikipedia, UPCitemdb and, for articles, rss2json. They receive only the barcode or the words you search, plus the technical data of any internet connection (such as your IP address). If you use cover recognition with Google Vision, the photo is sent to Google for analysis. If you use «What song is this?», the 10 seconds of recorded audio go through our Supabase server (EU) to the AudD service to recognise the song: the audio is not stored, and the comparison with your collection happens on the phone. Your Discogs token, if you enter it, stays on your phone.</p>
<h3>Community (only if you join)</h3>
<p>If you join the community we store on a Supabase server in the European Union (Frankfurt): your email address and Google identifier (used only to recognise you, never shown to others), the name you choose, your city and bio if you add them, your reviews, ratings after swaps, comments, articles, the items and wishes you choose to share, messages, events and replies, reports, blocks and notifications. Other members see your name and what you publish; private messages are seen only by the people in the conversation.</p>
<p>To suggest swaps, your phone sends the server the list of works you own and want (simplified author and title), only for matching: it is not stored or shown to anyone unless you choose to share.</p>
<h3>Notifications</h3>
<p>If you turn on phone notifications we store the delivery address provided by your browser. Notifications go through the push services of Google, Apple or Mozilla.</p>
<p>If you write to us via «Report a problem» or «Suggest an idea» we store the message, any contact you choose to leave and, if you tick it, technical data (app version, phone model and browser, language, recent errors: nothing from your collection). If the app hits an error it automatically sends an anonymous technical report (error message, version, browser), which you can turn off in Settings. We don't store your IP address, only a fingerprint that changes every day and is used to stop abuse.</p>
<h3>What we don't do</h3>
<p>No advertising, no profiling, no selling or sharing of data with third parties, no tracking.</p>
<h3>Why and for how long</h3>
<p>We use community data only to run the community (providing the service you ask for by joining) and for safety and moderation (legitimate interest). We keep it while you are a member; when you delete your account it is erased immediately. The provider's backups are overwritten within a few days.</p>
<h3>Your rights</h3>
<p>You can see, correct, download and delete your data: in <b>Settings › Community</b> you'll find <b>Download my data</b> and <b>Delete my account</b>. For anything else write to {contatto}. You can also complain to your data protection authority (in Italy: garanteprivacy.it).</p>
<h3>Age</h3>
<p>The community is for people aged 14 or over.</p>`,
    terms: `
<h3>The service</h3>
<p>Spinyl is free and provided as is, with no guarantee of uninterrupted operation. Prices, values and details come from external services and are indicative.</p>
<h3>Your content</h3>
<p>You are responsible for what you publish. By publishing you allow Spinyl to show it to other community members until you delete it or your account. Only publish texts and images that are yours or that you may use.</p>
<h3>Swaps, sales and loans</h3>
<p>Spinyl puts members in touch but is not part of their agreements: it handles no payments, shipping or guarantees. Agreements and risks are between the people involved. If you meet, choose a public place.</p>
<h3>Moderation</h3>
<p>The operator may hide or remove content that breaks these rules or the law, and suspend accounts that do. Content reported by 3 members is hidden automatically. If you think a decision is wrong, write to {contatto} and we will review it.</p>
<h3>Changes</h3>
<p>These terms may change; important changes are announced in the app. Italian law applies.</p>`,
    rules: `
<ul>
<li>Be kind: no insults, harassment, hate or threats.</li>
<li>No spam, unsolicited advertising or misleading links.</li>
<li>Don't post personal data, yours or others' (addresses, phone numbers, documents).</li>
<li>In swaps be honest about condition and price, and keep your word.</li>
<li>No illegal, counterfeit or stolen items.</li>
<li>Use <b>Report</b> for content that breaks the rules and <b>Block</b> for anyone who bothers you.</li>
</ul>`,
  },
  es: {
    updated: 'Última actualización: 18 de octubre de 2026',
    privacy: `
<h3>Quién es responsable de los datos</h3>
<p>Spinyl está gestionada por {gestore}. Para cualquier pregunta sobre tus datos escribe a <b>{contatto}</b>.</p>
<h3>Tu colección sigue siendo tuya</h3>
<p>Libros, discos, películas, fotos, notas y préstamos se guardan <b>en tu teléfono</b> y, si conectas Google Drive, en una carpeta de <b>tu Google Drive</b> (Scaffale). Spinyl solo pide a Google acceso a los archivos que ella misma crea: no ve el resto de tu Drive. El gestor no tiene acceso a tu colección.</p>
<h3>Búsquedas en servicios externos</h3>
<p>Para encontrar datos, portadas y precios el teléfono consulta directamente servicios públicos: Google Libros, Open Library, MusicBrainz, Cover Art Archive, Discogs, Apple (iTunes), Deezer, TMDB, Wikipedia, UPCitemdb y, para los artículos, rss2json. Solo reciben el código de barras o las palabras buscadas, además de los datos técnicos de cualquier conexión a internet (como la dirección IP). Si usas el reconocimiento de portada con Google Vision, la foto se envía a Google para analizarla. Si usas «¿Qué canción es?», los 10 segundos de audio grabado pasan por nuestro servidor Supabase (UE) al servicio AudD para reconocer la canción: el audio no se guarda y la comparación con tu colección se hace en el teléfono. El token de Discogs, si lo introduces, se queda en tu teléfono.</p>
<h3>Comunidad (solo si entras)</h3>
<p>Si entras en la comunidad guardamos en un servidor de Supabase en la Unión Europea (Fráncfort): tu correo y el identificador de Google (sirven solo para reconocerte y no se muestran a los demás), el nombre que elijas, tu ciudad y presentación si las añades, tus reseñas, las valoraciones tras los intercambios, comentarios, artículos, lo que decidas compartir de tu colección y tus deseos, mensajes, eventos y respuestas, denuncias, bloqueos y notificaciones. Los demás miembros ven tu nombre y lo que publicas; los mensajes privados solo los ven quienes participan en la conversación.</p>
<p>Para sugerirte intercambios, el teléfono envía al servidor la lista de obras que tienes y deseas (autor y título simplificados), solo para compararlas: no se guarda ni se muestra a nadie salvo que decidas compartir.</p>
<h3>Notificaciones</h3>
<p>Si activas las notificaciones guardamos la dirección de entrega que da el navegador. Las notificaciones pasan por los servicios push de Google, Apple o Mozilla.</p>
<p>Si nos escribes desde «Informar de un problema» o «Proponer una idea» guardamos el mensaje, el contacto que decidas dejar y, si lo marcas, los datos técnicos (versión de la app, modelo de teléfono y navegador, idioma, últimos errores: nada de tu colección). Si la app falla, envía automáticamente un informe técnico anónimo (mensaje de error, versión, navegador), que puedes desactivar en Ajustes. No guardamos tu dirección IP, solo una huella que cambia cada día y sirve para frenar abusos.</p>
<h3>Lo que no hacemos</h3>
<p>Sin publicidad, sin perfiles, sin venta ni cesión de datos a terceros, sin rastreo.</p>
<h3>Por qué y durante cuánto tiempo</h3>
<p>Usamos los datos de la comunidad solo para hacerla funcionar (prestar el servicio que pides al entrar) y para la seguridad y la moderación (interés legítimo). Los conservamos mientras seas miembro; cuando eliminas la cuenta se borran de inmediato. Las copias de seguridad del proveedor se sobrescriben en pocos días.</p>
<h3>Tus derechos</h3>
<p>Puedes ver, corregir, descargar y borrar tus datos: en <b>Ajustes › Comunidad</b> encontrarás <b>Descargar mis datos</b> y <b>Eliminar mi cuenta</b>. Para todo lo demás escribe a {contatto}. También puedes reclamar ante tu autoridad de protección de datos (en España: aepd.es).</p>
<h3>Edad</h3>
<p>La comunidad es para personas de 14 años o más.</p>`,
    terms: `
<h3>El servicio</h3>
<p>Spinyl es gratuita y se ofrece tal cual, sin garantía de funcionamiento continuo. Precios, valores y datos vienen de servicios externos y son orientativos.</p>
<h3>Tus contenidos</h3>
<p>Eres responsable de lo que publicas. Al publicar permites a Spinyl mostrarlo a los demás miembros hasta que lo borres o elimines tu cuenta. Publica solo textos e imágenes tuyos o que puedas usar.</p>
<h3>Intercambios, ventas y préstamos</h3>
<p>Spinyl pone en contacto a los miembros pero no participa en los acuerdos: no gestiona pagos, envíos ni garantías. Acuerdos y riesgos son entre quienes intercambian. Si quedáis, elegid un lugar público.</p>
<h3>Moderación</h3>
<p>El gestor puede ocultar o eliminar contenidos contrarios a estas normas o a la ley y suspender las cuentas que las incumplan. Lo denunciado por 3 miembros se oculta automáticamente. Si crees que una decisión es errónea escribe a {contatto} y la revisaremos.</p>
<h3>Cambios</h3>
<p>Estos términos pueden cambiar; los cambios importantes se anuncian en la app. Se aplica la ley italiana.</p>`,
    rules: `
<ul>
<li>Sé amable: nada de insultos, acoso, odio ni amenazas.</li>
<li>Nada de spam, publicidad no solicitada ni enlaces engañosos.</li>
<li>No publiques datos personales tuyos o de otros (direcciones, teléfonos, documentos).</li>
<li>En los intercambios sé honesto sobre estado y precio, y cumple lo acordado.</li>
<li>Nada de objetos ilegales, falsificados o robados.</li>
<li>Usa <b>Denunciar</b> para lo que incumpla las normas y <b>Bloquear</b> para quien te moleste.</li>
</ul>`,
  },
};
