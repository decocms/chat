<script lang="ts">
  import Button from "../../../lib/studio/Button.svelte";
  import Input from "../../../lib/studio/Input.svelte";
  import Label from "../../../lib/studio/Label.svelte";
  import Popover from "../../../lib/studio/Popover.svelte";
  import PopoverContent from "../../../lib/studio/PopoverContent.svelte";
  import PopoverTrigger from "../../../lib/studio/PopoverTrigger.svelte";

  let { story }: { story: string } = $props();

  const ALIGNMENTS = ["start", "center", "end"] as const;
</script>

{#if story === "default"}
  <Popover>
    <PopoverTrigger>
      {#snippet child({ props })}
        <Button {...props} variant="outline">API rate limits</Button>
      {/snippet}
    </PopoverTrigger>
    <PopoverContent>
      <div class="grid gap-4">
        <div class="grid gap-1">
          <h4 class="leading-none font-medium text-balance">Rate limits</h4>
          <p class="text-sm text-pretty text-muted-foreground">
            Requests per minute allowed for this API key.
          </p>
        </div>
        <div class="grid gap-2">
          <div class="grid grid-cols-3 items-center gap-4">
            <Label for="rpm">Requests</Label>
            <Input id="rpm" value="600" class="col-span-2 h-8" />
          </div>
          <div class="grid grid-cols-3 items-center gap-4">
            <Label for="burst">Burst</Label>
            <Input id="burst" value="100" class="col-span-2 h-8" />
          </div>
        </div>
      </div>
    </PopoverContent>
  </Popover>
{:else if story === "alignment"}
  <div class="flex gap-2">
    {#each ALIGNMENTS as align (align)}
      <Popover>
        <PopoverTrigger>
          {#snippet child({ props })}
            <Button {...props} variant="outline" class="capitalize">
              Align {align}
            </Button>
          {/snippet}
        </PopoverTrigger>
        <PopoverContent {align} class="w-56">
          <p class="text-sm text-pretty">
            This popover is aligned to the {align} of its trigger.
          </p>
        </PopoverContent>
      </Popover>
    {/each}
  </div>
{/if}
