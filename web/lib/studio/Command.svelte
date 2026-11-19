<script lang="ts">
  import { Command as CommandPrimitive } from "bits-ui";
  import { setContext } from "svelte";
  import { COMMAND_CONTEXT, type CommandContext } from "./command";
  import { cn } from "./utils";

  /** Ported from @decocms/ui `Command` (cmdk), on Bits UI's `Command`. `defaultValue` is the initial `value`. */
  let {
    class: className,
    value = $bindable(""),
    ref = $bindable(null),
    onStateChange,
    ...rest
  }: CommandPrimitive.RootProps = $props();

  let count = $state(0);
  setContext<CommandContext>(COMMAND_CONTEXT, {
    get count() {
      return count;
    },
  });
</script>

<CommandPrimitive.Root
  bind:value
  bind:ref
  data-slot="command"
  onStateChange={(state) => {
    count = state.filtered.count;
    onStateChange?.(state);
  }}
  class={cn(
    "bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md",
    className,
  )}
  {...rest}
/>
