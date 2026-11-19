import { CUBE } from "./cubeShader";

// Draws the home's cube on a canvas with WebGL: it leans toward the pointer,
// sways a little, and turns once when clicked. Ported from the Studio prototype.
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

/** Starts drawing; returns a function that stops it and removes its listeners. No WebGL: draws nothing. */
export function mountCube(canvas: HTMLCanvasElement): () => void {
  const gl = canvas.getContext("webgl", {
    premultipliedAlpha: true,
    alpha: true,
  });
  if (!gl) return () => {};
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
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return () => {};
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
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
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
    twirl.goal +=
      (event.clientX >= box.left + box.width / 2 ? -1 : 1) * Math.PI * 2;
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
    const rotation = mul(mul(rotX(tilt.x), rotY(tilt.y)), mul(sway, CUBE.rest));
    const root = document.documentElement;
    const dark =
      root.classList.contains("dark") ||
      root.dataset.theme === "dark" ||
      (root.dataset.theme !== "light" &&
        !root.classList.contains("light") &&
        matchMedia("(prefers-color-scheme: dark)").matches);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(u("uRes"), canvas.width, canvas.height);
    gl.uniformMatrix3fv(u("uRot"), false, rotation);
    gl.uniform1f(u("uSpread"), 1);
    gl.uniform1f(u("uDark"), dark ? 1 : 0);
    gl.uniform1f(u("uTime"), still ? 0 : (now - started) / 1000);
    gl.uniform2f(u("uTrip"), 0, 1);
    gl.uniform1f(u("uScale"), 1);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  frame = requestAnimationFrame(draw);
  return stop;
}
