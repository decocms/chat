/** Which coding agent it is, from the model or client it reported (vanilla
 * `agentKind()` in public/app.html). Unknown names (e.g. "vibebook CLI", which
 * Claude Code drives) keep the Claude mark. */
export type AgentProvider =
  "claude" | "codex" | "gemini" | "cursor" | "copilot";
export function agentProvider(via: string | null | undefined): AgentProvider {
  const value = via || "";
  return /codex|gpt|openai|\bo[1-9]\b/i.test(value)
    ? "codex"
    : /gemini|antigravity/i.test(value)
      ? "gemini"
      : /cursor/i.test(value)
        ? "cursor"
        : /copilot/i.test(value)
          ? "copilot"
          : "claude";
}
const AGENT_MARKS: Record<AgentProvider, string> = {
  claude: "✻",
  codex: "◎",
  gemini: "✦",
  cursor: "▲",
  copilot: "◉",
};
/** The tinted tile behind an agent's glyph: text glyphs on the provider's color, not brand logos. */
export const AGENT_TILES: Record<AgentProvider, string> = {
  claude: "tw:bg-agent-claude tw:text-agent-claude-foreground",
  codex: "tw:bg-agent-codex tw:text-agent-codex-foreground",
  gemini: "tw:bg-agent-gemini tw:text-agent-gemini-foreground",
  cursor: "tw:bg-agent-cursor tw:text-agent-cursor-foreground",
  copilot: "tw:bg-agent-copilot tw:text-agent-copilot-foreground",
};
/** The glyph an agent's avatar shows for the model or client it runs on. */
export const agentMark = (via: string | null | undefined) =>
  AGENT_MARKS[agentProvider(via)];
/** An agent's name in its provider's color, as its tile (the tokens flip for dark mode). */
export const AGENT_NAMES: Record<AgentProvider, string> = {
  claude: "tw:text-agent-claude-text",
  codex: "tw:text-agent-codex-text",
  gemini: "tw:text-agent-gemini-text",
  cursor: "tw:text-agent-cursor-text",
  copilot: "tw:text-agent-copilot-text",
};
