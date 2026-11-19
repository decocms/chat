<script lang="ts">
  import { cn } from "../studio/utils";
  /**
   * A person's online dot, at the bottom right of their avatar (the room's
   * People list and the DM list). The parent is `relative`; `class` gives the
   * ring the colour of the surface behind it. With `label`, the dot is an
   * image that says "Name · Online".
   */
  let {
    online,
    label,
    class: className,
  }: { online: boolean; label?: string; class?: string } = $props();
</script>

<span
  role={label ? "img" : undefined}
  aria-label={label}
  data-status-dot={online ? "online" : "offline"}
  class={cn(
    "absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2",
    online ? "bg-brand" : "bg-subtle-foreground",
    className,
  )}
></span>
