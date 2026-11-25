import type { Attachment, Room } from "../../../shared/room";
import type { ChatActions } from "../../app/chatTypes";
import type { RichFileReader } from "./roomFiles";
import type { AppLink } from "./appLinks";
export type RichPolicy = "document" | "file-preview";
export type RichMode = "human" | "markdown" | "inline";
export type RichContext = {
  policy?: RichPolicy;
  room: Room;
  pageUrl: string;
  idPrefix: string;
  names?: Readonly<Record<string, string>>;
  fileLabel?: string;
  fileIndex?: RichFileReader;
};
export type RichFileReference = {
  roomId: string;
  id: string;
  name: string;
  type?: string;
};
export type RichNavigation = { kind: "thread" | "document"; id?: string };
export type RichActions = Pick<
  ChatActions,
  "navigate" | "openFile" | "ensureFileIndex" | "openAppLink"
> & {
  navigateRich?: (target: RichNavigation) => void;
  openFileReference?: (file: RichFileReference) => void;
};
export type LinkTarget =
  | { kind: "url"; href: string; external: boolean }
  | { kind: "message"; id: number; href: string }
  | { kind: "thread" | "document"; id?: string; href: string }
  | {
      kind: "file";
      href: string;
      file: RichFileReference;
      attachment?: Attachment;
      version?: number;
    }
  | { kind: "github"; href: string; label: string }
  /** A room, thread or message of this app; chip = the link's text is the bare URL, so a chip takes its place. */
  | { kind: "app"; href: string; link: AppLink; chip: boolean };
export type RichNamespace =
  | "http://www.w3.org/1999/xhtml"
  | "http://www.w3.org/2000/svg"
  | "http://www.w3.org/1998/Math/MathML";
export type SafeAttributes = Readonly<
  Record<string, string | number | boolean>
>;
/** Only the namespace/tag allowlist projection creates a renderable dynamic tag. */
export type SafeTag = string & { readonly safeRichTag: unique symbol };
export type RichNode =
  | { kind: "text"; text: string }
  | { kind: "mention"; text: string; who: string; mine: boolean }
  | {
      kind: "link";
      target: LinkTarget;
      children: RichNode[];
      title?: string;
      namespace: RichNamespace;
    }
  | {
      kind: "element";
      tag: SafeTag;
      namespace: RichNamespace;
      attrs: SafeAttributes;
      children: RichNode[];
      task?: boolean;
      documentTaskSlot?: true;
      documentAppSlot?: number;
      sourceStart?: number;
      sourceEnd?: number;
      language?: string;
    };
