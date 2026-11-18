<script lang="ts">
  import AgentAvatar from "../../lib/studio/AgentAvatar.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Card from "../../lib/studio/Card.svelte";
  import CardHeader from "../../lib/studio/CardHeader.svelte";
  import CardTitle from "../../lib/studio/CardTitle.svelte";
  import EmptyState from "../../lib/studio/EmptyState.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { AlertCircle, Plus, SearchMd, Zap } from "../../lib/studio/icons";

  let { story }: { story: string } = $props();

  const AGENT_FACE =
    "https://assets.decocache.com/decocms/fd07a578-6b1c-40f1-bc05-88a3b981695d/f7fc4ffa81aec04e37ae670c3cd4936643a7b269.png";
  const DESCRIPTION =
    "Automations run a prompt on a schedule or when something happens.";
</script>

{#snippet zap()}<Icon icon={Zap} />{/snippet}
{#snippet search()}<Icon icon={SearchMd} />{/snippet}
{#snippet alert()}<Icon icon={AlertCircle} />{/snippet}
{#snippet newAutomation()}<Icon icon={Plus} /> New automation{/snippet}
{#snippet clearFilters()}Clear filters{/snippet}
{#snippet tryAgain()}Try again{/snippet}
{#snippet agent()}<AgentAvatar src={AGENT_FACE} size={48} />{/snippet}
{#snippet askAgent()}<Button variant="agent">Ask the agent</Button>{/snippet}

{#if story === "default"}
  <EmptyState
    icon={zap}
    title="No automations yet"
    description={DESCRIPTION}
    buttonProps={{ children: newAutomation }}
  />
{:else if story === "no-results"}
  <EmptyState
    icon={search}
    title="Nothing matches “banner”"
    description="Try another word or clear the filters."
    buttonProps={{ children: clearFilters, variant: "ghost" }}
  />
{:else if story === "error"}
  <EmptyState
    tone="error"
    icon={alert}
    title="Couldn't load deployments"
    description="The hosting provider didn't answer."
    buttonProps={{ children: tryAgain }}
  />
{:else if story === "inline"}
  <Card class="w-96">
    <CardHeader>
      <CardTitle>Recent runs</CardTitle>
    </CardHeader>
    <EmptyState
      size="inline"
      icon={zap}
      title="No runs in this range"
      description="Pick a wider range to see older runs."
    />
  </Card>
{:else if story === "with-agent"}
  <EmptyState
    icon={zap}
    illustration={agent}
    title="Nothing on the board yet"
    description="Tell the agent a goal and it will plan the first tasks."
    buttonProps={{ children: newAutomation }}
    buttonComponent={askAgent}
  />
{/if}
