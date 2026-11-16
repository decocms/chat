<script lang="ts">
  import type { ComponentProps } from "svelte";
  import Card from "./Card.svelte";
  import { cn } from "./utils";

  /** One thing you open from a grid: a project, a connection, an app. */
  let {
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<ComponentProps<typeof Card>, "size" | "interactive"> = $props();
</script>

<Card
  bind:ref
  data-slot="entity-card"
  size="tile"
  interactive={Boolean(rest.onclick) || Boolean(rest.child)}
  class={cn("tw:min-w-0", className)}
  {...rest}
/>
