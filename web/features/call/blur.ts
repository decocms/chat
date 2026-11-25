// The camera with its background out of focus, as Meet and Discord do: a model finds the person in each frame
// (MediaPipe's multiclass selfie model, on this machine: no picture leaves the browser for it), and a canvas draws the
// frame out of focus with the person sharp over it. The canvas is what goes to the call.
import wasmLoaderPath from "@mediapipe/tasks-vision/vision_wasm_internal.js?url";
import wasmBinaryPath from "@mediapipe/tasks-vision/vision_wasm_internal.wasm?url";

/** How much the background is out of focus, in pixels of blur on a 720p frame. */
export const BLUR_LEVELS = { none: 0, light: 10, strong: 32 } as const;
export type Blur = keyof typeof BLUR_LEVELS;
const MODEL = "/vendor/mediapipe/selfie_multiclass_256x256.tflite";
const FRAME_MS = 1000 / 24;
// How much of the mask of the frame before stays in the new one (0: none).
const SMOOTH = 0.5;

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
  // The background at a quarter of the size: a blur there costs a sixteenth and looks the same once scaled up.
  const small = surface(Math.round(width / 4), Math.round(height / 4)),
    back = surface(small.canvas.width, small.canvas.height);
  let mask: ReturnType<typeof surface> | undefined,
    pixels: ImageData | undefined,
    // The mask of the frame before: each new mask is mixed with it, so the edge does not shake.
    kept: Float32Array | undefined,
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
      // One mask: how sure the model is that each point is the person. More: the first is the background.
      const masks = result.confidenceMasks ?? [],
        found = masks[0],
        inverted = masks.length > 1;
      if (found) {
        mask ??= surface(found.width, found.height);
        pixels ??= mask.context.createImageData(found.width, found.height);
        const sure = found.getAsFloat32Array();
        kept ??= new Float32Array(sure.length);
        for (let i = 0; i < sure.length; i++) {
          const person = inverted ? 1 - (sure[i] ?? 0) : (sure[i] ?? 0);
          const mixed = (kept[i] = kept[i]! * SMOOTH + person * (1 - SMOOTH));
          // A firm edge: below 0.3 is background, above 0.7 is the person, a short ramp between.
          const t = Math.min(1, Math.max(0, (mixed - 0.3) / 0.4));
          pixels.data[i * 4 + 3] = t * t * (3 - 2 * t) * 255;
        }
        mask.context.putImageData(pixels, 0, 0);
        // The person alone: the frame, kept only where the mask is, with a soft edge.
        person.context.globalCompositeOperation = "copy";
        person.context.filter = "none";
        person.context.drawImage(video, 0, 0, width, height);
        person.context.globalCompositeOperation = "destination-in";
        person.context.filter = "blur(2px)";
        person.context.drawImage(mask.canvas, 0, 0, width, height);
        // The background alone, small: the frame with the person (and a margin around them) cut out. Blurring it
        // without the person keeps their colors out of the background: no halo around them.
        const sw = small.canvas.width,
          sh = small.canvas.height,
          radius = blur / 4;
        small.context.globalCompositeOperation = "copy";
        small.context.filter = "none";
        small.context.drawImage(video, 0, 0, sw, sh);
        small.context.globalCompositeOperation = "destination-out";
        small.context.filter = "blur(2px)";
        small.context.drawImage(mask.canvas, 0, 0, sw, sh);
        small.context.drawImage(mask.canvas, 0, 0, sw, sh);
        // The blurred frame under it fills what the cut leaves, then the blurred background, drawn three times: each
        // pass makes its edge more opaque without changing its color.
        back.context.globalCompositeOperation = "copy";
        back.context.filter = `blur(${radius}px)`;
        back.context.drawImage(video, 0, 0, sw, sh);
        back.context.globalCompositeOperation = "source-over";
        for (let pass = 0; pass < 3; pass++)
          back.context.drawImage(small.canvas, 0, 0);
        out.context.filter = "none";
        out.context.imageSmoothingQuality = "high";
        out.context.drawImage(back.canvas, 0, 0, width, height);
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
