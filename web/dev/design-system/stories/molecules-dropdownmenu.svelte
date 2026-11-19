<script lang="ts">
  import Button from "../../../lib/studio/Button.svelte";
  import DropdownMenu from "../../../lib/studio/DropdownMenu.svelte";
  import DropdownMenuCheckboxItem from "../../../lib/studio/DropdownMenuCheckboxItem.svelte";
  import DropdownMenuContent from "../../../lib/studio/DropdownMenuContent.svelte";
  import DropdownMenuGroup from "../../../lib/studio/DropdownMenuGroup.svelte";
  import DropdownMenuItem from "../../../lib/studio/DropdownMenuItem.svelte";
  import DropdownMenuLabel from "../../../lib/studio/DropdownMenuLabel.svelte";
  import DropdownMenuRadioGroup from "../../../lib/studio/DropdownMenuRadioGroup.svelte";
  import DropdownMenuRadioItem from "../../../lib/studio/DropdownMenuRadioItem.svelte";
  import DropdownMenuSeparator from "../../../lib/studio/DropdownMenuSeparator.svelte";
  import DropdownMenuShortcut from "../../../lib/studio/DropdownMenuShortcut.svelte";
  import DropdownMenuSub from "../../../lib/studio/DropdownMenuSub.svelte";
  import DropdownMenuSubContent from "../../../lib/studio/DropdownMenuSubContent.svelte";
  import DropdownMenuSubTrigger from "../../../lib/studio/DropdownMenuSubTrigger.svelte";
  import DropdownMenuTrigger from "../../../lib/studio/DropdownMenuTrigger.svelte";
  import Icon from "../../../lib/studio/Icon.svelte";

  let { story }: { story: string } = $props();

  let showTools = $state(true);
  let showResources = $state(false);
  let sortBy = $state("name");
</script>

{#if story === "default"}
  <DropdownMenu>
    <DropdownMenuTrigger>
      {#snippet child({ props })}
        <Button {...props} variant="outline">Account</Button>
      {/snippet}
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-56">
      <DropdownMenuLabel>My account</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem>
          <Icon icon="user-01" /> Profile
          <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Icon icon="settings-01" /> Settings
          <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem>
          <Icon icon="users-01" /> Team
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Icon icon="user-plus-01" class="mr-2 size-4" /> Invite members
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem>
              <Icon icon="copy-01" /> Copy invite link
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Icon icon="plus" /> Invite by email
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem>
        <Icon icon="log-out-01" /> Log out
        <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
{:else if story === "destructive-item"}
  <DropdownMenu>
    <DropdownMenuTrigger>
      {#snippet child({ props })}
        <Button {...props} variant="outline">Connection actions</Button>
      {/snippet}
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-52">
      <DropdownMenuItem>
        <Icon icon="copy-01" /> Duplicate connection
      </DropdownMenuItem>
      <DropdownMenuItem>
        <Icon icon="settings-01" /> Edit configuration
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="destructive">
        <Icon icon="trash-01" /> Delete connection
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
{:else if story === "with-checkbox-items"}
  <DropdownMenu>
    <DropdownMenuTrigger>
      {#snippet child({ props })}
        <Button {...props} variant="outline">View options</Button>
      {/snippet}
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-52">
      <DropdownMenuLabel>Show columns</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuCheckboxItem bind:checked={showTools}>
        Tools
      </DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem bind:checked={showResources}>
        Resources
      </DropdownMenuCheckboxItem>
      <DropdownMenuCheckboxItem checked disabled>
        Status
      </DropdownMenuCheckboxItem>
    </DropdownMenuContent>
  </DropdownMenu>
{:else if story === "with-radio-group"}
  <DropdownMenu>
    <DropdownMenuTrigger>
      {#snippet child({ props })}
        <Button {...props} variant="outline">Sort by</Button>
      {/snippet}
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-48">
      <DropdownMenuLabel>Sort connections</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuRadioGroup bind:value={sortBy}>
        <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="last-used">
          Last used
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="created">
          Date created
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
{/if}
