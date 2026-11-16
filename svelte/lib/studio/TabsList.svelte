<script lang="ts" module>
  const LIST = {
    pill: "tw:bg-muted tw:text-muted-foreground tw:inline-flex tw:h-9 tw:w-fit tw:items-center tw:justify-center tw:gap-1 tw:rounded-full tw:p-1",
    underline:
      "tw:flex tw:h-[52px] tw:items-center tw:border-b tw:border-border",
    canvas: "tw:flex tw:h-10 tw:items-center tw:bg-background",
  } as const;
  const TRACK = {
    pill: "tw:top-1 tw:bottom-1",
    underline: "tw:bottom-[-1px] tw:h-0.5",
  } as const;
  const THUMB = {
    pill: "tw:bg-background tw:shadow-[0_1px_2px_0_#0000000d] tw:dark:bg-input/30",
    underline: "tw:bg-primary",
  } as const;
  const ACTIVE = ':scope > [data-slot="tabs-trigger"][data-state="active"]';
  const SLIDE =
    "tw:transition-[width] tw:duration-200 tw:ease-[cubic-bezier(0.23,1,0.32,1)] tw:motion-reduce:transition-none";
</script>

<script lang="ts">
  import { Tabs as TabsPrimitive } from "bits-ui";
  import type { TabsVariant } from "./tabs";
  import { cn } from "./utils";

  let {
    ref = $bindable(null),
    variant,
    class: className,
    children,
    ...rest
  }: Omit<TabsPrimitive.ListProps, "style" | "class" | "child"> & {
    variant?: TabsVariant;
    class?: string;
  } = $props();

  const parentVariant = $derived(variant || "pill");
  let x = $state(0);
  let width = $state(0);
  let hasActive = $state(false);
  let ready = $state(false);

  $effect(() => {
    const container = ref;
    if (!container || parentVariant === "canvas") return;
    const update = () => {
      const active = container.querySelector<HTMLElement>(ACTIVE);
      x = active?.offsetLeft ?? 0;
      width = active?.offsetWidth ?? 0;
      hasActive = Boolean(active);
    };
    update();
    const frame = requestAnimationFrame(() => {
      ready = true;
    });
    const mutations = new MutationObserver(update);
    mutations.observe(container, {
      subtree: true,
      childList: true,
      attributeFilter: ["data-state"],
    });
    const resizes = new ResizeObserver(update);
    resizes.observe(container);
    return () => {
      cancelAnimationFrame(frame);
      mutations.disconnect();
      resizes.disconnect();
    };
  });
</script>

<TabsPrimitive.List
  bind:ref
  data-slot="tabs-list"
  data-variant={parentVariant}
  data-has-active={hasActive ? "" : undefined}
  data-ready={ready ? "" : undefined}
  {...rest}
  class={cn("tw:relative", LIST[parentVariant], className)}
>
  {#if parentVariant !== "canvas"}
    <!-- Inline styles are not allowed here, so the measured offset and width travel as SVG width attributes: a spacer, then the thumb. -->
    <span
      aria-hidden="true"
      data-slot="tabs-indicator"
      class={cn(
        "tw:pointer-events-none tw:absolute tw:left-0 tw:flex",
        TRACK[parentVariant],
      )}
    >
      <svg width={x} class={cn("tw:h-0 tw:shrink-0", ready && SLIDE)}></svg>
      <svg
        {width}
        class={cn(
          "tw:h-full tw:shrink-0 tw:rounded-full",
          THUMB[parentVariant],
          ready && SLIDE,
        )}
      ></svg>
    </span>
  {/if}
  {@render children?.()}
</TabsPrimitive.List>
