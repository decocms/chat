// The open threads you own, as waits (D1 `waits`, ref e<epicId>; src/book.ts syncThreadWaits). Browser-safe.
// The row's text is this machine line, never shown raw: status|done/total. Its author is "" while the thread is
// quiet, "ai" once @vibe called its owner because it stood still for STALE_THREAD_MS (Gimenes #5242, PO #5257).

/** How long an open thread can sit without a person's or an agent's message before @vibe calls its owner. */
export const STALE_THREAD_MS = 3 * 864e5;

export type ThreadWaitStatus = "todo" | "doing" | "review";

export type ThreadWait = {
  status: ThreadWaitStatus;
  done: number;
  total: number;
  /** All its tasks are done: it only waits for its owner to mark it done ("Pronta pra fechar"). */
  ready: boolean;
  /** @vibe called its owner: it stood still for 3 days. */
  stale: boolean;
};

export const threadWaitText = (
  status: ThreadWaitStatus,
  done: number,
  total: number,
) => `${status}|${done}/${total}`;

/** A thread wait's ref: e<epicId>. */
export const isThreadWait = (wait: { ref: string }) => wait.ref.startsWith("e");

export function threadWait(wait: {
  ref: string;
  text: string;
  author: string;
}): ThreadWait | null {
  if (!isThreadWait(wait)) return null;
  const m = /^(todo|doing|review)\|(\d+)\/(\d+)$/.exec(wait.text);
  if (!m) return null;
  const status = m[1] as ThreadWaitStatus;
  return {
    status,
    done: Number(m[2]),
    total: Number(m[3]),
    ready: status === "review",
    stale: wait.author === "ai",
  };
}

/** A thread wait that is for you now (the Inbox's "Tudo", the home, the digest): ready to close, or @vibe called you.
 *  Every other open thread of yours is only in the Inbox's "Suas threads". */
export const urgentThreadWait = (wait: {
  ref: string;
  text: string;
  author: string;
}) => {
  const t = threadWait(wait);
  return !!t && (t.ready || t.stale);
};

/** The thread wait as one line, in the app's language. */
export function threadWaitLine(t: ThreadWait, en: boolean) {
  const what = t.stale
    ? en
      ? "Stalled for 3 days"
      : "Parada há 3 dias"
    : t.ready
      ? en
        ? "Ready to close"
        : "Pronta pra fechar"
      : t.status === "doing"
        ? en
          ? "In progress"
          : "Em andamento"
        : en
          ? "To do"
          : "A fazer";
  return t.total
    ? `${what} · ${en ? `${t.done}/${t.total} tasks` : `${t.done}/${t.total} tarefas`}`
    : what;
}
