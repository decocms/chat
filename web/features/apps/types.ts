import type { InfraWindow } from "../../../shared/schemas";
import type { Room } from "../../../shared/room";
import type { RequestRoomCommand } from "../../app/roomConnection";
import type { AppsApi } from "./api";
import type { AppsSession } from "./session";
import type { Readable } from "svelte/store";
import type { ConnectionMode } from "./directTypes";
export type AppBridgeModule = Pick<
  typeof import("./bridge"),
  "createRoomAppBridge" | "appToolInfo" | "remoteToolResult"
>;
export type AppsProps = {
  /** Put a prompt for your Claude in the composer (the empty tab's "Ask your Claude"). */
  ask?: (prompt: string) => void;
  owner: AppsSession;
  api: AppsApi;
  connectionModes?: Readable<ReadonlyMap<string, ConnectionMode>>;
  room: Room;
  request: RequestRoomCommand;
  current(): boolean;
  checkAccess(): void;
  name(email: string): string;
  ago(ts: number): string;
  t(text: string, vars?: Record<string, string | number>): string;
  lang: string;
  thread: string;
  openLink(url: string): void;
  metric(
    kind: "spend" | "router" | "infra",
    roomOnly: boolean,
    days?: InfraWindow,
  ): Promise<unknown>;
  putInDocument?(target: { connection: string; tool: string }): void;
  /** Explicit browser dependency seam; production keeps its existing lazy SDK import. */
  loadBridge?(): Promise<AppBridgeModule>;
};
