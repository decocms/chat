<script lang="ts">
  import Label from "../../lib/studio/Label.svelte";
  import Textarea from "../../lib/studio/Textarea.svelte";

  let { story }: { story: string } = $props();

  const PLACEHOLDER = "Describe what this connection is used for...";
</script>

{#if story === "default"}
  <div class="tw:w-96">
    <Textarea placeholder={PLACEHOLDER} />
  </div>
{:else if story === "with-label"}
  <div class="tw:grid tw:w-96 tw:gap-2">
    <Label for="description">Project description</Label>
    <Textarea
      id="description"
      placeholder="A short summary shown on the project card."
    />
    <p class="tw:text-sm tw:text-pretty tw:text-muted-foreground">
      Visible to every member of the organization.
    </p>
  </div>
{:else if story === "with-content"}
  <div class="tw:w-96">
    <Textarea
      value="Handles order lookups and refund requests for the storefront. Escalates anything involving payments to a human agent."
    />
  </div>
{:else if story === "invalid"}
  <div class="tw:grid tw:w-96 tw:gap-2">
    <Label for="prompt">System prompt</Label>
    <Textarea id="prompt" aria-invalid value="" />
    <p class="tw:text-sm tw:text-pretty tw:text-destructive">
      A system prompt is required.
    </p>
  </div>
{:else if story === "disabled"}
  <div class="tw:w-96">
    <Textarea
      placeholder={PLACEHOLDER}
      disabled
      value="This field is managed by your organization admin."
    />
  </div>
{/if}
