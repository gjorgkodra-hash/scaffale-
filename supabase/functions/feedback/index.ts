// Spinyl — segnalazioni dall'app: problemi e idee scritti dagli utenti, errori tecnici anonimi.
// Funziona anche per chi non è nella community (basta la chiave pubblica). Nessun IP salvato: solo un'impronta giornaliera per limitare gli abusi.
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const ORIGINS = [/^https:\/\/gjorgkodra-hash\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const cors = (o: string) => ({ "Access-Control-Allow-Origin": ORIGINS.some((r) => r.test(o)) ? o : "https://gjorgkodra-hash.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-google-token", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Content-Type": "application/json" });
const clean = (s: unknown, n: number) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n);
const enc = new TextEncoder();
const sha = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s))), (b) => b.toString(16).padStart(2, "0")).join("");

// limite per impronta (in memoria, per istanza) contro i cicli di errori
const hits = new Map<string, { n: number; t: number }>();
function tooMany(key: string, max: number) {
  const now = Date.now(); const h = hits.get(key);
  if (!h || now - h.t > 3600e3) { if (hits.size > 5000) hits.clear(); hits.set(key, { n: 1, t: now }); return false; }
  return ++h.n > max;
}

Deno.serve(async (req) => {
  const h = cors(req.headers.get("origin") || "");
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  const out = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: h });
  try {
    if (req.method !== "POST") return out({ error: "metodo" }, 405);
    const body = await req.json().catch(() => ({}));
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
    const ipHash = (await sha(ip + "|" + new Date().toISOString().slice(0, 10) + "|spinyl")).slice(0, 24);

    if (body.action === "error") {
      if (tooMany("e" + ipHash, 60)) return out({ ok: true, skipped: true });
      const list = Array.isArray(body.errors) ? body.errors.slice(0, 10) : [];
      const version = clean(body.version, 20), ua = clean(body.ua, 300);
      for (const e of list) {
        const message = clean(e.message, 500); if (!message) continue;
        const source = clean(e.source, 300), stack = clean(e.stack, 2000), view = clean(e.view, 40);
        const hash = (await sha([message, source.replace(/\?.*$/, ""), version].join("|"))).slice(0, 32);
        await db.rpc("log_client_error", { p_hash: hash, p_message: message, p_source: source, p_stack: stack, p_version: version, p_ua: ua, p_view: view });
      }
      return out({ ok: true });
    }

    if (body.action === "send") {
      const kind = body.kind === "idea" ? "idea" : "bug";
      const message = clean(body.message, 4000);
      if (message.length < 3) return out({ error: "vuoto" }, 400);
      if (tooMany("f" + ipHash, 10)) return out({ error: "troppi" }, 429);
      const { count } = await db.from("feedback").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", new Date(Date.now() - 3600e3).toISOString());
      if ((count || 0) >= 10) return out({ error: "troppi" }, 429);
      // se l'utente ha fatto l'accesso a Google ed è nella community, colleghiamo la segnalazione al suo nome (facoltativo)
      let member_id: string | null = null;
      const tok = req.headers.get("x-google-token") || "";
      if (tok && tok.length < 4096) {
        try {
          const r = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(permissionId)", { headers: { Authorization: "Bearer " + tok } });
          if (r.ok) {
            const gid = String(((await r.json()).user || {}).permissionId || "");
            if (gid) { const { data } = await db.from("members").select("id").eq("google_id", gid).maybeSingle(); member_id = data?.id ?? null; }
          }
        } catch (_) { /* va bene anche anonima */ }
      }
      const dj = body.diag && typeof body.diag === "object" ? JSON.stringify(body.diag) : "";
      const diag = !dj ? null : dj.length <= 6000 ? JSON.parse(dj) : { troppo_lungo: true, version: clean(body.version, 20) };
      const { error } = await db.from("feedback").insert({ kind, message, contact: clean(body.contact, 200), member_id, version: clean(body.version, 20), lang: clean(body.lang, 5), diag, ip_hash: ipHash });
      if (error) { console.error(error); return out({ error: "errore" }, 500); }
      return out({ ok: true });
    }
    return out({ error: "azione" }, 400);
  } catch (e) {
    console.error(e);
    return out({ error: "errore" }, 500);
  }
});
