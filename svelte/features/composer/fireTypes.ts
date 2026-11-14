import type { PersonEvent } from "../../../shared/person";
export type FireReport = Extract<PersonEvent, { t: "fireState" }>;
export type ComposerFirePort = {
  set(on: boolean, signal: AbortSignal): Promise<void>;
  transcribe(
    audio: Blob,
    query: { lang: string; prompt: string },
    signal: AbortSignal,
  ): Promise<string>;
  current(): boolean;
  restore(signal: AbortSignal): Promise<void>;
  beforeLeave(callback: () => void): () => void;
  watch(callback: (report: FireReport) => void): () => void;
  sessionLost(): void;
  denyMembership(): void;
};
