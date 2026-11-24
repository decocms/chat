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
// Readings (ROUTER_READINGS, stage 2) ride in the same Jev call: questions whose answers the room keeps, not one
// action to pick. "waits" reads who the message asks something of ("esperando você"); it was a second Jev call 30 s
// later (Book.findWaits), which now reads only agents' messages and what this pass could not do.
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
  /** For the waits reading: the other people in the room and the talk before the message. Absent or null = no reading. */
  people?(m: ActionMessage): Promise<RoomPeople | null>;
  /** The people the message waits on: the room stores the waits and tells them. */
  saveWaits?(m: ActionMessage, emails: string[]): Promise<void>;
};

export type RoomPeople = {
  /** Everyone except the author, with the name Jev reads (a first name, or full name and @handle if two match). */
  others: { email: string; name: string }[];
  /** People in the room, for the state ("Ana (@ana), Bruno"). */
  roster: string;
  /** The last messages of the thread before this one, one per line. */
  before: string;
  author: string;
  /** The people the author @mentioned: they and only they wait on it. */
  tagged: string[];
};

/** What a reading asks for one message: the state it adds, its questions, and what it does with the answers. */
export type ReadingAsk = {
  state: Record<string, string>;
  questions: Record<string, string>;
  use(answers: Record<string, number>): Promise<string[]>;
};

/** A reading: questions that join the actions' Jev call, whose answers the room keeps. */
export type RouterReading = {
  name: string;
  /** Null when it does not apply to this message. Question keys get the reading's name as a prefix. */
  ask(m: ActionMessage, room: ActionRoom): Promise<ReadingAsk | null>;
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

/** The floor of every action's threshold (Gimenes #4435): never lower it. A miss goes to a better question, not to a
 *  lower threshold. scripts/router-actions.test.ts fails on an action below it. */
export const ACTION_THRESHOLD_MIN = 0.8;

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
    threshold: ACTION_THRESHOLD_MIN,
    run: (m, room) => room.makeAnswerThread(m),
  },
  {
    // A person closes a thread in their own words (Gimenes #4249, #4369): "Mark as done" exactly, or "pode fechar".
    name: "mark_done",
    when: (m, room) => m.thread !== "main" && room.openThread(m.thread),
    exact: isMarkDone,
    question:
      'The author wrote this in a thread (a topic with its own tasks). Is the author saying that the thread\'s work is finished and the thread can be closed or marked done (for example "pode fechar", "feito, valeu", "done", "pode marcar como concluída")? Answer no for a question ("está feito?"), for one step done while more remains, for a request to do something, and for "done" about something else.',
    threshold: ACTION_THRESHOLD_MIN,
    run: (m, room, via) => room.markDone(m.thread, via),
  },
];

/** The waits question, the same for a person's message (here) and an agent's (Book.findWaits). `own` is the note an
 *  agent's message adds: its "você" is its own human. */
export function waitQuestion(name: string, own = ""): string {
  return `Esta mensagem pede algo a ${name}: uma resposta, decisão, aprovação, revisão ou ação que fica esperando por ${name}? Responda não se só informa, agradece, ou fala com todo mundo sem esperar nada de ${name} em especial. Nesta sala cada pessoa conversa com o próprio Claude: um pedido ou pergunta que não nomeia ninguém é pro Claude de quem escreveu, não pra ${name}; responda sim só se ela nomeia ${name} ou fala claramente com ${name}.${own}`;
}
/** A wait is at this probability or more. */
export const WAIT_THRESHOLD = 0.7;
/** Jev reads at most this many people per message. */
export const WAIT_PEOPLE_MAX = 12;

export const ROUTER_READINGS: readonly RouterReading[] = [
  {
    // Who waits on this message (Valls, 18/11: a bare ask is for the author's own Claude, not for everyone).
    name: "waits",
    async ask(m, room) {
      if (!m.text.trim() || !room.people || !room.saveWaits) return null;
      const p = await room.people(m);
      if (!p || !p.others.length) return null;
      const others = p.others.slice(0, WAIT_PEOPLE_MAX);
      const questions: Record<string, string> = {};
      others.forEach((o, i) => (questions[`p${i}`] = waitQuestion(o.name)));
      return {
        state: {
          people_in_room: p.roster,
          conversation_before: p.before || "(início)",
          author: p.author,
        },
        questions,
        // A person who @mentions someone says who it is for: only the people tagged wait on it.
        async use(answers) {
          const asked = p.tagged.length
            ? p.others
                .filter((o) => p.tagged.includes(o.email))
                .map((o) => o.email)
            : others
                .filter((_, i) => (answers[`p${i}`] ?? 0) >= WAIT_THRESHOLD)
                .map((o) => o.email);
          await room.saveWaits!(m, asked);
          return asked;
        },
      };
    },
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
  readings: readonly RouterReading[] = ROUTER_READINGS,
): Promise<{
  action: string | null;
  via: "exact" | "jev" | null;
  p: number;
  cost: number;
  asked: string[];
  /** Each reading that ran, with what it found (waits: the emails that wait on the message). */
  read: Record<string, string[]>;
}> {
  const open = actions.filter((action) => action.when(m, room));
  const exact = open.find((action) => action.exact?.(m.text));
  if (exact) {
    await exact.run(m, room, "exact");
    return {
      action: exact.name,
      via: "exact",
      p: 1,
      cost: 0,
      asked: [],
      read: {},
    };
  }
  const asked: RouterAction[] = [];
  for (const action of open)
    if (
      action.question &&
      (action.name !== "mark_done" || m.text.trim().length <= MARK_DONE_MAX) &&
      (!action.ready || (await action.ready(m, room)))
    )
      asked.push(action);
  const state: Record<string, string> = {
    thread: context.topic,
    message: m.text.slice(0, 1500),
  };
  const reads: (ReadingAsk & { name: string })[] = [];
  for (const reading of readings) {
    const ask = await reading.ask(m, room).catch(() => null);
    if (!ask) continue;
    Object.assign(state, ask.state);
    reads.push({ ...ask, name: reading.name });
  }
  if (!asked.length && !reads.length)
    return { action: null, via: null, p: 0, cost: 0, asked: [], read: {} };
  const questions: Record<string, Question> = {};
  for (const action of asked)
    questions[action.name] = { type: "noul", instructions: action.question! };
  for (const reading of reads)
    for (const [k, q] of Object.entries(reading.questions))
      questions[`${reading.name}_${k}`] = { type: "noul", instructions: q };
  const r = await decide(state, questions).catch(() => null);
  if (!r)
    return {
      action: null,
      via: null,
      p: 0,
      cost: 0,
      asked: asked.map((a) => a.name),
      read: {},
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
  const read: Record<string, string[]> = {};
  for (const reading of reads) {
    const answers: Record<string, number> = {};
    for (const k of Object.keys(reading.questions))
      answers[k] = r.answers[`${reading.name}_${k}`]?.noul ?? 0;
    read[reading.name] = await reading.use(answers);
  }
  return {
    action: best?.name ?? null,
    via: best ? "jev" : null,
    p,
    cost: r.cost,
    asked: asked.map((a) => a.name),
    read,
  };
}
