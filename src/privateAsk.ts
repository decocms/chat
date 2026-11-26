// A Claude's hook question (⏸ permission, ❓ AskUserQuestion; claude-plugin/hooks) is its human's alone: the room
// stores it as a message, with the human's answer ("Aprovar") as a reply, so the hook reads the answer back
// (Book.answerTo). Both rows carry messages.private_to = that human, and every read that leaves the Book for a
// viewer keeps them to that person: the room's state, pages, live pushes, read_room, search. Nobody else's unread
// number, listener or mail moves for them (PO, Nov 2026: paths and commands of one person's terminal were in
// everyone's timeline). The client hides them too (web/features/chat/privacy.ts) for rooms cached before this.

/** What the plugin's hooks post when a Claude stops at a question (permission.sh, question.sh). */
export const ASK_OPENER = /^(⏸ Seu Claude (pede permissão|quer seguir)|❓ Seu Claude pergunta)/;

/** The SQL twin of isAsk, for rows of `messages` (alias-free column names). */
const ASK_SQL = (t: string) =>
  `${t}.kind = 'agent' AND ${t}.choices IS NOT NULL AND (${t}.text LIKE '⏸ Seu Claude pede permissão%' OR ${t}.text LIKE '⏸ Seu Claude quer seguir%' OR ${t}.text LIKE '❓ Seu Claude pergunta%')`;

type AskRow = { kind: string | null; author: string; text: string | null; choices: string | object | null | undefined };

export const isAsk = (m: AskRow) => m.kind === "agent" && !!m.choices && ASK_OPENER.test(m.text ?? "");

/** Whose this new message is alone, or null for the room: a hook's question is its author's, and so is that
 *  author's own answer to it. */
export function privateOwner(m: AskRow, parent?: AskRow | null): string | null {
  if (isAsk(m)) return m.author;
  if (parent && !m.kind && parent.author === m.author && isAsk(parent)) return m.author;
  return null;
}

/** `WHERE` piece: the rows this viewer may read (bind the viewer's email once). An empty viewer reads none of them. */
export const VISIBLE_SQL = (t = "messages") => `(${t}.private_to IS NULL OR ${t}.private_to = ?)`;
/** `WHERE` piece: the room's own rows, for reads that are nobody's in particular (the router, @vibe's context). */
export const PUBLIC_SQL = (t = "messages") => `${t}.private_to IS NULL`;

/** Marks the asks and their owners' answers stored before private_to existed (run once per room). */
export const BACKFILL_SQL = [
  `UPDATE messages SET private_to = author WHERE private_to IS NULL AND ${ASK_SQL("messages")}`,
  `UPDATE messages SET private_to = author WHERE private_to IS NULL AND kind IS NULL AND reply_to IN (SELECT q.id FROM messages q WHERE ${ASK_SQL("q")} AND q.author = messages.author)`,
];

/** The sockets a message goes to: everyone's for the room's own, only its owner's for a private one. */
export const recipients = <S>(sockets: readonly S[], emailOf: (s: S) => string, privateTo: string | null) =>
  privateTo ? sockets.filter((s) => emailOf(s) === privateTo) : [...sockets];
