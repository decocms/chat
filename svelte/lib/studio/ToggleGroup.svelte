<script lang="ts">
  import { ToggleGroup as ToggleGroupPrimitive } from "bits-ui";
  import type { ToggleVariants } from "./toggle";
  import { setToggleGroupContext } from "./toggle-group";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `ToggleGroup`. `bind:value` replaces Radix's `defaultValue`/`value` pair. */
  let {
    variant,
    size,
    type,
    value = $bindable(),
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<ToggleGroupPrimitive.RootProps, "style" | "class" | "child"> &
    ToggleVariants & { class?: string } = $props();

  // The single/multiple union cannot be spread back after destructuring, so `value` and `type` are cast where they are passed on.
  setToggleGroupContext(() => ({ variant, size }));
  // A single-choice segmented control slides one pill between its options.
  const sliding = $derived(variant === "segmented" && type === "single");
  // Typed loosely on the way through: the primitive's prop union is too large for TypeScript to re-check after a spread.
  const passthrough = $derived<Record<string, unknown>>(rest);
</script>

<ToggleGroupPrimitive.Root
  bind:ref
  bind:value={value as never}
  type={type as never}
  data-slot="toggle-group"
  data-variant={variant}
  data-size={size}
  data-sliding={sliding || undefined}
  {...passthrough}
  class={cn(
    "group/toggle-group relative flex w-fit items-center rounded-full [anchor-scope:--studio-toggle-active] data-[variant=outline]:bg-card data-[variant=outline]:after:pointer-events-none data-[variant=outline]:after:absolute data-[variant=outline]:after:inset-0 data-[variant=outline]:after:rounded-full data-[variant=outline]:after:shadow-edge data-[variant=outline]:after:content-[''] data-[variant=segmented]:gap-0.5 data-[variant=segmented]:bg-muted data-[variant=segmented]:p-0.5",
    className,
  )}
>
  {#if sliding}
    <!-- React measures the chosen item in JS and writes inline styles; here the pill is anchored to it in CSS. -->
    <span
      aria-hidden="true"
      data-slot="toggle-group-indicator"
      class="pointer-events-none absolute top-0.5 bottom-0.5 left-[anchor(left)] hidden w-[anchor-size(width)] rounded-full bg-background opacity-0 shadow-[0_1px_2px_0_#0000000d] transition-[left,width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [position-anchor:--studio-toggle-active] group-has-[>[data-slot=toggle-group-item][data-state=on]]/toggle-group:opacity-100 motion-reduce:transition-none supports-[anchor-scope:--a]:block dark:bg-accent"
    ></span>
  {/if}
  {@render children?.()}
</ToggleGroupPrimitive.Root>
