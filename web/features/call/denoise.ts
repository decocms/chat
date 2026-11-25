// The microphone with the noise around the person taken out, before it goes to the call: RNNoise (the model that
// Jitsi uses), on this machine, in an AudioWorklet. It catches what the browser's own noise suppression lets
// through: construction, a keyboard, a fan. Nothing of the audio goes to a server for this.
import {
  loadRnnoise,
  RnnoiseWorkletNode,
} from "@sapphi-red/web-noise-suppressor";
import workletPath from "@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url";
import wasmPath from "@sapphi-red/web-noise-suppressor/rnnoise.wasm?url";
import simdPath from "@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url";

// ponytail: one fixed gain, tuned with scripts/call-audio-test.ts; an automatic level if voices vary too much.
const GAIN = 2;

/** The cleaned track of `microphone`, and what stops the cleaning. The microphone itself is not stopped: muting it
 *  (track.enabled) still gives silence through here. */
export async function denoise(microphone: MediaStream) {
  // RNNoise works at 48 kHz only.
  const context = new AudioContext({ sampleRate: 48_000 });
  const [binary] = await Promise.all([
    loadRnnoise({ url: wasmPath, simdUrl: simdPath }),
    context.audioWorklet.addModule(workletPath),
  ]);
  const source = context.createMediaStreamSource(microphone);
  const node = new RnnoiseWorkletNode(context, {
    wasmBinary: binary,
    maxChannels: 1,
  });
  // RNNoise leaves the voice about 6 dB lower. The gain puts it back at the level of the raw microphone; the limiter
  // after it only touches the peaks, so a loud word does not clip and the quiet pauses stay quiet.
  const gain = new GainNode(context, { gain: GAIN });
  const limiter = new DynamicsCompressorNode(context, {
    threshold: -6,
    knee: 0,
    ratio: 20,
    attack: 0.001,
    release: 0.1,
  });
  const out = context.createMediaStreamDestination();
  source.connect(node).connect(gain).connect(limiter).connect(out);
  await context.resume();
  const [track] = out.stream.getAudioTracks();
  if (!track) throw new Error("no denoised track");
  return {
    track,
    stop() {
      source.disconnect();
      node.destroy();
      track.stop();
      void context.close().catch(() => {});
    },
  };
}
export type Denoiser = Awaited<ReturnType<typeof denoise>>;
