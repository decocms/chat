import "server-only";
import { emailHtml, escapeHtml, inviteLink } from "./auth";
import { mailFrom } from "./host";
import type { Env } from "./index";
import type { Lang } from "./lang";

/** The one invite email: a room invite (`room`), or "someone wrote to you" for a person not on deco.chat yet.
 *  Rate-limited per inviter (one budget for both); skipped in dev (`DEV_EMAIL`). No replyTo: a reply would quote
 *  the sign-in link back to the inviter. Returns whether it went out. */
export async function sendInviteEmail(
  env: Env,
  ctx: { waitUntil(p: Promise<unknown>): void },
  o: { origin: string; inviter: string; who: string; lang?: Lang; room?: { id: string; joined?: boolean } },
) {
  if (env.DEV_EMAIL || !(await env.LOGIN_LIMIT.limit({ key: `invite:${o.inviter}` })).success) return false;
  const { origin, inviter, who, room } = o;
  const [book, known] = await Promise.all([
    room ? env.DB.prepare(`SELECT title FROM books WHERE id = ?`).bind(room.id).first<{ title: string }>() : null,
    env.DB.prepare(`SELECT lang FROM users WHERE email = ?`).bind(who).first<{ lang: string | null }>(),
  ]);
  // The invitee's own language when they've used deco.chat, else the inviter's (likely the same team).
  const en = (known?.lang ?? o.lang ?? "pt") === "en";
  const name = inviter.split("@")[0];
  const mail = room ? roomMail(en, origin, inviter, name, book?.title ?? (en ? "a room" : "uma sala"), await inviteLink(env, origin, who, room.id), room) : chatMail(en, origin, inviter, name);
  ctx.waitUntil(
    env.EMAIL.send({ to: who, from: { email: mailFrom(env, "convite"), name: "deco.chat" }, ...mail }).catch((e) =>
      console.error("invite email failed", { who, error: String(e) }),
    ),
  );
  return true;
}

function roomMail(en: boolean, origin: string, inviter: string, name: string, title: string, url: string, room: { id: string; joined?: boolean }) {
  const connect = `${origin}/llms.txt`; // the setup guide for every client
  const setup = `Read ${origin}/llms.txt and set up deco.chat for this project. Room: ${origin}/b/${room.id}`;
  return {
    subject: en ? `${name} invited you to the room "${title}"` : `${name} te chamou pra sala "${title}"`,
    text: en
      ? `${inviter} invited you to the room "${title}".\n\nOpen it: ${url}\n\nBring your Claude: paste this in Claude Code, inside the project folder:\n${setup}\nOther clients: ${connect}`
      : `${inviter} te convidou para a sala "${title}".\n\nEntra aqui: ${url}\n\nTraga seu Claude: cole isto no Claude Code, dentro da pasta do projeto:\n${setup}\nOutros clientes: ${connect}`,
    html: emailHtml(
      en ? `${escapeHtml(name)} invited you to deco.chat` : `${escapeHtml(name)} te chamou pro deco.chat`,
      `<p style="font-size:18px;font-weight:700">${escapeHtml(title)}</p><p>${
        en
          ? `${escapeHtml(inviter)} wants to run this project with you on deco.chat: a room with chat, a doc and tasks, where your Claude and ${escapeHtml(name)}'s talk too.`
          : `${escapeHtml(inviter)} quer tocar esse projeto com você no deco.chat: uma sala com chat, documento e tarefas, onde o seu Claude e o de ${escapeHtml(name)} também conversam.`
      }</p><p style="margin:24px 0"><a href="${url}" style="background:#1d5fc4;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">${room.joined ? (en ? "Open the room" : "Abrir a sala") : en ? "See the invite" : "Ver o convite"}</a></p><p style="font-size:13px;color:#6b7383">${
        en ? "The button signs you in and works for 24h. After that, just sign in with your email." : "O botão já te deixa logado e vale por 24h. Depois disso é só entrar com seu email."
      }</p>
<div style="margin-top:28px;padding:18px 20px;background:#f3f6fb;border-radius:14px"><p style="margin:0 0 8px;font-weight:700">✦ ${en ? "Bring your Claude" : "Traga seu Claude"}</p><p style="margin:0 0 8px">${
        en ? "Paste this in <b>Claude Code</b>, inside the project folder:" : "Cole isto no <b>Claude Code</b>, dentro da pasta do projeto:"
      }</p><p style="margin:0;font-family:ui-monospace,Menlo,monospace;font-size:13px;background:#fff;border:1px solid #dde4ee;border-radius:8px;padding:10px 12px">${escapeHtml(setup)}</p><p style="margin:10px 0 0;font-size:14px">${en ? "Claude.ai or another client?" : "Claude.ai ou outro cliente?"} <a href="${connect}" style="color:#1d5fc4;font-weight:700">${en ? "Step by step" : "Passo a passo"}</a></p></div>`,
      origin,
    ),
  };
}

/** "Someone wrote to you": the message itself stays in deco.chat (a stranger's text never goes out in our email). */
function chatMail(en: boolean, origin: string, inviter: string, name: string) {
  const url = `${origin}/login`;
  return {
    subject: en ? `${name} wants to talk with you on deco.chat` : `${name} quer conversar com você no deco.chat`,
    text: en
      ? `${inviter} sent you a message on deco.chat.\n\nSign in with this email to read it and answer: ${url}`
      : `${inviter} te mandou uma mensagem no deco.chat.\n\nEntre com este email para ler e responder: ${url}`,
    html: emailHtml(
      en ? `${escapeHtml(name)} wants to talk with you` : `${escapeHtml(name)} quer conversar com você`,
      `<p>${
        en
          ? `${escapeHtml(inviter)} sent you a message on deco.chat, where people and their Claudes work together in rooms.`
          : `${escapeHtml(inviter)} te mandou uma mensagem no deco.chat, onde pessoas e seus Claudes trabalham juntos em salas.`
      }</p><p style="margin:24px 0"><a href="${url}" style="background:#1d5fc4;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:700">${en ? "Read the message" : "Ler a mensagem"}</a></p><p style="font-size:13px;color:#6b7383">${
        en ? "Sign in with this email. The message waits under Requests until you accept or decline it." : "Entre com este email. A mensagem espera em Pedidos até você aceitar ou recusar."
      }</p>`,
      origin,
    ),
  };
}
