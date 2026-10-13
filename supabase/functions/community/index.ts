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
  const { data } = await db.from("members").select("id,nick,role,banned,email,city,bio").eq("google_id", gid).maybeSingle();
  return data;
}
async function writeBudget(mid: string) {
  const since = new Date(Date.now() - 3600e3).toISOString();
  const n = await Promise.all([
    db.from("reviews").select("id", { count: "exact", head: true }).eq("member_id", mid).gte("updated_at", since),
    db.from("comments").select("id", { count: "exact", head: true }).eq("member_id", mid).gte("created_at", since),
    db.from("posts").select("id", { count: "exact", head: true }).eq("member_id", mid).gte("created_at", since),
    db.from("messages").select("id", { count: "exact", head: true }).eq("member_id", mid).gte("created_at", since),
    db.from("event_msgs").select("id", { count: "exact", head: true }).eq("member_id", mid).gte("created_at", since),
  ]);
  // in un ascolto in diretta si commenta molto: limite più alto
  if (n.reduce((s, r) => s + (r.count || 0), 0) >= 200) throw new E(429, "troppi messaggi, riprova più tardi");
}
async function blockedSet(mid: string) {
  const { data } = await db.from("blocks").select("member_id,blocked_id").or(`member_id.eq.${mid},blocked_id.eq.${mid}`).limit(1000);
  return new Set((data || []).map((b: any) => (b.member_id === mid ? b.blocked_id : b.member_id)));
}
const shareOut = (x: any) => ({ member: x.member_id, nick: x.members.nick, city: x.members.city || "", work: x.work_key, kind: x.kind, tipo: x.tipo, titolo: x.titolo, autore: x.autore, anno: x.anno, formato: x.formato, cover: x.cover_url, offer: x.offer, price: x.price, note: x.note, at: x.updated_at });
async function myThread(id: string, mid: string) {
  const { data } = await db.from("threads").select("id,a,b,work_key,titolo,cover_url").eq("id", id).maybeSingle();
  if (!data || (data.a !== mid && data.b !== mid)) throw new E(404, "conversazione");
  return data;
}
async function addMessage(th: any, mid: string, body: any) {
  const offer = ["vendo", "presto", "regalo", "compro", "prestito"].includes(body.offer) ? body.offer : "";
  const price = (offer === "vendo" || offer === "compro") && body.price != null && body.price !== "" && +body.price >= 0 && +body.price < 1e6 ? Math.round(+body.price * 100) / 100 : null;
  const text = clean(body.body, 2000);
  if (!text && !offer) throw new E(400, "vuoto");
  const now = new Date().toISOString();
  await db.from("messages").insert({ thread_id: th.id, member_id: mid, body: text, offer, price });
  await db.from("threads").update(th.a === mid ? { updated_at: now, a_read: now } : { updated_at: now, b_read: now }).eq("id", th.id);
}
const inviteCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x % 32]).join("");

