<script lang="ts">
  import { Collapsible as CollapsiblePrimitive } from "bits-ui";
  import { cn } from "./utils";

  /** Animates height like `AccordionContent`; reduced motion turns it back into a plain toggle. */
  let {
    ref = $bindable(null),
    class: className,
    ...rest
  }: Omit<CollapsiblePrimitive.ContentProps, "style" | "class"> & {
    class?: string;
  } = $props();
</script>

<CollapsiblePrimitive.Content
  bind:ref
  data-slot="collapsible-content"
  {...rest}
  class={cn(
    "tw:overflow-hidden tw:data-[state=closed]:animate-collapsible-up tw:data-[state=open]:animate-collapsible-down tw:motion-reduce:animate-none",
    className,
  )}
/>
