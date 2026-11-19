export type ComposerVoicePort = {
  transcribe(audio: Blob, signal: AbortSignal): Promise<string>;
  current(): boolean;
  beforeLeave(callback: () => void): () => void;
};
