# Spinyl (repository `scaffale-`)

App web installabile (PWA) per catalogare libri, vinili, CD, cassette e film. Nessun server:
dati in IndexedDB sul telefono, copia su Google Drive dell'utente, pubblicata con GitHub Pages
(https://gjorgkodra-hash.github.io/scaffale-/).

- File: `index.html`, `app.js` (logica), `app.css`, `i18n.js` (traduzioni IT→EN/ES, chiave = testo italiano),
  `sw.js` (service worker: alzare `VERSION` a ogni rilascio), `config.js` (chiavi pubbliche limitate al sito).
- A ogni rilascio: alzare `VERSION` in `app.js` e `sw.js`, aggiungere le voci nuove in `NEWS` (app.js)
  e le traduzioni in `i18n.js`.
- Non rinominare la cartella Drive `Scaffale` né il file `scaffale.json`: gli utenti perderebbero i dati.
- Mai mettere il token Discogs in `config.js` (dà accesso all'account): ogni utente lo inserisce nelle Impostazioni.
- Test: `pip install playwright && python -m playwright install chromium && python tests/run_tests.py`
  (tutti i servizi esterni sono simulati). Girano anche su GitHub Actions a ogni push.
- Community: progetto Supabase `spinyl` (id `rixpxmjphydezosyhjzz`, eu-central-1). Tabelle con RLS senza policy:
  tutto passa dalla funzione `supabase/functions/community/index.ts`, che riconosce l'utente dal token Google
  (Drive `about`). Si entra con un codice invito; l'amministratore (gjorgkodra@gmail.com) entra senza codice.
  Dopo modifiche alla funzione: ridistribuirla su Supabase. La chiave `COMMUNITY_KEY` in config.js è la anon key (pubblica).
- Attenzione negli script Python: `open(f,'w').write(open(f).read()...)` svuota il file prima di leggerlo (è successo due volte a `sw.js`).
  Leggere prima in una variabile, poi scrivere. Il test "sw.js non vuoto" lo segnala: non fare push con test falliti.
- Notifiche push: funzione Supabase `push` (verify_jwt false). Il database (trigger → `notify()`/`push_send()` con pg_net)
  la chiama con il segreto `push_secret` del Vault; la chiave VAPID privata è nel Vault (`vapid_jwk`), MAI nel repository.
  La chiave pubblica VAPID è in config.js e in `supabase/functions/push/index.ts`. Il telefono si iscrive chiamando `push` con il token Google.
- Segnalazioni: funzione Supabase `feedback` (verify_jwt true, basta la anon key: funziona anche senza community).
  Tabelle `feedback` (problemi/idee, trigger → notifica + push agli admin) e `client_errors` (errori raggruppati per hash, RPC `log_client_error`).
  L'admin le legge in Impostazioni › Segnalazioni ricevute (azioni `feedbackList`/`feedbackStatus` della funzione community). Nessun IP salvato: solo `ip_hash` giornaliero.
