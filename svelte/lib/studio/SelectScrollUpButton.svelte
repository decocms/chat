<script lang="ts">
  import { Select as SelectPrimitive } from "bits-ui";
  import Icon from "./Icon.svelte";
  import { ChevronUp } from "./icons";
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
  class={cn(
    "tw:flex tw:cursor-default tw:items-center tw:justify-center tw:py-1",
    className,
  )}
  {...rest}
>
  <Icon icon={ChevronUp} class="tw:size-4" />
</SelectPrimitive.ScrollUpButton>
