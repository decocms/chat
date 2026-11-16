<script lang="ts">
  import { Accordion as AccordionPrimitive } from "bits-ui";
  import { cn } from "./utils";

  /** As in React, `class` styles the padded inner block, not the animated panel. */
  let {
    ref = $bindable(null),
    class: className,
    children,
    ...rest
  }: Omit<AccordionPrimitive.ContentProps, "style" | "class" | "child"> & {
    class?: string;
  } = $props();
</script>

<AccordionPrimitive.Content
  bind:ref
  data-slot="accordion-content"
  {...rest}
  class="tw:data-[state=closed]:animate-accordion-up tw:data-[state=open]:animate-accordion-down tw:overflow-hidden tw:text-sm tw:[--radix-accordion-content-height:var(--bits-accordion-content-height)]"
>
  <div
    class={cn("tw:text-muted-foreground tw:px-3 tw:pt-1 tw:pb-3", className)}
  >
    {@render children?.()}
  </div>
</AccordionPrimitive.Content>
