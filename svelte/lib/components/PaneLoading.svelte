<script lang="ts">
  import Spinner from "../studio/Spinner.svelte";
  /** A pane with nothing to show yet: one spinner in the middle of it. `label` is read by screen readers only. */
  let { label }: { label: string } = $props();
</script>

<div
  class="tw:flex tw:h-full tw:min-h-40 tw:flex-1 tw:items-center tw:justify-center tw:text-muted-foreground"
>
  <Spinner size="sm" {label} />
</div>
