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
    "peer data-[state=checked]:bg-primary data-[state=unchecked]:bg-foreground/15 inline-flex h-[1.125rem] w-8 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
    className,
  )}
>
  <SwitchPrimitive.Thumb
    data-slot="switch-thumb"
    class="bg-background dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-primary-foreground pointer-events-none block size-3.5 rounded-full shadow-[0_0_0_1px_#0000000f] ring-0 transition-transform data-[state=checked]:translate-x-3.5 data-[state=unchecked]:translate-x-0"
  />
</SwitchPrimitive.Root>
