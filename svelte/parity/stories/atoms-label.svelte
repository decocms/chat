<script lang="ts">
  import Checkbox from "../../lib/studio/Checkbox.svelte";
  import Input from "../../lib/studio/Input.svelte";
  import Label from "../../lib/studio/Label.svelte";

  let { story }: { story: string } = $props();
</script>

{#if story === "default"}
  <Label>Email address</Label>
{:else if story === "with-input"}
  <div class="grid w-80 gap-2">
    <Label for="email">Email address</Label>
    <Input id="email" type="email" placeholder="ana@example.com" />
  </div>
{:else if story === "with-checkbox"}
  <div class="flex items-center gap-2">
    <Checkbox id="marketing" />
    <Label for="marketing">Send me product updates</Label>
  </div>
{:else if story === "with-disabled-peer"}
  <div class="flex items-center gap-2">
    <Checkbox id="sso" disabled />
    <Label for="sso">Require SSO (managed by your plan)</Label>
  </div>
{/if}
