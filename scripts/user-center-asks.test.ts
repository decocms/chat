// "Seu agent precisa de você" in the user center (web/features/user-center/asks.ts, count.ts; Gimenes #6617).
import { expect, test } from "bun:test";
import {
  agentAsks,
  askLine,
  askApprove,
  askOptions,
} from "../web/features/user-center/asks";
import { userCenterCount } from "../web/features/user-center/count";

const wait = (
  ref: string,
  ts: number,
  extra: Record<string, unknown> = {},
) => ({
  book_id: "r1",
  room: "Loja",
  ref,
  thread: "main",
  topic: "",
  author: "a@x.test",
  author_name: "Ana",
  text: "⏸ Seu Claude pede permissão: **Bash** · `ls`",
  ts,
  ...extra,
});

test("only your agents' questions, from every room, the oldest first", () => {
  const asks = agentAsks([
    wait("m3", 1),
    wait("a9", 30, { book_id: "r2" }),
    wait("a5", 20),
    wait("t1", 5),
    wait("b2", 2),
  ]);
  expect(asks.map((w) => w.ref)).toEqual(["a5", "a9"]);
});

test("the line drops the opener and the markdown; the options come from the choices JSON", () => {
  const w = wait("a1", 1, {
    about: JSON.stringify({ options: ["Aprovar", "Negar"], multi: false }),
  });
  expect(askLine(w)).toBe("pede permissão: Bash · ls");
  expect(askOptions(w)).toEqual(["Aprovar", "Negar"]);
  expect(askOptions(wait("a2", 1))).toEqual([]);
});

test("only a permission gets Aprovar; the account line goes from the question", () => {
  const permission = wait("a1", 1, {
    text: "⏸ Seu Claude pede permissão: **Bash**\n`ls`\n\nSó vale a resposta da sua conta logada aqui.",
    about: JSON.stringify({ options: ["Aprovar", "Negar"], multi: false }),
  });
  expect(askApprove(permission)).toBe("Aprovar");
  expect(askLine(permission)).toBe("pede permissão: Bash ls");
  const question = wait("a2", 1, {
    about: JSON.stringify({ options: ["BLACK15", "LOJA15"], multi: false }),
  });
  expect(askApprove(question)).toBeUndefined();
});

test("the phone's count has one row for the waiting agents, however many", () => {
  const pwa = {
    standalone: true,
    ios: false,
    android: false,
    notifications: "unsupported",
  } as never;
  const base = {
    update: false,
    pwa,
    me: { invites: [], requests: [], waits: [] as never[] },
  };
  const before = userCenterCount(base);
  expect(
    userCenterCount({
      ...base,
      me: { ...base.me, waits: [wait("a1", 1), wait("a2", 2)] as never },
    }),
  ).toBe(before + 1);
});
