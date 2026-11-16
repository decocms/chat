<script lang="ts">
  import AlertDialog from "../../lib/studio/AlertDialog.svelte";
  import AlertDialogAction from "../../lib/studio/AlertDialogAction.svelte";
  import AlertDialogCancel from "../../lib/studio/AlertDialogCancel.svelte";
  import AlertDialogContent from "../../lib/studio/AlertDialogContent.svelte";
  import AlertDialogDescription from "../../lib/studio/AlertDialogDescription.svelte";
  import AlertDialogFooter from "../../lib/studio/AlertDialogFooter.svelte";
  import AlertDialogHeader from "../../lib/studio/AlertDialogHeader.svelte";
  import AlertDialogTitle from "../../lib/studio/AlertDialogTitle.svelte";
  import AlertDialogTrigger from "../../lib/studio/AlertDialogTrigger.svelte";
  import Button from "../../lib/studio/Button.svelte";

  let { story }: { story: string } = $props();
</script>

{#if story === "default"}
  <AlertDialog>
    <AlertDialogTrigger>
      {#snippet child({ props })}
        <Button {...props} variant="destructive">Delete project</Button>
      {/snippet}
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete this project?</AlertDialogTitle>
        <AlertDialogDescription>
          This will permanently delete the "Storefront" project, its
          connections, and all associated audit logs. This action cannot be
          undone.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction>Delete project</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
{:else if story === "confirmation"}
  <AlertDialog>
    <AlertDialogTrigger>
      {#snippet child({ props })}
        <Button {...props} variant="outline">Remove member</Button>
      {/snippet}
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Remove Ana Souza from the team?</AlertDialogTitle>
        <AlertDialogDescription>
          Ana will immediately lose access to all projects in this organization.
          You can invite her again later.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Keep member</AlertDialogCancel>
        <AlertDialogAction>Remove</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
{/if}
