import { expect, test } from "bun:test";
import { AGENT_HANDLE, baseName, byName, freeName } from "../shared/agentNames";
import { rule } from "../src/router-rule";
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
  expect(reviewer).toEqual({
    name: "reviewer",
    display_name: "Revisor 🔍",
    mentions: true,
    keywords: ["revisar", "pull request"],
    model: "claude-sonnet-5-5",
    context: "Você revisa PRs.",
  });
  expect(qa.keywords).toEqual(["teste"]);
  expect(qa.display_name).toBe("qa");
  expect(parseRole("# Agent da sala\n\n## Setup")).toBeNull();
  expect(parseRole("---\nname: Bad Name!\n---\nx")).toBeNull();
  expect(
    parseRole("---\nname: off\ntriggers:\n  mentions: false\n---\n")!.mentions,
  ).toBe(false);
});

test("forRole: @name or a keyword as a whole word, accents and case folded", () => {
  expect(forRole("@reviewer olha isso", reviewer)).toBe(true);
  expect(forRole("pode REVISAR o #12?", reviewer)).toBe(true);
  expect(forRole("abre um Pull Request", reviewer)).toBe(true);
  expect(forRole("revisaram ontem", reviewer)).toBe(false);
  expect(forRole("email reviewer@x.com", reviewer)).toBe(false);
  expect(
    forRole(
      "@reviewer",
      parseRole("---\nname: reviewer\ntriggers:\n  mentions: false\n---\n")!,
    ),
  ).toBe(false);
});

test("wakes: a role only for its human's messages for it; the Primary skips its human's @role messages", () => {
  const roles = [reviewer, qa];
  expect(
    wakes({ mine: true, text: "@reviewer vê o PR" }, reviewer, roles),
  ).toBe(true);
  expect(wakes({ mine: true, text: "faz o deploy" }, reviewer, roles)).toBe(
    false,
  );
  expect(
    wakes({ mine: false, text: "@reviewer vê o PR" }, reviewer, roles),
  ).toBe(false);
  expect(wakes({ mine: true, text: "@reviewer vê o PR" }, null, roles)).toBe(
    false,
  );
  expect(wakes({ mine: true, text: "pode revisar?" }, null, roles)).toBe(true);
  expect(wakes({ mine: true, text: "faz o deploy" }, null, roles)).toBe(true);
  expect(wakes({ mine: false, text: "@reviewer oi" }, null, roles)).toBe(true);
});

test("a planner of the same human @executor wakes the executor; another person's agent does not", () => {
  const executor = parseRole("---\nname: executor\n---\nRuns commands.")!;
  const roles = [executor];
  expect(
    wakes(
      { mine: false, ownAgent: true, text: "@executor roda bun run check" },
      executor,
      roles,
    ),
  ).toBe(true);
  expect(
    wakes(
      { mine: false, ownAgent: false, text: "@executor roda bun run check" },
      executor,
      roles,
    ),
  ).toBe(false);
  expect(
    wakes({ mine: false, ownAgent: true, text: "@executor roda" }, null, roles),
  ).toBe(false);
});

test("names: with two Claudes of one person, the Primary gets what calls no one and @claude-2 wakes only claude-2", () => {
  const first = { name: "claude", primary: true, others: ["claude-2"] };
  const second = { name: "claude-2", primary: false, others: ["claude"] };
  expect(wakes({ mine: true, text: "sobe a #481" }, null, [], first)).toBe(
    true,
  );
  expect(wakes({ mine: true, text: "sobe a #481" }, null, [], second)).toBe(
    false,
  );
  expect(
    wakes({ mine: true, text: "@claude-2 sobe a #481" }, null, [], first),
  ).toBe(false);
  expect(
    wakes({ mine: true, text: "@claude-2 sobe a #481" }, null, [], second),
  ).toBe(true);
  expect(
    wakes({ mine: true, text: "@claude sobe a #481" }, null, [], first),
  ).toBe(true);
  expect(
    wakes({ mine: true, text: "@claude sobe a #481" }, null, [], second),
  ).toBe(false);
  // Another person's @claude is their Claude: it never wakes yours by name.
  expect(wakes({ mine: false, text: "@claude-2 oi" }, null, [], second)).toBe(
    false,
  );
  expect(
    wakes({ mine: false, text: "alguém viu o deploy?" }, null, [], first),
  ).toBe(true);
  // Alone in the room: as before.
  expect(
    wakes({ mine: true, text: "sobe" }, null, [], {
      name: "claude",
      primary: true,
      others: [],
    }),
  ).toBe(true);
});

test("agent names: claude, claude-2, … in order; codex apart; @claude is never a person's handle", () => {
  expect(freeName("claude", [])).toBe("claude");
  expect(freeName("claude", ["claude"])).toBe("claude-2");
  expect(freeName("claude", ["claude", "claude-2", "codex"])).toBe("claude-3");
  expect(freeName("claude", ["claude-2"])).toBe("claude");
  expect(baseName("codex")).toBe("codex");
  expect(baseName("claude-code")).toBe("claude");
  expect(["claude-10", "codex", "claude-2", "claude"].sort(byName)).toEqual([
    "claude",
    "claude-2",
    "claude-10",
    "codex",
  ]);
  for (const h of ["claude", "claude-2", "codex", "codex-12", "agent"])
    expect(AGENT_HANDLE.test(h)).toBe(true);
  for (const h of ["claudia", "claude2", "gimenes"])
    expect(AGENT_HANDLE.test(h)).toBe(false);
});

test("router: your message that calls one of your agents by name wakes with no model", () => {
  const base = {
    author: "g@x",
    agent: false,
    tag: null,
    for_who: null,
    mentions_you: false,
    reply_author: null,
    epic_owner: null,
  };
  expect(rule({ ...base, to_own_agent: true }, "g@x")).toEqual({
    arm: "rule",
    decision: "wake",
    why: "você chamou o seu agent pelo nome",
  });
  expect(rule(base, "g@x")).toBeNull();
});
