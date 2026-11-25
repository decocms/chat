// The camera with its background out of focus, as Meet and Discord do: a model finds the person in each frame
// (MediaPipe's selfie segmenter, on this machine: no picture leaves the browser for it), and a canvas draws the
// frame out of focus with the person sharp over it. The canvas is what goes to the call.
import wasmLoaderPath from "@mediapipe/tasks-vision/vision_wasm_internal.js?url";
import wasmBinaryPath from "@mediapipe/tasks-vision/vision_wasm_internal.wasm?url";

/** How much the background is out of focus, in pixels of blur on a 720p frame. */
export const BLUR_LEVELS = { none: 0, light: 6, strong: 18 } as const;
export type Blur = keyof typeof BLUR_LEVELS;
const MODEL = "/vendor/mediapipe/selfie_segmenter.tflite";
const FRAME_MS = 1000 / 24;

const surface = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no 2d canvas");
  return { canvas, context };
};

/** `level` is read on each frame, so the person can change it while they look at the result. */
export async function blurCamera(source: MediaStream, level: () => Blur) {
  // Loaded only here: the model's runtime is large, and most people never turn the blur on.
  const { ImageSegmenter } = await import("@mediapipe/tasks-vision");
  const segmenter = await ImageSegmenter.createFromOptions(
    { wasmLoaderPath, wasmBinaryPath },
    {
      baseOptions: { modelAssetPath: MODEL, delegate: "GPU" },
      runningMode: "VIDEO",
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    },
  );
  const video = document.createElement("video");
  video.srcObject = source;
  video.muted = true;
  video.playsInline = true;
  await video.play();
  const width = video.videoWidth || 1280,
    height = video.videoHeight || 720;
  const out = surface(width, height),
    person = surface(width, height);
  let mask: ReturnType<typeof surface> | undefined,
    pixels: ImageData | undefined,
    timer: ReturnType<typeof setTimeout> | undefined,
    active = true;
  // ponytail: a timer on the page. In a tab that is not on show the browser slows it to one frame a second, so
  // the others see the camera almost still. A worker with MediaStreamTrackProcessor does not have that limit.
  function frame() {
    if (!active) return;
    const blur = BLUR_LEVELS[level()];
    if (!blur) out.context.drawImage(video, 0, 0, width, height);
    else {
      const result = segmenter.segmentForVideo(video, performance.now());
      // One mask: how sure the model is that each point is the person. Two: background, then person.
      const found = result.confidenceMasks?.at(-1);
      if (found) {
        mask ??= surface(found.width, found.height);
        pixels ??= mask.context.createImageData(found.width, found.height);
        const sure = found.getAsFloat32Array();
        for (let i = 0; i < sure.length; i++)
          pixels.data[i * 4 + 3] = (sure[i] ?? 0) * 255;
        mask.context.putImageData(pixels, 0, 0);
        // The person alone: the frame, kept only where the mask is. A little blur on the mask softens the edge.
        person.context.globalCompositeOperation = "copy";
        person.context.filter = "none";
        person.context.drawImage(video, 0, 0, width, height);
        person.context.globalCompositeOperation = "destination-in";
        person.context.filter = "blur(4px)";
        person.context.drawImage(mask.canvas, 0, 0, width, height);
        out.context.filter = `blur(${blur}px)`;
        out.context.drawImage(video, 0, 0, width, height);
        out.context.filter = "none";
        out.context.drawImage(person.canvas, 0, 0);
      }
      result.close();
    }
    timer = setTimeout(frame, FRAME_MS);
  }
  frame();
  return {
    stream: out.canvas.captureStream(24),
    stop() {
      active = false;
      clearTimeout(timer);
      video.srcObject = null;
      segmenter.close();
    },
  };
}
