import { readable } from "svelte/store";
import { CUBE } from "./cubeShader";

// Draws the agent's cube on a canvas with WebGL. The home's big cube leans
// toward the pointer, sways a little, and turns once when clicked (mountCube);
// the rail's small one stands still and turns slowly while an agent works
// (mountRailCube). Ported from the Studio prototype.
const VERTEX =
  "attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }";
type Matrix = readonly number[];
const mul = (a: Matrix, b: Matrix): number[] =>
  [0, 1, 2].flatMap((r) =>
    [0, 1, 2].map(
      (c) =>
        a[r * 3]! * b[c]! +
        a[r * 3 + 1]! * b[3 + c]! +
        a[r * 3 + 2]! * b[6 + c]!,
    ),
  );
const rotX = (t: number) => [
  1,
  0,
  0,
  0,
  Math.cos(t),
  -Math.sin(t),
  0,
  Math.sin(t),
  Math.cos(t),
];
const rotY = (t: number) => [
  Math.cos(t),
  0,
  Math.sin(t),
  0,
  1,
  0,
  -Math.sin(t),
  0,
  Math.cos(t),
];
const TURN = Math.PI * 2;
const reducedMotion = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches;
function darkTheme() {
  const root = document.documentElement;
  return (
    root.classList.contains("dark") ||
    root.dataset.theme === "dark" ||
    (root.dataset.theme !== "light" &&
      !root.classList.contains("light") &&
      matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

type Paint = (rotation: Matrix, seconds: number, dark?: boolean) => void;
/** Compiles the cube's shader on the canvas; null without WebGL. */
function cubePainter(canvas: HTMLCanvasElement): Paint | null {
  const gl = canvas.getContext("webgl", {
    premultipliedAlpha: true,
    alpha: true,
  });
  if (!gl) return null;
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, CUBE.fragment));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const at = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(at);
  gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
  const u = (name: string) => gl.getUniformLocation(program, name);
  return (rotation, seconds, dark = darkTheme()) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u("uRes"), canvas.width, canvas.height);
    gl.uniformMatrix3fv(u("uRot"), false, rotation);
    gl.uniform1f(u("uSpread"), 1);
    gl.uniform1f(u("uDark"), dark ? 1 : 0);
    gl.uniform1f(u("uTime"), seconds);
    gl.uniform2f(u("uTrip"), 0, 1);
    gl.uniform1f(u("uScale"), 1);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
}

/** Starts drawing; returns a function that stops it and removes its listeners. No WebGL: draws nothing. */
export function mountCube(canvas: HTMLCanvasElement): () => void {
  const paint = cubePainter(canvas);
  if (!paint) return () => {};
  const still = reducedMotion();
  const pointer = { x: innerWidth / 2, y: innerHeight / 2 },
    tilt = { x: 0, y: 0 },
    twirl = { angle: 0, goal: 0 };
  const onMove = (event: PointerEvent) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
  };
  // A click turns it once, away from the side that was pressed; clicks add up.
  const onClick = (event: MouseEvent) => {
    if (still) return;
    const box = canvas.getBoundingClientRect();
    twirl.goal += (event.clientX >= box.left + box.width / 2 ? -1 : 1) * TURN;
  };
  addEventListener("pointermove", onMove, { passive: true });
  canvas.addEventListener("click", onClick);
  const started = performance.now();
  let frame = 0,
    last = started;
  const stop = () => {
    cancelAnimationFrame(frame);
    removeEventListener("pointermove", onMove);
    canvas.removeEventListener("click", onClick);
  };
  const draw = (now: number) => {
    frame = requestAnimationFrame(draw);
    if (!canvas.isConnected) return stop();
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const box = canvas.getBoundingClientRect();
    const dx = Math.max(
      -1,
      Math.min(1, (pointer.x - box.left - box.width / 2) / (innerWidth / 2)),
    );
    const dy = Math.max(
      -1,
      Math.min(1, (pointer.y - box.top - box.height / 2) / (innerHeight / 2)),
    );
    const k = 1 - Math.exp(-dt * 5),
      amp = still ? 0 : (CUBE.tilt * Math.PI) / 180;
    tilt.x += (dy * amp - tilt.x) * k;
    tilt.y += (dx * amp - tilt.y) * k;
    twirl.angle += (twirl.goal - twirl.angle) * (1 - Math.exp(-dt * 5.5));
    if (Math.abs(twirl.goal - twirl.angle) < 0.002)
      twirl.angle = twirl.goal = 0;
    const sway = rotY((still ? 0 : Math.sin(now / 2000) * 0.105) + twirl.angle);
    paint(
      mul(mul(rotX(tilt.x), rotY(tilt.y)), mul(sway, CUBE.rest)),
      still ? 0 : (now - started) / 1000,
    );
  };
  frame = requestAnimationFrame(draw);
  return stop;
}

