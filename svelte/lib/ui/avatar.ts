/** One avatar language: people are circles, agents are rounded squares. */
export type AvatarKind = "person" | "agent";

/** Rendered avatar edge in px. It sets both the size and, for agents, the
 * radius, so a small agent mark can never pair a big radius with a small box. */
export type AvatarPx = 16 | 24 | 32;

export const avatarSize = (px: AvatarPx = 32) =>
  px <= 16 ? "tw:size-4" : px <= 24 ? "tw:size-6" : "tw:size-8";

/** Agents share the room tile radius (RoomTile uses tw:rounded-control), so one
 * token change reshapes both. Below 32px the radius is that token scaled down
 * (--radius-control-md/-sm), or a 16px mark would come out round. */
export const avatarShape = (kind: AvatarKind = "person", px: AvatarPx = 32) =>
  kind !== "agent"
    ? "tw:rounded-full"
    : px <= 16
      ? "tw:rounded-control-sm"
      : px <= 24
        ? "tw:rounded-control-md"
        : "tw:rounded-control";

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

/** The glyph shown for an agent, picked from its model or client name. */
export const agentMark = (via: string | null | undefined) =>
  AGENT_MARKS[agentProvider(via)];
