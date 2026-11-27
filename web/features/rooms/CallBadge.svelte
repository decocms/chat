<script lang="ts">
  import Icon from "../../lib/studio/Icon.svelte";
  import { cn } from "../../lib/studio/utils";
  /**
   * A call is on in the room (or in a room of a closed folder): a solid green
   * circle with a speaker, at the bottom right of the tile, like Discord's
   * voice badge. Ringed in the surface colour, as the red number is.
   */
  let {
    label,
    surface = "sidebar",
    class: className,
  }: {
    /** What it says to a screen reader: "Na call: Ana, Bia". */
    label: string;
    surface?: "sidebar" | "background";
    class?: string;
  } = $props();
</script>

<span
  role="img"
  aria-label={label}
  data-room-badge="call"
  class={cn(
    "absolute -right-1.5 -bottom-1.5 flex size-4 items-center justify-center rounded-full bg-success text-success-foreground ring-2",
    surface === "sidebar" ? "ring-sidebar" : "ring-background",
    className,
  )}><Icon icon="volume-max" size={10} stroke-width="2.5" /></span
>
