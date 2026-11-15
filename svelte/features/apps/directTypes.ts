import type { FetchLike } from "../../transport";
export class DirectCancelled extends Error {
  constructor() {
    super("App is no longer active");
  }
}
export type DirectSession = {
  call(name: string, args: unknown, signal: AbortSignal): Promise<unknown>;
  dispose(): void;
};
export type DirectSdkOptions = {
  url: string;
  identity(): string | null;
  current(): boolean;
  signal: AbortSignal;
  fetcher: FetchLike;
};
export type DirectSdkModule = {
  connectDirectSdk(options: DirectSdkOptions): Promise<DirectSession>;
};
export type ConnectionMode = "direct" | "proxy";
