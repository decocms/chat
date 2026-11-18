<script lang="ts">
  import { Checkbox as CheckboxPrimitive } from "bits-ui";
  import Icon from "./Icon.svelte";
  import { Minus } from "./icons";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `Checkbox`. Radix's `checked="indeterminate"` is the separate `indeterminate` prop, as in Bits UI. */
  let {
    checked = $bindable(false),
    indeterminate = $bindable(false),
    ref = $bindable(null),
    class: className,
    ...rest
  }: Omit<
    CheckboxPrimitive.RootProps,
    "class" | "style" | "children" | "child"
  > & { class?: string } = $props();
</script>

<CheckboxPrimitive.Root
  bind:checked
  bind:indeterminate
  bind:ref
  data-slot="checkbox"
  {...rest}
  class={cn(
    "peer relative size-4 shrink-0 cursor-pointer rounded-[4px] text-primary-foreground outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    "[--checkbox-line:var(--vb-input)] [--checkbox-on:var(--vb-primary)] shadow-[inset_0_0_0_1.5px_var(--checkbox-line)] transition-[box-shadow,background-color] duration-150 ease-[ease] hover:[--checkbox-line:color-mix(in_oklch,var(--vb-foreground)_30%,var(--vb-input))]",
    "data-[state=checked]:bg-[var(--checkbox-on)] data-[state=checked]:[--checkbox-line:var(--checkbox-on)] data-[state=checked]:delay-200 data-[state=indeterminate]:bg-[var(--checkbox-on)] data-[state=indeterminate]:[--checkbox-line:var(--checkbox-on)]",
    "data-[state=checked]:[&>svg]:animate-checkbox-tick data-[state=checked]:[&>svg]:[stroke-dasharray:16_86.12] data-[state=checked]:[&>svg]:[stroke-dashoffset:102.22]",
    "aria-invalid:[--checkbox-line:var(--vb-destructive)] aria-invalid:data-[state]:[--checkbox-line:var(--vb-destructive)]",
    "motion-reduce:duration-0! motion-reduce:delay-0!",
    className,
  )}
>
  {#snippet children({ checked: isChecked, indeterminate: isIndeterminate })}
    <!-- Always mounted, so the stroke can animate both ways. -->
    <svg
      viewBox="0 0 21 21"
      aria-hidden="true"
      class="absolute inset-0 size-full fill-none stroke-[color:var(--checkbox-on)] stroke-2 transition-[stroke-dasharray,stroke-dashoffset] duration-300 ease-[ease] [stroke-dasharray:86.12] [stroke-dashoffset:86.12] [stroke-linecap:round] [stroke-linejoin:round] motion-reduce:duration-0! motion-reduce:delay-0! motion-reduce:[animation-delay:0s]! motion-reduce:[animation-duration:0s]!"
    >
      <path
        d="M5,10.75 L8.5,14.25 L19.4,2.3 C18.8333333,1.43333333 18.0333333,1 17,1 L4,1 C2.35,1 1,2.35 1,4 L1,17 C1,18.65 2.35,20 4,20 L17,20 C18.65,20 20,18.65 20,17 L20,7.99769186"
      />
    </svg>
    {#if isChecked || isIndeterminate}
      <span
        data-slot="checkbox-indicator"
        data-state={isIndeterminate ? "indeterminate" : "checked"}
        class="pointer-events-none absolute inset-0 hidden items-center justify-center data-[state=indeterminate]:flex"
      >
        <Icon icon={Minus} class="size-3" />
      </span>
    {/if}
  {/snippet}
</CheckboxPrimitive.Root>
