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
      "font-sans z-50 w-fit origin-(--bits-tooltip-content-transform-origin) animate-in rounded-lg bg-foreground px-2 py-1 text-xs font-medium text-balance text-background [--tw-enter-opacity:0] [--tw-enter-scale:.95] data-[side=bottom]:[--tw-enter-translate-y:-0.5rem] data-[side=left]:[--tw-enter-translate-x:0.5rem] data-[side=right]:[--tw-enter-translate-x:-0.5rem] data-[side=top]:[--tw-enter-translate-y:0.5rem] data-[state=closed]:hidden motion-reduce:[animation-duration:0.01ms]",
      // Handing off within the shared provider: the next tooltip appears in place.
      "data-[state=instant-open]:animate-none",
      className,
    )}
  >
    {@render children?.()}
    <TooltipPrimitive.Arrow>
      {#snippet child({ props })}
        <span {...props}>
          <svg
            class="z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px] bg-foreground fill-foreground"
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
