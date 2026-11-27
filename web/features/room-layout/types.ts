import type { Snippet } from "svelte";
import type { Readable } from "svelte/store";
import type { DocumentPane } from "../documents/types";

export type RoomSheet = "side" | "doc";
export type RoomLayoutState = {
  pane: DocumentPane;
  sheet: RoomSheet | null;
  documentVisible: boolean;
  sidebarCollapsed: boolean;
  mobile: boolean;
  closingUnconfirmed: boolean;
  /** The phone doc pane while it is shown or fading out (the threads drawer is a Drawer, not here). */
  presentedSheet: "doc" | null;
  documentWidth: number;
  documentMaximum: number;
  resizing: boolean;
  active: boolean;
  animationUnavailable: boolean;
};
/** All nodes belong to one mounted RoomLayout. The chat cell is the scroller. */
export type RoomLayoutCells = {
  root: HTMLElement;
  viewport: HTMLElement;
  header: HTMLElement;
  peek: HTMLElement;
  attention: HTMLElement;
  chat: HTMLElement;
  composer: HTMLElement;
  documentToolbar: HTMLElement;
  document: HTMLElement;
};
export type RoomLayoutController = {
  readonly state: Readable<RoomLayoutState>;
  read(): RoomLayoutState;
  setPane(
    pane: DocumentPane,
    /** quiet: switch the pane without opening it (a fallback, not you). */
    options?: { open?: boolean; toggle?: boolean; quiet?: boolean },
  ): void;
  toggleDocument(): void;
  /** The app opening the pane on its own (an epic with your tasks): not when you closed it, and not remembered. */
  revealDocument(): void;
  toggleSidebar(): void;
  openSheet(which: RoomSheet): void;
  closeSheet(pick?: boolean): void;
  /** Close without Back; true requires the caller's route write to replace. */
  takeSheetEntry(): boolean;
  beforeNavigation(): void;
  /** Sheet-only: FileViewer pop/restore MUST run first. */
  consumePop(): boolean;
  /** FileViewer pending navigation MUST be checked before this queue. */
  deferNavigation(callback: () => void): boolean;
  retryHistory(): void;
  mount(cells: RoomLayoutCells): () => void;
  bindWidthInput(node: HTMLInputElement): () => void;
  /** Additional owned document surface, using the same preferred width. */
  bindDocumentWidth(node: HTMLElement): () => void;
  setViewerGate(gate: {
    deferNavigation(callback: () => void): boolean;
  }): () => void;
  dispose(): void;
};
export type RoomLayoutProps = {
  controller: RoomLayoutController;
  sidebar: Snippet;
  header: Snippet;
  peek: Snippet;
  attention?: Snippet;
  /** Desktop: a stage at the left of the chat (the room's call). With it the chat is a narrow column at the right. */
  stage?: Snippet;
  /** With `stage`: the chat column is hidden and the stage takes its place. */
  stageOnly?: boolean;
  /** With `stage`, in full screen: no sidebar and no top bar, only the stage and the chat column. */
  stageFull?: boolean;
  chat: Snippet;
  composer: Snippet;
  /** In Expand, one line over the floating composer (what came back after you wrote). */
  focusPeek?: Snippet;
  /** The phone's bottom tab bar, a row under the composer on phones only. */
  tabbar?: Snippet;
  documentToolbar: Snippet;
  document: Snippet;
  overlay?: Snippet;
  overlayOpen?: boolean;
  /** Exact scroller attachment; cleanup must detach only this same node. */
  onChatSurface?: (node: HTMLElement) => void | (() => void);
  onCells?: (cells: RoomLayoutCells) => void | (() => void);
  labels: {
    documentWidth: string;
    closeDocument: string;
    closeSidebar: string;
    closeSheet: string;
    historyUnconfirmed: string;
    historyRetry: string;
    animationUnavailable: string;
  };
};
export type RoomLayoutOptions = {
  /** Fixed account/room/connection scope supplied by the data owner. */
  scopeKey: string;
  current(): boolean;
  onDocumentClosed(): void;
  onPane?(pane: DocumentPane): void;
  sidebarCollapsed?: boolean;
  /** The side pane starts closed (a DM: no doc to show). */
  documentHidden?: boolean;
  browser?: RoomLayoutBrowser;
};
export type RoomLayoutBrowser = {
  href(): string;
  state(): unknown;
  history: Pick<History, "pushState" | "replaceState" | "back">;
  storage: Pick<Storage, "getItem" | "setItem"> | null;
  schedule(callback: () => void, ms: number): unknown;
  cancel(handle: unknown): void;
  enqueue(callback: () => void): void;
};
