<script lang="ts">
  import { mountRailCube, type RailCube } from "./cube";
  /**
   * The rail's home mark: the agent's cube, small. It stands still, and turns
   * slowly while `working` (an agent is busy in one of your rooms). Reduced
   * motion keeps it still. The canvas is a little larger than the 36px tile:
   * the shader leaves room around the cube, so this way it fills the tile.
   */
  let { working = false }: { working?: boolean } = $props();
  let canvas = $state<HTMLCanvasElement | null>(null),
    cube = $state<RailCube | null>(null);
  $effect(() => {
    if (!canvas) return;
    canvas.width = canvas.height = Math.round(
      36 * (globalThis.devicePixelRatio || 1),
    );
    const mounted = mountRailCube(canvas);
    cube = mounted;
    return () => {
      mounted.stop();
      cube = null;
    };
  });
  $effect(() => {
    cube?.spin(working);
  });
</script>

<canvas
  bind:this={canvas}
  data-rail-cube
  data-working={working ? "" : undefined}
  aria-hidden="true"
  class="pointer-events-none absolute -inset-1.5 size-12 max-w-none"
></canvas>
