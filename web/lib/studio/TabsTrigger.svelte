<script lang="ts" module>
  const TRIGGER = {
    pill: "relative z-10 data-[state=active]:text-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 text-muted-foreground inline-flex h-7 flex-1 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    underline:
      "relative z-10 flex items-center h-full px-3 text-sm whitespace-nowrap transition-colors text-muted-foreground hover:text-foreground data-[state=active]:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
    canvas:
      "flex items-center h-full px-3 gap-2.5 text-sm whitespace-nowrap transition-all border-r border-b border-border [&>*]:opacity-50 data-[state=active]:[&>*]:opacity-100 data-[state=active]:border-b-0 last:border-r-0 disabled:pointer-events-none max-w-2xs",
  } as const;
</script>

<script lang="ts">
  import { Tabs as TabsPrimitive } from "bits-ui";
  import type { TabsVariant } from "./tabs";
  import { cn } from "./utils";

  let {
    ref = $bindable(null),
    variant,
    class: className,
    ...rest
  }: Omit<TabsPrimitive.TriggerProps, "style" | "class"> & {
    variant?: TabsVariant;
    class?: string;
  } = $props();

  const parentVariant = $derived(variant || "pill");
</script>

<TabsPrimitive.Trigger
  bind:ref
  data-slot="tabs-trigger"
  data-variant={parentVariant}
  {...rest}
  class={cn(
    TRIGGER[parentVariant],
    "cursor-pointer disabled:cursor-not-allowed",
    className,
  )}
/>
