// Spinyl Community — unica porta d'accesso al database (le tabelle hanno RLS senza policy: solo questa funzione le legge e scrive).
// L'utente è riconosciuto dal token Google che l'app ha già per Drive: lo verifichiamo chiedendo a Google chi è.
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const ADMINS = ["gjorgkodra@gmail.com"];
const ORIGINS = [/^https:\/\/gjorgkodra-hash\.github\.io$/, /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/];

const cors = (origin: string) => ({
  "Access-Control-Allow-Origin": ORIGINS.some((r) => r.test(origin)) ? origin : "https://gjorgkodra-hash.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-google-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});
class E extends Error { constructor(public code: number, msg: string) { super(msg); } }

// token Google → utente (cache 10 minuti)
const seen = new Map<string, { gid: string; email: string; exp: number }>();
async function whoIs(token: string) {
  if (!token || token.length > 4096) throw new E(401, "login");
  const hit = seen.get(token); if (hit && hit.exp > Date.now()) return hit;
  const r = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(permissionId,emailAddress)", { headers: { Authorization: "Bearer " + token } });
  if (!r.ok) throw new E(401, "login");
  const u = (await r.json()).user || {};
  if (!u.permissionId || !u.emailAddress) throw new E(401, "login");
  const v = { gid: String(u.permissionId), email: String(u.emailAddress).toLowerCase(), exp: Date.now() + 10 * 60e3 };
  if (seen.size > 2000) seen.clear();
  seen.set(token, v); return v;
}
const clean = (s: unknown, n: number) => String(s ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, n);
const NICK = /^[\p{L}\p{N}_.\- ]{2,24}$/u;

async function member(gid: string) {
  const { data } = await db.from("members").select("id,nick,role,banned,email").eq("google_id", gid).maybeSingle();
  return data;
}
async function writeBudget(mid: string) {
  const since = new Date(Date.now() - 3600e3).toISOString();
  const [a, b] = await Promise.all([
    db.from("reviews").select("id", { count: "exact", head: true }).eq("member_id", mid).gte("updated_at", since),
    db.from("comments").select("id", { count: "exact", head: true }).eq("member_id", mid).gte("created_at", since),
  ]);
  if ((a.count || 0) + (b.count || 0) >= 40) throw new E(429, "troppi messaggi, riprova più tardi");
}
const inviteCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x % 32]).join("");

