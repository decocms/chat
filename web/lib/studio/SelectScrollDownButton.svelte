<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";
  import Icon from "./Icon.svelte";
  import { cn } from "./utils";

  let {
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<
    SelectPrimitive.ScrollDownButtonProps,
    "child" | "children"
  > = $props();
</script>

<SelectPrimitive.ScrollDownButton
  bind:ref
  data-slot="select-scroll-down-button"
  class={cn("flex cursor-default items-center justify-center py-1", className)}
  {...rest}
>
  <Icon icon="chevron-down" class="size-4" />
</SelectPrimitive.ScrollDownButton>
