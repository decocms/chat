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
  class="data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-sm [--radix-accordion-content-height:var(--bits-accordion-content-height)]"
>
  <div class={cn("text-muted-foreground px-3 pt-1 pb-3", className)}>
    {@render children?.()}
  </div>
</AccordionPrimitive.Content>
