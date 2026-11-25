import type { Room, Attachment } from "../../../shared/room";
import type { Connection } from "../../../shared/schemas";
export type AppTarget = { connection: string; tool: string };
/** OAuth returns identify a connection catalog, not an invented tool to run. */
export type AppRouteTarget = { connection: string; tool?: string };
const appConnection = /^(?:room|[a-f0-9]{12})$/;
const appTool = /^[\w.-]{1,100}$/;
export function appRouteHash(target: AppRouteTarget): string | null {
  if (
    typeof target.connection !== "string" ||
    !appConnection.test(target.connection) ||
    (target.tool !== undefined &&
      (typeof target.tool !== "string" || !appTool.test(target.tool)))
  )
    return null;
  return `#app:${target.connection}${target.tool === undefined ? "" : "/" + target.tool}`;
}
export function appRouteTarget(hash: string): AppRouteTarget | null {
  const match = /^#app:([^/]+)(?:\/([^/]+))?$/.exec(hash);
  if (!match) return null;
  const target = {
    connection: match[1]!,
    ...(match[2] !== undefined ? { tool: match[2] } : {}),
  };
  return appRouteHash(target) ? target : null;
}
export type RoomApp = { tool: string; title: string; file: Attachment };
export function roomApps(room: Room): RoomApp[] {
  const seen = new Set<string>();
  return (room.files || [])
    .filter(
      (file) =>
        file.type === "text/html" &&
        /^apps\/[\w.-]+\.html$/i.test(file.name) &&
        !seen.has(file.name) &&
        !!seen.add(file.name),
    )
    .map((file) => ({
      tool: file.name.slice(5, -5),
      title: file.name.slice(5, -5),
      file,
    }));
}
export function appIdentity(
  room: Room,
  connections: readonly Connection[],
  target: AppTarget,
): string | null {
  if (target.connection === "room") {
    const app = roomApps(room).find((app) => app.tool === target.tool);
    return app
      ? JSON.stringify([
          room.id,
          room.me,
          "room",
          app.tool,
          app.file.id,
          app.file.ts,
        ])
      : null;
  }
  const connection = connections.find(
    (connection) => connection.id === target.connection,
  );
  const app = connection?.apps.find((app) => app.tool === target.tool);
  return app && connection
    ? JSON.stringify([
        room.id,
        room.me,
        connection.id,
        app.tool,
        connection.auth,
        connection.signed_in,
      ])
    : null;
}
export function signinUrl(roomId: string, connectionId: string) {
  return `/api/books/${encodeURIComponent(roomId)}/connections/${encodeURIComponent(connectionId)}/signin`;
}
export function safeOpenLink(raw: string): string | null {
  try {
    const url = new URL(raw);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
/** The `_meta` key on the text blocks of a `ui/message` that asks for a draft: the text goes in the composer of the
 *  thread, not in the room. The host context has the same key (`true`) when this host can do it. */
export const APP_COMPOSE = "vibebook/compose";
type AppMessageBlock = {
  type: string;
  text?: string;
  _meta?: Record<string, unknown>;
};
/** The draft text when every text block asks for a draft, else null (the message is a post). The end of the text
 *  stays as the app wrote it: a blank line after a quote puts the caret in a new paragraph, not in the quote. */
export function appDraft(content: readonly AppMessageBlock[]): string | null {
  const blocks = content.filter((block) => block.type === "text");
  if (
    !blocks.length ||
    !blocks.every((block) => block._meta?.[APP_COMPOSE] === true)
  )
    return null;
  const text = blocks
    .map((block) => block.text ?? "")
    .join("\n")
    .replace(/^\s+/, "")
    .slice(0, 4000);
  return text.trim() ? text : "";
}

export function connectionApps(connection: Connection) {
  const seen = new Set<string>();
  return connection.apps.filter(
    (app) => !seen.has(app.tool) && !!seen.add(app.tool),
  );
}
