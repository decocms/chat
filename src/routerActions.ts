// HARD RULE (AGENTS.md, rule 14): a change here needs `bun scripts/router-bench.ts` before the pull request, with the
// scores before and after in the pull request. A score must not go down. New behavior gets new bench cases.
// Router actions (Gimenes #4369, #4379): things the server does by itself for a person's message, without waking
// anyone's Claude ("system 1"; the Claude is "system 2"). Each action is one entry here with the same shape:
//   when      cheap, synchronous checks: may this action apply to this message at all? (no model)
//   ready     optional async checks (D1) before the action costs a Jev question
//   exact     the free path: a fixed phrase that acts with no model
//   question  else, one Jev question; every action that passes `when` goes into ONE Jev call per message
//   threshold the probability that acts
//   run       what the server does
// To add an action: one entry in ROUTER_ACTIONS, a case in scripts/router-actions.test.ts, and the cases it must
// and must not catch in the bench. Jev down = no action (the message goes on as a plain message).
import { isMarkDone } from "../shared/epicStatus";
import type { Question } from "./jev";

/** A person's new message, as the actions see it. */
export type ActionMessage = {
  id: number;
  thread: string;
  author: string;
  text: string;
};

/** What an action may use from the room: the Book implements it. */
export type ActionRoom = {
  isDm: boolean;
  /** The thread exists, is not archived, and is not the room's main thread. */
  openThread(thread: string): boolean;
  /** The author's Claude listens to this room now (answer threads are only for someone whose Claude can answer). */
  listening(email: string): Promise<boolean>;
  /** A thread was already made from this message. */
  hasThreadFrom(msgId: number): boolean;
  markDone(thread: string, via: "exact" | "jev"): void;
  makeAnswerThread(m: ActionMessage): Promise<void>;
};

export type RouterAction = {
  name: string;
  when(m: ActionMessage, room: ActionRoom): boolean;
  ready?(m: ActionMessage, room: ActionRoom): Promise<boolean>;
  exact?(text: string): boolean;
  question?: string;
  threshold: number;
  run(
    m: ActionMessage,
    room: ActionRoom,
    via: "exact" | "jev",
  ): void | Promise<void>;
};

/** A message this long is not "pode fechar": mark_done asks Jev only about short messages (cost, and fewer false hits). */
export const MARK_DONE_MAX = 60;

export const ROUTER_ACTIONS: readonly RouterAction[] = [
  {
    // A question in main becomes its own thread with a doc for the answer (Gui #2767). It was answerIntent.
    name: "answer_thread",
    when: (m, room) =>
      m.thread === "main" &&
      !room.isDm &&
      m.text.length >= 12 &&
      !room.hasThreadFrom(m.id),
    ready: (m, room) => room.listening(m.author),
    question:
      "Is this message a question, or a request for an analysis, numbers, a summary, a report, a chart or a comparison: something to answer with information? Answer no for a request to build, change, fix, deploy or do something, for small talk, for an answer or OK to someone, and for a yes/no question to a person.",
    threshold: 0.7,
    run: (m, room) => room.makeAnswerThread(m),
  },
  {
    // A person closes a thread in their own words (Gimenes #4249, #4369): "Mark as done" exactly, or "pode fechar".
    name: "mark_done",
    when: (m, room) => m.thread !== "main" && room.openThread(m.thread),
    exact: isMarkDone,
    question:
      'The author wrote this in a thread (a topic with its own tasks). Is the author saying that the thread\'s work is finished and the thread can be closed or marked done (for example "pode fechar", "feito, valeu", "done", "pode marcar como concluída")? Answer no for a question ("está feito?"), for one step done while more remains, for a request to do something, and for "done" about something else.',
    threshold: 0.8,
    run: (m, room, via) => room.markDone(m.thread, via),
  },
];

/** One Jev call for every action that applies; the result says which action ran (or none) and what it cost.
 *  The exact path runs before the first await, so a caller that does not await still sees it done at once. */
export async function runRouterActions(
  m: ActionMessage,
  room: ActionRoom,
  decide: (
    state: Record<string, string>,
    questions: Record<string, Question>,
  ) => Promise<{
    answers: Record<string, { noul?: number | null }>;
    cost: number;
  } | null>,
  context: { topic: string },
  actions: readonly RouterAction[] = ROUTER_ACTIONS,
): Promise<{
  action: string | null;
  via: "exact" | "jev" | null;
  p: number;
  cost: number;
  asked: string[];
}> {
  const open = actions.filter((action) => action.when(m, room));
  const exact = open.find((action) => action.exact?.(m.text));
  if (exact) {
    await exact.run(m, room, "exact");
    return { action: exact.name, via: "exact", p: 1, cost: 0, asked: [] };
  }
  const asked: RouterAction[] = [];
  for (const action of open)
    if (
      action.question &&
      (action.name !== "mark_done" || m.text.trim().length <= MARK_DONE_MAX) &&
      (!action.ready || (await action.ready(m, room)))
    )
      asked.push(action);
  if (!asked.length)
    return { action: null, via: null, p: 0, cost: 0, asked: [] };
  const questions: Record<string, Question> = {};
  for (const action of asked)
    questions[action.name] = { type: "noul", instructions: action.question! };
  const r = await decide(
    { thread: context.topic, message: m.text.slice(0, 1500) },
    questions,
  ).catch(() => null);
  if (!r)
    return {
      action: null,
      via: null,
      p: 0,
      cost: 0,
      asked: asked.map((a) => a.name),
    };
  // p is the acting action's probability, else the highest one asked (the bench and the log show near misses).
  let best: RouterAction | null = null,
    p = 0,
    top = 0;
  for (const action of asked) {
    const q = r.answers[action.name]?.noul ?? 0;
    top = Math.max(top, q);
    if (q >= action.threshold && q > p) {
      best = action;
      p = q;
    }
  }
  if (!best) p = top;
  if (best) await best.run(m, room, "jev");
  return {
    action: best?.name ?? null,
    via: best ? "jev" : null,
    p,
    cost: r.cost,
    asked: asked.map((a) => a.name),
  };
}
