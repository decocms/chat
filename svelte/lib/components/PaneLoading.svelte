<script lang="ts">
  import Spinner from "../studio/Spinner.svelte";
  /** A pane with nothing to show yet: one spinner in the middle of it. `label` is read by screen readers only. */
  let { label }: { label: string } = $props();
</script>

<div
  class="flex h-full min-h-40 flex-1 items-center justify-center text-muted-foreground"
>
  <Spinner size="sm" {label} />
</div>
