import { expect, test } from "bun:test";
import { forRole, parseRole, wakes } from "../shared/roles";

const reviewer = parseRole(`---
name: Reviewer
display_name: "Revisor 🔍"
triggers:
  mentions: true
  keywords: [revisar, "pull request"]
model: claude-sonnet-5-5
---
Você revisa PRs.
`)!;
const qa = parseRole(`---
name: qa
triggers:
  keywords:
    - teste
---
QA.`)!;

test("parses a role file; a file without frontmatter or name is not a role", () => {
  expect(reviewer).toEqual({ name: "reviewer", display_name: "Revisor 🔍", mentions: true, keywords: ["revisar", "pull request"], model: "claude-sonnet-5-5", context: "Você revisa PRs." });
  expect(qa.keywords).toEqual(["teste"]);
  expect(qa.display_name).toBe("qa");
  expect(parseRole("# Agent da sala\n\n## Setup")).toBeNull();
  expect(parseRole("---\nname: Bad Name!\n---\nx")).toBeNull();
  expect(parseRole("---\nname: off\ntriggers:\n  mentions: false\n---\n")!.mentions).toBe(false);
});

test("forRole: @name or a keyword as a whole word, accents and case folded", () => {
  expect(forRole("@reviewer olha isso", reviewer)).toBe(true);
  expect(forRole("pode REVISAR o #12?", reviewer)).toBe(true);
  expect(forRole("abre um Pull Request", reviewer)).toBe(true);
  expect(forRole("revisaram ontem", reviewer)).toBe(false);
  expect(forRole("email reviewer@x.com", reviewer)).toBe(false);
  expect(forRole("@reviewer", parseRole("---\nname: reviewer\ntriggers:\n  mentions: false\n---\n")!)).toBe(false);
});

test("wakes: a role only for its human's messages for it; the Primary skips its human's @role messages", () => {
  const roles = [reviewer, qa];
  expect(wakes({ mine: true, text: "@reviewer vê o PR" }, reviewer, roles)).toBe(true);
  expect(wakes({ mine: true, text: "faz o deploy" }, reviewer, roles)).toBe(false);
  expect(wakes({ mine: false, text: "@reviewer vê o PR" }, reviewer, roles)).toBe(false);
  expect(wakes({ mine: true, text: "@reviewer vê o PR" }, null, roles)).toBe(false);
  expect(wakes({ mine: true, text: "pode revisar?" }, null, roles)).toBe(true);
  expect(wakes({ mine: true, text: "faz o deploy" }, null, roles)).toBe(true);
  expect(wakes({ mine: false, text: "@reviewer oi" }, null, roles)).toBe(true);
});

test("a planner of the same human @executor wakes the executor; another person's agent does not", () => {
  const executor = parseRole("---\nname: executor\n---\nRuns commands.")!;
  const roles = [executor];
  expect(wakes({ mine: false, ownAgent: true, text: "@executor roda bun run check" }, executor, roles)).toBe(true);
  expect(wakes({ mine: false, ownAgent: false, text: "@executor roda bun run check" }, executor, roles)).toBe(false);
  expect(wakes({ mine: false, ownAgent: true, text: "@executor roda" }, null, roles)).toBe(false);
});
