<script lang="ts" module>
  const LIST = {
    pill: "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center gap-1 rounded-full p-1",
    underline: "flex h-[52px] items-center border-b border-border",
    canvas: "flex h-10 items-center bg-background",
  } as const;
  const TRACK = {
    pill: "top-1 bottom-1",
    underline: "bottom-[-1px] h-0.5",
  } as const;
  const THUMB = {
    pill: "bg-background shadow-[0_1px_2px_0_#0000000d] dark:bg-input/30",
    underline: "bg-primary",
  } as const;
  const ACTIVE = ':scope > [data-slot="tabs-trigger"][data-state="active"]';
  const SLIDE =
    "transition-[width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none";
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
  class={cn("relative", LIST[parentVariant], className)}
>
  {#if parentVariant !== "canvas"}
    <!-- Inline styles are not allowed here, so the measured offset and width travel as SVG width attributes: a spacer, then the thumb. -->
    <span
      aria-hidden="true"
      data-slot="tabs-indicator"
      class={cn(
        "pointer-events-none absolute left-0 flex",
        TRACK[parentVariant],
      )}
    >
      <svg width={x} class={cn("h-0 shrink-0", ready && SLIDE)}></svg>
      <svg
        {width}
        class={cn(
          "h-full shrink-0 rounded-full",
          THUMB[parentVariant],
          ready && SLIDE,
        )}
      ></svg>
    </span>
  {/if}
  {@render children?.()}
</TabsPrimitive.List>
