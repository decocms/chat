<script lang="ts">
  import { cn } from "../../lib/studio/utils";
  /**
   * The mark on the rail's left edge beside a tile (along the bottom on the
   * phone row, below 901px), like Discord: a 3×24px foreground bar on the
   * current page, a small dot when the room has new messages (`human`: a person
   * wrote, in the foreground colour; `agent`: only agents wrote, muted). An idle
   * tile shows nothing. The parent tile must be `relative`.
   */
  let { state }: { state: "selected" | "human" | "agent" | "idle" } = $props();
</script>

{#if state === "selected"}<span
    aria-hidden="true"
    data-rail-pill={state}
    class="pointer-events-none absolute -bottom-2 left-1/2 h-[3px] w-6 -translate-x-1/2 rounded-t-full bg-foreground md:top-1/2 md:bottom-auto md:-left-4 md:h-6 md:w-[3px] md:translate-x-0 md:-translate-y-1/2 md:rounded-t-none md:rounded-r-full"
  ></span>{:else if state !== "idle"}<span
    aria-hidden="true"
    data-rail-pill={state}
    class={cn(
      "pointer-events-none absolute -bottom-2 left-1/2 h-[3px] w-2 -translate-x-1/2 rounded-t-full md:top-1/2 md:bottom-auto md:-left-4 md:h-2 md:w-1 md:translate-x-0 md:-translate-y-1/2 md:rounded-t-none md:rounded-r-full",
      state === "human" ? "bg-foreground" : "bg-muted-foreground",
    )}
  ></span>{/if}
