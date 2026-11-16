<script lang="ts">
  import { Command as CommandPrimitive } from "bits-ui";
  import { commandItemVariants, type CommandItemVariants } from "./command";
  import { cn } from "./utils";

  /** `onSelect` receives the row's value, as in cmdk: the `value` prop, or else its text. */
  let {
    class: className,
    size,
    value,
    onSelect,
    ref = $bindable(null),
    ...rest
  }: Omit<CommandPrimitive.ItemProps, "onSelect"> &
    Pick<CommandItemVariants, "size"> & {
      onSelect?: (value: string) => void;
    } = $props();
</script>

<CommandPrimitive.Item
  bind:ref
  data-slot="command-item"
  {value}
  onSelect={() => onSelect?.(ref?.getAttribute("data-value") ?? value ?? "")}
  class={cn(commandItemVariants({ size }), className)}
  {...rest}
/>
