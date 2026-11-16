<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import Input from "../../lib/studio/Input.svelte";
  import Label from "../../lib/studio/Label.svelte";
  import Sheet from "../../lib/studio/Sheet.svelte";
  import SheetClose from "../../lib/studio/SheetClose.svelte";
  import SheetContent from "../../lib/studio/SheetContent.svelte";
  import SheetDescription from "../../lib/studio/SheetDescription.svelte";
  import SheetFooter from "../../lib/studio/SheetFooter.svelte";
  import SheetHeader from "../../lib/studio/SheetHeader.svelte";
  import SheetTitle from "../../lib/studio/SheetTitle.svelte";
  import SheetTrigger from "../../lib/studio/SheetTrigger.svelte";

  let { story }: { story: string } = $props();

  const SIDES = ["right", "left", "top", "bottom"] as const;
</script>

{#if story === "default"}
  <Sheet>
    <SheetTrigger>
      {#snippet child({ props })}
        <Button {...props} variant="outline">Edit member</Button>
      {/snippet}
    </SheetTrigger>
    <SheetContent>
      <SheetHeader>
        <SheetTitle>Edit member</SheetTitle>
        <SheetDescription>
          Update the member's display name and role, then save.
        </SheetDescription>
      </SheetHeader>
      <div class="tw:grid tw:gap-4 tw:px-4">
        <div class="tw:grid tw:gap-2">
          <Label for="member-name">Name</Label>
          <Input id="member-name" value="Ana Souza" />
        </div>
        <div class="tw:grid tw:gap-2">
          <Label for="member-role">Role</Label>
          <Input id="member-role" value="Admin" />
        </div>
      </div>
      <SheetFooter>
        <Button>Save changes</Button>
        <SheetClose>
          {#snippet child({ props })}
            <Button {...props} variant="outline">Cancel</Button>
          {/snippet}
        </SheetClose>
      </SheetFooter>
    </SheetContent>
  </Sheet>
{:else if story === "sides"}
  <div class="tw:flex tw:flex-wrap tw:gap-2">
    {#each SIDES as side (side)}
      <Sheet>
        <SheetTrigger>
          {#snippet child({ props })}
            <Button {...props} variant="outline" class="tw:capitalize">
              {side}
            </Button>
          {/snippet}
        </SheetTrigger>
        <SheetContent {side}>
          <SheetHeader>
            <SheetTitle>Connection details</SheetTitle>
            <SheetDescription>
              This panel slides in from the {side} edge of the screen.
            </SheetDescription>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    {/each}
  </div>
{/if}
