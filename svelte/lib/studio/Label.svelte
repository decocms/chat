<script lang="ts">
  import { Label as LabelPrimitive } from "bits-ui";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `Label`; `htmlFor` is the native `for`. */
  let {
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<LabelPrimitive.RootProps, "class" | "style" | "child"> & {
    class?: string;
  } = $props();
</script>

<LabelPrimitive.Root
  bind:ref
  data-slot="label"
  {...rest}
  class={cn(
    "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
    className,
  )}
>
  {@render children?.()}
</LabelPrimitive.Root>
