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
    "tw:group tw:relative tw:inline-flex tw:size-4 tw:shrink-0 tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-full tw:shadow-[inset_0_0_0_1.5px_var(--vb-input)] tw:transition-[background-color,box-shadow] tw:duration-150 tw:hover:shadow-[inset_0_0_0_1.5px_color-mix(in_oklch,var(--vb-foreground)_30%,var(--vb-input))] tw:data-[state=checked]:bg-primary tw:data-[state=checked]:shadow-[inset_0_0_0_1.5px_var(--vb-primary)] tw:aria-invalid:shadow-[inset_0_0_0_1.5px_var(--vb-destructive)] tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:disabled:cursor-not-allowed tw:disabled:opacity-50 tw:motion-reduce:transition-none",
    className,
  )}
>
  <!-- Always mounted, so the dot can grow in and shrink out. -->
  <span
    class="tw:bg-primary-foreground tw:size-1.5 tw:scale-0 tw:rounded-full tw:transition-transform tw:duration-200 tw:ease-[cubic-bezier(0.34,1.56,0.64,1)] tw:group-data-[state=checked]:scale-100 tw:motion-reduce:transition-none"
  ></span>
</RadioGroupPrimitive.Item>
