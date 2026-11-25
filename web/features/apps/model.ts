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
/** The `_meta` key that makes a draft block a reference: `{ label }`. The block shows as a chip with the label above
 *  the field, and its text goes before what the person types. A host without it puts the text in the field. */
export const APP_REFERENCE = "vibebook/reference";
type AppMessageBlock = {
  type: string;
  text?: string;
  _meta?: Record<string, unknown>;
};
export type AppDraft = {
  text: string;
  quotes: { label: string; text: string }[];
};
const referenceLabel = (meta: unknown) => {
  if (!meta || typeof meta !== "object" || !("label" in meta)) return null;
  const label =
    typeof meta.label === "string"
      ? meta.label.replace(/\s+/g, " ").trim()
      : "";
  return label ? label.slice(0, 120) : null;
};
/** The draft when every text block asks for one, else null (the message is a post). A block with a reference label
 *  is a quote; the others are the text for the field. The end of the text stays as the app wrote it. */
export function appDraft(content: readonly AppMessageBlock[]): AppDraft | null {
  const blocks = content.filter((block) => block.type === "text");
  if (
    !blocks.length ||
    !blocks.every((block) => block._meta?.[APP_COMPOSE] === true)
  )
    return null;
  let room = 4000;
  const quotes: AppDraft["quotes"] = [],
    lines: string[] = [];
  for (const block of blocks) {
    const label = referenceLabel(block._meta?.[APP_REFERENCE]),
      text = (block.text ?? "").slice(0, room);
    room -= text.length;
    if (label && text.trim()) quotes.push({ label, text: text.trim() });
    else if (!label) lines.push(text);
  }
  const text = lines.join("\n").replace(/^\s+/, "");
  return { text: text.trim() ? text : "", quotes };
}

export function connectionApps(connection: Connection) {
  const seen = new Set<string>();
  return connection.apps.filter(
    (app) => !seen.has(app.tool) && !!seen.add(app.tool),
  );
}
