<script lang="ts">
  import Button from "../../../lib/studio/Button.svelte";
  import Icon from "../../../lib/studio/Icon.svelte";
  import Tooltip from "../../../lib/studio/Tooltip.svelte";
  import TooltipContent from "../../../lib/studio/TooltipContent.svelte";
  import TooltipTrigger from "../../../lib/studio/TooltipTrigger.svelte";

  let { story }: { story: string } = $props();

  const SIDES = ["top", "right", "bottom", "left"] as const;
</script>

{#if story === "default"}
  <Tooltip>
    <TooltipTrigger>
      {#snippet child({ props })}
        <Button {...props} variant="outline">Hover me</Button>
      {/snippet}
    </TooltipTrigger>
    <TooltipContent>Add a new connection to this project</TooltipContent>
  </Tooltip>
{:else if story === "sides"}
  <div class="flex items-center gap-4">
    {#each SIDES as side (side)}
      <Tooltip>
        <TooltipTrigger>
          {#snippet child({ props })}
            <Button {...props} variant="outline" class="capitalize">
              {side}
            </Button>
          {/snippet}
        </TooltipTrigger>
        <TooltipContent {side}>
          Tooltip on the {side} side
        </TooltipContent>
      </Tooltip>
    {/each}
  </div>
{:else if story === "on-icon-button"}
  <Tooltip>
    <TooltipTrigger>
      {#snippet child({ props })}
        <Button
          {...props}
          variant="ghost"
          size="icon"
          aria-label="Copy API key"
        >
          <Icon icon="copy-01" />
        </Button>
      {/snippet}
    </TooltipTrigger>
    <TooltipContent>Copy API key</TooltipContent>
  </Tooltip>
{/if}
