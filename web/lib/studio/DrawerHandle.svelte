<script lang="ts">
  import type { HTMLButtonAttributes } from "svelte/elements";
  import { cn } from "./utils";

  /** The grab bar of a phone drawer: a tap closes it, a drag on the drawer moves it. */
  let {
    class: className,
    label,
    ...rest
  }: HTMLButtonAttributes & { label: string } = $props();
</script>

<button
  type="button"
  aria-label={label}
  data-drawer-handle
  class={cn(
    "flex w-full shrink-0 cursor-pointer touch-none items-center justify-center border-0 bg-transparent py-2",
    className,
  )}
  {...rest}><span class="h-1 w-10 rounded-full bg-border"></span></button
>
