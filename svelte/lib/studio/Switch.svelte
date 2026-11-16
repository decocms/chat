<script lang="ts">
  import { Switch as SwitchPrimitive } from "bits-ui";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `Switch`; `defaultChecked` is an initial `checked`. */
  let {
    checked = $bindable(false),
    ref = $bindable(null),
    class: className,
    ...rest
  }: Omit<
    SwitchPrimitive.RootProps,
    "class" | "style" | "children" | "child"
  > & { class?: string } = $props();
</script>

<SwitchPrimitive.Root
  bind:checked
  bind:ref
  data-slot="switch"
  {...rest}
  class={cn(
    "tw:peer tw:data-[state=checked]:bg-primary tw:data-[state=unchecked]:bg-foreground/15 tw:inline-flex tw:h-[1.125rem] tw:w-8 tw:shrink-0 tw:cursor-pointer tw:items-center tw:rounded-full tw:border-2 tw:border-transparent tw:transition-colors tw:outline-none tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring tw:focus-visible:outline-offset-2 tw:disabled:cursor-not-allowed tw:disabled:opacity-50",
    className,
  )}
>
  <SwitchPrimitive.Thumb
    data-slot="switch-thumb"
    class="tw:bg-background tw:dark:data-[state=unchecked]:bg-foreground tw:dark:data-[state=checked]:bg-primary-foreground tw:pointer-events-none tw:block tw:size-3.5 tw:rounded-full tw:shadow-[0_0_0_1px_#0000000f] tw:ring-0 tw:transition-transform tw:data-[state=checked]:translate-x-3.5 tw:data-[state=unchecked]:translate-x-0"
  />
</SwitchPrimitive.Root>
