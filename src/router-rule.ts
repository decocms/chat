// HARD RULE (AGENTS.md, rule 14): a change here needs `bun scripts/router-bench.ts` before the pull request, with the
// scores before and after in the pull request. A score must not go down. New behavior gets new bench cases.
// The router's fixed rules (src/router.ts), apart so scripts/router-check.ts can run them without the Worker.
export type RuleMsg = { author: string; agent: boolean; tag: string | null; for_who: string | null; mentions_you: boolean; reply_author: string | null; epic_owner: string | null;
  /** Your message calls one of your agents by its @name (src/agentNames.ts, a role or a sandbox). */
  to_own_agent?: boolean };
/** Decisions that need no model: whose message it is, and what it answers. null = ask the arm. */
export function rule(m: RuleMsg, email: string): { arm: "rule"; decision: "ignore" | "wake"; why: string } | null | "skip" {
  if (m.author === email && m.agent) return "skip"; // your own Claudes' posts
  if (m.author === "ai") return m.tag === "reminder" && m.for_who === email ? { arm: "rule", decision: "wake", why: "seu lembrete" } : "skip";
  if (m.agent && !m.mentions_you) return "skip"; // other people's Claudes talking among themselves
  // Your own messages go to Jev too (Gui, 14/11, #2319: "concordo em tirar a regra fixa"; Gimenes wanted to talk to
  // a person without his Codex answering): route() asks whether you're talking to your Claude, biased to wake, since
  // on 13/11 a request of Gui's was missed when the router could ignore his messages.
  // Calling one of your agents by name (@claude-2, @reviewer) is the override when Jev gets it wrong (Gimenes #5440,
  // #5547): it wakes, with no model. Which of your agents acts is shared/roles.ts wakes.
  if (m.author === email) return m.to_own_agent ? { arm: "rule", decision: "wake", why: "você chamou o seu agent pelo nome" } : null;
  // Another person's message that doesn't mention you is for whoever it answers or whoever owns the epic. Jev read
  // Gui's requests to his own Claude as work for Gimenes's (for_them 0.75), and Haiku answered one in Gimenes's name
  // (#2250, 14/11). No model needed to see who it's addressed to.
  if (!m.agent && !m.mentions_you) {
    if (m.reply_author && m.reply_author !== email) return { arm: "rule", decision: "ignore", why: "resposta pra outra pessoa" };
    if (m.epic_owner && m.epic_owner !== email) return { arm: "rule", decision: "ignore", why: "épico de outra pessoa" };
  }
  return null;
}

