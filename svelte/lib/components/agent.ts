/** Which coding agent it is, from the model or client it reported. Unknown names (e.g. "vibebook CLI", which
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
  claude: "bg-agent-claude text-agent-claude-foreground",
  codex: "bg-agent-codex text-agent-codex-foreground",
  gemini: "bg-agent-gemini text-agent-gemini-foreground",
  cursor: "bg-agent-cursor text-agent-cursor-foreground",
  copilot: "bg-agent-copilot text-agent-copilot-foreground",
};
/** The glyph an agent's avatar shows for the model or client it runs on. */
export const agentMark = (via: string | null | undefined) =>
  AGENT_MARKS[agentProvider(via)];
/** An agent's name in its provider's color, as its tile (the tokens flip for dark mode). */
export const AGENT_NAMES: Record<AgentProvider, string> = {
  claude: "text-agent-claude-text",
  codex: "text-agent-codex-text",
  gemini: "text-agent-gemini-text",
  cursor: "text-agent-cursor-text",
  copilot: "text-agent-copilot-text",
};
