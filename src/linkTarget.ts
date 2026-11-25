// Where a link to this app goes, for the chip the chat draws in its place (GET /api/books/:id/link). Pure: the route's
// services hand it the reads (D1 for the room and people, the room's Book for its message and thread), so the rules
// are tested without a Worker. Only a member gets an answer with names in it; every other case is the same `private`.
import { CALL_THREAD } from "../shared/call";
import type { LinkQuery, LinkResolution } from "../shared/schemas";

export type LinkPeek = {
  /** null = no such message. */
  message: {
    thread: string;
    author: string;
    kind: string | null;
    tag: string | null;
    forWho: string | null;
    /** A "⏸ Seu Claude…" / "❓ Seu Claude…" ask: only its owner sees it (web/features/chat/privacy.ts). */
    ask: boolean;
    /** The title of the message's thread when it is a thread (an epic) of the room. */
    threadTitle: string | null;
  } | null;
  /** null = no such thread (an epic) in the room. */
  thread: { title: string; owner: string | null } | null;
};
export type LinkPorts = {
  isMember(): Promise<boolean>;
  /** The room's row; dm = the pair (src/dm.ts) for a DM. */
  book(): Promise<{ title: string; dm: string | null; icon: number | null } | null>;
  peek(q: { message?: number; thread?: string }): Promise<LinkPeek>;
  /** Name and picture version of each email that has a user row. */
  people(emails: string[]): Promise<Record<string, { name: string | null; avatar: number | null }>>;
};

const PRIVATE = { kind: "private" } as const satisfies LinkResolution;
const fallbackName = (email: string) => (email === "ai" ? "vibe" : email.split("@")[0] || email);

/** A message only the viewer may not see: a fire (a personal instruction), one saved for someone else, someone
 *  else's Claude asking its owner. The chat hides these (web/features/chat/privacy.ts); the chip does too. */
function hiddenFrom(viewer: string, m: NonNullable<LinkPeek["message"]>) {
  if (m.tag === "fire") return true;
  if (m.forWho && m.forWho !== viewer) return true;
  return m.kind === "agent" && m.author !== viewer && m.ask;
}

export async function resolveLink(ports: LinkPorts, room: string, viewer: string, q: LinkQuery): Promise<LinkResolution> {
  const me = viewer.toLowerCase();
  if (!(await ports.isMember())) return PRIVATE;
  const book = await ports.book();
  if (!book) return PRIVATE;
  const other = book.dm ? (book.dm.split("\n").find((e) => e !== me) ?? me) : null;
  const thread = q.t && q.t !== "main" ? q.t : undefined;
  // The call chat is the room's, not an epic: a DM's call uses main, so a DM has no "call" thread.
  if (thread === CALL_THREAD && book.dm) return PRIVATE;
  const peek = q.m !== undefined || (thread && thread !== CALL_THREAD) ? await ports.peek({ message: q.m, thread: thread === CALL_THREAD ? undefined : thread }) : { message: null, thread: null };
  const emails = [...new Set([other, peek.message?.author, peek.thread?.owner].filter((e): e is string => !!e && e !== "ai"))];
  const people = emails.length ? await ports.people(emails) : {};
  const name = (email: string) => people[email]?.name || fallbackName(email);
  const avatar = (email: string) => people[email]?.avatar ?? null;
  // A DM's title is the other person (dmTitle in src/dm.ts); your own DM is "Você", which the client names.
  const roomTitle = other ? (other === me ? "" : (people[other]?.name || other)) : book.title;
  if (q.m !== undefined) {
    const m = peek.message;
    if (!m || hiddenFrom(me, m)) return PRIVATE;
    // A link that names a thread must name the message's own thread.
    if (thread && thread !== m.thread) return PRIVATE;
    if (m.thread === CALL_THREAD && book.dm) return PRIVATE;
    return { kind: "message", room, id: q.m, thread: m.thread, author: m.author, name: name(m.author), avatar: avatar(m.author), threadTitle: m.threadTitle, roomTitle };
  }
  if (thread === CALL_THREAD) return { kind: "thread", room, thread, title: "", owner: null, ownerName: null };
  if (thread) {
    const t = peek.thread;
    if (!t) return PRIVATE;
    return { kind: "thread", room, thread, title: t.title, owner: t.owner, ownerName: t.owner ? name(t.owner) : null };
  }
  if (other) return { kind: "dm", room, email: other, name: other === me ? "" : name(other), avatar: avatar(other) };
  return { kind: "room", room, title: book.title, icon: book.icon };
}
