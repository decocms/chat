<script lang="ts">
  import { onMount } from "svelte";
  import Textarea from "../lib/studio/Textarea.svelte";
  let { mounted }: { mounted(): void } = $props();
  let draft = $state("");
  onMount(() => {
    mounted();
  });
</script>

<section data-layout-fixture-board class="flex min-h-0 flex-1 flex-col gap-2">
  <label for="layout-fixture-board-draft">Retained Board draft</label>
  <Textarea id="layout-fixture-board-draft" bind:value={draft} />
  <output data-layout-fixture-board-value>{draft}</output>
</section>
