<script lang="ts">
  import ContextMenu from "../../../lib/studio/ContextMenu.svelte";
  import ContextMenuCheckboxItem from "../../../lib/studio/ContextMenuCheckboxItem.svelte";
  import ContextMenuContent from "../../../lib/studio/ContextMenuContent.svelte";
  import ContextMenuItem from "../../../lib/studio/ContextMenuItem.svelte";
  import ContextMenuLabel from "../../../lib/studio/ContextMenuLabel.svelte";
  import ContextMenuRadioGroup from "../../../lib/studio/ContextMenuRadioGroup.svelte";
  import ContextMenuRadioItem from "../../../lib/studio/ContextMenuRadioItem.svelte";
  import ContextMenuSeparator from "../../../lib/studio/ContextMenuSeparator.svelte";
  import ContextMenuShortcut from "../../../lib/studio/ContextMenuShortcut.svelte";
  import ContextMenuSub from "../../../lib/studio/ContextMenuSub.svelte";
  import ContextMenuSubContent from "../../../lib/studio/ContextMenuSubContent.svelte";
  import ContextMenuSubTrigger from "../../../lib/studio/ContextMenuSubTrigger.svelte";
  import ContextMenuTrigger from "../../../lib/studio/ContextMenuTrigger.svelte";

  let { story }: { story: string } = $props();

  let pinned = $state(true);
  let view = $state("grid");
</script>

{#if story === "default"}
  <ContextMenu>
    <ContextMenuTrigger
      class="flex h-40 w-80 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground"
    >
      Right-click here
    </ContextMenuTrigger>
    <ContextMenuContent class="w-52">
      <ContextMenuItem>
        Open project
        <ContextMenuShortcut>⌘O</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem>
        Rename
        <ContextMenuShortcut>⌘R</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuSub>
        <ContextMenuSubTrigger>Share</ContextMenuSubTrigger>
        <ContextMenuSubContent class="w-44">
          <ContextMenuItem>Copy link</ContextMenuItem>
          <ContextMenuItem>Invite teammate</ContextMenuItem>
          <ContextMenuItem>Export as JSON</ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuSub>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive">
        Delete project
        <ContextMenuShortcut>⌘⌫</ContextMenuShortcut>
      </ContextMenuItem>
    </ContextMenuContent>
  </ContextMenu>
{:else if story === "with-selection-items"}
  <ContextMenu>
    <ContextMenuTrigger
      class="flex h-40 w-80 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground"
    >
      Right-click for view options
    </ContextMenuTrigger>
    <ContextMenuContent class="w-52">
      <ContextMenuCheckboxItem bind:checked={pinned}>
        Pin to sidebar
      </ContextMenuCheckboxItem>
      <ContextMenuSeparator />
      <ContextMenuLabel inset>Layout</ContextMenuLabel>
      <ContextMenuRadioGroup bind:value={view}>
        <ContextMenuRadioItem value="grid">Grid</ContextMenuRadioItem>
        <ContextMenuRadioItem value="list">List</ContextMenuRadioItem>
        <ContextMenuRadioItem value="compact">Compact</ContextMenuRadioItem>
      </ContextMenuRadioGroup>
    </ContextMenuContent>
  </ContextMenu>
{/if}
