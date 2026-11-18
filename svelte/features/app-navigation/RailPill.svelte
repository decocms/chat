<script lang="ts">
  /**
   * The current page's mark beside a rail tile: a 3×24px foreground bar on the
   * rail's left edge (along the bottom on the phone row, below 901px). An idle
   * tile shows nothing. The parent tile must be `relative`.
   */
  let { state }: { state: "selected" | "idle" } = $props();
</script>

{#if state === "selected"}<span
    aria-hidden="true"
    data-rail-pill={state}
    class="pointer-events-none absolute -bottom-2 left-1/2 h-[3px] w-6 -translate-x-1/2 rounded-t-full bg-foreground md:top-1/2 md:bottom-auto md:-left-4 md:h-6 md:w-[3px] md:translate-x-0 md:-translate-y-1/2 md:rounded-t-none md:rounded-r-full"
  ></span>{/if}
