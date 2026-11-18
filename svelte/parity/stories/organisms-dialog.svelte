<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import Dialog from "../../lib/studio/Dialog.svelte";
  import DialogClose from "../../lib/studio/DialogClose.svelte";
  import DialogContent from "../../lib/studio/DialogContent.svelte";
  import DialogDescription from "../../lib/studio/DialogDescription.svelte";
  import DialogFooter from "../../lib/studio/DialogFooter.svelte";
  import DialogHeader from "../../lib/studio/DialogHeader.svelte";
  import DialogTitle from "../../lib/studio/DialogTitle.svelte";
  import DialogTrigger from "../../lib/studio/DialogTrigger.svelte";
  import Input from "../../lib/studio/Input.svelte";
  import Label from "../../lib/studio/Label.svelte";

  let { story }: { story: string } = $props();
</script>

{#if story === "default"}
  <Dialog>
    <DialogTrigger>
      {#snippet child({ props })}
        <Button {...props} variant="outline">Rename project</Button>
      {/snippet}
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Rename project</DialogTitle>
        <DialogDescription>
          The project slug stays the same; only the display name changes.
        </DialogDescription>
      </DialogHeader>
      <div class="grid gap-2">
        <Label for="project-name">Project name</Label>
        <Input id="project-name" value="Checkout service" />
      </div>
      <DialogFooter>
        <DialogClose>
          {#snippet child({ props })}
            <Button {...props} variant="outline">Cancel</Button>
          {/snippet}
        </DialogClose>
        <Button>Save changes</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{:else if story === "destructive-confirmation"}
  <Dialog>
    <DialogTrigger>
      {#snippet child({ props })}
        <Button {...props} variant="destructive">Delete connection</Button>
      {/snippet}
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete this connection?</DialogTitle>
        <DialogDescription>
          Agents using the Linear connection will lose access immediately. This
          action cannot be undone.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose>
          {#snippet child({ props })}
            <Button {...props} variant="outline">Cancel</Button>
          {/snippet}
        </DialogClose>
        <Button variant="destructive">Delete connection</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
{/if}