async function handle(body: any, who: { gid: string; email: string }) {
  const me = await member(who.gid);
  const a = String(body.action || "");
  if (a === "me") return { member: me && !me.banned ? { id: me.id, nick: me.nick, admin: me.role === "admin" } : null, banned: !!me?.banned };

  if (a === "join") {
    if (me) return { member: { id: me.id, nick: me.nick, admin: me.role === "admin" } };
    const nick = clean(body.nick, 24);
    if (!NICK.test(nick)) throw new E(400, "nick");
    const admin = ADMINS.includes(who.email);
    let inv: any = null;
    if (!admin) {
      const code = clean(body.code, 12).toUpperCase();
      const { data } = await db.from("invites").select("*").eq("code", code).maybeSingle();
      if (!data || data.uses >= data.max_uses) throw new E(403, "invito");
      inv = data;
    }
    const { data: m, error } = await db.from("members").insert({ google_id: who.gid, email: who.email, nick, role: admin ? "admin" : "member", invited_by: inv?.created_by ?? null }).select("id,nick,role").single();
    if (error) throw new E(409, /nick/.test(error.message) ? "nick-preso" : "errore");
    if (inv) await db.from("invites").update({ uses: inv.uses + 1 }).eq("code", inv.code).eq("uses", inv.uses);
    return { member: { id: m.id, nick: m.nick, admin: m.role === "admin" } };
  }

  if (!me || me.banned) throw new E(403, "membro");
  const admin = me.role === "admin";

  if (a === "invite") {
    const { count } = await db.from("invites").select("code", { count: "exact", head: true }).eq("created_by", me.id);
    if (!admin && (count || 0) >= 10) throw new E(429, "inviti");
    const code = inviteCode();
    await db.from("invites").insert({ code, created_by: me.id, max_uses: admin ? 50 : 5 });
    return { code };
  }

  if (a === "work") {
    const key = clean(body.work, 300);
    const { data: revs } = await db.from("reviews").select("id,stars,body,created_at,updated_at,member_id,members!inner(nick,banned)").eq("work_key", key).eq("hidden", false).order("updated_at", { ascending: false }).limit(100);
    const list = (revs || []).filter((r: any) => !r.members.banned);
    const ids = list.map((r: any) => r.id);
    const { data: cms } = ids.length ? await db.from("comments").select("id,review_id,body,created_at,member_id,members!inner(nick,banned)").in("review_id", ids).eq("hidden", false).order("created_at").limit(500) : { data: [] };
    const stars = list.filter((r: any) => r.stars).map((r: any) => r.stars);
    return {
      avg: stars.length ? Math.round(stars.reduce((s: number, x: number) => s + x, 0) / stars.length * 10) / 10 : null, n: stars.length,
      reviews: list.map((r: any) => ({ id: r.id, nick: r.members.nick, mine: r.member_id === me.id, stars: r.stars, body: r.body, at: r.updated_at,
        comments: (cms || []).filter((c: any) => c.review_id === r.id && !c.members.banned).map((c: any) => ({ id: c.id, nick: c.members.nick, mine: c.member_id === me.id, body: c.body, at: c.created_at })) })),
    };
  }

  if (a === "review") {
    await writeBudget(me.id);
    const stars = body.stars == null || body.stars === 0 ? null : Math.max(1, Math.min(5, Math.round(+body.stars)));
    const text = clean(body.body, 2000);
    if (!stars && !text) throw new E(400, "vuota");
    const row = { work_key: clean(body.work, 300), tipo: clean(body.tipo, 20), titolo: clean(body.titolo, 300), autore: clean(body.autore, 200), cover_url: /^https:\/\//.test(String(body.cover || "")) ? clean(body.cover, 600) : "",
      member_id: me.id, stars, body: text, updated_at: new Date().toISOString() };
    if (!row.work_key || !row.titolo) throw new E(400, "opera");
    const { error } = await db.from("reviews").upsert(row, { onConflict: "work_key,member_id" });
    if (error) throw new E(500, "errore");
    return { ok: true };
  }

  if (a === "comment") {
    await writeBudget(me.id);
    const text = clean(body.body, 1000); if (!text) throw new E(400, "vuoto");
    const { data: r } = await db.from("reviews").select("id").eq("id", clean(body.review, 40)).eq("hidden", false).maybeSingle();
    if (!r) throw new E(404, "recensione");
    await db.from("comments").insert({ review_id: r.id, member_id: me.id, body: text });
    return { ok: true };
  }

  if (a === "delete") {
    const t = body.kind === "comment" ? "comments" : "reviews";
    let q = db.from(t).delete().eq("id", clean(body.id, 40));
    if (!admin) q = q.eq("member_id", me.id);
    await q; return { ok: true };
  }

  if (a === "report") {
    const kind = body.kind === "comment" ? "comment" : "review"; const id = clean(body.id, 40);
    await db.from("reports").upsert({ kind, target_id: id, member_id: me.id, reason: clean(body.reason, 300) }, { onConflict: "kind,target_id,member_id" });
    const { count } = await db.from("reports").select("id", { count: "exact", head: true }).eq("kind", kind).eq("target_id", id);
    if ((count || 0) >= 3 || admin) await db.from(kind === "comment" ? "comments" : "reviews").update({ hidden: true }).eq("id", id); // 3 segnalazioni (o l'amministratore) → nascosto
    return { ok: true };
  }

  if (a === "recent") {
    const { data } = await db.from("reviews").select("work_key,tipo,titolo,autore,cover_url,stars,body,updated_at,members!inner(nick,banned)").eq("hidden", false).order("updated_at", { ascending: false }).limit(40);
    return { reviews: (data || []).filter((r: any) => !r.members.banned).slice(0, 20).map((r: any) => ({ work: r.work_key, tipo: r.tipo, titolo: r.titolo, autore: r.autore, cover: r.cover_url, stars: r.stars, body: r.body.slice(0, 200), nick: r.members.nick, at: r.updated_at })) };
  }

  if (a === "ban" && admin) {
    await db.from("members").update({ banned: true }).eq("nick", clean(body.nick, 24)).neq("role", "admin");
    return { ok: true };
  }
  throw new E(400, "azione");
}

Deno.serve(async (req) => {
  const h = { ...cors(req.headers.get("origin") || ""), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: h });
  try {
    if (req.method !== "POST") throw new E(405, "metodo");
    const who = await whoIs(req.headers.get("x-google-token") || "");
    const body = await req.json().catch(() => ({}));
    return new Response(JSON.stringify(await handle(body, who)), { headers: h });
  } catch (e) {
    const code = e instanceof E ? e.code : 500;
    if (!(e instanceof E)) console.error(e);
    return new Response(JSON.stringify({ error: e instanceof E ? e.message : "errore" }), { status: code, headers: h });
  }
});
