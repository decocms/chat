<script lang="ts">
  import type { ComponentProps } from "svelte";
  import Input from "./Input.svelte";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `SidebarInput`. */
  let {
    class: className,
    value = $bindable(),
    ref = $bindable(null),
    ...rest
  }: ComponentProps<typeof Input> = $props();
</script>

<Input
  bind:ref
  bind:value
  data-slot="sidebar-input"
  data-sidebar="input"
  class={cn("tw:bg-background tw:h-10 tw:w-full tw:shadow-none", className)}
  {...rest}
/>
