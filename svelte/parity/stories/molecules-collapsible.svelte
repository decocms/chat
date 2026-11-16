<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import Collapsible from "../../lib/studio/Collapsible.svelte";
  import CollapsibleContent from "../../lib/studio/CollapsibleContent.svelte";
  import CollapsibleTrigger from "../../lib/studio/CollapsibleTrigger.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { ChevronDown } from "../../lib/studio/icons";

  let { story }: { story: string } = $props();
</script>

{#if story === "default"}
  <Collapsible class="tw:w-80 tw:space-y-2">
    <div class="tw:flex tw:items-center tw:justify-between">
      <span class="tw:text-sm tw:font-medium">3 pinned projects</span>
      <CollapsibleTrigger>
        {#snippet child({ props })}
          <Button
            {...props}
            variant="ghost"
            size="icon"
            aria-label="Toggle projects"
          >
            <Icon icon={ChevronDown} />
          </Button>
        {/snippet}
      </CollapsibleTrigger>
    </div>
    <div
      class="tw:rounded-md tw:border tw:border-border tw:px-4 tw:py-2 tw:text-sm"
    >
      Storefront redesign
    </div>
    <CollapsibleContent class="tw:space-y-2">
      <div
        class="tw:rounded-md tw:border tw:border-border tw:px-4 tw:py-2 tw:text-sm"
      >
        Checkout experiments
      </div>
      <div
        class="tw:rounded-md tw:border tw:border-border tw:px-4 tw:py-2 tw:text-sm"
      >
        Internal admin tools
      </div>
    </CollapsibleContent>
  </Collapsible>
{:else if story === "open-by-default"}
  <Collapsible open class="tw:w-80 tw:space-y-2">
    <CollapsibleTrigger>
      {#snippet child({ props })}
        <Button
          {...props}
          variant="outline"
          class="tw:w-full tw:justify-between"
        >
          Advanced options <Icon icon={ChevronDown} />
        </Button>
      {/snippet}
    </CollapsibleTrigger>
    <CollapsibleContent
      class="tw:space-y-1 tw:rounded-md tw:border tw:border-border tw:p-4 tw:text-sm tw:text-muted-foreground"
    >
      <p class="tw:text-pretty">Request timeout: 30 seconds</p>
      <p class="tw:text-pretty">Retry policy: exponential backoff</p>
      <p class="tw:text-pretty">Audit logging: enabled</p>
    </CollapsibleContent>
  </Collapsible>
{/if}
