// The morning and evening catch-up e-mail (Nov 2026): what didn't need the person right away goes here instead of a
// mention e-mail of its own. Sent at 8h and 18h São Paulo (cron), one e-mail per person across rooms: what is waiting
// on them (D1 waits) and the mentions held back (D1 digest_items). Nothing new since the last one: no e-mail.
// ponytail: one time zone for everyone (São Paulo, no DST); per-person zones when someone outside Brazil asks.
import { emailHtml, escapeHtml } from "./auth";
import { mailFrom, publicOrigin } from "./host";
import type { Env } from "./index";
import { unsubscribeUrl } from "./mentionmail";
import { waitsFor } from "./rooms";
import { threadWait, threadWaitLine } from "../shared/threadWait";
import { track } from "./track";
import { DIGEST_MENTIONS_SQL } from "./digestItems";

type Item = { book_id: string; room: string; msg_id: number; thread: string; author: string; text: string; ts: number };
type Wait = Awaited<ReturnType<typeof waitsFor>>[number];

const T = {
  pt: {
    subject: (n: number) => `deco.chat: ${n} ${n === 1 ? "coisa" : "coisas"} pra você`,
    title: (morning: boolean) => (morning ? "Seu resumo da manhã" : "Seu resumo do fim da tarde"),
    waits: "Esperando você",
    mentions: "Te mencionaram",
    open: "Abrir",
    why: "Você recebe isto de manhã e no fim da tarde, só quando tem novidade. Menções que pedem algo seu agora continuam chegando na hora.",
    off: "Parar de receber e-mails do deco.chat",
    main: "sala principal",
  },
  en: {
    subject: (n: number) => `deco.chat: ${n} ${n === 1 ? "thing" : "things"} for you`,
    title: (morning: boolean) => (morning ? "Your morning catch-up" : "Your evening catch-up"),
    waits: "Waiting on you",
    mentions: "You were mentioned",
    open: "Open",
    why: "You get this in the morning and late afternoon, only when there's something new. Mentions that need you now still arrive right away.",
    off: "Stop deco.chat e-mails",
    main: "main thread",
  },
};

export async function sendDigests(env: Env, now = Date.now(), only?: string) {
  const db = env.DB;
  const morning = new Date(now - 3 * 3600e3).getUTCHours() < 12;
  // Everyone with something held back or someone waiting on them, who wants e-mail.
  const people = (
    await db
      .prepare(
        `SELECT u.email, u.name, u.lang FROM users u WHERE coalesce(u.mention_mail, 1) != 0 AND (?1 IS NULL OR u.email = ?1)
           AND (u.email IN (SELECT email FROM digest_items) OR u.email IN (SELECT email FROM waits))`,
      )
      .bind(only ?? null)
      .all<{ email: string; name: string | null; lang: string | null }>()
  ).results;
  let sent = 0;
  for (const p of people) {
    const last = (await db.prepare(`SELECT max(ts) AS ts FROM events WHERE name = 'digest_mail' AND user = ?`).bind(p.email).first<{ ts: number | null }>())?.ts ?? 0;
    const items = (
      await db
        .prepare(DIGEST_MENTIONS_SQL)
        .bind(p.email)
        .all<Item>()
    ).results;
    const waits = await waitsFor(db, p.email);
    // Something new since the last catch-up (a held-back mention, or a wait that appeared since): else stay quiet.
    if (!items.length && !waits.some((w) => w.ts > last)) continue;
    const lang = p.lang === "en" ? "en" : "pt";
    await env.EMAIL.send(await digestMail(env, p.email, lang, morning, waits, items));
    await db.prepare(`DELETE FROM digest_items WHERE email = ? AND ts <= ?`).bind(p.email, items.at(-1)?.ts ?? 0).run();
    await track(env, "digest_mail", { user: p.email, dims: { waits: waits.length, mentions: items.length } });
    sent++;
  }
  return sent;
}

async function digestMail(env: Env, to: string, lang: "pt" | "en", morning: boolean, waits: Wait[], items: Item[]) {
  const t = T[lang];
  const origin = publicOrigin(env);
  const link = (book: string, thread: string, msg?: number) => `${origin}/b/${book}${thread && thread !== "main" ? `?t=${thread}` : ""}${msg ? `#m${msg}` : ""}`;
  const row = (where: string, text: string, url: string) =>
    `<li style="margin:0 0 10px"><span style="color:#676664;font-size:13px">${escapeHtml(where)}</span><br>${escapeHtml(text.slice(0, 240))} <a href="${url}" style="color:#216bf2">${t.open}</a></li>`;
  // A wait in the main thread is stored with the topic "sala principal" (src/book.ts): named in the reader's language.
  const topic = (w: Wait) => (w.thread === "main" && w.topic ? t.main : w.topic);
  // An open thread of yours (e<epic>) reads as its state ("Pronta pra fechar · 3/3 tarefas"), not its stored line.
  const said = (w: Wait) => { const tw = threadWait(w); return tw ? threadWaitLine(tw, lang === "en") : w.text; };
  const wl = waits.slice(0, 15).map((w) => row(`${w.room}${topic(w) ? ` › ${topic(w)}` : ""}`, said(w), link(w.book_id, w.thread, /^m\d/.test(w.ref) ? Number(w.ref.slice(1)) : undefined)));
  const il = items.map((i) => row(`${i.room} · ${i.author}`, i.text, link(i.book_id, i.thread, i.msg_id)));
  const unsub = await unsubscribeUrl(env.SESSION_SECRET, origin, to);
  const html = emailHtml(
    t.title(morning),
    `${wl.length ? `<p style="margin:0 0 8px;font-weight:700">${t.waits}</p><ul style="margin:0 0 18px;padding-left:20px;line-height:1.5">${wl.join("")}</ul>` : ""}
${il.length ? `<p style="margin:0 0 8px;font-weight:700">${t.mentions}</p><ul style="margin:0 0 18px;padding-left:20px;line-height:1.5">${il.join("")}</ul>` : ""}
<p style="font-size:12px;color:#676664;margin:20px 0 0;padding-top:16px;border-top:1px solid #edecea">${t.why} <a href="${unsub}" style="color:#676664">${t.off}</a></p>`,
    origin,
  );
  const text = [
    t.title(morning),
    waits.length ? `\n${t.waits}:\n${waits.slice(0, 15).map((w) => `- ${w.room}${topic(w) ? ` › ${topic(w)}` : ""}: ${said(w).slice(0, 240)}`).join("\n")}` : "",
    items.length ? `\n${t.mentions}:\n${items.map((i) => `- ${i.room} · ${i.author}: ${i.text.slice(0, 240)}`).join("\n")}` : "",
    `\n${t.off}: ${unsub}`,
  ].join("\n");
  return { to, from: { email: mailFrom(env, "mention"), name: "deco.chat" }, subject: t.subject(waits.length + items.length), text, html };
}
