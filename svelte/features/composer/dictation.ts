import {
  createSpeechController,
  type SpeechClock,
  type SpeechFactory,
  type SpeechKey,
} from "./speech";
import type { FireCapture, FireCaptureFactory } from "./fireAudio";
import { STT_AUDIO_MAX } from "../../../shared/schemas";

/** Ordinary dictation only: preview and refinement edit one draft, never send. */
export function createDictationController(options: {
  factory?: SpeechFactory;
  capture?: FireCaptureFactory;
  transcribe?(audio: Blob, signal: AbortSignal): Promise<string>;
  clock: SpeechClock;
  locale: string;
  coarse?(): boolean;
  read(): { text: string; start: number; end: number; revision: number };
  write(text: string, caret?: number): void;
  current(): boolean;
  canStart(): boolean;
  recording(value: boolean): void;
  refining(value: boolean): void;
  error(value: string): void;
  ended(): void;
}) {
  const usesAudio = !!options.capture && !!options.transcribe;
  let active = true,
    generation = 0,
    capture: FireCapture | null = null,
    pending = false,
    recording = false,
    controller: AbortController | null = null,
    timer: unknown,
    expectedRevision = 0;
  const current = (ticket: number) =>
    active && ticket === generation && options.current();
  function clearTimer() {
    if (timer !== undefined) options.clock.cancel(timer);
    timer = undefined;
  }
  function release() {
    const old = capture;
    capture = null;
    // Revoke the pool before any synchronous native stop callbacks.
    try {
      options.capture?.release?.();
    } catch {}
    try {
      old?.dispose();
    } catch {}
  }
  function cancel() {
    generation++;
    pending = recording = false;
    clearTimer();
    controller?.abort();
    controller = null;
    preview.cancel();
    release();
    options.recording(false);
    options.refining(false);
  }
  const preview = createSpeechController({
    factory: options.factory,
    locale: options.locale,
    coarse: options.coarse,
    clock: options.clock,
    read: options.read,
    write: (text, caret) => {
      options.write(text, caret);
      expectedRevision = options.read().revision;
    },
    canStart: () => active && options.current() && options.canStart(),
    recording: (value) => {
      if (!usesAudio) {
        recording = value;
        options.recording(value);
      }
    },
    error: (value) => {
      if (!usesAudio) options.error(value);
    },
    ended: () => {
      if (!usesAudio) options.ended();
    },
    canHold: () => usesAudio && options.canStart(),
    heldStart: () => {
      start();
      return true;
    },
    heldRelease: stop,
  });
  async function start() {
    if (!active || pending || recording || !options.canStart()) return;
    cancel();
    const ticket = generation,
      base = options.read();
    expectedRevision = base.revision;
    const ownsDraft = () => {
      const valid =
        current(ticket) && options.read().revision === expectedRevision;
      if (!valid && active && ticket === generation) cancel();
      return valid;
    };
    options.error("");
    if (!ownsDraft()) return;
    const transcribe = options.transcribe;
    if (!options.capture || !transcribe) {
      preview.start();
      return;
    }
    pending = true;
    timer = options.clock.schedule(() => {
      if (current(ticket)) {
        cancel();
        options.error("failed");
      }
    }, 20_000);
    try {
      const opened = await options.capture();
      if (!ownsDraft() || !pending) {
        opened.dispose();
        return;
      }
      clearTimer();
      pending = false;
      capture = opened;
      recording = true;
      options.recording(true);
      if (!ownsDraft() || capture !== opened) return;
      const chunks: Blob[] = [];
      let bytes = 0;
      opened.start(
        (chunk) => {
          if (!ownsDraft() || capture !== opened) return;
          bytes += chunk.size;
          if (bytes > STT_AUDIO_MAX) {
            cancel();
            options.error("failed");
            return;
          }
          chunks.push(chunk);
        },
        () => {
          if (!ownsDraft() || capture !== opened) return;
          clearTimer();
          recording = false;
          preview.cancel();
          options.recording(false);
          if (!ownsDraft() || capture !== opened) return;
          const blob = new Blob(chunks, { type: opened.type || "audio/webm" });
          release();
          if (blob.size < 2000) {
            options.ended();
            return;
          }
          const request = new AbortController();
          controller = request;
          options.refining(true);
          timer = options.clock.schedule(() => {
            if (current(ticket)) {
              cancel();
              options.error("failed");
            }
          }, 20_000);
          void Promise.resolve()
            .then(() => {
              if (!ownsDraft() || request.signal.aborted)
                throw Error("Released dictation");
              return transcribe(blob, request.signal);
            })
            .then(
              (text) => {
                if (
                  !ownsDraft() ||
                  request.signal.aborted ||
                  controller !== request
                )
                  return;
                const said = text.trim();
                if (said) {
                  const joined =
                    base.text +
                    (base.text && !/\s$/.test(base.text) ? " " : "") +
                    said;
                  options.write(joined, joined.length);
                  expectedRevision = options.read().revision;
                }
              },
              () => {
                if (ownsDraft() && !request.signal.aborted)
                  options.error("failed");
              },
            )
            .finally(() => {
              if (!current(ticket) || controller !== request) return;
              clearTimer();
              controller = null;
              options.refining(false);
              options.ended();
            });
        },
        () => {
          if (current(ticket)) {
            cancel();
            options.error("failed");
          }
        },
      );
      if (ownsDraft() && capture === opened) preview.start();
    } catch {
      if (current(ticket)) {
        cancel();
        options.error("not-allowed");
      }
    }
  }
  function stop() {
    if (!usesAudio) {
      preview.stop();
      return;
    }
    // Freeze the last preview at release. Late SR final events cannot race
    // Whisper or overwrite a newer draft; the same audio is authoritative.
    preview.cancel();
    if (pending) {
      cancel();
      return;
    }
    if (!recording) return;
    const ticket = generation,
      opened = capture;
    recording = false;
    options.recording(false);
    if (!current(ticket) || capture !== opened) return;
    if (!opened) {
      options.ended();
      return;
    }
    timer = options.clock.schedule(() => {
      if (current(ticket)) {
        cancel();
        options.error("failed");
      }
    }, 5000);
    try {
      opened.stop();
    } catch {
      cancel();
      options.error("failed");
    }
  }
  return {
    supported: !!options.factory || (!!options.capture && !!options.transcribe),
    start,
    stop,
    cancel,
    sync() {
      if (
        !options.current() ||
        ((pending || recording || capture || controller) &&
          options.read().revision !== expectedRevision)
      )
        cancel();
    },
    keydown: (event: SpeechKey) => preview.keydown(event),
    keyup: (event: Pick<SpeechKey, "key">) => preview.keyup(event),
    dispose() {
      active = false;
      cancel();
      preview.dispose();
    },
  };
}
