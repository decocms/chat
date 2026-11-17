<script lang="ts">
  import { Tooltip as TooltipPrimitive } from "bits-ui";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `TooltipContent`: portalled, with the arrow built in. */
  let {
    sideOffset = 0,
    class: className,
    ref = $bindable(null),
    children,
    ...rest
  }: Omit<TooltipPrimitive.ContentProps, "style" | "class" | "child"> & {
    class?: string;
  } = $props();
</script>

<TooltipPrimitive.Portal>
  <TooltipPrimitive.Content
    bind:ref
    data-slot="tooltip-content"
    {sideOffset}
    role="tooltip"
    translate="no"
    {...rest}
    class={cn(
      "tw:font-sans tw:z-50 tw:w-fit tw:origin-(--bits-tooltip-content-transform-origin) tw:animate-in tw:rounded-lg tw:bg-foreground tw:px-2 tw:py-1 tw:text-xs tw:font-medium tw:text-balance tw:text-background tw:[--tw-enter-opacity:0] tw:[--tw-enter-scale:.95] tw:data-[side=bottom]:[--tw-enter-translate-y:-0.5rem] tw:data-[side=left]:[--tw-enter-translate-x:0.5rem] tw:data-[side=right]:[--tw-enter-translate-x:-0.5rem] tw:data-[side=top]:[--tw-enter-translate-y:0.5rem] tw:data-[state=closed]:hidden tw:motion-reduce:[animation-duration:0.01ms]",
      className,
    )}
  >
    {@render children?.()}
    <TooltipPrimitive.Arrow>
      {#snippet child({ props })}
        <span {...props}>
          <svg
            class="tw:z-50 tw:size-2.5 tw:translate-y-[calc(-50%_-_2px)] tw:rotate-45 tw:rounded-[2px] tw:bg-foreground tw:fill-foreground"
            width="10"
            height="5"
            viewBox="0 0 30 10"
            preserveAspectRatio="none"
          >
            <polygon points="0,0 30,0 15,10" />
          </svg>
        </span>
      {/snippet}
    </TooltipPrimitive.Arrow>
  </TooltipPrimitive.Content>
</TooltipPrimitive.Portal>
