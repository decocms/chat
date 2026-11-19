<script lang="ts">
  import ScrollArea from "../../../lib/studio/ScrollArea.svelte";
  import ScrollBar from "../../../lib/studio/ScrollBar.svelte";
  import Separator from "../../../lib/studio/Separator.svelte";

  let { story }: { story: string } = $props();

  const events = [
    "Ana Souza invited Bruno Lima",
    "Slack connection created",
    "API key rotated",
    "Project Storefront redesign archived",
    "Bruno Lima changed role to Admin",
    "GitHub connection re-authenticated",
    "Webhook delivery failed (retrying)",
    "Monthly usage report generated",
    "New agent Checkout helper deployed",
    "Postgres connection updated",
    "Carla Mendes joined the organization",
    "Audit log export completed",
  ];
  const projects = [
    "Storefront redesign",
    "Checkout experiments",
    "Internal admin tools",
    "Marketing site",
    "Data pipeline",
    "Mobile app",
  ];
</script>

{#if story === "default"}
  <ScrollArea class="h-64 w-80 rounded-md border border-border">
    <div class="p-4">
      <h4 class="mb-4 text-sm font-medium text-balance">Recent activity</h4>
      {#each events as event (event)}
        <div>
          <div class="py-2 text-sm">{event}</div>
          <Separator />
        </div>
      {/each}
    </div>
  </ScrollArea>
{:else if story === "horizontal"}
  <ScrollArea class="w-80 rounded-md border border-border whitespace-nowrap">
    <div class="flex gap-4 p-4">
      {#each projects as project (project)}
        <div
          class="flex h-24 w-40 shrink-0 items-center justify-center rounded-md bg-muted text-sm text-muted-foreground"
        >
          {project}
        </div>
      {/each}
    </div>
    <ScrollBar orientation="horizontal" />
  </ScrollArea>
{:else if story === "hidden-scrollbar"}
  <ScrollArea hideScrollbar class="h-48 w-80 rounded-md border border-border">
    <div class="space-y-2 p-4 text-sm">
      {#each events as event (event)}
        <p class="text-pretty">{event}</p>
      {/each}
    </div>
  </ScrollArea>
{/if}
