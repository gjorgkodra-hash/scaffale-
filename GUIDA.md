# Scaffale — guida all'installazione

App per l'inventario di libri, dischi (vinili, CD) e film. Gira nel browser dell'iPhone e si installa sulla schermata Home come un'app normale. I dati stanno nel telefono e vengono copiati in automatico su Google Drive, nella cartella **Scaffale** (file `scaffale.json` e cartella `foto`).

Si configura una volta sola, in tre passi. Tempo totale: circa 20 minuti.

---

## 1. Pubblicare l'app (GitHub Pages, gratis)

L'app deve essere raggiungibile da un indirizzo `https://`: è necessario per usare la fotocamera e per l'accesso a Google.

1. Crea un account su [github.com](https://github.com) (o usa il tuo).
2. Crea un nuovo repository chiamato `scaffale`, **pubblico**.
3. Clicca **Add file → Upload files** e trascina **tutto il contenuto** della cartella (10 file: index.html, app.js, app.css, config.js, sw.js, manifest.webmanifest e le 3 icone .png). Conferma con **Commit changes**.
4. Vai su **Settings → Pages**. In *Branch* scegli `main` e `/ (root)`, poi **Save**.
5. Dopo un minuto l'app sarà su: `https://TUONOME.github.io/scaffale/`

Annota questo indirizzo: serve nel passo 2.

## 2. Collegare Google Drive (Google Cloud, gratis)

1. Vai su [console.cloud.google.com](https://console.cloud.google.com) e crea un nuovo progetto (es. "Scaffale").
2. Menu **API e servizi → Libreria**, cerca **Google Drive API** e clicca **Abilita**.
3. Menu **Google Auth Platform** (in alcune versioni si chiama *Schermata consenso OAuth*):
   - **Branding / Informazioni app**: nome app "Scaffale", la tua email. Salva.
   - **Pubblico / Audience**: tipo *Esterno*. Sotto **Utenti di test** aggiungi l'indirizzo Gmail del tuo amico (e il tuo, per provare).
   - **Accesso ai dati / Ambiti**: aggiungi `.../auth/drive.file` (permette all'app di vedere **solo i file che crea lei**, non il resto del Drive).
4. **Client / Credenziali → Crea credenziali → ID client OAuth**:
   - Tipo: **Applicazione web**
   - *Origini JavaScript autorizzate*: `https://TUONOME.github.io`
   - *URI di reindirizzamento autorizzati*: `https://TUONOME.github.io/scaffale/` (con la barra finale)
5. Copia l'**ID client** (finisce con `.apps.googleusercontent.com`).
6. Su GitHub apri `config.js`, clicca la matita e incollalo in `GOOGLE_CLIENT_ID: '...'`. Salva con **Commit changes**.

> Al primo accesso Google mostra l'avviso "Google non ha verificato questa app": è normale per un'app personale. Si clicca **Continua**. Finché l'app è in modalità *Test*, possono accedere solo gli utenti di test che hai aggiunto.

## 3. Installare sull'iPhone

1. Apri `https://TUONOME.github.io/scaffale/` con **Safari** (non Chrome).
2. Tocca **Condividi** (il quadrato con la freccia) → **Aggiungi alla schermata Home**.
3. Apri l'app dall'icona, poi tocca la **nuvola** in alto → **Accedi con Google**.
4. Alla prima scansione l'iPhone chiede il permesso per la fotocamera: **Consenti**.

---

## Come si usa

- **Aggiungi** → scegli Libro / Disco / Film → **Scansiona il codice a barre**. I dati (titolo, autore, anno, copertina, descrizione, tracce…) si compilano da soli: controlli, aggiungi foto, posizione, voto e note, e salvi.
- Se il codice non viene trovato: **Cerca per titolo**, oppure **Inserisci a mano**.
- Se scansioni qualcosa che hai già, l'app ti avvisa.
- Nella scheda di ogni pezzo puoi scrivere **commenti** datati, segnare a chi l'hai **prestato** e quando torna.
- Filtri in alto: Libri, Dischi, Film, Desideri, In prestito. La ricerca guarda anche dentro note e commenti.

## Buono a sapersi

- **Funziona anche offline.** Le modifiche si salvano nel telefono e vanno su Drive appena c'è rete.
- **L'accesso a Google dura un'ora** per motivi di sicurezza. Quando scade, il pallino sulla nuvola diventa arancione: basta toccarlo per riaccedere (pochi secondi). I dati nel telefono intanto restano al sicuro.
- **Pallino della nuvola:** verde = tutto salvato · arancione = serve accedere · blu = sta salvando · rosso = errore (dettagli in Impostazioni).
- **Più dispositivi:** se apre l'app su un altro telefono o tablet e accede con lo stesso Google, ritrova tutto.
- **Backup extra:** Impostazioni → *Esporta backup completo* crea un file con dati e foto, da tenere dove vuole.

## Ricerca: cosa funziona meglio

| Tipo | Dove cerca | Affidabilità con il codice a barre |
|---|---|---|
| Libri | Google Libri, Open Library | Ottima (ISBN) |
| Vinili/CD | MusicBrainz, Apple Music (+ Discogs se configurato) | Buona; molto migliore con Discogs |
| Film | Apple TV (+ TMDB se configurato) | Discreta: i codici dei DVD/Blu-ray sono il punto debole di tutti i database gratuiti. Spesso conviene cercare per titolo. |

**Chiavi facoltative** (gratis, da mettere in `config.js` o in Impostazioni → Avanzate):
- **TMDB** per i film: registrati su themoviedb.org → Impostazioni → API → chiave API (v3).
- **Discogs** per i dischi: discogs.com → Settings → Developers → *Generate new token*.

## Aggiornare l'app

Si modificano i file su GitHub. Per far arrivare l'aggiornamento sui telefoni, in `sw.js` cambia la riga `const VERSION = 'scaffale-v1.0.0'` (es. `v1.0.1`). L'app si aggiorna alla riapertura successiva.
