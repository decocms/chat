<script lang="ts" module>
  export const layouts = { states: "padded" };
</script>

<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import { Copy01, Pencil01, Trash01 } from "../../lib/studio/icons";
  import Matrix from "../Matrix.svelte";

  let { story }: { story: string } = $props();

  const STATE_ROWS = {
    "ghost · 28": { variant: "ghost", size: "icon-sm" },
    "ghost · 32": { variant: "ghost", size: "icon" },
    "secondary · 28": { variant: "secondary", size: "icon-sm" },
    "secondary · 32": { variant: "secondary", size: "icon" },
    "outline · 28": { variant: "outline", size: "icon-sm" },
    "outline · 32": { variant: "outline", size: "icon" },
    "primary · 28": { variant: "default", size: "icon-sm" },
    "primary · 32": { variant: "default", size: "icon" },
  } as const;
  const ROWS = [
    "ghost · 28",
    "ghost · 32",
    "secondary · 28",
    "secondary · 32",
    "outline · 28",
    "outline · 32",
    "primary · 28",
    "primary · 32",
  ] as const;
  const STATES = [undefined, "hover", "focus-visible", undefined];
</script>

<!-- Studio's root line height, which the parity page does not inherit. -->
<div class="leading-[1.5]">
  {#if story === "default"}
    <IconButton label="Copy value" variant="ghost" size="icon-sm">
      <Icon icon={Copy01} />
    </IconButton>
  {:else if story === "row-actions"}
    <div
      class="flex items-center gap-1 rounded-lg border border-border px-3 py-2"
    >
      <span class="mr-auto font-mono text-xs">API_BASE_URL</span>
      <IconButton label="Edit value">
        <Icon icon={Pencil01} />
      </IconButton>
      <IconButton label="Delete variable">
        <Icon icon={Trash01} />
      </IconButton>
    </div>
  {:else if story === "states"}
    <Matrix columns={["Default", "Hover", "Focus", "Disabled"]} rows={ROWS}>
      {#snippet cell(row, index)}
        <Button
          variant={STATE_ROWS[row].variant}
          size={STATE_ROWS[row].size}
          data-pseudo={STATES[index]}
          disabled={index === 3}
          aria-label="Edit"
        >
          <Icon icon={Pencil01} />
        </Button>
      {/snippet}
    </Matrix>
  {/if}
</div>
