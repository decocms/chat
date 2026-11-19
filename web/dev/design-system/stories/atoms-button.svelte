<script lang="ts" module>
  export const layouts = { states: "padded", "sizes-matrix": "padded" };
</script>

<script lang="ts">
  import AgentAvatar from "../../../lib/studio/AgentAvatar.svelte";
  import Button from "../../../lib/studio/Button.svelte";
  import Icon from "../../../lib/studio/Icon.svelte";
  import Matrix from "../Matrix.svelte";

  let { story }: { story: string } = $props();

  const AGENT_FACE =
    "https://assets.decocache.com/decocms/fd07a578-6b1c-40f1-bc05-88a3b981695d/f7fc4ffa81aec04e37ae670c3cd4936643a7b269.png";
  const STATE_ROWS = [
    "default",
    "secondary",
    "outline",
    "ghost",
    "destructive",
    "brand",
    "agent",
  ] as const;
  const STATES = [undefined, "hover", "focus-visible", "active", undefined];
  const SIZE_ROWS = ["default", "secondary", "outline"] as const;
  const SIZES = ["sm", "default", "lg"] as const;
</script>

{#if story === "default"}
  <Button>Button</Button>
{:else if story === "disabled"}
  <Button disabled>Button</Button>
{:else if story === "variants"}
  <div class="flex flex-wrap items-center gap-2">
    <Button>Default</Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="outline">Outline</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="destructive">Destructive</Button>
    <Button variant="success">Success</Button>
    <Button variant="warning">Warning</Button>
    <Button variant="brand">Brand</Button>
    <Button variant="special">Special</Button>
    <Button variant="link">Link</Button>
  </div>
{:else if story === "sizes"}
  <div class="flex flex-wrap items-center gap-2">
    <Button size="xs">Extra small</Button>
    <Button size="sm">Small</Button>
    <Button size="default">Default</Button>
    <Button size="lg">Large</Button>
    <Button size="icon" aria-label="Add"><Icon icon="plus" /></Button>
  </div>
{:else if story === "with-icon"}
  <div class="flex flex-wrap items-center gap-2">
    <Button><Icon icon="plus" /> New item</Button>
    <Button variant="outline">Continue <Icon icon="arrow-right" /></Button>
    <Button variant="destructive"><Icon icon="trash-01" /> Delete</Button>
  </div>
{:else if story === "agent"}
  <div class="flex items-center gap-2">
    <Button variant="agent" size="sm"
      ><AgentAvatar src={AGENT_FACE} size={20} /> Ask</Button
    >
    <Button variant="agent"
      ><AgentAvatar src={AGENT_FACE} size={26} /> Ask</Button
    >
    <Button variant="agent" size="lg"
      ><AgentAvatar src={AGENT_FACE} size={32} /> Ask</Button
    >
  </div>
{:else if story === "states"}
  <Matrix
    columns={["Default", "Hover", "Focus", "Pressed", "Disabled"]}
    proposed={["Pressed"]}
    rows={STATE_ROWS}
    labels={{ default: "primary" }}
  >
    {#snippet cell(variant, index)}
      <Button {variant} data-pseudo={STATES[index]} disabled={index === 4}>
        {#if variant === "agent"}
          <AgentAvatar src={AGENT_FACE} size={26} /> Ask
        {:else}
          New task
        {/if}
      </Button>
    {/snippet}
  </Matrix>
{:else if story === "sizes-matrix"}
  <Matrix
    columns={["sm · 28", "default · 32", "lg · 40"]}
    rows={SIZE_ROWS}
    labels={{ default: "primary" }}
  >
    {#snippet cell(variant, index)}
      <Button {variant} size={SIZES[index]}
        ><Icon icon="plus" /> New task</Button
      >
    {/snippet}
  </Matrix>
{/if}
