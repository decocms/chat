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
    "tw:peer tw:relative tw:size-4 tw:shrink-0 tw:cursor-pointer tw:rounded-[4px] tw:text-primary-foreground tw:outline-none tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:disabled:cursor-not-allowed tw:disabled:opacity-50",
    "tw:[--checkbox-line:var(--vb-input)] tw:[--checkbox-on:var(--vb-primary)] tw:shadow-[inset_0_0_0_1.5px_var(--checkbox-line)] tw:transition-[box-shadow,background-color] tw:duration-150 tw:ease-[ease] tw:hover:[--checkbox-line:color-mix(in_oklch,var(--vb-foreground)_30%,var(--vb-input))]",
    "tw:data-[state=checked]:bg-[var(--checkbox-on)] tw:data-[state=checked]:[--checkbox-line:var(--checkbox-on)] tw:data-[state=checked]:delay-200 tw:data-[state=indeterminate]:bg-[var(--checkbox-on)] tw:data-[state=indeterminate]:[--checkbox-line:var(--checkbox-on)]",
    "tw:data-[state=checked]:[&>svg]:animate-checkbox-tick tw:data-[state=checked]:[&>svg]:[stroke-dasharray:16_86.12] tw:data-[state=checked]:[&>svg]:[stroke-dashoffset:102.22]",
    "tw:aria-invalid:[--checkbox-line:var(--vb-destructive)] tw:aria-invalid:data-[state]:[--checkbox-line:var(--vb-destructive)]",
    "tw:motion-reduce:duration-0! tw:motion-reduce:delay-0!",
    className,
  )}
>
  {#snippet children({ checked: isChecked, indeterminate: isIndeterminate })}
    <!-- Always mounted, so the stroke can animate both ways. -->
    <svg
      viewBox="0 0 21 21"
      aria-hidden="true"
      class="tw:absolute tw:inset-0 tw:size-full tw:fill-none tw:stroke-[color:var(--checkbox-on)] tw:stroke-2 tw:transition-[stroke-dasharray,stroke-dashoffset] tw:duration-300 tw:ease-[ease] tw:[stroke-dasharray:86.12] tw:[stroke-dashoffset:86.12] tw:[stroke-linecap:round] tw:[stroke-linejoin:round] tw:motion-reduce:duration-0! tw:motion-reduce:delay-0! tw:motion-reduce:[animation-delay:0s]! tw:motion-reduce:[animation-duration:0s]!"
    >
      <path
        d="M5,10.75 L8.5,14.25 L19.4,2.3 C18.8333333,1.43333333 18.0333333,1 17,1 L4,1 C2.35,1 1,2.35 1,4 L1,17 C1,18.65 2.35,20 4,20 L17,20 C18.65,20 20,18.65 20,17 L20,7.99769186"
      />
    </svg>
    {#if isChecked || isIndeterminate}
      <span
        data-slot="checkbox-indicator"
        data-state={isIndeterminate ? "indeterminate" : "checked"}
        class="tw:pointer-events-none tw:absolute tw:inset-0 tw:hidden tw:items-center tw:justify-center tw:data-[state=indeterminate]:flex"
      >
        <Icon icon={Minus} class="tw:size-3" />
      </span>
    {/if}
  {/snippet}
</CheckboxPrimitive.Root>