async function handle(body: any, who: { gid: string; email: string }) {
  const me = await member(who.gid);
  const a = String(body.action || "");
  if (a === "me") return { member: me && !me.banned ? { id: me.id, nick: me.nick, admin: me.role === "admin", city: me.city || "" } : null, banned: !!me?.banned };

  if (a === "join") {
    if (me) return { member: { id: me.id, nick: me.nick, admin: me.role === "admin", city: me.city || "" } };
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
    const { data: m, error } = await db.from("members").insert({ google_id: who.gid, email: who.email, nick, role: admin ? "admin" : "member", invited_by: inv?.created_by ?? null, accepted_terms_at: new Date().toISOString(), city: clean(body.city, 60) }).select("id,nick,role,city").single();
    if (error) throw new E(409, /nick/.test(error.message) ? "nick-preso" : "errore");
    if (inv) await db.from("invites").update({ uses: inv.uses + 1 }).eq("code", inv.code).eq("uses", inv.uses);
    return { member: { id: m.id, nick: m.nick, admin: m.role === "admin", city: m.city || "" } };
  }

  if (!me || me.banned) throw new E(403, "membro");
  const admin = me.role === "admin";

  // ── I miei dati: esportazione e cancellazione dell'account (GDPR) ──
  if (a === "export") {
    const q = (t: string, col = "member_id") => db.from(t).select("*").eq(col, me.id).limit(5000).then((r: any) => r.data || []);
    const [profile, reviews, comments, posts, shares, messages, events, rsvps, blocks, invites] = await Promise.all([
      db.from("members").select("nick,email,role,city,bio,created_at,accepted_terms_at").eq("id", me.id).single().then((r: any) => r.data),
      q("reviews"), q("comments"), q("posts"), q("shares"), q("messages"), q("events"), q("event_rsvps"), q("blocks"), q("invites", "created_by")]);
    const ratings = await q("ratings", "rater_id");
    return { exportedAt: new Date().toISOString(), profile, reviews, comments, posts, shares, messages, events, rsvps, blocks, invites, ratings };
  }
  if (a === "deleteAccount") {
    if (clean(body.confirm, 24) !== me.nick) throw new E(400, "conferma");
    // i commenti sui miei pezzi condivisi non hanno un collegamento automatico: li tolgo a mano
    await db.from("comments").delete().eq("share_member", me.id);
    await db.from("push_subs").delete().eq("member_id", me.id);
    await db.from("members").delete().eq("id", me.id); // tutto il resto si cancella a cascata
    return { ok: true };
  }

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
    const { data: cms } = ids.length ? await db.from("comments").select("id,review_id,body,created_at,edited_at,member_id,members!inner(nick,banned)").in("review_id", ids).eq("hidden", false).order("created_at").limit(500) : { data: [] };
    const stars = list.filter((r: any) => r.stars).map((r: any) => r.stars);
    const blocked = await blockedSet(me.id);
    const [{ data: sh }, { data: ps }] = await Promise.all([
      db.from("shares").select("member_id,kind,offer,price,formato,note,members!inner(nick,banned)").eq("work_key", key).limit(200),
      db.from("posts").select("id,title,body,created_at,member_id,members!inner(nick,banned)").eq("work_key", key).eq("hidden", false).order("created_at", { ascending: false }).limit(50),
    ]);
    const shares = (sh || []).filter((x: any) => !x.members.banned && !blocked.has(x.member_id)).map((x: any) => ({ member: x.member_id, nick: x.members.nick, mine: x.member_id === me.id, kind: x.kind, offer: x.offer, price: x.price, formato: x.formato, note: x.note }));
    const posts = (ps || []).filter((x: any) => !x.members.banned && !blocked.has(x.member_id)).map((x: any) => ({ id: x.id, title: x.title, excerpt: x.body.slice(0, 160), nick: x.members.nick, mine: x.member_id === me.id, at: x.created_at }));
    return { shares, posts,
      avg: stars.length ? Math.round(stars.reduce((s: number, x: number) => s + x, 0) / stars.length * 10) / 10 : null, n: stars.length,
      reviews: list.map((r: any) => ({ id: r.id, nick: r.members.nick, mine: r.member_id === me.id, stars: r.stars, body: r.body, at: r.updated_at,
        comments: (cms || []).filter((c: any) => c.review_id === r.id && !c.members.banned).map((c: any) => ({ id: c.id, nick: c.members.nick, mine: c.member_id === me.id, body: c.body, at: c.created_at, edited: !!c.edited_at })) })),
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
    if (body.share && typeof body.share === "object") {
      const sm = clean(body.share.member, 40), sw = clean(body.share.work, 300), sk = body.share.kind === "wish" ? "wish" : "own";
      const { data: sh } = await db.from("shares").select("member_id").eq("member_id", sm).eq("work_key", sw).eq("kind", sk).maybeSingle();
      if (!sh) throw new E(404, "condivisione");
      await db.from("comments").insert({ share_member: sm, share_work: sw, share_kind: sk, member_id: me.id, body: text });
      return { ok: true };
    }
    if (body.post) {
      const { data: p } = await db.from("posts").select("id").eq("id", clean(body.post, 40)).eq("hidden", false).maybeSingle();
      if (!p) throw new E(404, "articolo");
      await db.from("comments").insert({ post_id: p.id, member_id: me.id, body: text });
      return { ok: true };
    }
    const { data: r } = await db.from("reviews").select("id").eq("id", clean(body.review, 40)).eq("hidden", false).maybeSingle();
    if (!r) throw new E(404, "recensione");
    await db.from("comments").insert({ review_id: r.id, member_id: me.id, body: text });
    return { ok: true };
  }

  // ── Blog dell'opera ──
  if (a === "post") {
    await writeBudget(me.id);
    const row = { work_key: clean(body.work, 300), tipo: clean(body.tipo, 20), titolo: clean(body.titolo, 300), autore: clean(body.autore, 200),
      cover_url: /^https:\/\//.test(String(body.cover || "")) ? clean(body.cover, 600) : "", member_id: me.id, title: clean(body.title, 150), body: clean(body.body, 8000) };
    if (!row.work_key || !row.titolo || row.title.length < 2 || !row.body) throw new E(400, "articolo");
    const { data, error } = await db.from("posts").insert(row).select("id").single();
    if (error) throw new E(500, "errore");
    return { id: data.id };
  }
  if (a === "postGet") {
    const { data: p } = await db.from("posts").select("id,work_key,tipo,titolo,autore,cover_url,title,body,created_at,edited_at,member_id,members!inner(nick,banned)").eq("id", clean(body.id, 40)).eq("hidden", false).maybeSingle();
    if (!p || p.members.banned) throw new E(404, "articolo");
    const { data: cms } = await db.from("comments").select("id,body,created_at,edited_at,member_id,members!inner(nick,banned)").eq("post_id", p.id).eq("hidden", false).order("created_at").limit(300);
    return { post: { id: p.id, work: p.work_key, tipo: p.tipo, titolo: p.titolo, autore: p.autore, cover: p.cover_url, title: p.title, body: p.body, nick: p.members.nick, member: p.member_id, mine: p.member_id === me.id, at: p.created_at, edited: !!p.edited_at },
      comments: (cms || []).filter((c: any) => !c.members.banned).map((c: any) => ({ id: c.id, nick: c.members.nick, mine: c.member_id === me.id, body: c.body, at: c.created_at, edited: !!c.edited_at })) };
  }

  // ── Pezzi e desideri condivisi: il telefono manda la lista completa, il server la sostituisce ──
  if (a === "shares") {
    const items = Array.isArray(body.items) ? body.items.slice(0, 3000) : [];
    const rows = new Map<string, any>();
    for (const x of items) {
      const kind = x.kind === "wish" ? "wish" : "own"; const work_key = clean(x.work, 300); const titolo = clean(x.titolo, 300);
      if (!work_key || !titolo) continue;
      const offer = kind === "own" && ["vendo", "presto", "regalo"].includes(x.offer) ? x.offer : "";
      const price = offer === "vendo" && +x.price >= 0 && +x.price < 1e6 ? Math.round(+x.price * 100) / 100 : null;
      rows.set(work_key + "|" + kind, { member_id: me.id, work_key, kind, tipo: clean(x.tipo, 20), titolo, autore: clean(x.autore, 200), anno: clean(x.anno, 10), formato: clean(x.formato, 60),
        cover_url: /^https:\/\//.test(String(x.cover || "")) ? clean(x.cover, 600) : "", offer, price, note: clean(x.note, 300), updated_at: new Date().toISOString() });
    }
    const { data: old } = await db.from("shares").select("work_key,kind,offer,price,note,titolo").eq("member_id", me.id);
    const keep = new Set(rows.keys());
    const gone = (old || []).filter((o: any) => !keep.has(o.work_key + "|" + o.kind));
    for (const g of gone) await db.from("shares").delete().eq("member_id", me.id).eq("work_key", g.work_key).eq("kind", g.kind);
    // aggiorna solo i cambiati, così "updated_at" (e la bacheca) mostra le novità vere
    const prev = new Map((old || []).map((o: any) => [o.work_key + "|" + o.kind, o]));
    const changed = [...rows.values()].filter((r) => { const o: any = prev.get(r.work_key + "|" + r.kind); return !o || o.offer !== r.offer || +(o.price ?? -1) !== +(r.price ?? -1) || o.note !== r.note || o.titolo !== r.titolo; });
    for (let i = 0; i < changed.length; i += 500) await db.from("shares").upsert(changed.slice(i, i + 500), { onConflict: "member_id,work_key,kind" });
    return { ok: true, n: rows.size };
  }
  // Scambi: chi cerca cose che ho (anche se non le ho condivise) e chi ha cose che cerco
  if (a === "match") {
    const own = (Array.isArray(body.own) ? body.own : []).slice(0, 3000).map((k: unknown) => clean(k, 300)).filter(Boolean);
    const wish = (Array.isArray(body.wish) ? body.wish : []).slice(0, 1000).map((k: unknown) => clean(k, 300)).filter(Boolean);
    const blocked = await blockedSet(me.id);
    const pick = "member_id,work_key,kind,tipo,titolo,autore,anno,formato,cover_url,offer,price,note,updated_at,members!inner(nick,banned,city)";
    const q = async (keys: string[], kind: string) => {
      const out: any[] = [];
      for (let i = 0; i < keys.length; i += 150) {
        const { data } = await db.from("shares").select(pick).eq("kind", kind).in("work_key", keys.slice(i, i + 150)).neq("member_id", me.id).limit(300);
        out.push(...(data || []));
      }
      return out.filter((x) => !x.members.banned && !blocked.has(x.member_id)).map(shareOut);
    };
    const [wanted, available] = await Promise.all([q(own, "wish"), q(wish, "own")]);
    return { wanted, available };
  }

  // ── Messaggi privati tra membri (proposte di vendita, prestito, regalo) ──
  if (a === "offer") {
    await writeBudget(me.id);
    const to = clean(body.to, 40); if (!to || to === me.id) throw new E(400, "destinatario");
    const { data: other } = await db.from("members").select("id,banned").eq("id", to).maybeSingle();
    if (!other || other.banned) throw new E(404, "destinatario");
    const { data: bl } = await db.from("blocks").select("member_id").or(`and(member_id.eq.${to},blocked_id.eq.${me.id}),and(member_id.eq.${me.id},blocked_id.eq.${to})`).limit(1);
    if (bl && bl.length) throw new E(403, "bloccato");
    const [x, y] = [me.id, to].sort(); const work_key = clean(body.work, 300);
    let { data: th } = await db.from("threads").select("id,a").eq("a", x).eq("b", y).eq("work_key", work_key).maybeSingle();
    if (!th) {
      const ins = await db.from("threads").insert({ a: x, b: y, work_key, titolo: clean(body.titolo, 300), cover_url: /^https:\/\//.test(String(body.cover || "")) ? clean(body.cover, 600) : "" }).select("id,a").single();
      th = ins.data; if (!th) throw new E(500, "errore");
    }
    await addMessage(th, me.id, body);
    return { thread: th.id };
  }
  if (a === "send") {
    await writeBudget(me.id);
    const th = await myThread(clean(body.thread, 40), me.id);
    const other = th.a === me.id ? th.b : th.a;
    const { data: bl } = await db.from("blocks").select("member_id").or(`and(member_id.eq.${other},blocked_id.eq.${me.id}),and(member_id.eq.${me.id},blocked_id.eq.${other})`).limit(1);
    if (bl && bl.length) throw new E(403, "bloccato");
    await addMessage(th, me.id, body);
    return { ok: true };
  }
  if (a === "threads") {
    const { data } = await db.from("threads").select("id,a,b,work_key,titolo,cover_url,a_read,b_read,updated_at").or(`a.eq.${me.id},b.eq.${me.id}`).order("updated_at", { ascending: false }).limit(100);
    const others = [...new Set((data || []).map((t: any) => (t.a === me.id ? t.b : t.a)))];
    const { data: ms } = others.length ? await db.from("members").select("id,nick").in("id", others) : { data: [] };
    const nick = new Map((ms || []).map((m: any) => [m.id, m.nick]));
    const out = [];
    for (const t of data || []) {
      const { data: last } = await db.from("messages").select("body,offer,price,member_id,created_at").eq("thread_id", t.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const other = t.a === me.id ? t.b : t.a; const read = t.a === me.id ? t.a_read : t.b_read;
      out.push({ id: t.id, other, nick: nick.get(other) || "?", titolo: t.titolo, cover: t.cover_url, at: t.updated_at, unread: !!last && last.member_id !== me.id && last.created_at > read,
        last: last ? { body: last.body.slice(0, 120), offer: last.offer, price: last.price, mine: last.member_id === me.id } : null });
    }
    return { threads: out };
  }
  if (a === "thread") {
    const th = await myThread(clean(body.id, 40), me.id);
    const { data: msgs } = await db.from("messages").select("id,member_id,body,offer,price,created_at,edited_at").eq("thread_id", th.id).order("created_at").limit(500);
    await db.from("threads").update(th.a === me.id ? { a_read: new Date().toISOString() } : { b_read: new Date().toISOString() }).eq("id", th.id);
    const other = th.a === me.id ? th.b : th.a;
    const { data: o } = await db.from("members").select("nick").eq("id", other).maybeSingle();
    const { data: bl } = await db.from("blocks").select("member_id").eq("member_id", me.id).eq("blocked_id", other).maybeSingle();
    const both = (msgs || []).some((m: any) => m.member_id === me.id) && (msgs || []).some((m: any) => m.member_id === other);
    const { data: myR } = await db.from("ratings").select("stars,body").eq("thread_id", th.id).eq("rater_id", me.id).maybeSingle();
    return { thread: { id: th.id, other, nick: o?.nick || "?", titolo: th.titolo, cover: th.cover_url, work: th.work_key, blocked: !!bl, canRate: both, myRating: myR || null },
      messages: (msgs || []).map((m: any) => ({ id: m.id, mine: m.member_id === me.id, body: m.body, offer: m.offer, price: m.price, at: m.created_at, edited: !!m.edited_at })) };
  }
  if (a === "unread") {
    const { data } = await db.from("threads").select("id,a,a_read,b_read,updated_at").or(`a.eq.${me.id},b.eq.${me.id}`).order("updated_at", { ascending: false }).limit(100);
    let n = 0;
    for (const t of data || []) {
      const read = t.a === me.id ? t.a_read : t.b_read;
      if (t.updated_at > read) { const { data: last } = await db.from("messages").select("member_id").eq("thread_id", t.id).order("created_at", { ascending: false }).limit(1).maybeSingle(); if (last && last.member_id !== me.id) n++; }
    }
    const { data: iv } = await db.from("event_invites").select("event_id,events!inner(starts_at,hidden)").eq("member_id", me.id).gte("events.starts_at", new Date().toISOString()).eq("events.hidden", false);
    const evIds = (iv || []).map((x: any) => x.event_id);
    const { data: rs } = evIds.length ? await db.from("event_rsvps").select("event_id").eq("member_id", me.id).in("event_id", evIds) : { data: [] };
    const answered = new Set((rs || []).map((x: any) => x.event_id));
    const { count: nn } = await db.from("notifications").select("id", { count: "exact", head: true }).eq("member_id", me.id).eq("read", false);
    return { unread: n, invites: evIds.filter((x: string) => !answered.has(x)).length, notifs: nn || 0 };
  }
  // ── Notifiche (create dal database: commenti, risposte, inviti, partecipanti, offerte, articoli) ──
  if (a === "notifs") {
    const { data } = await db.from("notifications").select("id,kind,data,read,created_at,actor_id").eq("member_id", me.id).order("created_at", { ascending: false }).limit(60);
    const ids = [...new Set((data || []).map((x: any) => x.actor_id).filter(Boolean))];
    const { data: ms } = ids.length ? await db.from("members").select("id,nick").in("id", ids) : { data: [] };
    const nick = new Map((ms || []).map((m: any) => [m.id, m.nick]));
    if (body.markRead) await db.from("notifications").update({ read: true }).eq("member_id", me.id).eq("read", false);
    return { items: (data || []).map((x: any) => ({ id: x.id, kind: x.kind, data: x.data, read: x.read, at: x.created_at, nick: nick.get(x.actor_id) || "" })) };
  }

  if (a === "block") {
    const who2 = clean(body.member, 40); if (!who2 || who2 === me.id) throw new E(400, "membro");
    if (body.off) await db.from("blocks").delete().eq("member_id", me.id).eq("blocked_id", who2);
    else await db.from("blocks").upsert({ member_id: me.id, blocked_id: who2 }, { onConflict: "member_id,blocked_id" });
    return { ok: true };
  }

  // ── Eventi ──
  if (a === "members") {
    const { data } = await db.from("members").select("id,nick,city").eq("banned", false).neq("id", me.id).order("nick").limit(500);
    const blocked = await blockedSet(me.id);
    return { members: (data || []).filter((m: any) => !blocked.has(m.id)) };
  }
  if (a === "eventCreate" || a === "eventEdit") {
    await writeBudget(me.id);
    const kind = ["vivo", "online", "ascolto"].includes(body.kind) ? body.kind : "vivo";
    const starts = new Date(String(body.starts || ""));
    if (isNaN(+starts) || +starts < Date.now() - 864e5 || +starts > Date.now() + 400 * 864e5) throw new E(400, "data");
    const link = clean(body.link, 500);
    const row: any = { title: clean(body.title, 120), body: clean(body.body, 4000), kind, starts_at: starts.toISOString(), place: clean(body.place, 200),
      link: /^https:\/\//.test(link) ? link : "", work_key: clean(body.work, 300), tipo: clean(body.tipo, 20), titolo: clean(body.titolo, 300), autore: clean(body.autore, 200),
      cover_url: /^https:\/\//.test(String(body.cover || "")) ? clean(body.cover, 600) : "", visibility: body.visibility === "invite" ? "invite" : "all" };
    if (row.title.length < 2) throw new E(400, "titolo");
    let id = clean(body.id, 40);
    if (a === "eventEdit") {
      const { data: ev } = await db.from("events").select("member_id").eq("id", id).maybeSingle();
      if (!ev || (ev.member_id !== me.id && !admin)) throw new E(403, "evento");
      await db.from("events").update(row).eq("id", id);
    } else {
      const { count } = await db.from("events").select("id", { count: "exact", head: true }).eq("member_id", me.id).gte("created_at", new Date(Date.now() - 864e5).toISOString());
      if ((count || 0) >= 10) throw new E(429, "troppi");
      const { data, error } = await db.from("events").insert({ ...row, member_id: me.id }).select("id").single();
      if (error || !data) throw new E(500, "errore");
      id = data.id;
      await db.from("event_rsvps").insert({ event_id: id, member_id: me.id, status: "si" });
    }
    const inv = (Array.isArray(body.invite) ? body.invite : []).slice(0, 200).map((x: unknown) => clean(x, 40)).filter((x: string) => /^[0-9a-f-]{36}$/.test(x) && x !== me.id);
    if (inv.length) await db.from("event_invites").upsert(inv.map((m: string) => ({ event_id: id, member_id: m })), { onConflict: "event_id,member_id", ignoreDuplicates: true });
    return { id };
  }
  const canSee = async (ev: any) => {
    if (!ev || ev.hidden) return false;
    if (ev.visibility === "all" || ev.member_id === me.id || admin) return true;
    const { data } = await db.from("event_invites").select("member_id").eq("event_id", ev.id).eq("member_id", me.id).maybeSingle();
    return !!data;
  };
  if (a === "events") {
    const since = new Date(Date.now() - 6 * 3600e3).toISOString();
    const blocked = await blockedSet(me.id);
    const { data: inv } = await db.from("event_invites").select("event_id").eq("member_id", me.id);
    const invited = new Set((inv || []).map((x: any) => x.event_id));
    const sel = "id,member_id,title,kind,starts_at,place,link,work_key,tipo,titolo,autore,cover_url,visibility,members!events_member_id_fkey!inner(nick,banned,city)";
    const [{ data: up }, { data: past }] = await Promise.all([
      db.from("events").select(sel).eq("hidden", false).gte("starts_at", since).order("starts_at").limit(100),
      db.from("events").select(sel).eq("hidden", false).lt("starts_at", since).order("starts_at", { ascending: false }).limit(15),
    ]);
    const vis = (e: any) => !e.members.banned && !blocked.has(e.member_id) && (e.visibility === "all" || e.member_id === me.id || invited.has(e.id) || admin);
    const all = [...(up || []), ...(past || [])].filter(vis);
    const ids = all.map((e: any) => e.id);
    const { data: rs } = ids.length ? await db.from("event_rsvps").select("event_id,member_id,status").in("event_id", ids) : { data: [] };
    const out = (e: any) => {
      const r = (rs || []).filter((x: any) => x.event_id === e.id);
      return { id: e.id, title: e.title, kind: e.kind, starts: e.starts_at, place: e.place, link: e.link, work: e.work_key, tipo: e.tipo, titolo: e.titolo, autore: e.autore, cover: e.cover_url,
        visibility: e.visibility, nick: e.members.nick, city: e.members.city || "", member: e.member_id, mine: e.member_id === me.id, invited: invited.has(e.id), my: (r.find((x: any) => x.member_id === me.id) || {}).status || "",
        going: r.filter((x: any) => x.status === "si").length };
    };
    return { upcoming: (up || []).filter(vis).map(out), past: (past || []).filter(vis).map(out) };
  }
  if (a === "eventGet") {
    const { data: e } = await db.from("events").select("*,members!events_member_id_fkey!inner(nick,banned)").eq("id", clean(body.id, 40)).maybeSingle();
    if (!(await canSee(e)) || e.members.banned) throw new E(404, "evento");
    const blocked = await blockedSet(me.id);
    const [{ data: rs }, { data: ms }, { data: iv }] = await Promise.all([
      db.from("event_rsvps").select("member_id,status,members!inner(nick)").eq("event_id", e.id),
      db.from("event_msgs").select("id,member_id,body,created_at,edited_at,members!inner(nick,banned)").eq("event_id", e.id).order("created_at").limit(500),
      db.from("event_invites").select("member_id,members!inner(nick)").eq("event_id", e.id),
    ]);
    return { event: { id: e.id, title: e.title, body: e.body, kind: e.kind, starts: e.starts_at, place: e.place, link: e.link, work: e.work_key, tipo: e.tipo, titolo: e.titolo, autore: e.autore, cover: e.cover_url,
        visibility: e.visibility, nick: e.members.nick, member: e.member_id, mine: e.member_id === me.id },
      rsvps: (rs || []).map((r: any) => ({ nick: r.members.nick, status: r.status, mine: r.member_id === me.id })),
      invited: (iv || []).map((r: any) => ({ id: r.member_id, nick: r.members.nick })),
      messages: (ms || []).filter((m: any) => !m.members.banned && !blocked.has(m.member_id)).map((m: any) => ({ id: m.id, nick: m.members.nick, mine: m.member_id === me.id, body: m.body, at: m.created_at, edited: !!m.edited_at })) };
  }
  if (a === "rsvp") {
    const { data: e } = await db.from("events").select("id,member_id,visibility,hidden").eq("id", clean(body.id, 40)).maybeSingle();
    if (!(await canSee(e))) throw new E(404, "evento");
    const status = ["si", "forse", "no"].includes(body.status) ? body.status : "si";
    await db.from("event_rsvps").upsert({ event_id: e.id, member_id: me.id, status, updated_at: new Date().toISOString() }, { onConflict: "event_id,member_id" });
    return { ok: true };
  }
  if (a === "eventMsg") {
    await writeBudget(me.id);
    const { data: e } = await db.from("events").select("id,member_id,visibility,hidden").eq("id", clean(body.id, 40)).maybeSingle();
    if (!(await canSee(e))) throw new E(404, "evento");
    const text = clean(body.body, 1000); if (!text) throw new E(400, "vuoto");
    await db.from("event_msgs").insert({ event_id: e.id, member_id: me.id, body: text });
    return { ok: true };
  }
  if (a === "eventDelete") {
    let q = db.from("events").delete().eq("id", clean(body.id, 40));
    if (!admin) q = q.eq("member_id", me.id);
    await q; return { ok: true };
  }

  // ── Modifica dei propri commenti, messaggi, messaggi degli eventi e articoli ──
  if (a === "edit") {
    await writeBudget(me.id);
    const T: Record<string, [string, number]> = { comment: ["comments", 1000], message: ["messages", 2000], eventmsg: ["event_msgs", 1000], post: ["posts", 8000] };
    const [t, max] = T[String(body.kind)] || [];
    if (!t) throw new E(400, "tipo");
    const id = clean(body.id, 40), text = clean(body.body, max);
    const { data: row } = await db.from(t).select(t === "messages" ? "member_id,offer" : "member_id").eq("id", id).maybeSingle();
    if (!row || (row as any).member_id !== me.id) throw new E(403, "non tuo");
    if (!text && !(t === "messages" && (row as any).offer)) throw new E(400, "vuoto");
    const upd: any = { body: text, edited_at: new Date().toISOString() };
    if (t === "posts") { const title = clean(body.title, 150); if (title.length < 2) throw new E(400, "titolo"); upd.title = title; }
    await db.from(t).update(upd).eq("id", id).eq("member_id", me.id);
    return { ok: true };
  }

  if (a === "delete") {
    if (body.kind === "message" || body.kind === "eventmsg") {
      let q = db.from(body.kind === "message" ? "messages" : "event_msgs").delete().eq("id", clean(body.id, 40));
      if (!(admin && body.kind === "eventmsg")) q = q.eq("member_id", me.id);
      await q; return { ok: true };
    }
    const t = body.kind === "comment" ? "comments" : body.kind === "post" ? "posts" : "reviews";
    let q = db.from(t).delete().eq("id", clean(body.id, 40));
    if (!admin) q = q.eq("member_id", me.id);
    await q; return { ok: true };
  }

  if (a === "report") {
    const kind = ["comment", "post", "message", "event", "eventmsg", "rating"].includes(body.kind) ? body.kind : "review"; const id = clean(body.id, 40);
    await db.from("reports").upsert({ kind, target_id: id, member_id: me.id, reason: clean(body.reason, 300) }, { onConflict: "kind,target_id,member_id" });
    const { count } = await db.from("reports").select("id", { count: "exact", head: true }).eq("kind", kind).eq("target_id", id);
    const table = kind === "comment" ? "comments" : kind === "post" ? "posts" : kind === "review" ? "reviews" : kind === "event" ? "events" : kind === "rating" ? "ratings" : "";
    if (table && ((count || 0) >= 3 || admin)) await db.from(table).update({ hidden: true }).eq("id", id); // 3 segnalazioni (o l'amministratore) → nascosto
    return { ok: true };
  }

  // Discussione su una voce della bacheca: recensione o pezzo condiviso, con i commenti della community
  if (a === "discussion") {
    const blocked = await blockedSet(me.id);
    const ok = (x: any) => !x.members.banned && !blocked.has(x.member_id);
    const cm = (q: any) => q.eq("hidden", false).order("created_at").limit(300);
    const mapC = (cms: any[]) => (cms || []).filter(ok).map((c: any) => ({ id: c.id, nick: c.members.nick, mine: c.member_id === me.id, body: c.body, at: c.created_at, edited: !!c.edited_at }));
    if (body.type === "review") {
      const { data: r } = await db.from("reviews").select("id,work_key,tipo,titolo,autore,cover_url,stars,body,updated_at,member_id,members!inner(nick,banned)").eq("id", clean(body.id, 40)).eq("hidden", false).maybeSingle();
      if (!r || !ok(r)) throw new E(404, "recensione");
      const { data: cms } = await cm(db.from("comments").select("id,body,created_at,edited_at,member_id,members!inner(nick,banned)").eq("review_id", r.id));
      return { item: { type: "review", id: r.id, work: r.work_key, tipo: r.tipo, titolo: r.titolo, autore: r.autore, cover: r.cover_url, stars: r.stars, body: r.body, nick: r.members.nick, member: r.member_id, mine: r.member_id === me.id, at: r.updated_at }, comments: mapC(cms || []) };
    }
    const sm = clean(body.member, 40), sw = clean(body.work, 300), sk = body.kind === "wish" ? "wish" : "own";
    const { data: x } = await db.from("shares").select("member_id,work_key,kind,tipo,titolo,autore,anno,formato,cover_url,offer,price,note,updated_at,members!inner(nick,banned,city)").eq("member_id", sm).eq("work_key", sw).eq("kind", sk).maybeSingle();
    if (!x || !ok(x)) throw new E(404, "condivisione");
    const { data: cms } = await cm(db.from("comments").select("id,body,created_at,edited_at,member_id,members!inner(nick,banned)").eq("share_member", sm).eq("share_work", sw).eq("share_kind", sk));
    return { item: { type: "share", ...shareOut(x), mine: x.member_id === me.id }, comments: mapC(cms || []) };
  }
  if (a === "board") {
    const blocked = await blockedSet(me.id);
    const [{ data: rv }, { data: ps }, { data: sh }] = await Promise.all([
      db.from("reviews").select("id,work_key,tipo,titolo,autore,cover_url,stars,body,updated_at,member_id,members!inner(nick,banned)").eq("hidden", false).order("updated_at", { ascending: false }).limit(30),
      db.from("posts").select("id,work_key,tipo,titolo,autore,cover_url,title,body,created_at,member_id,members!inner(nick,banned)").eq("hidden", false).order("created_at", { ascending: false }).limit(20),
      db.from("shares").select("member_id,work_key,kind,tipo,titolo,autore,anno,formato,cover_url,offer,price,note,updated_at,members!inner(nick,banned,city)").order("updated_at", { ascending: false }).limit(40),
    ]);
    const ok = (x: any) => !x.members.banned && !blocked.has(x.member_id);
    const items = [
      ...(rv || []).filter(ok).map((r: any) => ({ type: "review", id: r.id, work: r.work_key, tipo: r.tipo, titolo: r.titolo, autore: r.autore, cover: r.cover_url, stars: r.stars, body: r.body.slice(0, 200), nick: r.members.nick, member: r.member_id, at: r.updated_at })),
      ...(ps || []).filter(ok).map((p: any) => ({ type: "post", id: p.id, work: p.work_key, tipo: p.tipo, titolo: p.titolo, autore: p.autore, cover: p.cover_url, title: p.title, body: p.body.slice(0, 200), nick: p.members.nick, member: p.member_id, at: p.created_at })),
      ...(sh || []).filter(ok).map((x: any) => ({ type: "share", ...shareOut(x) })),
    ].sort((x, y) => String(y.at).localeCompare(String(x.at))).slice(0, 50);
    // quanti commenti ha ogni voce
    const rid = items.filter((i: any) => i.type === "review").map((i: any) => i.id), pid = items.filter((i: any) => i.type === "post").map((i: any) => i.id);
    const smem = [...new Set(items.filter((i: any) => i.type === "share").map((i: any) => i.member))];
    const [c1, c2, c3] = await Promise.all([
      rid.length ? db.from("comments").select("review_id").in("review_id", rid).eq("hidden", false) : Promise.resolve({ data: [] }),
      pid.length ? db.from("comments").select("post_id").in("post_id", pid).eq("hidden", false) : Promise.resolve({ data: [] }),
      smem.length ? db.from("comments").select("share_member,share_work,share_kind").in("share_member", smem).eq("hidden", false) : Promise.resolve({ data: [] }),
    ]);
    const cnt = new Map<string, number>(); const inc = (k: string) => cnt.set(k, (cnt.get(k) || 0) + 1);
    (c1.data || []).forEach((c: any) => inc("r" + c.review_id)); (c2.data || []).forEach((c: any) => inc("p" + c.post_id));
    (c3.data || []).forEach((c: any) => inc("s" + c.share_member + "|" + c.share_work + "|" + c.share_kind));
    for (const i of items as any[]) i.comments = cnt.get(i.type === "review" ? "r" + i.id : i.type === "post" ? "p" + i.id : "s" + i.member + "|" + i.work + "|" + i.kind) || 0;
    return { items };
  }
  if (a === "recent") {
    const { data } = await db.from("reviews").select("work_key,tipo,titolo,autore,cover_url,stars,body,updated_at,members!inner(nick,banned)").eq("hidden", false).order("updated_at", { ascending: false }).limit(40);
    return { reviews: (data || []).filter((r: any) => !r.members.banned).slice(0, 20).map((r: any) => ({ work: r.work_key, tipo: r.tipo, titolo: r.titolo, autore: r.autore, cover: r.cover_url, stars: r.stars, body: r.body.slice(0, 200), nick: r.members.nick, at: r.updated_at })) };
  }

  // ── Profili e valutazioni ──
  if (a === "profileSave") {
    const city = clean(body.city, 60), bio = clean(body.bio, 300);
    await db.from("members").update({ city, bio }).eq("id", me.id);
    return { member: { id: me.id, nick: me.nick, admin, city } };
  }
  if (a === "profile") {
    const id = clean(body.id, 40);
    const { data: m } = await db.from("members").select("id,nick,city,bio,created_at,banned").eq("id", id).maybeSingle();
    if (!m || m.banned) throw new E(404, "membro");
    const blocked = await blockedSet(me.id);
    const { data: iBlocked } = await db.from("blocks").select("member_id").eq("member_id", me.id).eq("blocked_id", m.id).maybeSingle();
    if (blocked.has(m.id) && !iBlocked) throw new E(404, "membro"); // mi ha bloccato
    const cnt = (t: string, f: (q: any) => any) => f(db.from(t).select("member_id", { count: "exact", head: true }).eq("member_id", m.id)).then((r: any) => r.count || 0);
    const [nRev, nPost, nOwn, nWish, { data: rt }, { data: offers }] = await Promise.all([
      cnt("reviews", (q) => q.eq("hidden", false)), cnt("posts", (q) => q.eq("hidden", false)), cnt("shares", (q) => q.eq("kind", "own")), cnt("shares", (q) => q.eq("kind", "wish")),
      db.from("ratings").select("id,stars,body,created_at,rater_id,members!ratings_rater_id_fkey(nick,banned)").eq("rated_id", m.id).eq("hidden", false).order("created_at", { ascending: false }).limit(100),
      db.from("shares").select("work_key,kind,tipo,titolo,autore,anno,formato,cover_url,offer,price,note,updated_at").eq("member_id", m.id).eq("kind", "own").neq("offer", "").order("updated_at", { ascending: false }).limit(30),
    ]);
    const rs = (rt || []).filter((r: any) => r.members && !r.members.banned && !blocked.has(r.rater_id));
    const avg = rs.length ? Math.round(rs.reduce((s: number, r: any) => s + r.stars, 0) / rs.length * 10) / 10 : null;
    return { profile: { id: m.id, nick: m.nick, city: m.city, bio: m.bio, since: m.created_at, mine: m.id === me.id, blocked: !!iBlocked,
      counts: { reviews: nRev, posts: nPost, own: nOwn, wish: nWish }, rating: { avg, n: rs.length },
      ratings: rs.slice(0, 20).map((r: any) => ({ id: r.id, nick: r.members.nick, stars: r.stars, body: r.body, at: r.created_at, mine: r.rater_id === me.id })),
      offers: (offers || []).map((x: any) => ({ member: m.id, nick: m.nick, city: m.city, work: x.work_key, kind: x.kind, tipo: x.tipo, titolo: x.titolo, autore: x.autore, anno: x.anno, formato: x.formato, cover: x.cover_url, offer: x.offer, price: x.price, note: x.note, at: x.updated_at })) } };
  }
  if (a === "rate") {
    await writeBudget(me.id);
    const th = await myThread(clean(body.thread, 40), me.id);
    const other = th.a === me.id ? th.b : th.a;
    // si valuta solo dopo un vero scambio di messaggi: entrambi hanno scritto
    const [{ count: c1 }, { count: c2 }] = await Promise.all([
      db.from("messages").select("id", { count: "exact", head: true }).eq("thread_id", th.id).eq("member_id", me.id),
      db.from("messages").select("id", { count: "exact", head: true }).eq("thread_id", th.id).eq("member_id", other),
    ]);
    if (!c1 || !c2) throw new E(400, "scambio");
    if (!(+body.stars >= 1)) throw new E(400, "voto");
    const stars = Math.max(1, Math.min(5, Math.round(+body.stars)));
    const { error } = await db.from("ratings").upsert({ thread_id: th.id, rater_id: me.id, rated_id: other, stars, body: clean(body.body, 500), updated_at: new Date().toISOString() }, { onConflict: "thread_id,rater_id" });
    if (error) throw new E(500, "errore");
    return { ok: true };
  }

  // ── Segnalazioni ricevute (solo amministratore) ──
  if (a === "feedbackList" && admin) {
    const [{ data: fb }, { data: er }] = await Promise.all([
      db.from("feedback").select("id,created_at,kind,message,contact,member_id,version,lang,diag,status").order("created_at", { ascending: false }).limit(100),
      db.from("client_errors").select("hash,message,source,stack,version,ua,view,count,first_seen,last_seen,done").eq("done", false).order("last_seen", { ascending: false }).limit(50),
    ]);
    const ids = [...new Set((fb || []).map((x: any) => x.member_id).filter(Boolean))];
    const { data: ms } = ids.length ? await db.from("members").select("id,nick").in("id", ids) : { data: [] };
    const nick = new Map((ms || []).map((m: any) => [m.id, m.nick]));
    return { feedback: (fb || []).map((x: any) => ({ ...x, nick: nick.get(x.member_id) || "" })), errors: er || [] };
  }
  if (a === "feedbackStatus" && admin) {
    if (body.error) { await db.from("client_errors").update({ done: true }).eq("hash", clean(body.error, 40)); return { ok: true }; }
    const status = ["nuovo", "visto", "fatto"].includes(body.status) ? body.status : "visto";
    await db.from("feedback").update({ status }).eq("id", clean(body.id, 40));
    return { ok: true };
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
