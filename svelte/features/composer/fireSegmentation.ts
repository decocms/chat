/** Sampled microphone levels, not browser speech-recognition text, bound a
 * hands-free utterance. The caller owns the recorder and sampling clock. */
export function createFireSegmentation(now: number) {
  let voiced = false,
    last = now,
    start = now;
  return {
    sample(level: number, time: number) {
      if (!Number.isFinite(level) || !Number.isFinite(time)) return false;
      if (level > 0.02) {
        if (!voiced) start = time;
        voiced = true;
        last = time;
      }
      if (voiced && (time - last > 800 || time - start > 20000)) {
        voiced = false;
        return true;
      }
      return false;
    },
  };
}
