<script lang="ts">
  import Button from "../../../lib/studio/Button.svelte";
  import Collapsible from "../../../lib/studio/Collapsible.svelte";
  import CollapsibleContent from "../../../lib/studio/CollapsibleContent.svelte";
  import CollapsibleTrigger from "../../../lib/studio/CollapsibleTrigger.svelte";
  import Icon from "../../../lib/studio/Icon.svelte";

  let { story }: { story: string } = $props();
</script>

{#if story === "default"}
  <Collapsible class="w-80 space-y-2">
    <div class="flex items-center justify-between">
      <span class="text-sm font-medium">3 pinned projects</span>
      <CollapsibleTrigger>
        {#snippet child({ props })}
          <Button
            {...props}
            variant="ghost"
            size="icon"
            aria-label="Toggle projects"
          >
            <Icon icon="chevron-down" />
          </Button>
        {/snippet}
      </CollapsibleTrigger>
    </div>
    <div class="rounded-md border border-border px-4 py-2 text-sm">
      Storefront redesign
    </div>
    <CollapsibleContent class="space-y-2">
      <div class="rounded-md border border-border px-4 py-2 text-sm">
        Checkout experiments
      </div>
      <div class="rounded-md border border-border px-4 py-2 text-sm">
        Internal admin tools
      </div>
    </CollapsibleContent>
  </Collapsible>
{:else if story === "open-by-default"}
  <Collapsible open class="w-80 space-y-2">
    <CollapsibleTrigger>
      {#snippet child({ props })}
        <Button {...props} variant="outline" class="w-full justify-between">
          Advanced options <Icon icon="chevron-down" />
        </Button>
      {/snippet}
    </CollapsibleTrigger>
    <CollapsibleContent
      class="space-y-1 rounded-md border border-border p-4 text-sm text-muted-foreground"
    >
      <p class="text-pretty">Request timeout: 30 seconds</p>
      <p class="text-pretty">Retry policy: exponential backoff</p>
      <p class="text-pretty">Audit logging: enabled</p>
    </CollapsibleContent>
  </Collapsible>
{/if}
