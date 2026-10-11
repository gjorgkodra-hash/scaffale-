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
