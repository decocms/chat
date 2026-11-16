<script lang="ts" module>
  const TRIGGER = {
    pill: "tw:relative tw:z-10 tw:data-[state=active]:text-foreground tw:hover:text-foreground tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:text-muted-foreground tw:inline-flex tw:h-7 tw:flex-1 tw:items-center tw:justify-center tw:gap-1.5 tw:rounded-full tw:px-3 tw:text-sm tw:font-medium tw:whitespace-nowrap tw:transition-colors tw:disabled:pointer-events-none tw:disabled:opacity-50 tw:[&_svg]:pointer-events-none tw:[&_svg]:shrink-0 tw:[&_svg:not([class*='size-'])]:size-4",
    underline:
      "tw:relative tw:z-10 tw:flex tw:items-center tw:h-full tw:px-3 tw:text-sm tw:whitespace-nowrap tw:transition-colors tw:text-muted-foreground tw:hover:text-foreground tw:data-[state=active]:text-foreground tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:disabled:pointer-events-none tw:disabled:opacity-50",
    canvas:
      "tw:flex tw:items-center tw:h-full tw:px-3 tw:gap-2.5 tw:text-sm tw:whitespace-nowrap tw:transition-all tw:border-r tw:border-b tw:border-border tw:[&>*]:opacity-50 tw:data-[state=active]:[&>*]:opacity-100 tw:data-[state=active]:border-b-0 tw:last:border-r-0 tw:disabled:pointer-events-none tw:max-w-2xs",
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
    "tw:cursor-pointer tw:disabled:cursor-not-allowed",
    className,
  )}
/>
