<script lang="ts" module>
  export const layouts = { states: "padded" };
</script>

<script lang="ts">
  import Avatar from "../../lib/studio/Avatar.svelte";
  import Badge from "../../lib/studio/Badge.svelte";
  import BadgeDot from "../../lib/studio/BadgeDot.svelte";
  import EntityCard from "../../lib/studio/EntityCard.svelte";
  import EntityCardDescription from "../../lib/studio/EntityCardDescription.svelte";
  import EntityCardFooter from "../../lib/studio/EntityCardFooter.svelte";
  import EntityCardHeader from "../../lib/studio/EntityCardHeader.svelte";
  import EntityCardSkeleton from "../../lib/studio/EntityCardSkeleton.svelte";
  import EntityCardTitle from "../../lib/studio/EntityCardTitle.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import { DotsHorizontal, Globe02 } from "../../lib/studio/icons";
  import ProjectIcon from "../../lib/studio/ProjectIcon.svelte";
  import TooltipProvider from "../../lib/studio/TooltipProvider.svelte";
  import Matrix from "../Matrix.svelte";

  let { story }: { story: string } = $props();

  const STATES = [undefined, "hover", "focus-visible"];
</script>

{#snippet projectIcon()}
  <ProjectIcon color="blue"><Icon icon={Globe02} /></ProjectIcon>
{/snippet}

{#if story === "project"}
  <EntityCard onclick={() => {}} class="tw:w-72">
    <EntityCardHeader icon={projectIcon}>
      {#snippet trailing()}
        <Badge variant="success"><BadgeDot /> Live</Badge>
      {/snippet}
    </EntityCardHeader>
    <EntityCardTitle>Storefront</EntityCardTitle>
    <EntityCardDescription>Updated 3 hours ago</EntityCardDescription>
  </EntityCard>
{:else if story === "connection"}
  <TooltipProvider>
    <EntityCard onclick={() => {}} class="tw:w-72">
      <EntityCardHeader>
        {#snippet icon()}
          <Avatar fallback="Slack" size="sm" />
        {/snippet}
        {#snippet trailing()}
          <IconButton label="Options"><Icon icon={DotsHorizontal} /></IconButton
          >
        {/snippet}
      </EntityCardHeader>
      <EntityCardTitle>Slack</EntityCardTitle>
      <EntityCardDescription>
        Send messages and manage channels
      </EntityCardDescription>
      <EntityCardFooter>
        <span>12 tools</span>
        <span>Used 2h ago</span>
      </EntityCardFooter>
    </EntityCard>
  </TooltipProvider>
{:else if story === "states"}
  <Matrix columns={["Default", "Hover", "Focus", "Loading"]} rows={["Project"]}>
    {#snippet cell(_row, index)}
      {#if index < 3}
        <EntityCard
          onclick={() => {}}
          tabindex={0}
          class="tw:w-56"
          data-pseudo={STATES[index]}
        >
          <EntityCardHeader icon={projectIcon} />
          <EntityCardTitle>Storefront</EntityCardTitle>
          <EntityCardDescription>Updated 3 hours ago</EntityCardDescription>
        </EntityCard>
      {:else}
        <div class="tw:w-56"><EntityCardSkeleton /></div>
      {/if}
    {/snippet}
  </Matrix>
{/if}
