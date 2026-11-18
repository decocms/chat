<script lang="ts">
  import { Command as CommandPrimitive } from "bits-ui";
  import type { Snippet } from "svelte";
  import { cn } from "./utils";

  /** `heading` is cmdk's prop: the label above the rows, hidden from assistive tech because the rows' group is labelled by it. */
  let {
    class: className,
    heading,
    value,
    children,
    ref = $bindable(null),
    ...rest
  }: Omit<CommandPrimitive.GroupProps, "child"> & {
    heading?: string | Snippet;
  } = $props();

  const uid = $props.id();
  let headingRef = $state<HTMLElement | null>(null);
</script>

<!-- A private value keeps Bits UI from moving whole groups while searching: cmdk sorts rows inside their group and leaves the groups in place. -->
<CommandPrimitive.Group bind:ref value={`group-${uid}`} {...rest}>
  {#snippet child({ props })}
    <div
      {...props}
      data-slot="command-group"
      data-value={value ??
        (typeof heading === "string"
          ? heading.trim()
          : headingRef?.textContent?.trim())}
      class={cn(
        "text-foreground [&_[data-command-group-heading]]:text-muted-foreground overflow-hidden p-1 [&_[data-command-group-heading]]:px-2 [&_[data-command-group-heading]]:py-1.5 [&_[data-command-group-heading]]:text-xs [&_[data-command-group-heading]]:font-medium",
        className,
      )}
    >
      {#if heading}
        <CommandPrimitive.GroupHeading bind:ref={headingRef} aria-hidden="true">
          {#if typeof heading === "string"}{heading}{:else}{@render heading()}{/if}
        </CommandPrimitive.GroupHeading>
      {/if}
      <CommandPrimitive.GroupItems>
        {@render children?.()}
      </CommandPrimitive.GroupItems>
    </div>
  {/snippet}
</CommandPrimitive.Group>
