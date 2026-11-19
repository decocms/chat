/** One recorder's callbacks are scoped independently from the session stream.
 * A locked session starts its next recorder without reacquiring the microphone. */
export type FireCapture = {
  readonly type: string;
  start(
    chunk: (data: Blob) => void,
    ended: () => void,
    failed: () => void,
  ): void;
  observeLevel?(sample: (rms: number) => void, failed?: () => void): () => void;
  stop(): void;
  dispose(): void;
};
export type FireCaptureFactory = (() => Promise<FireCapture>) & {
  release?(): void;
};
type AudioStream = { getTracks(): readonly { stop(): void }[] };
type AudioRecorder = Pick<FireCapture, "type" | "start" | "stop" | "dispose">;
type AudioLevels = {
  resume(): Promise<boolean>;
  sample(): number;
  close(): Promise<void>;
};
/** Explicit browser effects. The generic stream/timer preserve actual
 * browser types without a DOM/global mock or type assertion in owner tests. */
export type FireAudioPorts<Stream extends AudioStream, Timer> = {
  stream(): Promise<Stream>;
  recorder(stream: Stream): AudioRecorder;
  levels(stream: Stream): AudioLevels;
  interval(run: () => void, ms: number): Timer;
  clearInterval(timer: Timer): void;
};
export function createFireCaptureFactory<Stream extends AudioStream, Timer>(
  ports: FireAudioPorts<Stream, Timer>,
): FireCaptureFactory {
  let epoch = 0,
    stream: Stream | null = null,
    opening: Promise<Stream> | null = null;
  let levels: AudioLevels | null = null,
    timer: Timer | undefined;
  const captures = new Set<FireCapture>();
  const observers = new Set<{
    sample(value: number): void;
    failed(): void;
    active: boolean;
  }>();
  function stopSampling() {
    if (timer !== undefined) ports.clearInterval(timer);
    timer = undefined;
  }
  function stopTracks(value: Stream) {
    for (const track of value.getTracks()) {
      try {
        track.stop();
      } catch {}
    }
  }
  function release() {
    epoch++;
    opening = null;
    stopSampling();
    const oldCaptures = [...captures];
    captures.clear();
    for (const observer of observers) observer.active = false;
    observers.clear();
    const oldLevels = levels;
    levels = null;
    const oldStream = stream;
    stream = null;
    for (const capture of oldCaptures) {
      try {
        capture.dispose();
      } catch {}
    }
    if (oldLevels) {
      try {
        void oldLevels.close().catch(() => {});
      } catch {}
    }
    if (oldStream) stopTracks(oldStream);
  }
  function failObservers(ticket: number) {
    if (ticket !== epoch) return;
    stopSampling();
    // Callbacks can synchronously release this entire pool or create another.
    for (const observer of [...observers]) {
      if (ticket !== epoch) break;
      if (observer.active) observer.failed();
    }
  }
  const factory: FireCaptureFactory = async () => {
    const ticket = epoch;
    if (!stream) {
      const request = (opening ??= ports.stream());
      let value: Stream;
      try {
        value = await request;
      } catch (error) {
        if (ticket === epoch && opening === request) opening = null;
        throw error;
      }
      if (ticket !== epoch) {
        if (value !== stream) stopTracks(value);
        throw Error("Released audio permission");
      }
      stream = value;
      if (opening === request) opening = null;
    }
    const ownedStream = stream;
    let recorder: AudioRecorder;
    try {
      recorder = ports.recorder(ownedStream);
    } catch (error) {
      if (!captures.size) release();
      throw error;
    }
    let active = true;
    const removers = new Set<() => void>();
    const current = () => active && ticket === epoch && stream === ownedStream;
    const capture: FireCapture = {
      get type() {
        return recorder.type;
      },
      start(chunk, ended, failed) {
        if (!current()) throw Error("Released audio capture");
        recorder.start(
          (data) => {
            if (current()) chunk(data);
          },
          () => {
            if (current()) ended();
          },
          () => {
            if (current()) failed();
          },
        );
      },
      observeLevel(sample, failed = () => {}) {
        if (!current()) return () => {};
        const observer = { sample, failed, active: true };
        observers.add(observer);
        const remove = () => {
          observer.active = false;
          observers.delete(observer);
          removers.delete(remove);
          if (!observers.size) stopSampling();
        };
        removers.add(remove);
        let source: AudioLevels;
        try {
          source = levels ??= ports.levels(ownedStream);
        } catch (error) {
          remove();
          throw error;
        }
        void source.resume().then(
          (running) => {
            if (!current() || !observer.active || source !== levels) return;
            if (!running) {
              failObservers(ticket);
              return;
            }
            if (timer !== undefined) return;
            timer = ports.interval(() => {
              if (ticket !== epoch || source !== levels || !observers.size)
                return;
              let value: number;
              try {
                value = source.sample();
              } catch {
                failObservers(ticket);
                return;
              }
              for (const item of [...observers]) {
                if (ticket !== epoch) break;
                if (item.active) item.sample(value);
              }
            }, 100);
          },
          () => {
            if (current() && observer.active) failObservers(ticket);
          },
        );
        return remove;
      },
      stop() {
        if (current()) recorder.stop();
      },
      dispose() {
        if (!active) return;
        active = false;
        captures.delete(capture);
        for (const remove of [...removers]) remove();
        recorder.dispose();
      },
    };
    captures.add(capture);
    return capture;
  };
  factory.release = release;
  return factory;
}
export function browserFireCapture(
  scope: Window & typeof globalThis,
): FireCaptureFactory | undefined {
  if (
    !scope.navigator.mediaDevices?.getUserMedia ||
    typeof scope.MediaRecorder !== "function"
  )
    return;
  return createFireCaptureFactory({
    stream: () => scope.navigator.mediaDevices.getUserMedia({ audio: true }),
    recorder(stream) {
      const recorder = new scope.MediaRecorder(stream);
      let disposed = false;
      return {
        get type() {
          return recorder.mimeType || "audio/webm";
        },
        start(chunk, ended, failed) {
          if (disposed) throw Error("Released audio capture");
          recorder.ondataavailable = (event) => {
            if (!disposed && event.data.size) chunk(event.data);
          };
          recorder.onstop = () => {
            if (!disposed) ended();
          };
          recorder.onerror = () => {
            if (!disposed) failed();
          };
          recorder.start(1000);
        },
        stop() {
          if (!disposed && recorder.state !== "inactive") recorder.stop();
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          recorder.ondataavailable = recorder.onstop = recorder.onerror = null;
          if (recorder.state !== "inactive") recorder.stop();
        },
      };
    },
    levels(stream) {
      const context = new scope.AudioContext();
      try {
        const analyser = context.createAnalyser(),
          source = context.createMediaStreamSource(stream),
          values = new Float32Array(1024);
        analyser.fftSize = 2048;
        source.connect(analyser);
        let closed = false;
        return {
          async resume() {
            if (closed) return false;
            if (context.state === "suspended") await context.resume();
            return !closed && context.state === "running";
          },
          sample() {
            analyser.getFloatTimeDomainData(values);
            let sum = 0;
            for (const value of values) sum += value * value;
            return Math.sqrt(sum / values.length);
          },
          async close() {
            if (closed) return;
            closed = true;
            try {
              source.disconnect();
              analyser.disconnect();
            } finally {
              await context.close();
            }
          },
        };
      } catch (error) {
        void context.close().catch(() => {});
        throw error;
      }
    },
    interval: (run, ms) => scope.setInterval(run, ms),
    clearInterval: (timer) => scope.clearInterval(timer),
  });
}
