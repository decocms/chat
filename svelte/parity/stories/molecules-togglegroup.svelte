<script lang="ts" module>
  export const layouts = { states: "padded" };
</script>

<script lang="ts">
  import Icon from "../../lib/studio/Icon.svelte";
  import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    Bold01,
    Grid01,
    Italic01,
    List,
    Underline01,
  } from "../../lib/studio/icons";
  import ToggleGroup from "../../lib/studio/ToggleGroup.svelte";
  import ToggleGroupItem from "../../lib/studio/ToggleGroupItem.svelte";
  import Matrix from "../Matrix.svelte";

  let { story }: { story: string } = $props();

  const ROWS = ["default", "sm"] as const;
  const STATES = [undefined, "hover", "focus-visible"];
</script>

{#if story === "default"}
  <ToggleGroup type="multiple" variant="default" size="default">
    <ToggleGroupItem value="bold" aria-label="Toggle bold" iconOnly>
      <Icon icon={Bold01} />
    </ToggleGroupItem>
    <ToggleGroupItem value="italic" aria-label="Toggle italic" iconOnly>
      <Icon icon={Italic01} />
    </ToggleGroupItem>
    <ToggleGroupItem value="underline" aria-label="Toggle underline" iconOnly>
      <Icon icon={Underline01} />
    </ToggleGroupItem>
  </ToggleGroup>
{:else if story === "single-selection"}
  <ToggleGroup type="single" value="left" variant="outline">
    <ToggleGroupItem value="left" aria-label="Align left" iconOnly>
      <Icon icon={AlignLeft} />
    </ToggleGroupItem>
    <ToggleGroupItem value="center" aria-label="Align center" iconOnly>
      <Icon icon={AlignCenter} />
    </ToggleGroupItem>
    <ToggleGroupItem value="right" aria-label="Align right" iconOnly>
      <Icon icon={AlignRight} />
    </ToggleGroupItem>
  </ToggleGroup>
{:else if story === "outline"}
  <ToggleGroup type="single" value="month" variant="outline">
    <ToggleGroupItem value="day">Day</ToggleGroupItem>
    <ToggleGroupItem value="week">Week</ToggleGroupItem>
    <ToggleGroupItem value="month">Month</ToggleGroupItem>
  </ToggleGroup>
{:else if story === "sizes"}
  <div class="flex flex-col items-start gap-4">
    <ToggleGroup type="single" size="sm" variant="outline">
      <ToggleGroupItem value="list">List</ToggleGroupItem>
      <ToggleGroupItem value="grid">Grid</ToggleGroupItem>
    </ToggleGroup>
    <ToggleGroup type="single" size="default" variant="outline">
      <ToggleGroupItem value="list">List</ToggleGroupItem>
      <ToggleGroupItem value="grid">Grid</ToggleGroupItem>
    </ToggleGroup>
    <ToggleGroup type="single" size="lg" variant="outline">
      <ToggleGroupItem value="list">List</ToggleGroupItem>
      <ToggleGroupItem value="grid">Grid</ToggleGroupItem>
    </ToggleGroup>
  </div>
{:else if story === "disabled"}
  <ToggleGroup type="multiple" variant="outline" disabled>
    <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
    <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
  </ToggleGroup>
{:else if story === "segmented"}
  <div class="flex flex-col items-start gap-3">
    <ToggleGroup type="single" variant="segmented" value="preview">
      <ToggleGroupItem value="preview">Preview</ToggleGroupItem>
      <ToggleGroupItem value="code">Code</ToggleGroupItem>
    </ToggleGroup>
    <ToggleGroup type="single" variant="segmented" size="sm" value="all">
      <ToggleGroupItem value="all">All</ToggleGroupItem>
      <ToggleGroupItem value="dev">Dev</ToggleGroupItem>
      <ToggleGroupItem value="content">Content</ToggleGroupItem>
      <ToggleGroupItem value="design">Design</ToggleGroupItem>
    </ToggleGroup>
  </div>
{:else if story === "states"}
  <Matrix
    columns={["Default", "Hover on Code", "Focus on Code"]}
    rows={ROWS}
    labels={{ default: "segmented · 32", sm: "segmented · 28" }}
  >
    {#snippet cell(size, index)}
      <ToggleGroup type="single" variant="segmented" {size} value="preview">
        <ToggleGroupItem value="preview">Preview</ToggleGroupItem>
        <ToggleGroupItem value="code" data-pseudo={STATES[index]}>
          Code
        </ToggleGroupItem>
      </ToggleGroup>
    {/snippet}
  </Matrix>
{:else if story === "icons"}
  <ToggleGroup type="single" variant="segmented" size="sm" value="grid">
    <ToggleGroupItem value="grid" tooltip="Grid view" iconOnly>
      <Icon icon={Grid01} />
    </ToggleGroupItem>
    <ToggleGroupItem value="list" tooltip="List view" iconOnly>
      <Icon icon={List} />
    </ToggleGroupItem>
  </ToggleGroup>
{:else if story === "icon-and-label"}
  <ToggleGroup type="single" variant="segmented" size="sm" value="project">
    <ToggleGroupItem value="project">
      <Icon icon={Grid01} /> Project
    </ToggleGroupItem>
    <ToggleGroupItem value="files">
      <Icon icon={List} /> Files
    </ToggleGroupItem>
  </ToggleGroup>
{/if}
