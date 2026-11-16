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
    "tw:flex tw:items-center tw:gap-2 tw:text-sm tw:leading-none tw:font-medium tw:select-none tw:group-data-[disabled=true]:pointer-events-none tw:group-data-[disabled=true]:opacity-50 tw:peer-disabled:cursor-not-allowed tw:peer-disabled:opacity-50",
    className,
  )}
>
  {@render children?.()}
</LabelPrimitive.Root>
