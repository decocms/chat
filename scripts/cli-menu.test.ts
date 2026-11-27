// The runner's room-question fallback (cli/menu.ts): the question and options of a Claude Code menu on the screen.
import { expect, test } from "bun:test";
import { menuOf } from "../cli/menu";

test("the Claude in Chrome site question: the text between the rules, then its options (Gimenes #6490)", () => {
  const screen = [
    "  Calling claude-in-chrome 3 times…",
    "",
    "────────────────────────────────────────",
    " Claude in Chrome wants to navigate on localhost:8799",
    "╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌",
    " http://localhost:8799/acme/demo-storefront/editor",
    "╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌",
    " ❯ 1. Allow",
    "   2. Allow all actions on localhost:8799 for this session",
    "   3. Deny (esc)",
    "[hc] only its screen: it is blocked; history is not scrolled in this state",
  ].join("\n");
  expect(menuOf(screen)).toEqual({
    question:
      "Claude in Chrome wants to navigate on localhost:8799 http://localhost:8799/acme/demo-storefront/editor",
    options: [
      "Allow",
      "Allow all actions on localhost:8799 for this session",
      "Deny (esc)",
    ],
  });
});

test("no menu, or a numbered list in the middle of a reply, is not a question", () => {
  expect(menuOf("⏺ Done.\n\n✻ Baked for 13s")).toBeNull();
  expect(menuOf("Steps:\n1. Build\n\n❯ ")).toBeNull();
});
