<script lang="ts">
  import Label from "../../lib/studio/Label.svelte";
  import PasswordInput from "../../lib/studio/PasswordInput.svelte";

  let { story }: { story: string } = $props();

  let value = $state("a-very-secret-value");
</script>

{#if story === "default"}
  <div class="grid w-96 gap-2">
    <Label for="api-key">API key</Label>
    <PasswordInput id="api-key" bind:value />
    <p class="text-sm text-pretty text-muted-foreground">
      Use the buttons to reveal or copy the token.
    </p>
  </div>
{:else if story === "empty"}
  <div class="w-96">
    <PasswordInput value="" placeholder="Paste your access token" />
  </div>
{/if}
