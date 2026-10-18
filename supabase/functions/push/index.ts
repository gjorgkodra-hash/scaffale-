// Spinyl — invio delle notifiche push. La chiama solo il database (pg_net) con il segreto condiviso.
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendPush } from "./webpush.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const VAPID_PUB = "BIXQo58Vyrqy2dFBPiHC7Gcha8DApvlZBO0C6ytJYTfPk5LTV-J51yHmQpHintAbGJbG1Er0-VKwmBj8wbNFpE8";
let cfg: { jwk: JsonWebKey; secret: string } | null = null;

const T: Record<string, Record<string, string>> = {
  it: { comment: "{n} ha commentato {w}", reply: "{n} ha commentato anche lui su {w}", invite: "{n} ti ha invitato a {e}", rsvp: "{n} partecipa al tuo evento {e}",
    offer_vendo: "{n} vende {w}, che cerchi", offer_presto: "{n} presta {w}, che cerchi", offer_regalo: "{n} regala {w}, che cerchi", post: "{n} ha scritto un articolo su {w}", message: "Messaggio da {n}", gmessage: "{n} in {g}", greply: "{n} ti ha risposto in {g}", rating: "{n} ha valutato lo scambio con te" },
  en: { comment: "{n} commented on {w}", reply: "{n} also commented on {w}", invite: "{n} invited you to {e}", rsvp: "{n} is going to your event {e}",
    offer_vendo: "{n} is selling {w}, which you want", offer_presto: "{n} can lend {w}, which you want", offer_regalo: "{n} is giving away {w}, which you want", post: "{n} wrote an article about {w}", message: "Message from {n}", gmessage: "{n} in {g}", greply: "{n} replied to you in {g}", rating: "{n} rated your swap" },
  es: { comment: "{n} comentó {w}", reply: "{n} también comentó en {w}", invite: "{n} te invitó a {e}", rsvp: "{n} va a tu evento {e}",
    offer_vendo: "{n} vende {w}, que buscas", offer_presto: "{n} presta {w}, que buscas", offer_regalo: "{n} regala {w}, que buscas", post: "{n} escribió un artículo sobre {w}", message: "Mensaje de {n}", gmessage: "{n} en {g}", greply: "{n} te respondió en {g}", rating: "{n} valoró el intercambio contigo" },
};
const OFFER: Record<string, Record<string, string>> = { it: { vendo: "In vendita", presto: "In prestito", regalo: "In regalo", compro: "Vuole comprarlo", prestito: "Chiede in prestito" },
  en: { vendo: "For sale", presto: "Can lend", regalo: "Free", compro: "Wants to buy", prestito: "Asks to borrow" }, es: { vendo: "En venta", presto: "En préstamo", regalo: "Lo regala", compro: "Quiere comprarlo", prestito: "Pide prestado" } };

const FB: Record<string, [string, string]> = { it: ["Nuova segnalazione", "Nuova idea"], en: ["New problem report", "New idea"], es: ["Nuevo problema", "Nueva idea"] };
function text(lang: string, p: any) {
  const L = T[lang] || T.it; const d = p.data || {};
  if (p.kind === "feedback") { const f = FB[lang] || FB.it; return { title: d.type === "idea" ? f[1] : f[0], body: String(d.body || "").slice(0, 160), go: "feedback", tag: "feedback:" + (d.id || "") }; }
  const key = p.kind === "offer" ? "offer_" + (d.offer || "vendo") : p.kind;
  const title = (L[key] || "{n}").replace("{n}", p.nick || "Spinyl").replace("{w}", `«${d.titolo || d.title || ""}»`).replace("{e}", `«${d.title || ""}»`).replace("{g}", `«${d.name || ""}»`);
  let body = d.body ? String(d.body) : "";
  if (p.kind === "message" && d.offer) body = (OFFER[lang] || OFFER.it)[d.offer] + (d.price != null ? ` · ${d.price} €` : "") + (body ? " — " + body : "");
  if (p.kind === "message" && d.titolo) body = body ? `${body}` : `«${d.titolo}»`;
  if (p.kind === "rating") body = "★".repeat(d.stars || 0) + "☆".repeat(5 - (d.stars || 0)) + (d.body ? " — " + d.body : "");
  const go = p.kind === "invite" || p.kind === "rsvp" ? "event:" + d.id : p.kind === "message" ? "thread:" + d.thread : p.kind === "gmessage" || p.kind === "greply" ? "group:" + d.group : d.type === "post" || p.kind === "post" ? "post:" + d.id
    : d.type === "review" ? "review:" + d.id : "notifs";
  return { title, body: body.slice(0, 160), go, tag: p.kind + ":" + (d.id || d.thread || d.group || d.work || "") };
}

