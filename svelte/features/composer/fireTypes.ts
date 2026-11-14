import type { FireBody, FireResult } from "../../../shared/schemas";
export type FireFile = Extract<FireResult, { mode: "file" }>["file"];
export type ComposerFirePort = {
  apply(body: FireBody, signal: AbortSignal): Promise<FireResult>;
  current(): boolean;
  currentFile(): { roomId: string; name: string; id: string } | null;
  openFile(file: FireFile): void;
  sessionLost(): void;
  denyMembership(): void;
  activity?(cardId: number | null, hot: boolean): void;
};
