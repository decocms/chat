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
    "tw:group/toggle-group tw:relative tw:flex tw:w-fit tw:items-center tw:rounded-full tw:[anchor-scope:--studio-toggle-active] tw:data-[variant=outline]:bg-card tw:data-[variant=outline]:after:pointer-events-none tw:data-[variant=outline]:after:absolute tw:data-[variant=outline]:after:inset-0 tw:data-[variant=outline]:after:rounded-full tw:data-[variant=outline]:after:shadow-edge tw:data-[variant=outline]:after:content-[''] tw:data-[variant=segmented]:gap-0.5 tw:data-[variant=segmented]:bg-muted tw:data-[variant=segmented]:p-0.5",
    className,
  )}
>
  {#if sliding}
    <!-- React measures the chosen item in JS and writes inline styles; here the pill is anchored to it in CSS. -->
    <span
      aria-hidden="true"
      data-slot="toggle-group-indicator"
      class="tw:pointer-events-none tw:absolute tw:top-0.5 tw:bottom-0.5 tw:left-[anchor(left)] tw:hidden tw:w-[anchor-size(width)] tw:rounded-full tw:bg-background tw:opacity-0 tw:shadow-[0_1px_2px_0_#0000000d] tw:transition-[left,width] tw:duration-200 tw:ease-[cubic-bezier(0.23,1,0.32,1)] tw:[position-anchor:--studio-toggle-active] tw:group-has-[>[data-slot=toggle-group-item][data-state=on]]/toggle-group:opacity-100 tw:motion-reduce:transition-none tw:supports-[anchor-scope:--a]:block tw:dark:bg-accent"
    ></span>
  {/if}
  {@render children?.()}
</ToggleGroupPrimitive.Root>
