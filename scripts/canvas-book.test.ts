// The Book's canvas (src/book.ts canvasEdit, canvasOpen) on a fake receiver: membership, epic scope, the secret
// filter, one broadcast per change, and what the room's snapshot carries (canvases).
import { expect, mock, test } from "bun:test";
mock.module("cloudflare:workers", () => ({
  DurableObject: class {},
  WorkerEntrypoint: class {},
  env: {},
}));
const { Book } = await import("../src/book");

function fixture(member = true) {
  const meta = new Map<string, string>(),
    events: { t: string; scope?: string }[] = [];
  const receiver = {
    get: (k: string) => meta.get(k) ?? null,
    set: (k: string, v: string) => void meta.set(k, v),
    broadcast: (e: { t: string; scope?: string }) => void events.push(e),
    bind: () => {},
    members: async () => (member ? ["ana@example.test"] : []),
    epics: () => [{ id: "e1" }],
    sql: {
      exec: () => ({
        toArray: () => [...meta.keys()].filter((k) => k.startsWith("canvas:")).map((k) => ({ k })),
      }),
    },
  };
  for (const name of ["canvas", "canvases", "setCanvas", "canvasOpen", "canvasEdit"])
    Reflect.set(receiver, name, Reflect.get(Book.prototype, name).bind(receiver));
  const edit = (op: string, scope: string, a: Record<string, unknown>) =>
    (receiver as unknown as { canvasEdit: (...x: unknown[]) => Promise<Record<string, unknown>> }).canvasEdit(
      "abcdef",
      "ana@example.test",
      op,
      scope,
      a,
    );
  return { receiver: receiver as unknown as { canvases: () => unknown; canvasOpen: (o: boolean) => void }, events, edit };
}

test("an agent puts, reads and deletes cards; each change is one broadcast", async () => {
  const f = fixture();
  expect((await f.edit("put", "", { id: "a", body: "x" })).ok).toBe(true);
  expect((await f.edit("put", "e1", { body: "y" })).ok).toBe(true);
  expect(f.events.map((e) => e.scope)).toEqual(["", "e1"]);
  expect(((await f.edit("read", "", {})).cards as unknown[]).length).toBe(1);
  expect((await f.edit("delete", "", { id: "a" })).ok).toBe(true);
  expect((await f.edit("delete", "", { id: "a" })).error).toBe("card not found");
  // The snapshot leaves out an empty canvas, and keeps one that is open with no cards.
  expect(Object.keys(f.receiver.canvases() as object)).toEqual(["e1"]);
  f.receiver.canvasOpen(true);
  expect(Object.keys(f.receiver.canvases() as object).sort()).toEqual(["", "e1"]);
});

test("a non-member, an unknown epic and a secret are refused", async () => {
  expect((await fixture(false).edit("put", "", { body: "x" })).error).toBe("forbidden");
  const f = fixture();
  expect((await f.edit("put", "nope", { body: "x" })).error).toBe("epic not found");
  expect(String((await f.edit("put", "", { body: "ghp_" + "a".repeat(36) })).error)).toContain("secret");
  expect(f.events).toEqual([]);
});
