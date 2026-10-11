// ─────────────────────────────────────────────────────────────
//  Scaffale — configurazione
//  Compila questi valori prima di consegnare l'app.
//  (Si possono anche inserire dall'app: Impostazioni → Avanzate)
// ─────────────────────────────────────────────────────────────
window.SCAFFALE_CONFIG = {
  // OBBLIGATORIO per salvare su Google Drive.
  // Si ottiene da Google Cloud Console → Credenziali → ID client OAuth (Applicazione web).
  // Esempio: '1234567890-abcdefg.apps.googleusercontent.com'
  GOOGLE_CLIENT_ID: '348171565203-s58jqs70a73jb6fbqd4m1tn3fn0ndsmf.apps.googleusercontent.com',

  // Chiave Google (limitata al sito dell'app e alle API Books + Vision, quindi può stare qui)
  GOOGLE_BOOKS_KEY: 'AIzaSyBdrTT9X0rbZL2Tq9qSgXKiqWkfey87bfI',

  // Riconoscimento delle copertine con Google Cloud Vision (stessa chiave)
  GOOGLE_VISION_KEY: 'AIzaSyBdrTT9X0rbZL2Tq9qSgXKiqWkfey87bfI',
  // Foto al mese per telefono con Vision: 100 × fino a 10 utenti = 1000, la parte gratuita
  VISION_MONTHLY_LIMIT: 100,

  // FACOLTATIVO — migliora molto la ricerca dei film (gratis su themoviedb.org)
  TMDB_API_KEY: '580db0b4055f2c04a1895794292a65fd',

  // Community: funzione Supabase + chiave pubblica "anon" (pubblica per natura: i dati passano solo dalla funzione, che verifica l'utente Google)
  COMMUNITY_URL: 'https://rixpxmjphydezosyhjzz.supabase.co/functions/v1/community',
  COMMUNITY_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpeHB4bWpwaHlkZXpvc3loanp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE3MzkyNjksImV4cCI6MjEwNzMxNTI2OX0.o9W_h4lbs3aPz7qeC09UbbhqTUa11OU6KehENucmQEo',

  // Notifiche push: funzione Supabase che registra il telefono + chiave pubblica VAPID (pubblica per natura)
  PUSH_URL: 'https://rixpxmjphydezosyhjzz.supabase.co/functions/v1/push',
  VAPID_PUBLIC: 'BIXQo58Vyrqy2dFBPiHC7Gcha8DApvlZBO0C6ytJYTfPk5LTV-J51yHmQpHintAbGJbG1Er0-VKwmBj8wbNFpE8',

  // Chi gestisce Spinyl e a chi scrivere per la privacy (cambiare con l'indirizzo del dominio quando ci sarà)
  OPERATOR: 'Gjorg',
  PRIVACY_CONTACT: 'gjorgkodra@gmail.com',

  // NON inserire qui il token Discogs: questo file è pubblico e il token dà accesso all'account.
  // Ogni utente lo mette nelle Impostazioni dell'app.
  DISCOGS_TOKEN: ''
};