export type RailCube = {
  /** Turning slowly while true; when it goes false the cube finishes its turn and rests. */
  spin(on: boolean): void;
  stop(): void;
};
/** The rail's small cube: one frame at rest, frames only while it turns (never with reduced motion). */
export function mountRailCube(canvas: HTMLCanvasElement): RailCube {
  const paint = cubePainter(canvas);
  if (!paint) return { spin() {}, stop() {} };
  const SPEED = TURN / 6; // one turn every 6 s
  let angle = 0,
    spinning = false,
    frame = 0,
    last = 0;
  const render = () => paint(mul(rotY(angle), CUBE.rest), 0);
  const draw = (now: number) => {
    frame = 0;
    if (!canvas.isConnected) return;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    angle += SPEED * dt;
    // Stopping finishes the turn it is in, so the cube rests in its pose.
    if (!spinning && angle >= TURN) {
      angle = 0;
      last = 0;
      return render();
    }
    render();
    frame = requestAnimationFrame(draw);
  };
  const run = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };
  // The cube's colours follow the theme: a still cube repaints when it changes.
  const scheme = matchMedia("(prefers-color-scheme: dark)");
  const repaint = () => {
    if (!frame) render();
  };
  const observer = new MutationObserver(repaint);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme"],
  });
  scheme.addEventListener("change", repaint);
  render();
  return {
    spin(on) {
      spinning = on && !reducedMotion();
      if (spinning) run();
    },
    stop() {
      cancelAnimationFrame(frame);
      frame = 0;
      observer.disconnect();
      scheme.removeEventListener("change", repaint);
    },
  };
}

// @vibe's face: the rail's cube at rest, drawn once per theme on one shared
// canvas and handed out as a picture. A WebGL context per avatar would run out
// fast in a long channel (browsers keep about sixteen); a picture costs nothing.
const PICTURE_PX = 96;
let pictureCanvas: HTMLCanvasElement | null = null,
  picturePaint: Paint | null | undefined;
const pictures = new Map<boolean, string | null>();
/** The cube at rest as a PNG data URL for the theme; null without WebGL. */
function cubePicture(dark: boolean): string | null {
  const cached = pictures.get(dark);
  if (cached !== undefined) return cached;
  if (picturePaint === undefined) {
    pictureCanvas = document.createElement("canvas");
    pictureCanvas.width = pictureCanvas.height = PICTURE_PX;
    picturePaint = cubePainter(pictureCanvas);
  }
  let url: string | null = null;
  if (picturePaint && pictureCanvas) {
    picturePaint(CUBE.rest, 0, dark);
    url = pictureCanvas.toDataURL("image/png");
  }
  pictures.set(dark, url);
  return url;
}
/** @vibe's cube picture for the current theme (null without WebGL or a DOM); follows theme changes. */
export const vibeCube = readable<string | null>(null, (set) => {
  if (typeof document === "undefined" || typeof matchMedia !== "function")
    return;
  const update = () => set(cubePicture(darkTheme()));
  update();
  const scheme = matchMedia("(prefers-color-scheme: dark)");
  const observer = new MutationObserver(update);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-theme"],
  });
  scheme.addEventListener("change", update);
  return () => {
    observer.disconnect();
    scheme.removeEventListener("change", update);
  };
});
