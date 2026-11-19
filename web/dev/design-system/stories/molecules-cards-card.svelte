<script lang="ts" module>
  export const layouts = { states: "padded" };
</script>

<script lang="ts">
  import Badge from "../../../lib/studio/Badge.svelte";
  import BadgeDot from "../../../lib/studio/BadgeDot.svelte";
  import Button from "../../../lib/studio/Button.svelte";
  import Card from "../../../lib/studio/Card.svelte";
  import CardAction from "../../../lib/studio/CardAction.svelte";
  import CardContent from "../../../lib/studio/CardContent.svelte";
  import CardDescription from "../../../lib/studio/CardDescription.svelte";
  import CardFooter from "../../../lib/studio/CardFooter.svelte";
  import CardHeader from "../../../lib/studio/CardHeader.svelte";
  import CardInset from "../../../lib/studio/CardInset.svelte";
  import CardTitle from "../../../lib/studio/CardTitle.svelte";
  import Icon from "../../../lib/studio/Icon.svelte";
  import { Globe02, Key01 } from "../../../lib/studio/icons";
  import ListRow from "../../../lib/studio/ListRow.svelte";
  import ProjectIcon from "../../../lib/studio/ProjectIcon.svelte";
  import Matrix from "../Matrix.svelte";

  let { story }: { story: string } = $props();

  const ROWS = ["Email digest", "Mentions", "Weekly report"];
  const SIZES = ["default", "tile"] as const;
  const STATES = [undefined, "hover", "focus-visible"];
</script>

<!-- Studio's root line height, which the parity page does not inherit. -->
<div class="leading-[1.5]">
  {#if story === "playground"}
    <Card size="default" interactive={false} class="w-80">
      <CardHeader>
        <CardTitle>API keys</CardTitle>
        <CardDescription>Keys let scripts call Studio for you.</CardDescription>
      </CardHeader>
      <CardContent class="text-muted-foreground">
        2 active keys. The oldest was used 5 days ago.
      </CardContent>
    </Card>
  {:else if story === "section"}
    <Card class="w-96">
      <CardHeader>
        <CardTitle>API keys</CardTitle>
        <CardDescription>Keys let scripts call Studio for you.</CardDescription>
        <CardAction>
          <Button size="sm" variant="outline">New key</Button>
        </CardAction>
      </CardHeader>
      <div>
        <ListRow variant="divided" title="CI deploys" meta="Used 2 days ago">
          {#snippet lead()}<Icon icon={Key01} />{/snippet}
        </ListRow>
        <ListRow
          variant="divided"
          title="Analytics export"
          meta="Used 5 days ago"
        >
          {#snippet lead()}<Icon icon={Key01} />{/snippet}
        </ListRow>
      </div>
    </Card>
  {:else if story === "tile"}
    <Card size="tile" interactive class="w-72">
      {#snippet child({ props })}
        <button type="button" {...props}>
          <div class="flex items-center gap-2.5">
            <ProjectIcon color="blue"><Icon icon={Globe02} /></ProjectIcon>
            <span class="min-w-0 flex-1 truncate text-sm font-medium">
              Storefront
            </span>
            <Badge variant="success"><BadgeDot /> Live</Badge>
          </div>
          <span
            class="text-[0.75rem] leading-4 tabular-nums text-muted-foreground"
            >Updated 3 hours ago</span
          >
        </button>
      {/snippet}
    </Card>
  {:else if story === "flush"}
    <Card size="flush" class="divide-border w-80 gap-0 divide-y">
      {#each ROWS as row (row)}
        <div class="px-5 py-3 text-sm">{row}</div>
      {/each}
    </Card>
  {:else if story === "with-footer"}
    <Card class="w-96">
      <CardHeader>
        <CardTitle>Invite your team</CardTitle>
        <CardDescription>4 of 10 seats in use.</CardDescription>
      </CardHeader>
      <CardFooter class="justify-end">
        <Button variant="outline">Skip for now</Button>
        <Button>Invite members</Button>
      </CardFooter>
    </Card>
  {:else if story === "inset"}
    <Card class="w-96">
      <CardTitle>Webhook</CardTitle>
      <CardInset>
        <code class="font-mono text-xs">POST /hooks/9f2c…/deploy</code>
      </CardInset>
    </Card>
  {:else if story === "states"}
    <Matrix columns={["Default", "Hover", "Focus"]} rows={SIZES}>
      {#snippet cell(size, index)}
        <Card {size} interactive class="w-56" data-pseudo={STATES[index]}>
          {#snippet child({ props })}
            <button type="button" {...props}>
              <CardTitle>Storefront</CardTitle>
              <span
                class="text-[0.75rem] leading-4 tabular-nums text-muted-foreground"
                >Updated 3 hours ago</span
              >
            </button>
          {/snippet}
        </Card>
      {/snippet}
    </Matrix>
  {/if}
</div>
