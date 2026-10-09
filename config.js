// ─────────────────────────────────────────────────────────────
//  Scaffale — configurazione
//  Compila questi valori prima di consegnare l'app.
//  (Si possono anche inserire dall'app: Impostazioni → Avanzate)
// ─────────────────────────────────────────────────────────────
window.SCAFFALE_CONFIG = {
  // OBBLIGATORIO per salvare su Google Drive.
  // Si ottiene da Google Cloud Console → Credenziali → ID client OAuth (Applicazione web).
  // Esempio: '1234567890-abcdefg.apps.googleusercontent.com'
  GOOGLE_CLIENT_ID: '',

  // FACOLTATIVO — migliora molto la ricerca dei film (gratis su themoviedb.org)
  TMDB_API_KEY: '',

  // FACOLTATIVO — aggiunge Discogs alla ricerca dei vinili/CD (gratis su discogs.com/settings/developers)
  DISCOGS_TOKEN: ''
};
