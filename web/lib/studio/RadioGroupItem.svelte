<script lang="ts">
  import { RadioGroup as RadioGroupPrimitive } from "bits-ui";
  import { cn } from "./utils";

  /** One option of a `RadioGroup`: a ring that fills, with a dot that grows in. */
  let {
    ref = $bindable(null),
    class: className,
    ...rest
  }: Omit<
    RadioGroupPrimitive.ItemProps,
    "class" | "style" | "children" | "child"
  > & { class?: string } = $props();
</script>

<RadioGroupPrimitive.Item
  bind:ref
  data-slot="radio-group-item"
  {...rest}
  class={cn(
    "group relative inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full shadow-[inset_0_0_0_1.5px_var(--vb-input)] transition-[background-color,box-shadow] duration-150 hover:shadow-[inset_0_0_0_1.5px_color-mix(in_oklch,var(--vb-foreground)_30%,var(--vb-input))] data-[state=checked]:bg-primary data-[state=checked]:shadow-[inset_0_0_0_1.5px_var(--vb-primary)] aria-invalid:shadow-[inset_0_0_0_1.5px_var(--vb-destructive)] focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
    className,
  )}
>
  <!-- Always mounted, so the dot can grow in and shrink out. -->
  <span
    class="bg-primary-foreground size-1.5 scale-0 rounded-full transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-data-[state=checked]:scale-100 motion-reduce:transition-none"
  ></span>
</RadioGroupPrimitive.Item>
