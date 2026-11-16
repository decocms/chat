<script lang="ts">
  import ScrollArea from "../../lib/studio/ScrollArea.svelte";
  import ScrollBar from "../../lib/studio/ScrollBar.svelte";
  import Separator from "../../lib/studio/Separator.svelte";

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
  <ScrollArea class="tw:h-64 tw:w-80 tw:rounded-md tw:border tw:border-border">
    <div class="tw:p-4">
      <h4 class="tw:mb-4 tw:text-sm tw:font-medium tw:text-balance">
        Recent activity
      </h4>
      {#each events as event (event)}
        <div>
          <div class="tw:py-2 tw:text-sm">{event}</div>
          <Separator />
        </div>
      {/each}
    </div>
  </ScrollArea>
{:else if story === "horizontal"}
  <ScrollArea
    class="tw:w-80 tw:rounded-md tw:border tw:border-border tw:whitespace-nowrap"
  >
    <div class="tw:flex tw:gap-4 tw:p-4">
      {#each projects as project (project)}
        <div
          class="tw:flex tw:h-24 tw:w-40 tw:shrink-0 tw:items-center tw:justify-center tw:rounded-md tw:bg-muted tw:text-sm tw:text-muted-foreground"
        >
          {project}
        </div>
      {/each}
    </div>
    <ScrollBar orientation="horizontal" />
  </ScrollArea>
{:else if story === "hidden-scrollbar"}
  <ScrollArea
    hideScrollbar
    class="tw:h-48 tw:w-80 tw:rounded-md tw:border tw:border-border"
  >
    <div class="tw:space-y-2 tw:p-4 tw:text-sm">
      {#each events as event (event)}
        <p class="tw:text-pretty">{event}</p>
      {/each}
    </div>
  </ScrollArea>
{/if}
