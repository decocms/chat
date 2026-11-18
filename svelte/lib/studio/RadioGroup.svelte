<script lang="ts">
  import { RadioGroup as RadioGroupPrimitive } from "bits-ui";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `RadioGroup`; `defaultValue` is an initial `value`. */
  let {
    value = $bindable(""),
    ref = $bindable(null),
    class: className,
    children,
    ...rest
  }: Omit<RadioGroupPrimitive.RootProps, "class" | "style" | "child"> & {
    class?: string;
  } = $props();
</script>

<RadioGroupPrimitive.Root
  bind:value
  bind:ref
  data-slot="radio-group"
  {...rest}
  class={cn("grid gap-3", className)}
>
  {@render children?.()}
</RadioGroupPrimitive.Root>
