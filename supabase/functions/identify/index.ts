// Spinyl — "Che canzone è?": riconosce una canzone da pochi secondi di audio registrati dal telefono.
// L'audio va al servizio AudD (come Shazam) e non viene salvato. La chiave AudD è un segreto della funzione (AUDD_TOKEN), mai nel repository.
// Basta la chiave pubblica: funziona anche per chi non è nella community. Nessun IP salvato: solo un'impronta giornaliera per il limite.
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const TOKEN = Deno.env.get("AUDD_TOKEN") || "test"; // "test": pochi riconoscimenti al giorno, per provare
const DAILY = +(Deno.env.get("IDENTIFY_DAILY") || 40); // per telefono al giorno
const ORIGINS = [/^https:\/\/gjorgkodra-hash\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const cors = (o: string) => ({ "Access-Control-Allow-Origin": ORIGINS.some((r) => r.test(o)) ? o : "https://gjorgkodra-hash.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-google-token", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Content-Type": "application/json" });
const enc = new TextEncoder();
const sha = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s))), (b) => b.toString(16).padStart(2, "0")).join("");
const str = (v: unknown, n = 300) => String(v ?? "").slice(0, n);

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin") || "");
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  const out = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: h });
  try {
    if (req.method !== "POST") return out({ error: "metodo" }, 405);
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
    const ipHash = (await sha(ip + "|" + new Date().toISOString().slice(0, 10) + "|spinyl-identify")).slice(0, 24);

    // audio dal telefono (multipart "file") oppure un indirizzo https di un file audio
    const form = new FormData();
    form.set("api_token", TOKEN);
    form.set("return", "apple_music,spotify");
    const ct = req.headers.get("content-type") || "";
    let market = "it";
    if (ct.includes("multipart/form-data")) {
      const fd = await req.formData();
      const f = fd.get("file");
      if (!(f instanceof File) || f.size < 2000) return out({ error: "audio" }, 400);
      if (f.size > 3e6) return out({ error: "grande" }, 413);
      form.set("file", f, f.name || "clip");
      market = String(fd.get("market") || "it");
    } else {
      const b = await req.json().catch(() => ({}));
      const url = str(b.url, 600);
      if (!/^https:\/\//.test(url)) return out({ error: "audio" }, 400);
      form.set("url", url);
      market = String(b.market || "it");
    }
    form.set("market", /^[a-z]{2}$/.test(market) ? market : "it");

    const { data: n } = await db.rpc("identify_hit", { p_hash: ipHash });
    if (typeof n === "number" && n > DAILY) return out({ error: "limite" }, 429);

    const r = await fetch("https://api.audd.io/", { method: "POST", body: form });
    const j = await r.json().catch(() => ({}));
    if (j.status === "error") {
      const code = j.error?.error_code;
      console.error("audd", code, j.error?.error_message);
      return out({ error: code === 901 || code === 902 ? "servizio-limite" : code === 300 || code === 400 ? "audio" : "servizio" }, code === 901 || code === 902 ? 429 : 502);
    }
    const x = j.result;
    if (!x || !x.title) return out({ found: false });
    const am = x.apple_music || {}, sp = x.spotify || {};
    const art = am.artwork?.url ? String(am.artwork.url).replace("{w}", "300").replace("{h}", "300") : (sp.album?.images || [])[1]?.url || (sp.album?.images || [])[0]?.url || "";
    return out({ found: true, title: str(x.title), artist: str(x.artist), album: str(x.album || am.albumName || sp.album?.name),
      year: str(x.release_date, 4), label: str(x.label), cover: /^https:\/\//.test(art) ? art : "", link: /^https:\/\//.test(x.song_link || "") ? str(x.song_link, 300) : "",
      timecode: str(x.timecode, 10) });
  } catch (e) {
    console.error(e);
    return out({ error: "errore" }, 500);
  }
});
