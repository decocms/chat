<script lang="ts" module>
  export const layouts = { variants: "padded", states: "padded" };
</script>

<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import Card from "../../lib/studio/Card.svelte";
  import CardHeader from "../../lib/studio/CardHeader.svelte";
  import CardTitle from "../../lib/studio/CardTitle.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import {
    File02,
    Globe02,
    LayoutAlt01,
    Stars01,
  } from "../../lib/studio/icons";
  import ListRow from "../../lib/studio/ListRow.svelte";
  import Matrix from "../Matrix.svelte";

  let { story }: { story: string } = $props();

  const VARIANTS = ["default", "divided"] as const;
  const CONNECTIONS = [
    { name: "Storefront", calls: "4,120", share: "38.2%" },
    { name: "Analytics", calls: "2,310", share: "21.4%" },
    { name: "CMS", calls: "1,980", share: "18.3%" },
  ];
  const SECTIONS = ["Hero", "Product shelf", "Footer"];
  const STATES = [undefined, "hover", "focus-visible", undefined];
</script>

{#snippet stars()}<Icon icon={Stars01} />{/snippet}
{#snippet globe()}<Icon icon={Globe02} />{/snippet}
{#snippet layout()}<Icon icon={LayoutAlt01} />{/snippet}
{#snippet file()}<Icon icon={File02} />{/snippet}
{#snippet prep()}<Button size="sm" variant="ghost">Prep</Button>{/snippet}

{#if story === "playground"}
  <div class="w-[25rem]">
    <ListRow
      lead={stars}
      title="Black Friday creative review"
      meta="Meeting · 14:00 · prep ready"
      trailing={prep}
    />
  </div>
{:else if story === "variants"}
  <Matrix
    columns={["Default · in a card", "Divided · in a list"]}
    rows={["Row"]}
  >
    {#snippet cell(_row, index)}
      <div class="w-[25rem]">
        <ListRow
          lead={stars}
          title="Black Friday creative review"
          meta="Meeting · 14:00 · prep ready"
          trailing={prep}
          variant={VARIANTS[index]}
        />
        <ListRow
          lead={stars}
          trailing={prep}
          variant={VARIANTS[index]}
          title="Checkout freezes on iOS 17"
          meta="Execute · agent working · step 3 of 5"
        />
      </div>
    {/snippet}
  </Matrix>
{:else if story === "list"}
  <Card class="w-[26rem]">
    <CardHeader>
      <CardTitle>Top connections</CardTitle>
    </CardHeader>
    <div class="-mx-2">
      {#each CONNECTIONS as row (row.name)}
        <ListRow
          variant="divided"
          href="#connection"
          lead={globe}
          title={row.name}
        >
          {#snippet trailing()}
            <span class="tabular-nums flex gap-3 text-sm">
              <span>{row.calls}</span>
              <span class="text-muted-foreground w-12 text-right">
                {row.share}
              </span>
            </span>
          {/snippet}
        </ListRow>
      {/each}
    </div>
  </Card>
{:else if story === "selectable"}
  <div class="flex w-72 flex-col gap-0.5">
    {#each SECTIONS as name, index (name)}
      <ListRow selected={index === 1} lead={layout} title={name}>
        {#snippet child({ props, content })}
          <button type="button" {...props}>{@render content()}</button>
        {/snippet}
      </ListRow>
    {/each}
  </div>
{:else if story === "states"}
  <Matrix columns={["Default", "Hover", "Focus", "Selected"]} rows={VARIANTS}>
    {#snippet cell(variant, index)}
      <div class="w-56">
        <ListRow
          {variant}
          selected={index === 3}
          data-pseudo={STATES[index]}
          lead={file}
          title="Q3 brief.pdf"
          meta="Updated 2h ago"
        >
          {#snippet child({ props, content })}
            <button type="button" {...props}>{@render content()}</button>
          {/snippet}
        </ListRow>
      </div>
    {/snippet}
  </Matrix>
{/if}
