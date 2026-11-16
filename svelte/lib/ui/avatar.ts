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

/** The glyph shown for an agent, picked from its model or client name. */
export function agentMark(via: string | null | undefined) {
  return /codex|gpt|openai|\bo[1-9]\b/i.test(via || "")
    ? "◎"
    : /gemini|antigravity/i.test(via || "")
      ? "✦"
      : /cursor/i.test(via || "")
        ? "▲"
        : /copilot/i.test(via || "")
          ? "◉"
          : "✻";
}
