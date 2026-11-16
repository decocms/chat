import type { Attachment, Pin, Room } from "../../../shared/room";
import { kb } from "../../panels";
import { tintClasses } from "../home/model";

export type PinAppTarget = { connectionId: string; tool: string };
export type PinTarget =
  | {
      kind: "link";
      href: string;
      label: string;
      /** Host plus path, without scheme or trailing slash. */
      detail: string;
      /** A github.com link gets the GitHub mark; nothing is fetched from the site. */
      github: boolean;
    }
  | {
      kind: "file";
      file: Attachment;
      label: string;
      /** Type and size from the file record, e.g. "PDF · 2.1 MB". */
      detail: string;
    }
  | { kind: "file-unloaded"; id: string; label: string }
  | { kind: "app"; app: PinAppTarget; label: string }
  | {
      kind: "unavailable";
      label: string;
      reason:
        | "Link inválido"
        | "Arquivo indisponível"
        | "App indisponível"
        | "Item indisponível";
    };

/** Match Book.pinAdd's scheme normalization, retaining only browser-safe HTTP(S) links. */
export function normalizePinLink(value: string): string | null {
  const text = value.trim();
  if (!text || text.length > 2000 || /[\u0000-\u001f\u007f]/.test(text))
    return null;
  try {
    const url = new URL(/^[a-z]+:\/\//i.test(text) ? text : `https://${text}`);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function pinAppTarget(ref: string): PinAppTarget | null {
  const match = /^(?:((?:[a-f0-9]{12}|room))\/)?([\w.-]{1,100})$/.exec(ref);
  return match ? { connectionId: match[1] ?? "room", tool: match[2] } : null;
}

/** Resolve against the current room, so removed/unknown targets remain removable without executable hrefs. */
export function resolvePin(
  pin: Pin,
  room: Pick<Room, "files" | "filesAll">,
): PinTarget {
  if (pin.kind === "link") {
    const href = normalizePinLink(pin.ref);
    if (!href)
      return {
        kind: "unavailable",
        label: pin.title || pin.ref,
        reason: "Link inválido",
      };
    const url = new URL(href);
    const host = url.hostname.replace(/^www\./, "");
    return {
      kind: "link",
      href,
      label: pin.title || host,
      detail: `${host}${url.pathname.replace(/\/+$/, "")}`,
      github: host === "github.com" || host.endsWith(".github.com"),
    };
  }
  if (pin.kind === "file") {
    const file = room.files?.find((file) => file.id === pin.ref);
    return file
      ? {
          kind: "file",
          file,
          label: pin.title || file.name,
          detail: pinFileDetail(file),
        }
      : room.filesAll
        ? {
            kind: "unavailable",
            label: pin.title || pin.ref,
            reason: "Arquivo indisponível",
          }
        : { kind: "file-unloaded", id: pin.ref, label: pin.title || pin.ref };
  }
  if (pin.kind === "app") {
    const app = pinAppTarget(pin.ref);
    // Files may initially be a partial page; absence proves removal only after files.get has completed.
    const missing =
      app?.connectionId === "room" &&
      room.filesAll &&
      !room.files?.some((file) => file.name === `apps/${app.tool}.html`);
    return app && !missing
      ? { kind: "app", app, label: pin.title || app.tool }
      : {
          kind: "unavailable",
          label: pin.title || pin.ref,
          reason: "App indisponível",
        };
  }
  return {
    kind: "unavailable",
    label: pin.title || pin.ref,
    reason: "Item indisponível",
  };
}

/** "PDF · 2.1 MB": the file name's extension (or MIME subtype) and size, both already on the record. */
export function pinFileDetail(
  file: Pick<Attachment, "name" | "type" | "size">,
) {
  const extension = /\.([a-z0-9]{1,8})$/i.exec(file.name)?.[1];
  const subtype = /^[\w.+-]+\/([\w-]{1,12})$/.exec(file.type)?.[1];
  const kind = (extension ?? subtype ?? "").toUpperCase();
  return [
    kind,
    Number.isFinite(file.size) && file.size >= 0 ? kb(file.size) : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Same pinned app as the one open in the apps pane (`connection` is the pane's name for it). */
export function samePinApp(
  pin: PinAppTarget,
  open: { connection: string; tool: string } | null | undefined,
) {
  return (
    !!open && open.connection === pin.connectionId && open.tool === pin.tool
  );
}

const tints = (["blue", "green", "yellow", "pink", "purple"] as const).map(
  (tint) => tintClasses[tint],
);
/** A stable tint per app, so a pinned app reads as a tile like the rail's room tiles. */
export function pinAppTint(app: PinAppTarget) {
  let hash = 0;
  for (const char of `${app.connectionId}/${app.tool}`)
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return tints[hash % tints.length];
}

/** One or two initials from the app's label ("Roteador A/B" -> "RA", "chart" -> "C"). */
export function pinAppInitials(label: string) {
  const words = label
    .replace(/[-_.]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => /[\p{L}\p{N}]/u.test(word));
  return (
    words
      .slice(0, 2)
      .map((word) => Array.from(word.replace(/^[^\p{L}\p{N}]+/u, ""))[0] ?? "")
      .join("") || "A"
  ).toLocaleUpperCase();
}
