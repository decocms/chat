<script lang="ts">
  import type { ComponentProps } from "svelte";
  import Separator from "./Separator.svelte";
  import { cn } from "./utils";

  let {
    ref = $bindable(null),
    orientation = "vertical",
    class: className,
    ...rest
  }: ComponentProps<typeof Separator> = $props();
</script>

<Separator
  bind:ref
  data-slot="button-group-separator"
  {orientation}
  {...rest}
  class={cn(
    "tw:bg-input tw:relative tw:!m-0 tw:self-stretch tw:data-[orientation=vertical]:h-auto",
    className,
  )}
/>
