<script lang="ts" module>
  export const layouts = { states: "padded" };
</script>

<script lang="ts">
  import Icon from "../../lib/studio/Icon.svelte";
  import { Bold01, Italic01, Underline01 } from "../../lib/studio/icons";
  import Toggle from "../../lib/studio/Toggle.svelte";
  import Matrix from "../Matrix.svelte";

  let { story }: { story: string } = $props();

  const ROWS = ["default", "outline"] as const;
  const STATES = [undefined, "hover", "focus-visible", undefined, undefined];
</script>

{#if story === "default"}
  <Toggle variant="default" size="default">Bold</Toggle>
{:else if story === "variants"}
  <div class="flex items-center gap-2">
    <Toggle aria-label="Toggle bold">
      <Icon icon={Bold01} /> Bold
    </Toggle>
    <Toggle variant="outline" aria-label="Toggle italic">
      <Icon icon={Italic01} /> Italic
    </Toggle>
  </div>
{:else if story === "sizes"}
  <div class="flex items-center gap-2">
    <Toggle size="sm" variant="outline">Small</Toggle>
    <Toggle size="default" variant="outline">Default</Toggle>
    <Toggle size="lg" variant="outline">Large</Toggle>
  </div>
{:else if story === "pressed"}
  <Toggle variant="default" size="default" pressed>
    <Icon icon={Underline01} /> Underline
  </Toggle>
{:else if story === "disabled"}
  <Toggle variant="default" size="default" disabled>Unavailable</Toggle>
{:else if story === "states"}
  <Matrix
    columns={["Default", "Hover", "Focus", "Pressed", "Disabled"]}
    rows={ROWS}
  >
    {#snippet cell(variant, index)}
      <Toggle
        {variant}
        data-pseudo={STATES[index]}
        pressed={index === 3}
        disabled={index === 4}
        aria-label="Bold"
      >
        <Icon icon={Bold01} /> Bold
      </Toggle>
    {/snippet}
  </Matrix>
{/if}
