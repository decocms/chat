<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";
  import Icon from "./Icon.svelte";
  import { cn } from "./utils";

  let {
    class: className,
    ref = $bindable(null),
    ...rest
  }: Omit<SelectPrimitive.ScrollUpButtonProps, "child" | "children"> = $props();
</script>

<SelectPrimitive.ScrollUpButton
  bind:ref
  data-slot="select-scroll-up-button"
  class={cn("flex cursor-default items-center justify-center py-1", className)}
  {...rest}
>
  <Icon icon="chevron-up" class="size-4" />
</SelectPrimitive.ScrollUpButton>
