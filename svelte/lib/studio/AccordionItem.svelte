<script lang="ts">
  import { Accordion as AccordionPrimitive } from "bits-ui";
  import { cn } from "./utils";

  let {
    ref = $bindable(null),
    class: className,
    ...rest
  }: Omit<AccordionPrimitive.ItemProps, "style" | "class"> & {
    class?: string;
  } = $props();
</script>

<AccordionPrimitive.Item
  bind:ref
  data-slot="accordion-item"
  {...rest}
  class={cn("border-border border-b py-1 last:border-b-0", className)}
/>
