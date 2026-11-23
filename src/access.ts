// A room link opened by someone without access (/b/<id>): the room's name for link previews (WhatsApp, Slack,
// iMessage read og:*); the access page asks to join. The title is readable by anyone holding the link, on purpose.
import { escapeHtml } from "./auth";
import { isMember } from "./rooms";
import type { AccessContext } from "../shared/schemas";

export type AccessState = "out" | "ask" | "asked" | "invited" | "missing";

const DESC = "Sala no deco.chat: chat, doc e tarefas pras pessoas e os agents delas trabalharem juntos.";

/** <head> tags that make a shared room link render as a card: deco.chat's image + the room's name. */
export function roomMeta(origin: string, id: string, title: string | null) {
  const t = escapeHtml(title ? `${title} · deco.chat` : "deco.chat");
  const name = escapeHtml(title ?? "deco.chat");
  return `<title>${t}</title>
<meta name="description" content="${DESC}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="deco.chat" />
<meta property="og:title" content="${name}" />
<meta property="og:description" content="${DESC}" />
<meta property="og:url" content="${origin}/b/${id}" />
<meta property="og:image" content="${origin}/og.png?v=3" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${name}" />
<meta name="twitter:image" content="${origin}/og.png?v=3" />`;
}

/** Where someone stands with a room from its link: the /b/* page and the typed GET /auth/room/:id read the same. */
export async function roomAccess(db: D1Database, id: string, email: string | null): Promise<AccessContext> {
  const book = /^[a-z0-9]{6,40}$/.test(id) ? await db.prepare(`SELECT title, dm FROM books WHERE id = ?`).bind(id).first<{ title: string; dm: string | null }>() : null;
  // A DM is private to its two people: to anyone else it doesn't exist (no title, no "ask to join").
  if (!book || (book.dm && !(email && (await isMember(db, id, email))))) return { state: "missing", title: null, email };
  if (!email) return { state: "out", title: book.title, email: null };
  if (await isMember(db, id, email)) return { state: "member", title: book.title, email };
  // Invited and not answered: the page asks for the yes (an invite no longer makes you a member by itself).
  const inv = await db.prepare(`SELECT i.inviter, u.name FROM invites i LEFT JOIN users u ON u.email = i.inviter WHERE i.book_id = ? AND i.email = ? AND i.declined_at IS NULL`).bind(id, email).first<{ inviter: string; name: string | null }>();
  if (inv) return { state: "invited", title: book.title, email, inviter: inv.name || inv.inviter };
  const asked = await db.prepare(`SELECT 1 FROM access_requests WHERE book_id = ? AND email = ?`).bind(id, email).first();
  return { state: asked ? "asked" : "ask", title: book.title, email };
}
