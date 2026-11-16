<script lang="ts">
  import { Command as CommandPrimitive } from "bits-ui";
  import { getContext } from "svelte";
  import { COMMAND_CONTEXT, type CommandContext } from "./command";

  let {
    forceMount,
    ref = $bindable(null),
    ...rest
  }: Omit<CommandPrimitive.EmptyProps, "class"> = $props();

  const command = getContext<CommandContext | undefined>(COMMAND_CONTEXT);
</script>

<!-- Bits UI never shows it for a list that starts with no rows, so the count kept by `Command` mounts it. -->
<CommandPrimitive.Empty
  bind:ref
  data-slot="command-empty"
  forceMount={forceMount || command?.count === 0}
  class="tw:text-muted-foreground tw:px-4 tw:py-4 tw:text-center tw:text-sm"
  {...rest}
/>
