import { expect, test } from "bun:test";
import { askThread } from "../src/askThread";
const all = () => true;
test("a ⏸ goes to the newer of the acked request and the Claude's latest post", () => {
  // Gui #3349: acked a request in epic A, then worked from the terminal and posted in epic B.
  expect(askThread({ thread: "A", ts: 100 }, { thread: "B", ts: 200 }, all)).toBe("B");
  // "publica" asked in A after the Claude's last post in B: A.
  expect(askThread({ thread: "A", ts: 300 }, { thread: "B", ts: 200 }, all)).toBe("A");
  expect(askThread(undefined, { thread: "B", ts: 1 }, all)).toBe("B");
  expect(askThread({ thread: "A", ts: 1 }, { thread: "gone", ts: 9 }, (t) => t !== "gone")).toBe("A");
  expect(askThread(undefined, undefined, all)).toBe("");
});
