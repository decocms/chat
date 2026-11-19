<script lang="ts">
  import type { ComponentProps } from "svelte";
  import Button from "./Button.svelte";
  import Tooltip from "./Tooltip.svelte";
  import TooltipContent from "./TooltipContent.svelte";
  import TooltipTrigger from "./TooltipTrigger.svelte";

  /** An icon-only button that always explains itself: `label` is both the tooltip and the accessible name. */
  let {
    label,
    tooltipSide = "top",
    variant = "ghost",
    size = "icon-sm",
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<ComponentProps<typeof Button>, "aria-label"> & {
    /** What the button does, as a person would say it. */
    label: string;
    /** Where the tooltip opens; defaults to above. */
    tooltipSide?: ComponentProps<typeof TooltipContent>["side"];
  } = $props();
</script>

<Tooltip>
  <TooltipTrigger>
    {#snippet child({ props })}
      <Button
        bind:ref
        {...props}
        data-slot="icon-button"
        aria-label={label}
        {variant}
        {size}
        {...rest}>{@render children?.()}</Button
      >
    {/snippet}
  </TooltipTrigger>
  <TooltipContent side={tooltipSide}>{label}</TooltipContent>
</Tooltip>
