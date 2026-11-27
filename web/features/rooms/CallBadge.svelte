<script lang="ts">
  import Icon from "../../lib/studio/Icon.svelte";
  import { cn } from "../../lib/studio/utils";
  import { RAIL_CALL_AT } from "./railBadges";
  /**
   * A call is on in the room (or in a room of a closed folder): a solid green
   * circle with a speaker, like Discord's voice badge. Ringed in the surface
   * colour, as the red number is. `corner`: "bottom" hangs off the bottom
   * right (the phone's big avatar, the red number stays top right); "top" sits
   * inside the top right corner, as on Discord's rail (railBadges.ts).
   */
  let {
    label,
    surface = "sidebar",
    corner = "bottom",
    class: className,
  }: {
    /** What it says to a screen reader: "Na call: Ana, Bia". */
    label: string;
    surface?: "sidebar" | "background";
    corner?: "bottom" | "top";
    class?: string;
  } = $props();
</script>

<span
  role="img"
  aria-label={label}
  data-room-badge="call"
  data-corner={corner}
  class={cn(
    "absolute flex size-4 items-center justify-center rounded-full bg-success text-success-foreground ring-2",
    surface === "sidebar" ? "ring-sidebar" : "ring-background",
    corner === "top" ? RAIL_CALL_AT : "-right-1.5 -bottom-1.5",
    className,
  )}><Icon icon="volume-max" size={10} stroke-width="2.5" /></span
>
