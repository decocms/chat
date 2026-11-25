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
  const out = context.createMediaStreamDestination();
  source.connect(node).connect(out);
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
