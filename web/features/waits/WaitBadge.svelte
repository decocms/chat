<script lang="ts">
  import Count from "../../lib/components/Count.svelte";
  import { cn } from "../../lib/studio/utils";
  import { waitCount, type WaitReference } from "./model";
  import { RAIL_COUNT } from "../rooms/railBadges";
  /** What waits on you here, as one red number: asks, your Claude's questions and your tasks in review. */
  let {
    waits,
    label,
    solid = false,
    surface = "sidebar",
    rail = false,
    class: className = "",
  }: {
    waits: readonly WaitReference[];
    label: (count: number) => string;
    /** Ringed in the surface colour, for sitting on top of an avatar tile. */
    solid?: boolean;
    /** The colour behind the avatar the badge sits on. */
    surface?: "sidebar" | "background";
    /** On a rail tile: the smaller number (railBadges.ts). */
    rail?: boolean;
    class?: string;
  } = $props();
  const count = $derived(waitCount(waits));
  const ring = $derived(
    surface === "sidebar" ? "ring-2 ring-sidebar" : "ring-2 ring-background",
  );
</script>

{#if count}<span data-wait-badge class={cn("inline-flex shrink-0", className)}
    ><Count
      value={count}
      label={label(count)}
      class={cn(solid && ring, rail && RAIL_COUNT)}
    /></span
  >{/if}
