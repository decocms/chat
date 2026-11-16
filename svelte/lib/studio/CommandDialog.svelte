<script lang="ts">
  import type {
    Command as CommandPrimitive,
    Dialog as DialogPrimitive,
  } from "bits-ui";
  import Command from "./Command.svelte";
  import Dialog from "./Dialog.svelte";
  import DialogContent from "./DialogContent.svelte";
  import DialogDescription from "./DialogDescription.svelte";
  import DialogHeader from "./DialogHeader.svelte";
  import DialogTitle from "./DialogTitle.svelte";
  import { cn } from "./utils";

  /** Closing leaves focus where the caller puts it, as the React dialog (which has no trigger) does. `shouldFilter={false}` only when EVERY row is already the answer (a server-side search); a dialog mixing server and local rows keeps it on and gives each server row `keywords`. */
  let {
    title = "Command Palette",
    description = "Search for a command to run...",
    children,
    class: className,
    filter,
    shouldFilter,
    open = $bindable(false),
    ...rest
  }: DialogPrimitive.RootProps & {
    title?: string;
    description?: string;
    class?: string;
    /** Overrides the default fuzzy scorer (e.g. a stricter substring match). */
    filter?: CommandPrimitive.RootProps["filter"];
    shouldFilter?: CommandPrimitive.RootProps["shouldFilter"];
  } = $props();
</script>

<Dialog bind:open {...rest}>
  <DialogHeader class="tw:sr-only">
    <DialogTitle>{title}</DialogTitle>
    <DialogDescription>{description}</DialogDescription>
  </DialogHeader>
  <DialogContent
    class={cn("tw:overflow-hidden tw:p-0", className)}
    closeButtonClassName="tw:hidden"
    onCloseAutoFocus={(event) => event.preventDefault()}
  >
    <Command
      {filter}
      {shouldFilter}
      class="tw:[&_[data-command-group-heading]]:text-muted-foreground tw:**:data-[slot=command-input-wrapper]:h-12 tw:[&_[data-command-group-heading]]:px-2 tw:[&_[data-command-group-heading]]:font-medium tw:[&_[data-command-group]]:px-2 tw:[&_[data-command-group]:not([hidden])_~[data-command-group]]:pt-0 tw:[&_[data-command-input]]:h-12 tw:[&_[data-command-item]]:px-2 tw:[&_[data-command-item]]:py-3 tw:[&_[data-command-item]_svg:not([class*='size-'])]:h-5 tw:[&_[data-command-item]_svg:not([class*='size-'])]:w-5"
    >
      {@render children?.()}
    </Command>
  </DialogContent>
</Dialog>
