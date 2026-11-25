// The router's ack on a message it handled (src/router-rule.ts routerAck): your own ignored message stays unacked (Gimenes #5373).
import { expect, test } from "bun:test";
import { routerAck } from "../src/router-rule";

const me = "gimenes@deco.cx";

test("your own message that the router ignored gets no ack: it stays in unacked", () => {
  expect(routerAck({ author: me }, me, "ignore")).toBeNull();
  expect(routerAck({ author: me, mentions_you: true }, me, "ignore")).toBeNull();
});

test("an answered message of yours, or one that mentions you, is acked done", () => {
  expect(routerAck({ author: me }, me, "answer")).toBe("done");
  expect(routerAck({ author: "viktor@decocms.com", mentions_you: true }, me, "answer")).toBe("done");
});

test("another person's message that mentions you and was ignored is acked idle", () => {
  expect(routerAck({ author: "viktor@decocms.com", mentions_you: true }, me, "ignore")).toBe("idle");
});

test("no ack on a wake, nor on another person's message that does not mention you", () => {
  expect(routerAck({ author: me }, me, "wake")).toBeNull();
  expect(routerAck({ author: "viktor@decocms.com" }, me, "ignore")).toBeNull();
  expect(routerAck({ author: "viktor@decocms.com" }, me, "answer")).toBeNull();
});
