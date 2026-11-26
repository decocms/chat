// The room's search in the browser (web/features/chat/roomSearch.ts): what a loaded message matches, how the loaded
// matches and the server's pages make one list, and what the desktop pane does when the search changes.
import { expect, test } from "bun:test";
import { get } from "svelte/store";
import {
  matchesSearch,
  mergeHits,
  NO_SEARCH,
  personMatch,
  roomSearch,
  searchActive,
  searchOf,
  searchPaneStep,
  searchPlaceholder,
} from "../web/features/chat/roomSearch";

const ana = "ana@example.test";
const bruno = "bruno@example.test";

test("a search lists something with a word of two letters, or with a person alone", () => {
  expect(searchActive(NO_SEARCH)).toBe(false);
  expect(searchActive({ text: " a ", person: "" })).toBe(false);
  expect(searchActive({ text: "ok", person: "" })).toBe(true);
  expect(searchActive({ text: "", person: ana })).toBe(true);
});

test("a person alone matches each of their own messages with text or files, not their agent's", () => {
  const person = { text: "", person: ana };
  expect(matchesSearch({ author: ana, text: "bom dia" }, person)).toBe(true);
  expect(matchesSearch({ author: bruno, text: "bom dia" }, person)).toBe(false);
  expect(
    matchesSearch({ author: ana, text: "feito", kind: "agent" }, person),
  ).toBe(false);
  expect(
    matchesSearch(
      { author: ana, text: "", files: [{ name: "plano.png" }] },
      person,
    ),
  ).toBe(true);
  expect(matchesSearch({ author: ana, text: "" }, person)).toBe(false);
  expect(matchesSearch({ author: ana, text: "x", deleted: 5 }, person)).toBe(
    false,
  );
});

test("words and a person narrow together; words match the text or a file's name, accents ignored", () => {
  const both = { text: "orcamento", person: ana };
  expect(matchesSearch({ author: ana, text: "Fechei o orçamento" }, both)).toBe(
    true,
  );
  expect(
    matchesSearch({ author: bruno, text: "Fechei o orçamento" }, both),
  ).toBe(false);
  expect(matchesSearch({ author: ana, text: "Fechei o evento" }, both)).toBe(
    false,
  );
  expect(
    matchesSearch(
      { author: bruno, text: "", files: [{ name: "orcamento.pdf" }] },
      { text: "orçamento", person: "" },
    ),
  ).toBe(true);
  // A one-letter word is left out, as the server does: "o" does not narrow.
  expect(
    matchesSearch(
      { author: ana, text: "deploy feito" },
      {
        text: "o deploy",
        person: "",
      },
    ),
  ).toBe(true);
  expect(matchesSearch({ author: ana, text: "bom dia" }, NO_SEARCH)).toBe(
    false,
  );
});

test("the list is newest first, each message once, with no gap before the server's next page", () => {
  const ids = (list: { id: number }[]) => list.map((hit) => hit.id);
  const local = [{ id: 50 }, { id: 12 }, { id: 3 }];
  const remote = [{ id: 50 }, { id: 40 }, { id: 30 }];
  // An older page exists: 12 and 3 wait for it, or they would sit under 30 with 29…13 missing.
  expect(ids(mergeHits(local, remote, true))).toEqual([50, 40, 30]);
  expect(ids(mergeHits(local, remote, false))).toEqual([50, 40, 30, 12, 3]);
  // Before the server answers: the loaded matches.
  expect(ids(mergeHits(local, [], true))).toEqual([50, 12, 3]);
  // A message that arrived after the server's page shows on top.
  expect(ids(mergeHits([{ id: 60 }], remote, true))).toEqual([60, 50, 40, 30]);
});

test("the search belongs to one room", () => {
  roomSearch.set({ room: "room-a", text: "deploy", person: ana });
  expect(searchOf(get(roomSearch), "room-a")).toEqual({
    text: "deploy",
    person: ana,
  });
  expect(searchOf(get(roomSearch), "room-b")).toEqual(NO_SEARCH);
  roomSearch.set({ room: "", ...NO_SEARCH });
});

test("desktop: the search opens its pane, and clearing it gives the column back as it was", () => {
  const desk = (
    documentVisible: boolean,
    pane: "doc" | "people" | "search",
  ) => ({
    mobile: false,
    documentVisible,
    pane,
  });
  // The pane was closed: the search opens it, and clearing closes it (the bug: an empty column stayed).
  const fromClosed = searchPaneStep(true, desk(false, "doc"), null);
  expect(fromClosed).toEqual({
    kind: "open",
    before: { visible: false, pane: "doc" },
  });
  if (fromClosed.kind !== "open") throw Error("not open");
  expect(
    searchPaneStep(false, desk(true, "search"), fromClosed.before),
  ).toEqual({ kind: "close", pane: "doc" });
  // People was open: clearing brings People back.
  expect(
    searchPaneStep(false, desk(true, "search"), {
      visible: true,
      pane: "people",
    }),
  ).toEqual({ kind: "restore", pane: "people" });
  // Closed with People as its pane: it closes on People, so ⌥⌘B opens People, not an empty Search pane.
  expect(
    searchPaneStep(false, desk(true, "search"), {
      visible: false,
      pane: "people",
    }),
  ).toEqual({ kind: "close", pane: "people" });
  // No memory of the pane before (the search pane was open some other way): close it, on the doc.
  expect(searchPaneStep(false, desk(true, "search"), null)).toEqual({
    kind: "close",
    pane: "doc",
  });
  // Typing more, or a pane the person opened since: nothing to do.
  expect(searchPaneStep(true, desk(true, "search"), null)).toEqual({
    kind: "none",
  });
  expect(searchPaneStep(false, desk(true, "doc"), null)).toEqual({
    kind: "none",
  });
});

test("phone: the Search pane holds the field, so clearing keeps it open", () => {
  expect(
    searchPaneStep(
      false,
      { mobile: true, documentVisible: true, pane: "search" },
      null,
    ),
  ).toEqual({ kind: "none" });
});

test("the people picker matches each typed word in the name or the email", () => {
  expect(personMatch(`Ana Souza ${ana}`, "ana sou")).toBe(1);
  expect(personMatch(`Ana Souza ${ana}`, "example")).toBe(1);
  expect(personMatch(`Ana Souza ${ana}`, "bruno")).toBe(0);
});

test("the placeholder names the room, or the conversation in a DM", () => {
  const t = (text: string, vars?: Record<string, string | number>) =>
    text.replace("{room}", String(vars?.room ?? ""));
  expect(searchPlaceholder({ title: "Projeto" }, t)).toBe("Buscar em Projeto");
  expect(searchPlaceholder({ title: "Ana", dm: true }, t)).toBe(
    "Buscar na conversa",
  );
  expect(searchPlaceholder({ title: "" }, t)).toBe("Buscar nesta sala");
});
