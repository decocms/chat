import { expect, test } from "bun:test";
import { bookSocketUrl } from "../src/bookSocket";

const query = (q: string) => {
  const params = new URLSearchParams(q);
  return (name: string) => params.get(name) ?? undefined;
};

test("the room socket keeps the resume of the app (since, at, eh) on its way to the Book", () => {
  const url = new URL(
    bookSocketUrl(
      "abcdef",
      query("t=a22ffd1e&rc=1006&since=4846&at=1795618413891&eh=18k75oq4jio"),
    ),
  );
  expect(Object.fromEntries(url.searchParams)).toEqual({
    book: "abcdef",
    t: "a22ffd1e",
    rc: "1006",
    since: "4846",
    at: "1795618413891",
    eh: "18k75oq4jio",
  });
});

test("a first open has no resume, and a resume needs both since and at", () => {
  expect(bookSocketUrl("abcdef", query(""))).toBe(
    "https://book/ws?book=abcdef&t=main",
  );
  expect(bookSocketUrl("abcdef", query("since=12"))).toBe(
    "https://book/ws?book=abcdef&t=main",
  );
});

test("a light socket (lite=1) keeps its flag; any other value is dropped", () => {
  expect(bookSocketUrl("abcdef", query("lite=1&t=e1"))).toBe(
    "https://book/ws?book=abcdef&t=e1&lite=1",
  );
  expect(bookSocketUrl("abcdef", query("lite=true"))).toBe(
    "https://book/ws?book=abcdef&t=main",
  );
});

test("only numbers and a short hash pass", () => {
  const url = new URL(
    bookSocketUrl("abcdef", query("since=12x&at=34&eh=a%26b=c&rc=99999")),
  );
  expect(url.searchParams.get("since")).toBe("12");
  expect(url.searchParams.get("eh")).toBe("abc");
  expect(url.searchParams.get("rc")).toBe("9999");
});

test("the call's own socket (call=1) reaches the Book as such; any other value is no call socket", () => {
  expect(bookSocketUrl("abcdef", query("call=1"))).toBe(
    "https://book/ws?book=abcdef&t=main&call=1",
  );
  expect(bookSocketUrl("abcdef", query("call=yes"))).toBe(
    "https://book/ws?book=abcdef&t=main",
  );
});

test("the Home Inbox's look (peek=1) reaches the Book as such; any other value is a plain open", () => {
  expect(bookSocketUrl("abcdef", query("peek=1&t=e1"))).toBe(
    "https://book/ws?book=abcdef&t=e1&peek=1",
  );
  expect(bookSocketUrl("abcdef", query("peek=yes"))).toBe(
    "https://book/ws?book=abcdef&t=main",
  );
});
