<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import Command from "../../lib/studio/Command.svelte";
  import CommandDialog from "../../lib/studio/CommandDialog.svelte";
  import CommandEmpty from "../../lib/studio/CommandEmpty.svelte";
  import CommandGroup from "../../lib/studio/CommandGroup.svelte";
  import CommandInput from "../../lib/studio/CommandInput.svelte";
  import CommandItem from "../../lib/studio/CommandItem.svelte";
  import CommandList from "../../lib/studio/CommandList.svelte";
  import CommandSeparator from "../../lib/studio/CommandSeparator.svelte";
  import CommandShortcut from "../../lib/studio/CommandShortcut.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import {
    Calendar,
    Mail01,
    Plus,
    Settings01,
    User01,
    Users01,
  } from "../../lib/studio/icons";

  let { story }: { story: string } = $props();

  let open = $state(false);
</script>

{#if story === "default"}
  <Command
    class="tw:w-96 tw:rounded-lg tw:border-border tw:border tw:shadow-md"
  >
    <CommandInput placeholder="Type a command or search..." />
    <CommandList>
      <CommandEmpty>No results found.</CommandEmpty>
      <CommandGroup heading="Suggestions">
        <CommandItem>
          <Icon icon={Plus} /> New connection
        </CommandItem>
        <CommandItem>
          <Icon icon={Calendar} /> Schedule a task
        </CommandItem>
        <CommandItem>
          <Icon icon={Mail01} /> Invite a member
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Settings">
        <CommandItem>
          <Icon icon={User01} /> Profile<CommandShortcut>⇧⌘P</CommandShortcut>
        </CommandItem>
        <CommandItem>
          <Icon icon={Users01} /> Members<CommandShortcut>⌘M</CommandShortcut>
        </CommandItem>
        <CommandItem>
          <Icon icon={Settings01} /> Organization settings<CommandShortcut
            >⌘,</CommandShortcut
          >
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </Command>
{:else if story === "as-dialog"}
  <Button variant="outline" onclick={() => (open = true)}>
    Open command palette
    <span class="tw:text-muted-foreground tw:text-xs">⌘K</span>
  </Button>
  <CommandDialog bind:open>
    <CommandInput placeholder="Search projects, connections, members..." />
    <CommandList>
      <CommandEmpty>No results found.</CommandEmpty>
      <CommandGroup heading="Projects">
        <CommandItem>Checkout service</CommandItem>
        <CommandItem>Storefront</CommandItem>
        <CommandItem>Internal tools</CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Connections">
        <CommandItem>Stripe</CommandItem>
        <CommandItem>Linear</CommandItem>
        <CommandItem>GitHub</CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>
{/if}