// Il telefono si iscrive (o si disiscrive) alle notifiche: riconosciuto dal token Google come nella funzione community
const ORIGINS = [/^https:\/\/gjorgkodra-hash\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];
const cors = (o: string) => ({ "Access-Control-Allow-Origin": ORIGINS.some((r) => r.test(o)) ? o : "https://gjorgkodra-hash.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-google-token", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin", "Content-Type": "application/json" });
async function subscribe(req: Request) {
  const h = cors(req.headers.get("origin") || "");
  const tok = req.headers.get("x-google-token") || "";
  const r = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(permissionId)", { headers: { Authorization: "Bearer " + tok } });
  if (!tok || !r.ok) return new Response(JSON.stringify({ error: "login" }), { status: 401, headers: h });
  const gid = String(((await r.json()).user || {}).permissionId || "");
  const { data: me } = await db.from("members").select("id,banned").eq("google_id", gid).maybeSingle();
  if (!me || me.banned) return new Response(JSON.stringify({ error: "membro" }), { status: 403, headers: h });
  const b = await req.json().catch(() => ({}));
  const sub = b.sub || {}; const endpoint = String(sub.endpoint || "").slice(0, 1000);
  if (!/^https:\/\//.test(endpoint)) return new Response(JSON.stringify({ error: "sub" }), { status: 400, headers: h });
  if (b.action === "unsub") { await db.from("push_subs").delete().eq("endpoint", endpoint).eq("member_id", me.id); return new Response(JSON.stringify({ ok: true }), { headers: h }); }
  const keys = sub.keys || {};
  if (!keys.p256dh || !keys.auth) return new Response(JSON.stringify({ error: "sub" }), { status: 400, headers: h });
  const lang = ["it", "en", "es"].includes(b.lang) ? b.lang : "it";
  await db.from("push_subs").upsert({ endpoint, member_id: me.id, p256dh: String(keys.p256dh).slice(0, 200), auth: String(keys.auth).slice(0, 100), lang }, { onConflict: "endpoint" });
  if (b.test) {
    if (!cfg) { const { data } = await db.rpc("push_config"); cfg = { jwk: JSON.parse(data.jwk), secret: data.secret }; }
    const t = { it: "Notifiche attive", en: "Notifications on", es: "Notificaciones activadas" }[lang];
    const x = { it: "Ti avviseremo di commenti, messaggi, inviti e offerte.", en: "We'll tell you about comments, messages, invites and offers.", es: "Te avisaremos de comentarios, mensajes, invitaciones y ofertas." }[lang];
    const send = async () => {
      const rr = await sendPush({ endpoint, p256dh: keys.p256dh, auth: keys.auth }, { title: t, body: x, go: "notifs", tag: "welcome" }, { jwk: cfg!.jwk, pub: VAPID_PUB, subject: "mailto:spinyl@users.noreply.github.com" });
      if (!rr.ok) console.error("test push", rr.status, await rr.text());
      return rr.status;
    };
    // prova "ad app chiusa": risponde subito e manda la notifica dopo 10 secondi
    if (b.delay) { (globalThis as any).EdgeRuntime?.waitUntil(new Promise((r) => setTimeout(r, 10000)).then(send).catch(console.error)); return new Response(JSON.stringify({ ok: true, test: 202 }), { headers: h }); }
    return new Response(JSON.stringify({ ok: true, test: await send() }), { headers: h });
  }
  return new Response(JSON.stringify({ ok: true }), { headers: h });
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req.headers.get("origin") || "") });
    if (req.headers.get("x-google-token")) return await subscribe(req);
    if (!cfg) { const { data } = await db.rpc("push_config"); cfg = { jwk: JSON.parse(data.jwk), secret: data.secret }; }
    if (req.headers.get("x-push-secret") !== cfg.secret) return new Response("no", { status: 403 });
    const p = await req.json();
    const { data: subs } = await db.from("push_subs").select("endpoint,p256dh,auth,lang").eq("member_id", p.to);
    // numero da mostrare sull'icona dell'app (non letti in tutto)
    const { data: badge } = subs && subs.length ? await db.rpc("unread_total", { p: p.to }) : { data: null };
    let sent = 0;
    for (const s of subs || []) {
      try {
        const r = await sendPush(s, { ...text(s.lang, p), badge: typeof badge === "number" ? badge : null }, { jwk: cfg.jwk, pub: VAPID_PUB, subject: "mailto:spinyl@users.noreply.github.com" });
        if (r.status === 404 || r.status === 410) await db.from("push_subs").delete().eq("endpoint", s.endpoint); // abbonamento scaduto
        else if (r.ok) sent++;
        else console.error("push", r.status, await r.text());
      } catch (e) { console.error(e); }
    }
    return new Response(JSON.stringify({ sent }), { headers: { "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response("errore", { status: 500 });
  }
});
