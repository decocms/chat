/** Holographic motion for the profile card, ported from holocard (src/client/HoloCard.tsx): the pointer (or the
 *  phone's tilt, after a tap grants it) sets a target angle, a spring eases toward it, and the angle drives where the
 *  foil and the glare shine. Only the custom properties in scripts/style-policy.ts HOLO_PROPERTIES are written. */
type Orientation = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = () =>
  matchMedia("(hover: hover) and (pointer: fine)").matches;

export function holo(card: HTMLElement) {
  let rx = 0,
    ry = 0,
    tx = 0,
    ty = 0,
    active = false,
    raf = 0,
    base: { beta: number; gamma: number } | null = null,
    listening = false;

  function light() {
    const x = Math.max(0, Math.min(100, 50 + (ry / 14) * 48));
    const y = Math.max(0, Math.min(100, 50 - (rx / 14) * 48));
    const strength = Math.min(1, (Math.abs(rx) + Math.abs(ry)) / 18);
    card.style.setProperty("--rx", `${rx.toFixed(3)}deg`);
    card.style.setProperty("--ry", `${ry.toFixed(3)}deg`);
    card.style.setProperty("--mx", `${x.toFixed(1)}%`);
    card.style.setProperty("--my", `${y.toFixed(1)}%`);
    card.style.setProperty("--posx", `${(20 + x * 0.6).toFixed(1)}%`);
    card.style.setProperty("--posy", `${(20 + y * 0.6).toFixed(1)}%`);
    card.style.setProperty(
      "--active",
      Math.max(strength, active ? 0.35 : 0).toFixed(2),
    );
  }
  function tick() {
    rx += (tx - rx) * 0.12;
    ry += (ty - ry) * 0.12;
    light();
    raf =
      Math.abs(tx - rx) > 0.02 || Math.abs(ty - ry) > 0.02
        ? requestAnimationFrame(tick)
        : 0;
  }
  function target(x: number, y: number, on = true) {
    tx = Math.max(-14, Math.min(14, x));
    ty = Math.max(-14, Math.min(14, y));
    active = on;
    raf ||= requestAnimationFrame(tick);
  }
  function move(e: PointerEvent) {
    if (reduced() || !finePointer()) return;
    const box = card.getBoundingClientRect();
    target(
      (0.5 - (e.clientY - box.top) / box.height) * 28,
      ((e.clientX - box.left) / box.width - 0.5) * 28,
    );
  }
  const leave = () => target(0, 0, false);
  function orient(e: DeviceOrientationEvent) {
    if (e.beta == null || e.gamma == null) return;
    base ??= { beta: e.beta, gamma: e.gamma };
    target(-(e.beta - base.beta) * 0.45, (e.gamma - base.gamma) * 0.45);
  }
  // Phones: tilt follows the gyroscope once a tap grants it (iOS asks; Android needs no prompt). Declined = static foil.
  async function tap() {
    if (listening || reduced() || finePointer()) return;
    const O = window.DeviceOrientationEvent as Orientation | undefined;
    if (!O) return;
    try {
      if (
        typeof O.requestPermission === "function" &&
        (await O.requestPermission()) !== "granted"
      )
        return;
      listening = true;
      addEventListener("deviceorientation", orient);
    } catch {
      // Permission refused or unavailable: the foil stays still.
    }
  }

  light();
  card.addEventListener("pointermove", move);
  card.addEventListener("pointerleave", leave);
  card.addEventListener("pointerdown", tap);
  return {
    destroy() {
      cancelAnimationFrame(raf);
      card.removeEventListener("pointermove", move);
      card.removeEventListener("pointerleave", leave);
      card.removeEventListener("pointerdown", tap);
      removeEventListener("deviceorientation", orient);
    },
  };
}
