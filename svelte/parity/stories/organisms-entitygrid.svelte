<script lang="ts" module>
  export const layouts = {
    default: "padded",
    "two-columns": "padded",
    loading: "padded",
  };
</script>

<script lang="ts">
  import Avatar from "../../lib/studio/Avatar.svelte";
  import EntityCard from "../../lib/studio/EntityCard.svelte";
  import EntityCardDescription from "../../lib/studio/EntityCardDescription.svelte";
  import EntityCardFooter from "../../lib/studio/EntityCardFooter.svelte";
  import EntityCardHeader from "../../lib/studio/EntityCardHeader.svelte";
  import EntityCardTitle from "../../lib/studio/EntityCardTitle.svelte";
  import EntityGrid from "../../lib/studio/EntityGrid.svelte";
  import EntityGridSkeleton from "../../lib/studio/EntityGridSkeleton.svelte";

  let { story }: { story: string } = $props();

  type Connection = { name: string; description: string; tools: number };
  const connections: Connection[] = [
    {
      name: "Slack",
      description: "Send messages and manage channels",
      tools: 12,
    },
    {
      name: "GitHub",
      description: "Repositories, issues and pull requests",
      tools: 28,
    },
    { name: "Linear", description: "Create and triage issues", tools: 9 },
    {
      name: "Notion",
      description: "Read and write pages and databases",
      tools: 15,
    },
    {
      name: "Stripe",
      description: "Payments, customers and invoices",
      tools: 21,
    },
    {
      name: "Postgres",
      description: "Query your production database",
      tools: 6,
    },
    {
      name: "Google Drive",
      description: "Search and fetch documents",
      tools: 8,
    },
    { name: "Figma", description: "Inspect files and export assets", tools: 5 },
  ];
</script>

{#snippet connectionCard({ name, description, tools }: Connection)}
  <EntityCard onclick={() => {}}>
    <EntityCardHeader>
      {#snippet icon()}<Avatar fallback={name} size="sm" />{/snippet}
    </EntityCardHeader>
    <EntityCardTitle>{name}</EntityCardTitle>
    <EntityCardDescription>{description}</EntityCardDescription>
    <EntityCardFooter>{tools} tools</EntityCardFooter>
  </EntityCard>
{/snippet}

{#if story === "default"}
  <div class="@container w-full">
    <EntityGrid>
      {#each connections as connection (connection.name)}
        {@render connectionCard(connection)}
      {/each}
    </EntityGrid>
  </div>
{:else if story === "two-columns"}
  <div class="@container w-full max-w-2xl">
    <EntityGrid columns={{ sm: 1, md: 2 }} gap={6}>
      {#each connections.slice(0, 4) as connection (connection.name)}
        {@render connectionCard(connection)}
      {/each}
    </EntityGrid>
  </div>
{:else if story === "loading"}
  <div class="@container w-full">
    <EntityGridSkeleton count={8} />
  </div>
{/if}
