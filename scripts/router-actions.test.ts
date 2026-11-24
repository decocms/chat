// Router actions (src/routerActions.ts, Gimenes #4369, #4379): the server acts on a person's message by itself.
import { expect, test } from "bun:test";
import {
  MARK_DONE_MAX,
  runRouterActions,
  type ActionMessage,
  type ActionRoom,
} from "../src/routerActions";
import type { Question } from "../src/jev";
import { compareBench } from "./router-bench-compare";

function room(over: Partial<ActionRoom> = {}) {
  const did: string[] = [];
  const r: ActionRoom = {
    isDm: false,
    openThread: (thread) => thread === "t1",
    listening: async () => true,
    hasThreadFrom: () => false,
    markDone: (thread, via) => void did.push(`done ${thread} ${via}`),
    makeAnswerThread: async (m) => void did.push(`answer ${m.id}`),
    ...over,
  };
  return { r, did };
}
const msg = (thread: string, text: string): ActionMessage => ({
  id: 7,
  thread,
  author: "a@x.test",
  text,
});
/** A fake Jev: records the questions it got and answers with fixed probabilities. */
function jev(p: Record<string, number> | null) {
  const calls: string[][] = [];
  const decide = async (
    _state: Record<string, string>,
    questions: Record<string, Question>,
  ) => {
    calls.push(Object.keys(questions));
    return p
      ? {
          answers: Object.fromEntries(
            Object.keys(questions).map((k) => [k, { noul: p[k] ?? 0 }]),
          ),
          cost: 0.00002,
        }
      : null;
  };
  return { decide, calls };
}

test("the exact phrase closes the thread with no model call, before any await", () => {
  const { r, did } = room();
  const j = jev({});
  void runRouterActions(msg("t1", "Mark as done."), r, j.decide, {
    topic: "T",
  });
  // Not awaited: the exact path already ran.
  expect(did).toEqual(["done t1 exact"]);
  expect(j.calls).toEqual([]);
});

test("free words in a thread: one Jev question; at 0.8 or more it closes the thread", async () => {
  const a = room(),
    yes = jev({ mark_done: 0.93 });
  expect(
    await runRouterActions(msg("t1", "pode fechar"), a.r, yes.decide, {
      topic: "T",
    }),
  ).toMatchObject({ action: "mark_done", via: "jev" });
  expect(yes.calls).toEqual([["mark_done"]]);
  expect(a.did).toEqual(["done t1 jev"]);
  const b = room(),
    no = jev({ mark_done: 0.6 });
  expect(
    (
      await runRouterActions(msg("t1", "está feito?"), b.r, no.decide, {
        topic: "T",
      })
    ).action,
  ).toBeNull();
  expect(b.did).toEqual([]);
});

test("mark_done asks only about short messages in an open thread", async () => {
  const { r } = room();
  const j = jev({ mark_done: 0.99 });
  await runRouterActions(
    msg("t1", "x".repeat(MARK_DONE_MAX + 1)),
    r,
    j.decide,
    { topic: "T" },
  );
  await runRouterActions(msg("closed", "pode fechar"), r, j.decide, {
    topic: "T",
  });
  await runRouterActions(msg("main", "pode fechar"), r, j.decide, {
    topic: "T",
  });
  expect(j.calls).toEqual([]);
});

test("answer_thread: a question in main, only when the author's Claude listens and no thread came from it", async () => {
  const q = msg("main", "quantas pessoas entraram essa semana?");
  const a = room(),
    j = jev({ answer_thread: 0.9 });
  expect(
    (await runRouterActions(q, a.r, j.decide, { topic: "main" })).action,
  ).toBe("answer_thread");
  expect(a.did).toEqual(["answer 7"]);
  const b = room({ listening: async () => false }),
    k = jev({ answer_thread: 0.9 });
  await runRouterActions(q, b.r, k.decide, { topic: "main" });
  expect(k.calls).toEqual([]);
  const c = room({ isDm: true }),
    l = jev({ answer_thread: 0.9 });
  await runRouterActions(q, c.r, l.decide, { topic: "main" });
  expect(l.calls).toEqual([]);
});

test("Jev down: no action", async () => {
  const { r, did } = room();
  expect(
    (
      await runRouterActions(msg("t1", "pode fechar"), r, jev(null).decide, {
        topic: "T",
      })
    ).action,
  ).toBeNull();
  expect(did).toEqual([]);
});

test("the bench check fails when a score goes down or false yes goes up, and shows new parts", () => {
  const base = { wake: { right: 18, n: 20 } };
  const same = compareBench(base, {
    wake: { right: 18, n: 20 },
    actions: { mark_done: { right: 20, n: 24, falseYes: 1 } },
  });
  expect(same.worse).toBe(false);
  expect(same.markdown).toContain(
    "| mark_done | — | 20/24 (83%) · falso sim 1 | novo |",
  );
  expect(compareBench(base, { wake: { right: 17, n: 20 } }).worse).toBe(true);
  const a = { actions: { mark_done: { right: 20, n: 24, falseYes: 0 } } };
  expect(
    compareBench(a, {
      actions: { mark_done: { right: 21, n: 24, falseYes: 1 } },
    }).worse,
  ).toBe(true);
  expect(compareBench(a, { actions: {} }).worse).toBe(true);
});
